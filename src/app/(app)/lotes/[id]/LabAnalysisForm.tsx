"use client";

import { useActionState } from "react";
import { createLabAnalysis, type LogisticsFormState } from "./actions";

export function LabAnalysisForm({ lotId }: { lotId: string }) {
  const boundAction = createLabAnalysis.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Fecha de muestreo</span>
          <input name="sampled_at" type="datetime-local" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Fecha de resultado</span>
          <input name="analyzed_at" type="datetime-local" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Laboratorio</span>
          <input name="lab_name" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">N° de informe</span>
          <input name="report_number" className={inputClass} />
        </label>
      </div>

      <div className="border-t border-dashed border-slate-800 pt-3">
        <p className="mb-2 text-xs font-medium text-slate-500">Ley (entra en la valorización)</p>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Au (g/t)</span>
            <input name="au_gt" type="number" step="0.001" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Ag (g/t)</span>
            <input name="ag_gt" type="number" step="0.001" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Pb (%)</span>
            <input name="pb_pct" type="number" step="0.001" className={inputClass} />
          </label>
        </div>
      </div>

      <div className="border-t border-dashed border-slate-800 pt-3">
        <p className="mb-2 text-xs font-medium text-slate-500">
          Otros elementos (solo registro — no afectan el pago al proveedor)
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">As (%)</span>
            <input name="as_pct" type="number" step="0.001" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Sb (%)</span>
            <input name="sb_pct" type="number" step="0.001" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">S (%)</span>
            <input name="s_pct" type="number" step="0.001" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Humedad (%)</span>
            <input name="humidity_pct" type="number" step="0.001" className={inputClass} />
          </label>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-400">Notas</span>
        <textarea name="notes" rows={2} className={`${inputClass} resize-none`} />
      </label>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar resultado de laboratorio"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500";
