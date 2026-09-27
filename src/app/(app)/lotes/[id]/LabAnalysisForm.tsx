"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createLabAnalysis, updateLabAnalysis, type LogisticsFormState } from "./actions";
import { LabReportScanInput } from "@/components/LabReportScanInput";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type InitialValues = {
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

const numStr = (n: number | null | undefined) => (n == null ? "" : String(n));

export function LabAnalysisForm({
  lotId,
  analysisId,
  initialValues,
  onDone,
}: {
  lotId: string;
  analysisId?: string;
  initialValues?: InitialValues;
  onDone?: () => void;
}) {
  const boundAction = analysisId
    ? updateLabAnalysis.bind(null, lotId, analysisId)
    : createLabAnalysis.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state == null) onDone?.();
    prevPending.current = pending;
  }, [pending, state, onDone]);

  // Controlados (en vez de defaultValue) para que la lectura del informe
  // pueda prellenarlos — el usuario los sigue pudiendo editar a mano.
  const [analyzedAt, setAnalyzedAt] = useState(toLocalInputValue(initialValues?.analyzed_at ?? null));
  const [labName, setLabName] = useState(initialValues?.lab_name ?? "");
  const [reportNumber, setReportNumber] = useState(initialValues?.report_number ?? "");
  const [auGt, setAuGt] = useState(numStr(initialValues?.au_gt));
  const [agGt, setAgGt] = useState(numStr(initialValues?.ag_gt));
  const [pbPct, setPbPct] = useState(numStr(initialValues?.pb_pct));
  const [asPct, setAsPct] = useState(numStr(initialValues?.as_pct));
  const [sbPct, setSbPct] = useState(numStr(initialValues?.sb_pct));
  const [sPct, setSPct] = useState(numStr(initialValues?.s_pct));
  const [humidityPct, setHumidityPct] = useState(numStr(initialValues?.humidity_pct));

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {!analysisId && (
        <LabReportScanInput
          onExtracted={(data) => {
            if (data.lab_name) setLabName(data.lab_name);
            if (data.report_number) setReportNumber(data.report_number);
            if (data.analyzed_at) setAnalyzedAt(data.analyzed_at);
            if (data.au_gt != null) setAuGt(String(data.au_gt));
            if (data.ag_gt != null) setAgGt(String(data.ag_gt));
            if (data.pb_pct != null) setPbPct(String(data.pb_pct));
            if (data.as_pct != null) setAsPct(String(data.as_pct));
            if (data.sb_pct != null) setSbPct(String(data.sb_pct));
            if (data.s_pct != null) setSPct(String(data.s_pct));
            if (data.humidity_pct != null) setHumidityPct(String(data.humidity_pct));
          }}
        />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha de muestreo</span>
          <input
            name="sampled_at"
            type="date"
            defaultValue={toLocalInputValue(initialValues?.sampled_at ?? null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha de resultado</span>
          <input
            name="analyzed_at"
            type="date"
            value={analyzedAt}
            onChange={(e) => setAnalyzedAt(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Laboratorio</span>
          <input name="lab_name" value={labName} onChange={(e) => setLabName(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de informe</span>
          <input
            name="report_number"
            value={reportNumber}
            onChange={(e) => setReportNumber(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3">
        <p className="mb-2 text-xs font-medium text-slate-500">Ley (entra en la valorización)</p>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Au (g/t)</span>
            <input
              name="au_gt"
              type="number"
              step="0.001"
              value={auGt}
              onChange={(e) => setAuGt(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Ag (g/t)</span>
            <input
              name="ag_gt"
              type="number"
              step="0.001"
              value={agGt}
              onChange={(e) => setAgGt(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Pb (%)</span>
            <input
              name="pb_pct"
              type="number"
              step="0.001"
              value={pbPct}
              onChange={(e) => setPbPct(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3">
        <p className="mb-2 text-xs font-medium text-slate-500">
          Otros elementos (solo registro — no afectan el pago al proveedor)
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">As (%)</span>
            <input
              name="as_pct"
              type="number"
              step="0.001"
              value={asPct}
              onChange={(e) => setAsPct(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Sb (%)</span>
            <input
              name="sb_pct"
              type="number"
              step="0.001"
              value={sbPct}
              onChange={(e) => setSbPct(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">S (%)</span>
            <input
              name="s_pct"
              type="number"
              step="0.001"
              value={sPct}
              onChange={(e) => setSPct(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Humedad (%)</span>
            <input
              name="humidity_pct"
              type="number"
              step="0.001"
              value={humidityPct}
              onChange={(e) => setHumidityPct(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Notas</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initialValues?.notes ?? ""}
          className={`${inputClass} resize-none`}
        />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : analysisId ? "Guardar cambios" : "+ Registrar resultado de laboratorio"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="text-xs text-slate-500 hover:underline">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
