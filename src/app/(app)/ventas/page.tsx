import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SALE_LOT_STATUS_LABELS } from "@/lib/sale-lot-status";

const fmtKg = (n: number) => `${n.toLocaleString("es-PE")} kg`;

export default async function SaleLotsPage() {
  const supabase = await createClient();
  const { data: saleLots } = await supabase
    .from("sale_lots")
    .select("id, code, status, created_at, big_bags(weight_kg)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Lotes de venta</h1>
          <p className="mt-1 text-sm text-slate-400">Despachos a PY, armados a partir de big bags disponibles.</p>
        </div>
        <Link
          href="/ventas/nuevo"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
        >
          + Armar lote de venta
        </Link>
      </div>

      {!saleLots || saleLots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
          Todavía no hay lotes de venta armados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Armado</th>
                <th className="px-4 py-3 text-right">Big bags</th>
                <th className="px-4 py-3 text-right">Peso total</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {saleLots.map((s) => {
                const bags = Array.isArray(s.big_bags) ? s.big_bags : [];
                const totalKg = bags.reduce((sum, b) => sum + (b.weight_kg ?? 0), 0);
                return (
                  <tr key={s.id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-mono text-slate-200">
                      <Link href={`/ventas/${s.id}`} className="hover:text-teal-400 hover:underline">
                        {s.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(s.created_at).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{bags.length}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{fmtKg(totalKg)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        {SALE_LOT_STATUS_LABELS[s.status as keyof typeof SALE_LOT_STATUS_LABELS] ?? s.status}
                      </span>
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
