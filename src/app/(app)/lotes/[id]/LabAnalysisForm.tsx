"use client";

import { useActionState, useEffect, useRef } from "react";
import { createLabAnalysis, updateLabAnalysis, type LogisticsFormState } from "./actions";

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

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
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
            defaultValue={toLocalInputValue(initialValues?.analyzed_at ?? null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Laboratorio</span>
          <input name="lab_name" defaultValue={initialValues?.lab_name ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de informe</span>
          <input name="report_number" defaultValue={initialValues?.report_number ?? ""} className={inputClass} />
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
              defaultValue={initialValues?.au_gt ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Ag (g/t)</span>
            <input
              name="ag_gt"
              type="number"
              step="0.001"
              defaultValue={initialValues?.ag_gt ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Pb (%)</span>
            <input
              name="pb_pct"
              type="number"
              step="0.001"
              defaultValue={initialValues?.pb_pct ?? ""}
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
              defaultValue={initialValues?.as_pct ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Sb (%)</span>
            <input
              name="sb_pct"
              type="number"
              step="0.001"
              defaultValue={initialValues?.sb_pct ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">S (%)</span>
            <input
              name="s_pct"
              type="number"
              step="0.001"
              defaultValue={initialValues?.s_pct ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Humedad (%)</span>
            <input
              name="humidity_pct"
              type="number"
              step="0.001"
              defaultValue={initialValues?.humidity_pct ?? ""}
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
