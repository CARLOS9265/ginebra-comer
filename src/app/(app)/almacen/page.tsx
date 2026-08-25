import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const fmtKg = (n: number) => `${n.toLocaleString("es-PE")} kg`;
const fmtPEN = (n: number) => `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("es-PE") : "—");

export default async function AlmacenPage() {
  const supabase = await createClient();

  const [{ data: pendingLots }, { data: warehouseLots }] = await Promise.all([
    supabase
      .from("purchase_lots")
      .select("id, code, estimated_weight_tmh, providers(name)")
      .eq("status", "valorizado")
      .order("code"),
    supabase
      .from("purchase_lots")
      .select(
        "id, code, status, sample_batch_id, providers(name), warehouse_transfers(forklift_cost_pen, dispatch_carrier, dispatch_truck_plate, departed_at, arrived_at), weighings(net_weight, ticket_number, type)",
      )
      .in("status", ["en_almacen", "cerrado"])
      .is("sample_batch_id", null)
      .order("code"),
  ]);

  const warehouseRows = (warehouseLots ?? []).map((l) => {
    const provider = Array.isArray(l.providers) ? l.providers[0] : l.providers;
    const transfer = Array.isArray(l.warehouse_transfers) ? l.warehouse_transfers[0] : l.warehouse_transfers;
    const huanchacoWeighing = (Array.isArray(l.weighings) ? l.weighings : l.weighings ? [l.weighings] : []).find(
      (w) => w.type === "huanchaco",
    );
    return { ...l, providerName: provider?.name, transfer, weightKg: huanchacoWeighing?.net_weight ?? null };
  });

  const totalKg = warehouseRows.reduce((sum, l) => sum + (l.weightKg ?? 0), 0);
  const totalForklift = warehouseRows.reduce((sum, l) => sum + (l.transfer?.forklift_cost_pen ?? 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Almacén (Huanchaco)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Traslado del molino al almacén propio de Ginebra: montacarga, trailer, pesaje propio y descarga.
          Los datos de cada traslado se cargan en el detalle de cada lote.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-dashed border-emerald-200 bg-emerald-50 p-4">
        <h2 className="text-sm font-semibold text-emerald-900">Lotes listos para trasladar</h2>
        <p className="mt-1 text-xs text-emerald-700">
          Ya tienen liquidación definitiva de compra — falta registrar el traslado a Huanchaco.
        </p>
        {!pendingLots || pendingLots.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-700">No hay lotes esperando traslado.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingLots.map((l) => {
              const provider = Array.isArray(l.providers) ? l.providers[0] : l.providers;
              return (
                <Link
                  key={l.id}
                  href={`/lotes/${l.id}`}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-mono text-emerald-800 shadow-sm hover:bg-emerald-100"
                >
                  {l.code} · {provider?.name ?? "—"}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Lotes en almacén</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{warehouseRows.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Peso total (pesaje Huanchaco)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtKg(totalKg)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Costo de montacarga acumulado</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtPEN(totalForklift)}</p>
        </div>
      </div>

      {warehouseRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No hay lotes esperando en el almacén todavía (o ya están todos agrupados en un muestreo —
          revisá <Link href="/muestreo" className="text-gold-700 hover:underline">Muestreo PY</Link>).
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3 text-right">Peso (Huanchaco)</th>
                <th className="px-4 py-3">Transportista</th>
                <th className="px-4 py-3 text-right">Montacarga</th>
                <th className="px-4 py-3">Descarga en almacén</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {warehouseRows.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-700">
                    <Link href={`/lotes/${l.id}`} className="hover:text-gold-800 hover:underline">
                      {l.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{l.providerName ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {l.weightKg != null ? fmtKg(l.weightKg) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{l.transfer?.dispatch_carrier ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400">
                    {l.transfer?.forklift_cost_pen != null ? fmtPEN(l.transfer.forklift_cost_pen) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(l.transfer?.arrived_at ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
