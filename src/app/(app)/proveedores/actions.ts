"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type ProviderFormState = { error?: string } | null;

export async function createProvider(
  _prevState: ProviderFormState,
  formData: FormData,
): Promise<ProviderFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !["compras", "gerencia", "administrador"].includes(profile.role)) {
    return { error: "Tu rol no puede crear proveedores." };
  }

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const mineName = String(formData.get("mine_name") ?? "").trim();
  const concession = String(formData.get("concession") ?? "").trim();

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
