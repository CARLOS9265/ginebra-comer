"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

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

export async function updateScheduleStatus(id: string, status: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  await supabase.from("truck_schedule").update({ status }).eq("id", id);
  revalidatePath("/calendario");
}

export async function deleteSchedule(id: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  await supabase.from("truck_schedule").delete().eq("id", id);
  revalidatePath("/calendario");
}
