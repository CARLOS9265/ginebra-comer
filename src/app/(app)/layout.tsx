import Link from "next/link";
import { getCurrentUser, ROLE_LABELS } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const NAV_START = [{ href: "/", label: "Inicio" }];

// Los 3 procesos físicos del negocio, cada uno con su color para que se
// distingan de un vistazo en el menú (pedido del usuario). El resto de las
// pantallas (proveedores, programación, márgenes, precios, asistente) no
// pertenece a una sola fase, así que van sueltas al final.
const NAV_GROUPS = [
  {
    label: "Compra",
    textClass: "text-amber-500",
    borderClass: "border-amber-500",
    links: [
      { href: "/lotes", label: "Lotes de compra" },
      { href: "/precintos", label: "Precintos" },
      { href: "/big-bags", label: "Bolsones" },
    ],
  },
  {
    label: "Almacén",
    textClass: "text-emerald-500",
    borderClass: "border-emerald-500",
    links: [{ href: "/almacen", label: "Almacén" }],
  },
  {
    label: "Venta",
    textClass: "text-sky-500",
    borderClass: "border-sky-500",
    links: [
      { href: "/ventas", label: "Ventas a PY" },
      { href: "/muestreo", label: "Muestreo PY" },
    ],
  },
];

const NAV_END = [
  { href: "/proveedores", label: "Proveedores" },
  { href: "/calendario", label: "Programación" },
  { href: "/margenes", label: "Márgenes" },
  { href: "/precios", label: "Precios" },
  { href: "/asistente", label: "Asistente" },
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
        <nav className="mx-auto flex max-w-6xl items-end gap-3 px-6">
          <div className="flex gap-1 pb-1">
            {NAV_START.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-t-lg px-3 py-2 text-sm text-navy-200 hover:bg-navy-800 hover:text-gold-400"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col border-l border-navy-700 pl-3">
              <span className={`px-3 text-[10px] font-semibold uppercase tracking-wider ${group.textClass}`}>
                {group.label}
              </span>
              <div className={`flex gap-1 border-b-2 pb-1 ${group.borderClass}`}>
                {group.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded-t-lg px-3 py-1.5 text-sm text-navy-200 hover:bg-navy-800 hover:text-gold-400"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-1 border-l border-navy-700 pb-1 pl-3">
            {NAV_END.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-t-lg px-3 py-2 text-sm text-navy-200 hover:bg-navy-800 hover:text-gold-400"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
