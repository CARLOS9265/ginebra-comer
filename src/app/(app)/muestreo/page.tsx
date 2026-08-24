import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/ActionButton";
import { createSampleBatch } from "./actions";

const fmtKg = (n: number) => `${n.toLocaleString("es-PE")} kg`;

export default async function SampleBatchesPage() {
  const supabase = await createClient();

  const [{ data: batches }, { data: pendingLots }] = await Promise.all([
    supabase
      .from("py_sample_batches")
      .select("id, code, created_at, au_gt, sale_lots(id, big_bags(weight_kg))")
      .order("created_at", { ascending: false }),
    supabase
      .from("sale_lots")
      .select("id, code, big_bags(weight_kg)")
      .eq("status", "recibido_py")
      .is("sample_batch_id", null)
      .order("code"),
  ]);

  const pendingTotalKg = (pendingLots ?? []).reduce((sum, l) => {
    const bags = Array.isArray(l.big_bags) ? l.big_bags : [];
    return sum + bags.reduce((s, b) => s + (b.weight_kg ?? 0), 0);
  }, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Muestreo conjunto en PY</h1>
        <p className="mt-1 text-sm text-slate-500">
          Al llegar, se pesan los trailers, se rompen los big bags en una plataforma y se mezclan — varios
          lotes de venta se convierten en uno solo para el muestreo.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Lotes esperando muestreo</h2>
        {!pendingLots || pendingLots.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No hay lotes de venta recibidos en PY sin muestrear.</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {pendingLots.map((l) => (
                <Link
                  key={l.id}
                  href={`/ventas/${l.id}`}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-mono text-slate-700 hover:bg-slate-200"
                >
                  {l.code}
                </Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {pendingLots.length} lote{pendingLots.length === 1 ? "" : "s"} · {fmtKg(pendingTotalKg)} en total
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
                <th className="px-4 py-3 text-right">Lotes de venta</th>
                <th className="px-4 py-3 text-right">Peso total</th>
                <th className="px-4 py-3">Laboratorio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {batches.map((batch) => {
                const lots = Array.isArray(batch.sale_lots) ? batch.sale_lots : [];
                const totalKg = lots.reduce((sum, l) => {
                  const bags = Array.isArray(l.big_bags) ? l.big_bags : [];
                  return sum + bags.reduce((s, b) => s + (b.weight_kg ?? 0), 0);
                }, 0);
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
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{lots.length}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{fmtKg(totalKg)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-400">
                        {batch.au_gt != null ? "Con resultado" : "Pendiente"}
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
