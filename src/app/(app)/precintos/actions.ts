"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type SealFormState = { error?: string } | null;

// Debe coincidir con las políticas RLS de `seals` en 0001_init.sql.
const ALLOWED_ROLES = ["operaciones", "calidad", "gerencia", "administrador"];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createSeal(
  _prevState: SealFormState,
  formData: FormData,
): Promise<SealFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar precintos." };
  }

  const code = str(formData, "code").toUpperCase();
  const lotId = str(formData, "purchase_lot_id") || null;
  if (!code) return { error: "Ingresá el código del precinto." };

  const supabase = await createClient();
  const { error } = await supabase.from("seals").insert({
    code,
    purchase_lot_id: lotId,
    status: lotId ? "colocado" : "disponible",
    updated_by: profile.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un precinto con el código "${code}".` };
    }
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/precintos");
  return null;
}

export async function assignSealToLot(sealId: string, lotId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar precintos." };
  }
  if (!lotId) return { error: "Elegí un lote." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("seals")
    .update({ purchase_lot_id: lotId, status: "colocado", updated_by: profile.id })
    .eq("id", sealId)
    .eq("status", "disponible");

  if (error) return { error: error.message };
  revalidatePath("/precintos");
  return null;
}

export async function verifySeal(sealId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede verificar precintos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("seals")
    .update({ status: "verificado", updated_by: profile.id })
    .eq("id", sealId)
    .eq("status", "colocado");

  if (error) return { error: error.message };
  revalidatePath("/precintos");
  return null;
}

export async function openSeal(sealId: string, reason: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede abrir precintos." };
  }
  if (!reason.trim()) return { error: "Ingresá el motivo de apertura." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("seals")
    .update({
      status: "abierto",
      opened_reason: reason.trim(),
      opened_by: profile.id,
      updated_by: profile.id,
    })
    .eq("id", sealId)
    .in("status", ["colocado", "verificado"]);

  if (error) return { error: error.message };
  revalidatePath("/precintos");
  return null;
}

export async function voidSeal(sealId: string, reason: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede anular precintos." };
  }
  if (!reason.trim()) return { error: "Ingresá el motivo de anulación." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("seals")
    .update({
      status: "anulado",
      opened_reason: reason.trim(),
      opened_by: profile.id,
      updated_by: profile.id,
    })
    .eq("id", sealId)
    .neq("status", "anulado");

  if (error) return { error: error.message };
  revalidatePath("/precintos");
  return null;
}

export async function deleteSeal(sealId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return;

  const supabase = await createClient();
  await supabase.from("seals").delete().eq("id", sealId).eq("status", "disponible");

  revalidatePath("/precintos");
}
