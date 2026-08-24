"use client";

import { useState } from "react";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteLabAnalysis } from "./actions";
import { LabAnalysisForm } from "./LabAnalysisForm";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

function MetalCompareRow({
  label,
  unit,
  real,
  estimated,
}: {
  label: string;
  unit: string;
  real: number | null;
  estimated: number | null;
}) {
  if (real == null) return null;
  const isLow = estimated != null && real < estimated;
  return (
    <div className={`text-xs ${isLow ? "text-amber-700" : "text-slate-400"}`}>
      {label}: {real} {unit}
      {estimated != null && ` (estimado: ${estimated} ${unit})`}
      {isLow && " — menor al estimado, revisar"}
    </div>
  );
}

type Analysis = {
  id: string;
  sampled_at: string | null;
  analyzed_at: string | null;
  lab_name: string | null;
  report_number: string | null;
  au_gt: number | null;
  ag_gt: number | null;
  pb_pct: number | null;
  as_pct: number | null;
  sb_pct: number | null;
  s_pct: number | null;
  humidity_pct: number | null;
  notes: string | null;
};

export function LabAnalysisRow({
  lotId,
  analysis,
  estimatedAu,
  estimatedAg,
  estimatedPb,
}: {
  lotId: string;
  analysis: Analysis;
  estimatedAu: number | null;
  estimatedAg: number | null;
  estimatedPb: number | null;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <LabAnalysisForm lotId={lotId} analysisId={analysis.id} initialValues={analysis} onDone={() => setEditing(false)} />
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
      <div className="space-y-2 text-slate-400">
        <div>
          {analysis.lab_name ?? "Laboratorio sin datos"} ·{" "}
          {fmtDate(analysis.analyzed_at) ?? fmtDate(analysis.sampled_at) ?? "Sin fecha"}
          {analysis.report_number && ` · Informe ${analysis.report_number}`}
        </div>
        <div className="space-y-1">
          <MetalCompareRow label="Au" unit="g/t" real={analysis.au_gt} estimated={estimatedAu} />
          <MetalCompareRow label="Ag" unit="g/t" real={analysis.ag_gt} estimated={estimatedAg} />
          <MetalCompareRow label="Pb" unit="%" real={analysis.pb_pct} estimated={estimatedPb} />
        </div>
        <div className="text-xs text-slate-500">
          {analysis.as_pct != null && `As ${analysis.as_pct}% · `}
          {analysis.sb_pct != null && `Sb ${analysis.sb_pct}% · `}
          {analysis.s_pct != null && `S ${analysis.s_pct}% · `}
          {analysis.humidity_pct != null && `Humedad ${analysis.humidity_pct}%`}
        </div>
        {analysis.notes && <div className="text-xs text-slate-500">Notas: {analysis.notes}</div>}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
          Editar
        </button>
        <DeleteRowButton
          action={deleteLabAnalysis.bind(null, lotId, analysis.id)}
          confirmText="¿Eliminar este resultado de laboratorio?"
        />
      </div>
    </div>
  );
}
