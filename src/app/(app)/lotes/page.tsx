import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const fmtUSD = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const STATUS_LABELS: Record<string, string> = {
  creado: "Creado",
  en_transito: "En tránsito",
  pesado: "Pesado",
  recibido_molino: "Recibido en molino",
  conminuido: "Conminuido",
  en_laboratorio: "En laboratorio",
  valorizado: "Valorizado",
  en_almacen: "En almacén",
  cerrado: "Cerrado",
};

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string }>;
}) {
  const { creado } = await searchParams;
  const supabase = await createClient();
  const { data: lots } = await supabase
    .from("purchase_lots")
    .select(
      "id, code, loaded_at, estimated_weight_tmh, provisional_price_per_tmh, projected_margin_per_tmh, status, requires_approval, approved_at, providers(name, code)",
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      {creado && (
        <div className="mb-4 rounded-lg border border-teal-800 bg-teal-950/40 px-4 py-2.5 text-sm text-teal-300">
          Lote <span className="font-mono">{creado}</span> registrado correctamente.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Lotes de compra</h1>
          <p className="mt-1 text-sm text-slate-400">Desde la carga en mina hasta el cierre de compra.</p>
        </div>
        <Link
          href="/lotes/nuevo"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
        >
          + Nuevo lote
        </Link>
      </div>

      {!lots || lots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
          Todavía no hay lotes registrados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Carga</th>
                <th className="px-4 py-3 text-right">TMH</th>
                <th className="px-4 py-3 text-right">Precio prov. /TMH</th>
                <th className="px-4 py-3 text-right">Margen proy. /TMH</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {lots.map((l) => {
                const provider = Array.isArray(l.providers) ? l.providers[0] : l.providers;
                return (
                  <tr key={l.id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-mono text-slate-200">{l.code}</td>
                    <td className="px-4 py-3 text-slate-300">{provider?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(l.loaded_at).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      {l.estimated_weight_tmh ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      {fmtUSD(l.provisional_price_per_tmh)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        (l.projected_margin_per_tmh ?? 0) >= 0 ? "text-teal-400" : "text-red-400"
                      }`}
                    >
                      {fmtUSD(l.projected_margin_per_tmh)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {STATUS_LABELS[l.status] ?? l.status}
                      </span>
                      {l.requires_approval && !l.approved_at && (
                        <span className="ml-2 rounded-full bg-amber-950/60 px-2.5 py-1 text-xs text-amber-400">
                          Pendiente de aprobación
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
