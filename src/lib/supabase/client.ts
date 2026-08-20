import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para usar dentro del navegador (componentes "use client").
 * Cada llamada crea una instancia liviana; @supabase/ssr reutiliza la sesión guardada en cookies.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
