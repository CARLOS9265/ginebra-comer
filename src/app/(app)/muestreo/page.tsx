import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/ActionButton";
import { createSampleBatch } from "./actions";

const fmtKg = (n: number) => `${n.toLocaleString("es-PE")} kg`;

export default async function SampleBatchesPage() {
  const supabase = await createClient();

  const [{ data: batches }, { data: huanchacoWeighings }] = await Promise.all([
    supabase
      .from("py_sample_batches")
      .select(
        "id, code, created_at, prov_au_gt, prov_value_total, final_value_total, purchase_lots(id, code), sale_lots(id)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("weighings")
      .select("purchase_lot_id, net_weight, purchase_lots(id, code, sample_batch_id)")
      .eq("type", "huanchaco"),
  ]);

  const pendingLots = (huanchacoWeighings ?? [])
    .map((w) => ({
      weight: w.net_weight,
      lot: Array.isArray(w.purchase_lots) ? w.purchase_lots[0] : w.purchase_lots,
    }))
    .filter((w) => w.lot && w.lot.sample_batch_id == null);

  const pendingTotalKg = pendingLots.reduce((sum, w) => sum + (w.weight ?? 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Muestreo</h1>
        <p className="mt-1 text-sm text-slate-500">
          El muestreo <strong>provisional</strong> se toma en Huanchaco, de todo lo que está esperando
          embarque a la vez — recién después se arman los lotes de venta y se despachan a Lima, donde pasa
          el muestreo <strong>final</strong> (conjunto, laboratorio internacional).
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Lotes de compra esperando muestreo provisional</h2>
        {pendingLots.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No hay lotes de compra que hayan llegado a Huanchaco sin muestrear.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {pendingLots.map((w) => (
                <Link
                  key={w.lot!.id}
                  href={`/lotes/${w.lot!.id}`}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-mono text-slate-700 hover:bg-slate-200"
                >
                  {w.lot!.code}
                </Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {pendingLots.length} lote{pendingLots.length === 1 ? "" : "s"} · {fmtKg(pendingTotalKg)} en total
              (pesaje de Huanchaco)
            </p>
            <div className="mt-4">
              <ActionButton
                action={createSampleBatch}
                label={`Crear muestreo con estos ${pendingLots.length} lotes`}
                pendingLabel="Creando..."
                confirmText="¿Mezclar todos los lotes pendientes en un solo muestreo? Se agrupan automáticamente, no se puede elegir de a uno."
              />
            </div>
          </>
        )}
      </div>

      {!batches || batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          Todavía no hay muestreos armados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Creado</th>
                <th className="px-4 py-3 text-right">Lotes de compra</th>
                <th className="px-4 py-3 text-right">Lotes de venta</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {batches.map((batch) => {
                const purchaseLots = Array.isArray(batch.purchase_lots) ? batch.purchase_lots : [];
                const saleLots = Array.isArray(batch.sale_lots) ? batch.sale_lots : [];
                const status = batch.final_value_total != null
                  ? "Liquidado (final)"
                  : batch.prov_value_total != null
                    ? "Liquidado (provisional)"
                    : batch.prov_au_gt != null
                      ? "Con ensaye provisional"
                      : "Pendiente";
                return (
                  <tr key={batch.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-700">
                      <Link href={`/muestreo/${batch.id}`} className="hover:text-gold-800 hover:underline">
                        {batch.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(batch.created_at).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{purchaseLots.length}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{saleLots.length}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-400">
                        {status}
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
