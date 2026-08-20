"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type ProviderFormState = { error?: string } | null;

const ALLOWED_ROLES = ["compras", "gerencia", "administrador"];

function readFields(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const mineName = String(formData.get("mine_name") ?? "").trim();
  const concession = String(formData.get("concession") ?? "").trim();
  return { code, name, mineName, concession };
}

export async function createProvider(
  _prevState: ProviderFormState,
  formData: FormData,
): Promise<ProviderFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede crear proveedores." };
  }

  const { code, name, mineName, concession } = readFields(formData);

  if (!code || !name) {
    return { error: "Completá al menos el código y el nombre." };
  }
  if (!/^[A-Z0-9]{2,10}$/.test(code)) {
    return { error: "El código debe ser 2 a 10 letras/números, sin espacios (ej. BUS, GC)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("providers").insert({
    code,
    name,
    mine_name: mineName || null,
    concession: concession || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un proveedor con el código "${code}".` };
    }
    return { error: error.message };
  }

  redirect("/proveedores");
}

export async function updateProvider(
  providerId: string,
  _prevState: ProviderFormState,
  formData: FormData,
): Promise<ProviderFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar proveedores." };
  }

  const { code, name, mineName, concession } = readFields(formData);

  if (!code || !name) {
    return { error: "Completá al menos el código y el nombre." };
  }
  if (!/^[A-Z0-9]{2,10}$/.test(code)) {
    return { error: "El código debe ser 2 a 10 letras/números, sin espacios (ej. BUS, GC)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("providers")
    .update({ code, name, mine_name: mineName || null, concession: concession || null })
    .eq("id", providerId);

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un proveedor con el código "${code}".` };
    }
    return { error: error.message };
  }

  redirect("/proveedores?editado=1");
}

export type DeleteProviderResult = { error?: string } | undefined;

export async function deleteProvider(providerId: string): Promise<DeleteProviderResult> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar proveedores." };
  }

  const supabase = await createClient();

  const [{ count: lotCount }, { count: scheduleCount }] = await Promise.all([
    supabase.from("purchase_lots").select("id", { count: "exact", head: true }).eq("provider_id", providerId),
    supabase.from("truck_schedule").select("id", { count: "exact", head: true }).eq("provider_id", providerId),
  ]);

  if ((lotCount ?? 0) > 0 || (scheduleCount ?? 0) > 0) {
    return {
      error: "No se puede eliminar: el proveedor tiene lotes o programaciones asociadas.",
    };
  }

  const { error } = await supabase.from("providers").delete().eq("id", providerId);
  if (error) return { error: error.message };

  revalidatePath("/proveedores");
}
