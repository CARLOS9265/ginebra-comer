import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProviderRowActions } from "./ProviderRowActions";

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ editado?: string }>;
}) {
  const { editado } = await searchParams;
  const supabase = await createClient();
  const { data: providers } = await supabase
    .from("providers")
    .select("id, code, name, mine_name, concession, created_at")
    .order("name");

  return (
    <div>
      {editado && (
        <div className="mb-4 rounded-lg border border-teal-800 bg-teal-950/40 px-4 py-2.5 text-sm text-teal-300">
          Proveedor actualizado correctamente.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Proveedores</h1>
          <p className="mt-1 text-sm text-slate-400">Minas y traders de los que Ginebra compra mineral.</p>
        </div>
        <Link
          href="/proveedores/nuevo"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
        >
          + Nuevo proveedor
        </Link>
      </div>

      {!providers || providers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
          Todavía no hay proveedores registrados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Mina</th>
                <th className="px-4 py-3">Concesión</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-mono text-slate-200">{p.code}</td>
                  <td className="px-4 py-3 text-slate-200">{p.name}</td>
                  <td className="px-4 py-3 text-slate-400">{p.mine_name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{p.concession ?? "—"}</td>
                  <td className="px-4 py-3">
                    <ProviderRowActions id={p.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
