import Link from "next/link";
import { getCurrentUser, ROLE_LABELS } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/lotes", label: "Lotes de compra" },
  { href: "/precintos", label: "Precintos" },
  { href: "/big-bags", label: "Big bags" },
  { href: "/ventas", label: "Ventas a PY" },
  { href: "/muestreo", label: "Muestreo PY" },
  { href: "/margenes", label: "Márgenes" },
  { href: "/calendario", label: "Programación" },
  { href: "/precios", label: "Precios" },
  { href: "/proveedores", label: "Proveedores" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUser();

  if (!user) {
    // El proxy ya debería haber redirigido, esto es un resguardo extra.
    return null;
  }

  if (!profile || !profile.active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-navy-900">Cuenta pendiente de activación</h1>
          <p className="mt-2 text-sm text-slate-500">
            Tu cuenta ({user.email}) todavía no fue activada por un administrador de Ginebra.
            Avisale para que te asigne un rol.
          </p>
          <form action={signOut} className="mt-4">
            <button className="text-sm text-gold-700 hover:underline">Cerrar sesión</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-navy-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <span className="text-lg font-semibold text-white">Ginebra</span>
            <span className="ml-2 text-xs text-navy-300">Sistema de trazabilidad</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-white">{profile.full_name}</div>
              <div className="text-xs text-navy-300">{ROLE_LABELS[profile.role]}</div>
            </div>
            <form action={signOut}>
              <button className="rounded-lg border border-navy-600 px-3 py-1.5 text-xs text-navy-100 hover:bg-navy-800">
                Salir
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-t-lg px-3 py-2 text-sm text-navy-200 hover:bg-navy-800 hover:text-gold-400"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
