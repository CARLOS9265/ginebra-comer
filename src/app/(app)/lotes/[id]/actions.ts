"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { LOT_STATUS_ORDER, type LotStatus } from "@/lib/lot-status";

export type LogisticsFormState = { error?: string } | null;

// Debe coincidir con las políticas RLS de transport_events/weighings en 0001_init.sql.
const ALLOWED_ROLES = ["operaciones", "calidad", "gerencia", "administrador"];

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function advanceLotStatus(
  supabase: SupabaseClient,
  lotId: string,
  minStatus: LotStatus,
  profileId: string,
) {
  const { data: lot } = await supabase
    .from("purchase_lots")
    .select("status")
    .eq("id", lotId)
    .maybeSingle();
  if (!lot) return;

  const currentIdx = LOT_STATUS_ORDER.indexOf(lot.status as LotStatus);
  const targetIdx = LOT_STATUS_ORDER.indexOf(minStatus);
  if (targetIdx > currentIdx) {
    await supabase
      .from("purchase_lots")
      .update({ status: minStatus, updated_by: profileId })
      .eq("id", lotId);
  }
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createTransportEvent(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar transporte." };
  }

  const departedAt = str(formData, "departed_at");
  const supabase = await createClient();

  const { error } = await supabase.from("transport_events").insert({
    purchase_lot_id: lotId,
    departed_at: departedAt ? new Date(departedAt).toISOString() : null,
    carrier_name: str(formData, "carrier_name") || null,
    tariff_pen_per_tmh: num(formData, "tariff_pen_per_tmh"),
    security_group_code: str(formData, "security_group_code") || null,
    security_cost_pen: num(formData, "security_cost_pen"),
    estimated_arrival: str(formData, "estimated_arrival")
      ? new Date(str(formData, "estimated_arrival")).toISOString()
      : null,
    incidents: str(formData, "incidents") || null,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  if (departedAt) {
    await advanceLotStatus(supabase, lotId, "en_transito", profile.id);
  }

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteTransportEvent(lotId: string, eventId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  await supabase.from("transport_events").delete().eq("id", eventId);
  revalidatePath(`/lotes/${lotId}`);
}

export async function createWeighing(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar pesajes." };
  }

  const type = str(formData, "type");
  if (!["inicial", "oficial", "regularizacion"].includes(type)) {
    return { error: "Elegí un tipo de pesaje válido." };
  }

  const gross = num(formData, "gross_weight");
  const tare = num(formData, "tare_weight");
  const netInput = num(formData, "net_weight");
  const net = netInput ?? (gross != null && tare != null ? gross - tare : null);

  const supabase = await createClient();
  const { error } = await supabase.from("weighings").insert({
    purchase_lot_id: lotId,
    type,
    gross_weight: gross,
    tare_weight: tare,
    net_weight: net,
    ticket_number: str(formData, "ticket_number") || null,
    weighed_at: str(formData, "weighed_at") ? new Date(str(formData, "weighed_at")).toISOString() : null,
    reason: str(formData, "reason") || null,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  if (type === "oficial") {
    await advanceLotStatus(supabase, lotId, "pesado", profile.id);
  }

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteWeighing(lotId: string, weighingId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  await supabase.from("weighings").delete().eq("id", weighingId);
  revalidatePath(`/lotes/${lotId}`);
}
