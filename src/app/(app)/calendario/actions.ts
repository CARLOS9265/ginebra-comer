"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { LOT_CODE_PREFIX, buildLotCode } from "@/lib/lot-code";

export type ScheduleFormState = { error?: string } | null;

const ALLOWED_ROLES = ["operaciones", "compras", "comercial", "gerencia", "administrador"];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createSchedule(
  _prevState: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede programar volquetes." };
  }

  const type = str(formData, "type");
  const scheduledDate = str(formData, "scheduled_date");
  if (!scheduledDate || (type !== "compra" && type !== "despacho")) {
    return { error: "Completá al menos el tipo y la fecha." };
  }
  if (type === "compra" && !str(formData, "provider_id")) {
    return { error: "Elegí el proveedor del que viene el volquete." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("truck_schedule").insert({
    type,
    scheduled_date: scheduledDate,
    scheduled_time: str(formData, "scheduled_time") || null,
    provider_id: type === "compra" ? str(formData, "provider_id") || null : null,
    destination: type === "despacho" ? str(formData, "destination") || "PY - Lima" : null,
    estimated_big_bags:
      type === "despacho" && str(formData, "estimated_big_bags")
        ? Number(formData.get("estimated_big_bags"))
        : null,
    truck_plate: str(formData, "truck_plate") || null,
    carrier_name: str(formData, "carrier_name") || null,
    notes: str(formData, "notes") || null,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/calendario");
  return null;
}

export async function updateSchedule(
  id: string,
  type: "compra" | "despacho",
  _prevState: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar programaciones." };
  }

  if (type === "compra" && !str(formData, "provider_id")) {
    return { error: "Elegí el proveedor del que viene el volquete." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("truck_schedule")
    .update({
      scheduled_time: str(formData, "scheduled_time") || null,
      provider_id: type === "compra" ? str(formData, "provider_id") || null : null,
      destination: type === "despacho" ? str(formData, "destination") || "PY - Lima" : null,
      estimated_big_bags:
        type === "despacho" && str(formData, "estimated_big_bags")
          ? Number(formData.get("estimated_big_bags"))
          : null,
      truck_plate: str(formData, "truck_plate") || null,
      carrier_name: str(formData, "carrier_name") || null,
      notes: str(formData, "notes") || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/calendario");
  return null;
}

export type UpdateStatusResult = { error?: string; createdLotCode?: string };

export async function updateScheduleStatus(id: string, status: string): Promise<UpdateStatusResult> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede cambiar el estado." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("truck_schedule").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  let createdLotCode: string | undefined;
  if (status === "confirmado") {
    createdLotCode = (await createPurchaseLotForSchedule(supabase, id, profile.id)) ?? undefined;
  }

  revalidatePath("/calendario");
  revalidatePath("/lotes");
  return { createdLotCode };
}

// Al confirmar un volquete de compra, se genera el lote automáticamente (en estado
// "creado", solo con lo que ya se sabía en la programación) para que operaciones no
// tenga que cargarlo de nuevo a mano — el peso real, precio y demás se completan
// después en el detalle del lote, igual que si se hubiese creado a mano.
async function createPurchaseLotForSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scheduleId: string,
  profileId: string,
): Promise<string | null> {
  const { data: item } = await supabase
    .from("truck_schedule")
    .select("type, purchase_lot_id, provider_id, scheduled_date, scheduled_time, truck_plate, carrier_name")
    .eq("id", scheduleId)
    .maybeSingle();

  if (!item || item.type !== "compra" || item.purchase_lot_id || !item.provider_id) return null;

  const loadedAt = new Date(`${item.scheduled_date}T${item.scheduled_time ?? "00:00"}`);
  const year = loadedAt.getFullYear();

  // Correlativo único de Ginebra, compartido entre todos los proveedores.
  const { data: seq, error: seqError } = await supabase.rpc("next_lot_seq", {
    p_provider_code: LOT_CODE_PREFIX,
    p_year: year,
  });
  if (seqError || seq == null) return null;

  const code = buildLotCode(year, seq);

  const { data: lot, error: insertError } = await supabase
    .from("purchase_lots")
    .insert({
      code,
      provider_id: item.provider_id,
      loaded_at: loadedAt.toISOString(),
      truck_plate: item.truck_plate,
      carrier_name: item.carrier_name,
      status: "creado",
      created_by: profileId,
      updated_by: profileId,
    })
    .select("id")
    .single();

  if (insertError || !lot) return null;

  await supabase.from("truck_schedule").update({ purchase_lot_id: lot.id }).eq("id", scheduleId);
  return code;
}

export async function deleteSchedule(id: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  await supabase.from("truck_schedule").delete().eq("id", id);
  revalidatePath("/calendario");
}
