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

export async function createMillReception(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar la recepción en molino." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mill_receptions").insert({
    purchase_lot_id: lotId,
    received_at: str(formData, "received_at") ? new Date(str(formData, "received_at")).toISOString() : null,
    supervisor_name: str(formData, "supervisor_name") || null,
    storage_location: str(formData, "storage_location") || null,
    incidents: str(formData, "incidents") || null,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await advanceLotStatus(supabase, lotId, "recibido_molino", profile.id);

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteMillReception(lotId: string, receptionId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  await supabase.from("mill_receptions").delete().eq("id", receptionId);
  revalidatePath(`/lotes/${lotId}`);
}

export async function createComminution(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar la conminución." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("comminutions").insert({
    purchase_lot_id: lotId,
    started_at: str(formData, "started_at") ? new Date(str(formData, "started_at")).toISOString() : null,
    finished_at: str(formData, "finished_at") ? new Date(str(formData, "finished_at")).toISOString() : null,
    processed_tons: num(formData, "processed_tons"),
    mill_invoice_number: str(formData, "mill_invoice_number") || null,
    tariff_pen_per_ton: num(formData, "tariff_pen_per_ton"),
    responsible_name: str(formData, "responsible_name") || null,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await advanceLotStatus(supabase, lotId, "conminuido", profile.id);

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteComminution(lotId: string, comminutionId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  await supabase.from("comminutions").delete().eq("id", comminutionId);
  revalidatePath(`/lotes/${lotId}`);
}

export async function addBigBag(
  lotId: string,
  comminutionId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar big bags." };
  }

  const weight = num(formData, "weight_kg");
  const supabase = await createClient();

  const { data: lot } = await supabase
    .from("purchase_lots")
    .select("code")
    .eq("id", lotId)
    .maybeSingle();
  if (!lot) return { error: "No se encontró el lote." };

  const { count } = await supabase
    .from("big_bags")
    .select("id", { count: "exact", head: true })
    .eq("purchase_lot_id", lotId);

  const seq = (count ?? 0) + 1;
  const code = `GIN-${lot.code}-BB${String(seq).padStart(2, "0")}`;

  const { error } = await supabase.from("big_bags").insert({
    code,
    purchase_lot_id: lotId,
    comminution_id: comminutionId,
    weight_kg: weight,
    storage_location: str(formData, "storage_location") || null,
    created_by: profile.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Se generó un código duplicado, probá guardar de nuevo." };
    }
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteBigBag(lotId: string, bagId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  await supabase.from("big_bags").delete().eq("id", bagId);
  revalidatePath(`/lotes/${lotId}`);
}

export async function createLabAnalysis(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar resultados de laboratorio." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lab_analyses").insert({
    purchase_lot_id: lotId,
    sampled_at: str(formData, "sampled_at") ? new Date(str(formData, "sampled_at")).toISOString() : null,
    analyzed_at: str(formData, "analyzed_at") ? new Date(str(formData, "analyzed_at")).toISOString() : null,
    lab_name: str(formData, "lab_name") || null,
    report_number: str(formData, "report_number") || null,
    au_gt: num(formData, "au_gt"),
    ag_gt: num(formData, "ag_gt"),
    pb_pct: num(formData, "pb_pct"),
    as_pct: num(formData, "as_pct"),
    sb_pct: num(formData, "sb_pct"),
    s_pct: num(formData, "s_pct"),
    humidity_pct: num(formData, "humidity_pct"),
    notes: str(formData, "notes") || null,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await advanceLotStatus(supabase, lotId, "en_laboratorio", profile.id);

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteLabAnalysis(lotId: string, analysisId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  await supabase.from("lab_analyses").delete().eq("id", analysisId);
  revalidatePath(`/lotes/${lotId}`);
}
