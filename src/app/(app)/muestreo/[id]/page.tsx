import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/ActionButton";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import {
  undoSampleBatch,
  deleteProvisionalAssay,
  deleteFinalAssay,
  markProvisionalPaid,
  markFinalPaid,
  saveFinalLiquidation,
} from "../actions";
import { ProvisionalAssayForm } from "./ProvisionalAssayForm";
import { FinalAssayForm } from "./FinalAssayForm";
import { ProvisionalLiquidationForm } from "./ProvisionalLiquidationForm";
import { FixationWindowForm } from "./FixationWindowForm";
import { MetalFixation } from "./MetalFixation";

const fmtKg = (n: number) => `${n.toLocaleString("es-PE")} kg`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);
const fmtUSD = (n: number | null, decimals = 2) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals });

export default async function SampleBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: batch } = await supabase.from("py_sample_batches").select("*").eq("id", id).maybeSingle();

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

  const hasProvAssay = batch.prov_au_gt != null;
  const hasProvLiquidation = batch.prov_value_total != null;
  const hasFinalAssay = batch.final_au_gt != null;
  const allFixed = batch.au_fixed_price != null && batch.ag_fixed_price != null && batch.pb_fixed_price != null;
  const hasFinalLiquidation = batch.final_value_total != null;
  const windowEnded = batch.fixation_window_end ? new Date(batch.fixation_window_end) < new Date() : false;

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
          {!hasProvAssay && (
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
          Ensaye provisional
        </h2>
        {hasProvAssay ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="space-y-1 text-slate-600">
              <div>
                {batch.prov_lab_name ?? "Laboratorio sin datos"} · {fmtDate(batch.prov_sampled_at) ?? "Sin fecha"}
                {batch.prov_report_number && ` · Informe ${batch.prov_report_number}`}
              </div>
              <div className="text-xs">
                Au {batch.prov_au_gt} g/t · Ag {batch.prov_ag_gt} g/t · Pb {batch.prov_pb_pct}%
              </div>
            </div>
            {!hasProvLiquidation && (
              <DeleteRowButton
                action={deleteProvisionalAssay.bind(null, batch.id)}
                confirmText="¿Eliminar este ensaye provisional?"
              />
            )}
          </div>
        ) : (
          <ProvisionalAssayForm batchId={batch.id} />
        )}
      </div>

      {hasProvAssay && (
        <div>
          <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Liquidación provisional (90%)
          </h2>
          {hasProvLiquidation ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <Row label="Precio Au (prom. 5 días)" value={fmtUSD(batch.prov_price_au)} />
                <Row label="Precio Ag (prom. 5 días)" value={fmtUSD(batch.prov_price_ag)} />
                <Row label="Precio Pb (prom. 5 días)" value={fmtUSD(batch.prov_price_pb, 0)} />
                <div className="my-2 border-t border-dashed border-slate-200" />
                <Row label="Valor estimado /TMH" value={fmtUSD(batch.prov_value_per_tmh)} />
                <Row label="Valor estimado total (100%)" value={fmtUSD(batch.prov_value_total, 0)} />
                <Row label="Pago provisional (90%)" value={fmtUSD(batch.prov_payment_total, 0)} strong />
              </div>
              {batch.prov_paid_at ? (
                <p className="text-sm text-emerald-700">Pagado el {fmtDate(batch.prov_paid_at)}.</p>
              ) : (
                <ActionButton
                  action={markProvisionalPaid.bind(null, batch.id)}
                  label="Marcar pago provisional como recibido"
                  pendingLabel="Guardando..."
                  confirmText="¿Confirmás que ya se recibió el pago provisional de PY?"
                />
              )}
            </div>
          ) : (
            <ProvisionalLiquidationForm batchId={batch.id} />
          )}
        </div>
      )}

      {hasProvAssay && (
        <div>
          <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ensaye final
          </h2>
          {hasFinalAssay ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="space-y-1 text-slate-600">
                <div>
                  {batch.final_lab_name ?? "Laboratorio sin datos"} ·{" "}
                  {fmtDate(batch.final_sampled_at) ?? "Sin fecha"}
                  {batch.final_report_number && ` · Informe ${batch.final_report_number}`}
                </div>
                <div className="text-xs">
                  Au {batch.final_au_gt} g/t · Ag {batch.final_ag_gt} g/t · Pb {batch.final_pb_pct}%
                </div>
              </div>
              {!hasFinalLiquidation && (
                <DeleteRowButton
                  action={deleteFinalAssay.bind(null, batch.id)}
                  confirmText="¿Eliminar este ensaye final?"
                />
              )}
            </div>
          ) : (
            <FinalAssayForm batchId={batch.id} />
          )}
        </div>
      )}

      {hasFinalAssay && (
        <div>
          <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fijación de precio por metal
          </h2>
          <p className="mb-2 text-xs text-slate-500">
            Ventana de fijación: {batch.fixation_window_start} a {batch.fixation_window_end}
            {windowEnded && !allFixed && " — venció"}
          </p>
          <div className="mb-3">
            <FixationWindowForm
              batchId={batch.id}
              start={batch.fixation_window_start}
              end={batch.fixation_window_end}
            />
          </div>
          <div className="space-y-2">
            <MetalFixation
              batchId={batch.id}
              metal="au"
              fixedAt={batch.au_fixed_at}
              fixedPrice={batch.au_fixed_price}
              windowEnded={windowEnded}
            />
            <MetalFixation
              batchId={batch.id}
              metal="ag"
              fixedAt={batch.ag_fixed_at}
              fixedPrice={batch.ag_fixed_price}
              windowEnded={windowEnded}
            />
            <MetalFixation
              batchId={batch.id}
              metal="pb"
              fixedAt={batch.pb_fixed_at}
              fixedPrice={batch.pb_fixed_price}
              windowEnded={windowEnded}
            />
          </div>
        </div>
      )}

      {hasFinalAssay && allFixed && (
        <div>
          <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Liquidación final
          </h2>
          {hasFinalLiquidation ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <Row label="Valor final /TMH" value={fmtUSD(batch.final_value_per_tmh)} />
                <Row label="Valor final total" value={fmtUSD(batch.final_value_total, 0)} />
                <Row label="Ya pagado (provisional)" value={fmtUSD(batch.prov_payment_total, 0)} />
                <div className="my-2 border-t border-dashed border-slate-200" />
                <Row
                  label={
                    (batch.final_balance_total ?? 0) >= 0 ? "Saldo a favor de Ginebra" : "Saldo a favor de PY"
                  }
                  value={fmtUSD(Math.abs(batch.final_balance_total ?? 0), 0)}
                  strong
                />
              </div>
              {batch.final_paid_at ? (
                <p className="text-sm text-emerald-700">Pagado el {fmtDate(batch.final_paid_at)}.</p>
              ) : (
                <ActionButton
                  action={markFinalPaid.bind(null, batch.id)}
                  label="Marcar pago final como recibido"
                  pendingLabel="Guardando..."
                  confirmText="¿Confirmás que ya se recibió el pago final de PY?"
                />
              )}
            </div>
          ) : (
            <ActionButton
              action={saveFinalLiquidation.bind(null, batch.id)}
              label="Calcular liquidación final"
              pendingLabel="Calculando..."
            />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${strong ? "text-sm font-semibold text-gold-700" : "text-slate-700"}`}>
        {value}
      </span>
    </div>
  );
}
