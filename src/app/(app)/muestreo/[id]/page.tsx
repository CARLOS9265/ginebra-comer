import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/ActionButton";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { undoSampleBatch, deleteSampleResult } from "../actions";
import { SampleResultForm } from "./SampleResultForm";

const fmtKg = (n: number) => `${n.toLocaleString("es-PE")} kg`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

export default async function SampleBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("py_sample_batches")
    .select(
      "id, code, created_at, sampled_at, lab_name, report_number, au_gt, ag_gt, pb_pct, as_pct, sb_pct, s_pct, humidity_pct, notes",
    )
    .eq("id", id)
    .maybeSingle();

  if (!batch) notFound();

  const { data: saleLots } = await supabase
    .from("sale_lots")
    .select("id, code, py_official_weight_kg, big_bags(weight_kg)")
    .eq("sample_batch_id", id)
    .order("code");

  const totalKg = (saleLots ?? []).reduce((sum, l) => {
    const bags = Array.isArray(l.big_bags) ? l.big_bags : [];
    return sum + bags.reduce((s, b) => s + (b.weight_kg ?? 0), 0);
  }, 0);
  const totalOfficialKg = (saleLots ?? []).reduce((sum, l) => sum + (l.py_official_weight_kg ?? 0), 0);

  const hasResult = batch.au_gt != null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/muestreo" className="text-xs text-slate-500 hover:text-slate-900">
          ← Muestreo conjunto
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{batch.code}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Creado el {new Date(batch.created_at).toLocaleDateString("es-PE")} · {saleLots?.length ?? 0} lotes
              de venta · {fmtKg(totalKg)}
              {totalOfficialKg > 0 && ` (${fmtKg(totalOfficialKg)} según peso oficial)`}
            </p>
          </div>
          {!hasResult && (
            <ActionButton
              action={undoSampleBatch.bind(null, batch.id)}
              label="Deshacer muestreo"
              pendingLabel="Deshaciendo..."
              variant="danger"
              confirmText="¿Deshacer este muestreo? Los lotes de venta vuelven a 'recibido_py' sin agrupar."
            />
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Lotes de venta mezclados
        </h2>
        {!saleLots || saleLots.length === 0 ? (
          <p className="text-sm text-slate-500">No hay lotes asociados.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {saleLots.map((l) => (
              <Link
                key={l.id}
                href={`/ventas/${l.id}`}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-mono text-slate-700 hover:bg-slate-200"
              >
                {l.code}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Resultado de laboratorio
        </h2>
        {hasResult ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="space-y-1 text-slate-600">
              <div>
                {batch.lab_name ?? "Laboratorio sin datos"} ·{" "}
                {fmtDate(batch.sampled_at) ?? "Sin fecha"}
                {batch.report_number && ` · Informe ${batch.report_number}`}
              </div>
              <div className="text-xs">
                Au {batch.au_gt} g/t · Ag {batch.ag_gt} g/t · Pb {batch.pb_pct}%
              </div>
              <div className="text-xs text-slate-400">
                {batch.as_pct != null && `As ${batch.as_pct}% · `}
                {batch.sb_pct != null && `Sb ${batch.sb_pct}% · `}
                {batch.s_pct != null && `S ${batch.s_pct}% · `}
                {batch.humidity_pct != null && `Humedad ${batch.humidity_pct}%`}
              </div>
              {batch.notes && <div className="text-xs text-slate-400">Notas: {batch.notes}</div>}
            </div>
            <DeleteRowButton
              action={deleteSampleResult.bind(null, batch.id)}
              confirmText="¿Eliminar este resultado de laboratorio?"
            />
          </div>
        ) : (
          <SampleResultForm batchId={batch.id} />
        )}
      </div>
    </div>
  );
}
