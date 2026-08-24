import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SALE_LOT_STATUS_LABELS } from "@/lib/sale-lot-status";

export default async function SaleLotsPage() {
  const supabase = await createClient();
  const { data: saleLots } = await supabase
    .from("sale_lots")
    .select("id, code, status, created_at, sale_lot_allocations(bag_count)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lotes de venta</h1>
          <p className="mt-1 text-sm text-slate-500">Despachos a PY, armados a partir de bolsones disponibles.</p>
        </div>
        <Link
          href="/ventas/nuevo"
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700"
        >
          + Armar lote de venta
        </Link>
      </div>

      {!saleLots || saleLots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          Todavía no hay lotes de venta armados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Armado</th>
                <th className="px-4 py-3 text-right">Bolsones</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {saleLots.map((s) => {
                const allocations = Array.isArray(s.sale_lot_allocations) ? s.sale_lot_allocations : [];
                const totalBags = allocations.reduce((sum, a) => sum + (a.bag_count ?? 0), 0);
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-700">
                      <Link href={`/ventas/${s.id}`} className="hover:text-gold-800 hover:underline">
                        {s.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(s.created_at).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{totalBags}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-400">
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
