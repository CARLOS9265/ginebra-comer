import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { fetchWithTimeout } from "./fetch-with-timeout";

const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * Se ejecuta en cada request. Renueva la sesión de Supabase (si el usuario está
 * logueado) y redirige a /login a quien intente entrar sin sesión.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getSession() lee la sesión de la cookie sin llamar a la API de Supabase — acá
  // solo decide si redirige a /login, no autoriza nada. En este entorno esa llamada
  // de red (lo que sí hace getUser()) puede tardar minutos por algún problema de red
  // local (mismo tipo de bloqueo que ya se vio con fetch() a inversoro.es), y el
  // proxy corre en TODAS las páginas — eso volvía la app inutilizable. La validación
  // real (con red, contra el servidor de Supabase) se sigue haciendo con getUser()
  // en `getCurrentUser()` (server/auth.ts), que corre en el layout de cada página y
  // ahora si no hay usuario válido redirige de verdad — no solo confía en el proxy.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!session && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
