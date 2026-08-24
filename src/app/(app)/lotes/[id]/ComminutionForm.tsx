"use client";

import { useActionState } from "react";
import { createComminution, type LogisticsFormState } from "./actions";

export function ComminutionForm({ lotId, officialWeightHint }: { lotId: string; officialWeightHint?: string }) {
  const boundAction = createComminution.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Inicio</span>
          <input name="started_at" type="datetime-local" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fin</span>
          <input name="finished_at" type="datetime-local" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Toneladas procesadas (según molino)</span>
          <input name="processed_tons" type="number" step="0.01" className={inputClass} />
          {officialWeightHint && <span className="mt-1 block text-xs text-slate-400">{officialWeightHint}</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de factura del molino</span>
          <input name="mill_invoice_number" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Tarifa (S/ por tonelada)</span>
          <input name="tariff_pen_per_ton" type="number" step="0.01" defaultValue="80" className={inputClass} />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar conminución"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
