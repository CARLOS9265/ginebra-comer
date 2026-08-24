import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const fmtUSD = (n: number, decimals = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals });
const fmtKg = (n: number) => `${n.toLocaleString("es-PE")} kg`;

type BagRow = {
  id: string;
  weight_kg: number | null;
  purchase_lot_id: string | null;
  sale_lot_id: string | null;
  purchase_lots: { id: string; code: string } | { id: string; code: string }[] | null;
  sale_lots: { id: string; code: string; sample_batch_id: string | null } | { id: string; code: string; sample_batch_id: string | null }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function MargenesPage() {
  const supabase = await createClient();

  const { data: bagsRaw } = await supabase
    .from("big_bags")
    .select(
      "id, weight_kg, purchase_lot_id, purchase_lots(id, code), sale_lot_id, sale_lots(id, code, sample_batch_id)",
    );
  const bags = (bagsRaw ?? []) as BagRow[];

  // Peso total por muestreo (para el ingreso por kg de cada muestreo).
  const batchWeights = new Map<string, number>();
  for (const b of bags) {
    const saleLot = one(b.sale_lots);
    const batchId = saleLot?.sample_batch_id;
    if (batchId) batchWeights.set(batchId, (batchWeights.get(batchId) ?? 0) + (b.weight_kg ?? 0));
  }

  const batchIds = [...batchWeights.keys()];
  const { data: batches } =
    batchIds.length > 0
      ? await supabase.from("py_sample_batches").select("id, code, final_value_total").in("id", batchIds)
      : { data: [] as { id: string; code: string; final_value_total: number | null }[] };
  const batchById = new Map((batches ?? []).map((b) => [b.id, b]));

  const purchaseLotIds = [...new Set(bags.map((b) => b.purchase_lot_id).filter((v): v is string => !!v))];
  const { data: settlements } =
    purchaseLotIds.length > 0
      ? await supabase
          .from("lot_settlements")
          .select("purchase_lot_id, precio_definitivo_total, tmh_used, created_at")
          .in("purchase_lot_id", purchaseLotIds)
          .order("created_at", { ascending: false })
      : { data: [] as { purchase_lot_id: string; precio_definitivo_total: number | null; tmh_used: number | null; created_at: string }[] };

  const settlementByLot = new Map<string, { total: number; tmh: number }>();
  for (const s of settlements ?? []) {
    if (!settlementByLot.has(s.purchase_lot_id) && s.precio_definitivo_total != null && s.tmh_used) {
      settlementByLot.set(s.purchase_lot_id, { total: s.precio_definitivo_total, tmh: s.tmh_used });
    }
  }

  type Agg = { code: string; totalKg: number; pendingKg: number; margin: number; hasComplete: boolean };
  const byPurchaseLot = new Map<string, Agg>();
  const bySaleLot = new Map<string, Agg>();

  for (const b of bags) {
    const weightKg = b.weight_kg ?? 0;
    const purchaseLot = one(b.purchase_lots);
    const saleLot = one(b.sale_lots);
    if (!purchaseLot) continue;

    const settlement = settlementByLot.get(purchaseLot.id);
    const batch = saleLot?.sample_batch_id ? batchById.get(saleLot.sample_batch_id) : null;
    const batchTotalWeight = saleLot?.sample_batch_id ? batchWeights.get(saleLot.sample_batch_id) : null;

    const costPerKg = settlement ? settlement.total / (settlement.tmh * 1000) : null;
    const revenuePerKg =
      batch?.final_value_total != null && batchTotalWeight ? batch.final_value_total / batchTotalWeight : null;
    const complete = costPerKg != null && revenuePerKg != null;
    const marginTotal = complete ? weightKg * (revenuePerKg! - costPerKg!) : 0;

    const pl = byPurchaseLot.get(purchaseLot.id) ?? {
      code: purchaseLot.code,
      totalKg: 0,
      pendingKg: 0,
      margin: 0,
      hasComplete: false,
    };
    pl.totalKg += weightKg;
    if (complete) {
      pl.margin += marginTotal;
      pl.hasComplete = true;
    } else {
      pl.pendingKg += weightKg;
    }
    byPurchaseLot.set(purchaseLot.id, pl);

    if (saleLot) {
      const sl = bySaleLot.get(saleLot.id) ?? {
        code: saleLot.code,
        totalKg: 0,
        pendingKg: 0,
        margin: 0,
        hasComplete: false,
      };
      sl.totalKg += weightKg;
      if (complete) {
        sl.margin += marginTotal;
        sl.hasComplete = true;
      } else {
        sl.pendingKg += weightKg;
      }
      bySaleLot.set(saleLot.id, sl);
    }
  }

  const purchaseRows = [...byPurchaseLot.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
  const saleRows = [...bySaleLot.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
  const totalMargin = purchaseRows.reduce((sum, [, v]) => sum + v.margin, 0);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Márgenes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cruza el costo definitivo de cada lote de compra con el ingreso final de cada muestreo de PY,
          prorrateado por peso a través de los big bags. Solo se calcula cuando ambos lados tienen
          liquidación definitiva — el resto queda marcado como pendiente.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Row label="Margen total (lotes con liquidación completa de ambos lados)" value={fmtUSD(totalMargin)} strong />
      </div>

      <div>
        <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Por lote de compra
        </h2>
        {purchaseRows.length === 0 ? (
          <p className="text-sm text-slate-500">No hay big bags generados todavía.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lote de compra</th>
                  <th className="px-4 py-3 text-right">Peso total</th>
                  <th className="px-4 py-3 text-right">Pendiente</th>
                  <th className="px-4 py-3 text-right">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {purchaseRows.map(([id, v]) => (
                  <tr key={id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-700">
                      <Link href={`/lotes/${id}`} className="hover:text-gold-800 hover:underline">
                        {v.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{fmtKg(v.totalKg)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {v.pendingKg > 0 ? fmtKg(v.pendingKg) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        !v.hasComplete
                          ? "text-slate-400"
                          : v.margin >= 0
                            ? "text-emerald-700"
                            : "text-red-600"
                      }`}
                    >
                      {v.hasComplete ? fmtUSD(v.margin) : "Pendiente"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Por lote de venta
        </h2>
        {saleRows.length === 0 ? (
          <p className="text-sm text-slate-500">No hay big bags asignados a un lote de venta todavía.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lote de venta</th>
                  <th className="px-4 py-3 text-right">Peso total</th>
                  <th className="px-4 py-3 text-right">Pendiente</th>
                  <th className="px-4 py-3 text-right">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {saleRows.map(([id, v]) => (
                  <tr key={id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-700">
                      <Link href={`/ventas/${id}`} className="hover:text-gold-800 hover:underline">
                        {v.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{fmtKg(v.totalKg)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {v.pendingKg > 0 ? fmtKg(v.pendingKg) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        !v.hasComplete
                          ? "text-slate-400"
                          : v.margin >= 0
                            ? "text-emerald-700"
                            : "text-red-600"
                      }`}
                    >
                      {v.hasComplete ? fmtUSD(v.margin) : "Pendiente"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${strong ? "text-base font-semibold text-gold-700" : "text-slate-700"}`}>
        {value}
      </span>
    </div>
  );
}
