import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_LABELS } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; accent: "amber" | "emerald" | "sky"; links: NavLink[] };

const NAV_START: NavLink[] = [
  { href: "/", label: "Inicio" },
  { href: "/calendario", label: "Programación" },
];

// Los 3 procesos físicos del negocio, cada uno con su color para que se
// distingan de un vistazo en el menú (pedido del usuario). El resto de las
// pantallas (proveedores, programación, márgenes, precios, asistente) no
// pertenece a una sola fase, así que van sueltas al final.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Compra",
    accent: "amber",
    links: [
      { href: "/lotes", label: "Lotes de compra" },
      { href: "/precintos", label: "Precintos" },
      { href: "/big-bags", label: "Bolsones" },
    ],
  },
  {
    label: "Almacén",
    accent: "emerald",
    links: [{ href: "/almacen", label: "Almacén" }],
  },
  {
    label: "Venta",
    accent: "sky",
    links: [
      { href: "/ventas", label: "Ventas a PY" },
      { href: "/muestreo", label: "Muestreo PY" },
    ],
  },
];

const NAV_END: NavLink[] = [
  { href: "/proveedores", label: "Proveedores" },
  { href: "/margenes", label: "Márgenes" },
  { href: "/precios", label: "Precios" },
  { href: "/asistente", label: "Asistente" },
];

const ACCENT_TEXT: Record<NavGroup["accent"], string> = {
  amber: "text-amber-400/90",
  emerald: "text-emerald-400/90",
  sky: "text-sky-400/90",
};

const ACCENT_BORDER: Record<NavGroup["accent"], string> = {
  amber: "border-amber-500/80",
  emerald: "border-emerald-500/80",
  sky: "border-sky-500/80",
};

function NavLinks({ links }: { links: NavLink[] }) {
  return (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-navy-200 transition-colors hover:bg-navy-800 hover:text-white"
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}

function NavCluster({ label, accent, links }: { label?: string; accent?: NavGroup["accent"]; links: NavLink[] }) {
  return (
    <div className="flex flex-shrink-0 flex-col">
      <span
        className={`mb-1 h-3.5 px-2 text-[10px] font-semibold uppercase leading-none tracking-[0.08em] ${
          accent ? ACCENT_TEXT[accent] : "invisible"
        }`}
      >
        {label ?? "·"}
      </span>
      <div
        className={`flex items-center gap-0.5 border-b-2 pb-2.5 ${accent ? ACCENT_BORDER[accent] : "border-transparent"}`}
      >
        <NavLinks links={links} />
      </div>
    </div>
  );
}

function NavDivider() {
  return <div className="mx-1 mb-2.5 h-4 w-px flex-shrink-0 self-end bg-navy-700" />;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUser();

  if (!user) {
    // El proxy solo hace un chequeo rápido (sin red) para el caso común; esta es la
    // validación real (con `getUser()`, contra el servidor de Supabase) y el redirect
    // de verdad si no hay sesión válida.
    redirect("/login");
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
            <div className="text-base font-semibold tracking-tight text-white">Ginebra Trade Peru SAC</div>
            <div className="text-xs text-navy-400">Sistema de trazabilidad de mineral</div>
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
        <nav className="border-t border-navy-800/80">
          <div className="mx-auto flex max-w-6xl items-end gap-1 overflow-x-auto px-6 pt-2.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-navy-700 [&::-webkit-scrollbar-track]:bg-transparent">
            <NavCluster links={NAV_START} />
            <NavDivider />
            {NAV_GROUPS.map((group, i) => (
              <div key={group.label} className="flex items-end gap-1">
                <NavCluster label={group.label} accent={group.accent} links={group.links} />
                {i < NAV_GROUPS.length - 1 && <NavDivider />}
              </div>
            ))}
            <NavDivider />
            <NavCluster links={NAV_END} />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
