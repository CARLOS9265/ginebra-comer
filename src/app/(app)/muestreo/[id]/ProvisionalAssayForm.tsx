"use client";

import { useActionState } from "react";
import { saveProvisionalAssay, type SampleBatchFormState } from "../actions";

export function ProvisionalAssayForm({ batchId }: { batchId: string }) {
  const boundAction = saveProvisionalAssay.bind(null, batchId);
  const [state, action, pending] = useActionState<SampleBatchFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">
        Ensaye rápido de laboratorio local, para el pago provisional (cláusula 11.1 del contrato).
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha de muestreo</span>
          <input name="prov_sampled_at" type="datetime-local" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Laboratorio</span>
          <input name="prov_lab_name" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de informe</span>
          <input name="prov_report_number" className={inputClass} />
        </label>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3">
        <p className="mb-2 text-xs font-medium text-slate-500">Ley</p>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Au (g/t)</span>
            <input name="prov_au_gt" type="number" step="0.001" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Ag (g/t)</span>
            <input name="prov_ag_gt" type="number" step="0.001" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Pb (%)</span>
            <input name="prov_pb_pct" type="number" step="0.001" className={inputClass} />
          </label>
        </div>
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3">
        <p className="mb-2 text-xs font-medium text-slate-500">Otros elementos (solo registro)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">As (%)</span>
            <input name="prov_as_pct" type="number" step="0.001" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Sb (%)</span>
            <input name="prov_sb_pct" type="number" step="0.001" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">S (%)</span>
            <input name="prov_s_pct" type="number" step="0.001" className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Humedad (%)</span>
            <input name="prov_humidity_pct" type="number" step="0.001" className={inputClass} />
          </label>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Notas</span>
        <textarea name="prov_notes" rows={2} className={`${inputClass} resize-none`} />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar ensaye provisional"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
