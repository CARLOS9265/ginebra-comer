"use client";

import { useActionState } from "react";
import { createComminution, type LogisticsFormState } from "./actions";

export function ComminutionForm({ lotId, officialWeightHint }: { lotId: string; officialWeightHint?: string }) {
  const boundAction = createComminution.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Inicio</span>
          <input name="started_at" type="datetime-local" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Fin</span>
          <input name="finished_at" type="datetime-local" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Toneladas procesadas (según molino)</span>
          <input name="processed_tons" type="number" step="0.01" className={inputClass} />
          {officialWeightHint && <span className="mt-1 block text-xs text-slate-600">{officialWeightHint}</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">N° de factura del molino</span>
          <input name="mill_invoice_number" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Tarifa (S/ por tonelada)</span>
          <input name="tariff_pen_per_ton" type="number" step="0.01" defaultValue="80" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Responsable</span>
          <input name="responsible_name" className={inputClass} />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar conminución"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500";
