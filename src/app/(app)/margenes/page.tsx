import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeMargins } from "@/lib/margins";

const fmtUSD = (n: number, decimals = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals });
const fmtKg = (n: number) => `${n.toLocaleString("es-PE")} kg`;

export default async function MargenesPage() {
  const supabase = await createClient();
  const { byPurchaseLot: purchaseRows, bySaleLot: saleRows, totalMargin } = await computeMargins(supabase);

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
