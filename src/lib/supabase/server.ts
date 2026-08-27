import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchWithTimeout } from "./fetch-with-timeout";

/**
 * Cliente de Supabase para usar en Server Components, Route Handlers y Server Actions.
 * Lee y escribe la sesión en las cookies de la petición actual.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll fue llamado desde un Server Component: Next.js no permite
            // escribir cookies ahí. El middleware se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
