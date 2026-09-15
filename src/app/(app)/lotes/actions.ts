"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getLiveGoldSilver } from "@/lib/live-metal-prices";
import { todayISO } from "@/lib/calendar";
import { LOT_CODE_PREFIX, buildLotCode } from "@/lib/lot-code";

export type LotFormState = { error?: string } | null;

export type DatePriceResult = {
  gold: number | null;
  silver: number | null;
  lead: number | null;
  referencePct: number;
  isLive: boolean;
  found: boolean;
};

// Precio de referencia para una fecha puntual (no necesariamente hoy) — para
// el selector de fecha del formulario de lote: el pago provisional de un
// lote debería usar el precio del día al que corresponde, no siempre "hoy".
// Si es la fecha de hoy, se intenta el precio en vivo igual que en la carga
// inicial del formulario; si no, se usa exclusivamente el snapshot guardado
// para esa fecha exacta (sin caer a "el más reciente" — si no se cargó ese
// día, se avisa en vez de mostrar un precio de otro día sin decirlo).
export async function getPricesForDate(dateStr: string): Promise<DatePriceResult> {
  const { profile } = await getCurrentUser();
  if (!profile?.active) {
    return { gold: null, silver: null, lead: null, referencePct: 40, isLive: false, found: false };
  }

  const supabase = await createClient();
  const [{ data: snapshot }, live] = await Promise.all([
    supabase
      .from("daily_metal_prices")
      .select("gold_usd_oz, silver_usd_oz, lead_usd_ton, reference_pct")
      .eq("price_date", dateStr)
      .maybeSingle(),
    dateStr === todayISO() ? getLiveGoldSilver() : Promise.resolve({ gold: null, silver: null }),
  ]);

  const gold = live.gold ?? snapshot?.gold_usd_oz ?? null;
  const silver = live.silver ?? snapshot?.silver_usd_oz ?? null;

  return {
    gold,
    silver,
    lead: snapshot?.lead_usd_ton ?? null,
    referencePct: snapshot?.reference_pct ?? 40,
    isLive: live.gold != null && live.silver != null,
    found: snapshot != null || (live.gold != null && live.silver != null),
  };
}

const ALLOWED_ROLES = ["operaciones", "compras", "gerencia", "administrador"];

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function buildLotFields(formData: FormData, profileId: string) {
  const tmh = num(formData, "estimated_weight_tmh");
  const precioProvisional = num(formData, "provisional_price_per_tmh");

  const fields = {
    provider_id: str(formData, "provider_id") || null,
    concession: str(formData, "concession") || null,
    truck_plate: str(formData, "truck_plate") || null,
    carrier_name: str(formData, "carrier_name") || null,
    estimated_weight_tmh: tmh,
    provisional_price_per_tmh: precioProvisional,
    initial_guide_number: str(formData, "initial_guide_number") || null,
    initial_invoice_number: str(formData, "initial_invoice_number") || null,
    estimated_au: num(formData, "estimated_au"),
    estimated_ag: num(formData, "estimated_ag"),
    estimated_pb: num(formData, "estimated_pb"),
    estimated_price_au: num(formData, "estimated_price_au"),
    estimated_price_ag: num(formData, "estimated_price_ag"),
    estimated_price_pb: num(formData, "estimated_price_pb"),
    updated_by: profileId,
  };

  return { tmh, precioProvisional, fields };
}

export async function createPurchaseLot(
  _prevState: LotFormState,
  formData: FormData,
): Promise<LotFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar lotes de compra." };
  }

  const providerId = str(formData, "provider_id");
  const loadedAt = str(formData, "loaded_at");

  const supabase = await createClient();
  const { tmh, precioProvisional, fields } = buildLotFields(formData, profile.id);

  if (!providerId || !loadedAt || !tmh || precioProvisional == null) {
    return {
      error: "Completá proveedor, fecha/hora de carga, peso estimado y precio provisional.",
    };
  }

  // Correlativo único de Ginebra, compartido entre todos los proveedores (no
  // se diferencia por empresa) — a pedido del usuario.
  const year = new Date(loadedAt).getFullYear();
  const { data: seq, error: seqError } = await supabase.rpc("next_lot_seq", {
    p_provider_code: LOT_CODE_PREFIX,
    p_year: year,
  });
  if (seqError || seq == null) {
    return { error: "No se pudo generar el código del lote. Probá de nuevo." };
  }
  const code = buildLotCode(year, seq);

  const { data: lot, error: insertError } = await supabase
    .from("purchase_lots")
    .insert({
      ...fields,
      code,
      loaded_at: new Date(loadedAt).toISOString(),
      created_by: profile.id,
      status: "creado",
    })
    .select("id")
    .single();

  if (insertError || !lot) {
    return { error: `No se pudo guardar el lote: ${insertError?.message ?? "error desconocido"}` };
  }

  redirect(`/lotes?creado=${code}`);
}

export async function updatePurchaseLot(
  lotId: string,
  _prevState: LotFormState,
  formData: FormData,
): Promise<LotFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar lotes de compra." };
  }

  const loadedAt = str(formData, "loaded_at");
  const code = str(formData, "code").toUpperCase();
  const supabase = await createClient();
  const { tmh, precioProvisional, fields } = buildLotFields(formData, profile.id);

  if (!code || !fields.provider_id || !loadedAt || !tmh || precioProvisional == null) {
    return {
      error: "Completá código, proveedor, fecha/hora de carga, peso estimado y precio provisional.",
    };
  }

  const { data: lot, error: updateError } = await supabase
    .from("purchase_lots")
    .update({ ...fields, code, loaded_at: new Date(loadedAt).toISOString() })
    .eq("id", lotId)
    .select("code")
    .single();

  if (updateError || !lot) {
    if (updateError?.code === "23505") {
      return { error: `Ya existe otro lote con el código "${code}".` };
    }
    return { error: `No se pudo guardar: ${updateError?.message ?? "error desconocido"}` };
  }

  redirect(`/lotes?editado=${lot.code}`);
}

export async function deletePurchaseLot(lotId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  const { data: lot } = await supabase
    .from("purchase_lots")
    .select("status")
    .eq("id", lotId)
    .maybeSingle();
  if (!lot || lot.status !== "creado") return;

  await supabase.from("purchase_lots").delete().eq("id", lotId);

  revalidatePath("/lotes");
}
