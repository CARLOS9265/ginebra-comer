"use server";

import { redirect } from "next/navigation";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar (problema de red, no de la contraseña). Probá de nuevo en unos segundos.";

export type AuthFormState = {
  error?: string;
  message?: string;
} | null;

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá correo y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: isAuthRetryableFetchError(error) ? NETWORK_ERROR_MESSAGE : "Correo o contraseña incorrectos." };
  }

  redirect("/");
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Completá todos los campos." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: isAuthRetryableFetchError(error) ? NETWORK_ERROR_MESSAGE : error.message };
  }

  return {
    message:
      "Cuenta creada. Un administrador de Ginebra tiene que activarla y asignarte un rol antes de que puedas entrar.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
