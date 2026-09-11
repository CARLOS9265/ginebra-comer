import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LotRowActions } from "./LotRowActions";
import { LotPipelineBoard } from "./LotPipelineBoard";
import { LOT_STATUS_LABELS } from "@/lib/lot-status";
import { MONTH_NAMES, monthParam, parseMonthParam, monthRange, shiftMonth } from "@/lib/calendar";

const fmtUSD = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string; editado?: string; month?: string }>;
}) {
  const { creado, editado, month: monthQuery } = await searchParams;
  const { year, month } = parseMonthParam(monthQuery);
  const { start } = monthRange(year, month);
  const nextMonth = shiftMonth(year, month, 1);
  const { start: nextStart } = monthRange(nextMonth.year, nextMonth.month);
  const prevMonth = shiftMonth(year, month, -1);

  const supabase = await createClient();
  const { data: allLots } = await supabase
    .from("purchase_lots")
    .select(
      "id, code, loaded_at, estimated_weight_tmh, provisional_price_per_tmh, projected_margin_per_tmh, status, requires_approval, approved_at, providers(name, code)",
    )
    .order("created_at", { ascending: false });

  // El tablero de arriba muestra el estado ACTUAL de todos los lotes activos
  // (no tiene sentido "esconder" un lote que sigue en molino solo porque se
  // cargó el mes pasado). Solo la tabla de abajo se filtra por mes de carga.
  const lots = (allLots ?? []).filter((l) => l.loaded_at >= start && l.loaded_at < nextStart);

  return (
    <div>
      {creado && (
        <div className="mb-4 rounded-lg border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm text-gold-600">
          Lote <span className="font-mono">{creado}</span> registrado correctamente.
        </div>
      )}
      {editado && (
        <div className="mb-4 rounded-lg border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm text-gold-600">
          Lote <span className="font-mono">{editado}</span> actualizado correctamente.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lotes de compra</h1>
          <p className="mt-1 text-sm text-slate-500">Desde la carga en mina hasta el cierre de compra.</p>
        </div>
        <Link
          href="/lotes/nuevo"
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700"
        >
          + Nuevo lote
        </Link>
      </div>

      {allLots && allLots.length > 0 && <LotPipelineBoard lots={allLots} />}

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <div className="flex gap-2">
          <Link
            href={`/lotes?month=${monthParam(prevMonth.year, prevMonth.month)}`}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-100"
          >
            ← Anterior
          </Link>
          <Link
            href={`/lotes?month=${monthParam(nextMonth.year, nextMonth.month)}`}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-100"
          >
            Siguiente →
          </Link>
        </div>
      </div>

      {lots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No hay lotes cargados en {MONTH_NAMES[month - 1].toLowerCase()} de {year}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Carga</th>
                <th className="px-4 py-3 text-right">TMH</th>
                <th className="px-4 py-3 text-right">Precio prov. /TMH</th>
                <th className="px-4 py-3 text-right">Total USD</th>
                <th className="px-4 py-3 text-right">Margen proy. /TMH</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {lots.map((l) => {
                const provider = Array.isArray(l.providers) ? l.providers[0] : l.providers;
                const totalUsd =
                  l.estimated_weight_tmh != null && l.provisional_price_per_tmh != null
                    ? l.estimated_weight_tmh * l.provisional_price_per_tmh
                    : null;
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-700">
                      <Link href={`/lotes/${l.id}`} className="hover:text-gold-800 hover:underline">
                        {l.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{provider?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(l.loaded_at).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {l.estimated_weight_tmh ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {fmtUSD(l.provisional_price_per_tmh)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{fmtUSD(totalUsd)}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        (l.projected_margin_per_tmh ?? 0) >= 0 ? "text-gold-700" : "text-red-600"
                      }`}
                    >
                      {fmtUSD(l.projected_margin_per_tmh)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-400">
                        {LOT_STATUS_LABELS[l.status as keyof typeof LOT_STATUS_LABELS] ?? l.status}
                      </span>
                      {l.requires_approval && !l.approved_at && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">
                          Pendiente de aprobación
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LotRowActions id={l.id} canDelete={l.status === "creado"} />
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
