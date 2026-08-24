import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function BagInventoryPage() {
  const supabase = await createClient();

  const [{ data: comminutions }, { data: allocations }] = await Promise.all([
    supabase
      .from("comminutions")
      .select("purchase_lot_id, bag_count, purchase_lots(id, code, providers(name))")
      .not("bag_count", "is", null),
    supabase.from("sale_lot_allocations").select("purchase_lot_id, bag_count"),
  ]);

  const allocatedByLot = new Map<string, number>();
  for (const a of allocations ?? []) {
    allocatedByLot.set(a.purchase_lot_id, (allocatedByLot.get(a.purchase_lot_id) ?? 0) + a.bag_count);
  }

  const totalByLot = new Map<
    string,
    { code: string; lotId: string; providerName: string | null; total: number }
  >();
  for (const c of comminutions ?? []) {
    const lot = Array.isArray(c.purchase_lots) ? c.purchase_lots[0] : c.purchase_lots;
    if (!lot) continue;
    const provider = Array.isArray(lot.providers) ? lot.providers[0] : lot.providers;
    const existing = totalByLot.get(c.purchase_lot_id);
    totalByLot.set(c.purchase_lot_id, {
      code: lot.code,
      lotId: lot.id,
      providerName: provider?.name ?? null,
      total: (existing?.total ?? 0) + (c.bag_count ?? 0),
    });
  }

  const rows = [...totalByLot.entries()]
    .map(([purchaseLotId, v]) => ({
      purchaseLotId,
      ...v,
      allocated: allocatedByLot.get(purchaseLotId) ?? 0,
      available: v.total - (allocatedByLot.get(purchaseLotId) ?? 0),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const totals = rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, allocated: acc.allocated + r.allocated, available: acc.available + r.available }),
    { total: 0, allocated: 0, available: 0 },
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bolsones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Inventario de bolsones generados por lote de compra, y cuántos ya están asignados a un
            despacho a PY.
          </p>
        </div>
        <Link
          href="/ventas/nuevo"
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700"
        >
          + Armar lote de venta
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          Todavía no hay lotes de compra con bolsones cargados.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lote de compra</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3 text-right">Generados</th>
                  <th className="px-4 py-3 text-right">Asignados a venta</th>
                  <th className="px-4 py-3 text-right">Disponibles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r) => (
                  <tr key={r.purchaseLotId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-700">
                      <Link href={`/lotes/${r.lotId}`} className="hover:text-gold-800 hover:underline">
                        {r.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{r.providerName ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{r.total}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{r.allocated}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        r.available > 0 ? "text-gold-700" : "text-slate-400"
                      }`}
                    >
                      {r.available}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {totals.total} generados · {totals.allocated} asignados · {totals.available} disponibles
          </p>
        </>
      )}
    </div>
  );
}
