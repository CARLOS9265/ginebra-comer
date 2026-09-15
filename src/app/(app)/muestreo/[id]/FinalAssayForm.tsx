"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveFinalAssay, type SampleBatchFormState } from "../actions";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type InitialValues = {
  final_sampled_at: string | null;
  final_lab_name: string | null;
  final_report_number: string | null;
  final_au_gt: number | null;
  final_ag_gt: number | null;
  final_pb_pct: number | null;
  final_as_pct: number | null;
  final_sb_pct: number | null;
  final_s_pct: number | null;
  final_humidity_pct: number | null;
  final_notes: string | null;
};

export function FinalAssayForm({
  batchId,
  editing,
  initialValues,
  onDone,
}: {
  batchId: string;
  editing?: boolean;
  initialValues?: InitialValues;
  onDone?: () => void;
}) {
  const boundAction = saveFinalAssay.bind(null, batchId);
  const [state, action, pending] = useActionState<SampleBatchFormState, FormData>(boundAction, null);
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state == null) onDone?.();
    prevPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">
        Ensaye conjunto (Ginebra + PY), laboratorio internacional — Alex Stewart o Alfred H Knight
        (cláusula 11.2 del contrato).
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha de muestreo</span>
          <input
            name="final_sampled_at"
            type="date"
            defaultValue={toLocalInputValue(initialValues?.final_sampled_at ?? null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Laboratorio</span>
          <input name="final_lab_name" defaultValue={initialValues?.final_lab_name ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de informe</span>
          <input
            name="final_report_number"
            defaultValue={initialValues?.final_report_number ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3">
        <p className="mb-2 text-xs font-medium text-slate-500">Ley (para la liquidación final)</p>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Au (g/t)</span>
            <input
              name="final_au_gt"
              type="number"
              step="0.001"
              defaultValue={initialValues?.final_au_gt ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Ag (g/t)</span>
            <input
              name="final_ag_gt"
              type="number"
              step="0.001"
              defaultValue={initialValues?.final_ag_gt ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Pb (%)</span>
            <input
              name="final_pb_pct"
              type="number"
              step="0.001"
              defaultValue={initialValues?.final_pb_pct ?? ""}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3">
        <p className="mb-2 text-xs font-medium text-slate-500">Otros elementos (solo registro)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">As (%)</span>
            <input
              name="final_as_pct"
              type="number"
              step="0.001"
              defaultValue={initialValues?.final_as_pct ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Sb (%)</span>
            <input
              name="final_sb_pct"
              type="number"
              step="0.001"
              defaultValue={initialValues?.final_sb_pct ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">S (%)</span>
            <input
              name="final_s_pct"
              type="number"
              step="0.001"
              defaultValue={initialValues?.final_s_pct ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Humedad (%)</span>
            <input
              name="final_humidity_pct"
              type="number"
              step="0.001"
              defaultValue={initialValues?.final_humidity_pct ?? ""}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Notas</span>
        <textarea
          name="final_notes"
          rows={2}
          defaultValue={initialValues?.final_notes ?? ""}
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
          {pending ? "Guardando..." : editing ? "Guardar cambios" : "+ Registrar ensaye final"}
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
