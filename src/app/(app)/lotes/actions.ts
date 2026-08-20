"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type LotFormState = { error?: string } | null;

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
    reference_price_usd: num(formData, "reference_price_usd"),
    provisional_price_per_tmh: precioProvisional,
    advance_pct: num(formData, "advance_pct"),
    initial_guide_number: str(formData, "initial_guide_number") || null,
    initial_invoice_number: str(formData, "initial_invoice_number") || null,
    estimated_au: num(formData, "estimated_au"),
    estimated_ag: num(formData, "estimated_ag"),
    estimated_pb: num(formData, "estimated_pb"),
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
  const providerCode = str(formData, "provider_code");
  const loadedAt = str(formData, "loaded_at");

  const supabase = await createClient();
  const { tmh, precioProvisional, fields } = buildLotFields(formData, profile.id);

  if (!providerId || !providerCode || !loadedAt || !tmh || precioProvisional == null) {
    return {
      error: "Completá proveedor, fecha/hora de carga, peso estimado y precio provisional.",
    };
  }

  const year = new Date(loadedAt).getFullYear();
  const { data: seq, error: seqError } = await supabase.rpc("next_lot_seq", {
    p_provider_code: providerCode,
    p_year: year,
  });
  if (seqError || seq == null) {
    return { error: "No se pudo generar el código del lote. Probá de nuevo." };
  }
  const code = `${providerCode}-${String(year).slice(-2)}-${String(seq).padStart(2, "0")}`;

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

  const sealsRaw = str(formData, "seals");
  const sealCodes = sealsRaw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sealCodes.length > 0) {
    const { error: sealsError } = await supabase.from("seals").insert(
      sealCodes.map((code) => ({
        code,
        purchase_lot_id: lot.id,
        status: "colocado",
        updated_by: profile.id,
      })),
    );
    if (sealsError) {
      return {
        error: `El lote ${code} se guardó, pero hubo un error con los precintos: ${sealsError.message}`,
      };
    }
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

  await supabase.from("seals").delete().eq("purchase_lot_id", lotId);
  await supabase.from("purchase_lots").delete().eq("id", lotId);

  revalidatePath("/lotes");
}
