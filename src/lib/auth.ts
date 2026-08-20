import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string;
  role:
    | "operaciones"
    | "compras"
    | "calidad"
    | "comercial"
    | "contabilidad"
    | "gerencia"
    | "administrador";
  active: boolean;
  created_at: string;
};

export const ROLE_LABELS: Record<Profile["role"], string> = {
  operaciones: "Operaciones",
  compras: "Compras",
  calidad: "Calidad",
  comercial: "Comercial",
  contabilidad: "Contabilidad",
  gerencia: "Gerencia",
  administrador: "Administrador",
};

/**
 * Devuelve el usuario logueado junto con su perfil (rol, si está activo).
 * `profile` viene null si el usuario no tiene sesión.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile: profile as Profile | null };
}
