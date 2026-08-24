"use client";

import { useActionState } from "react";
import { receiveSaleLotAtPY, type SaleLotFormState } from "../actions";

export function PyReceptionForm({ saleLotId }: { saleLotId: string }) {
  const boundAction = receiveSaleLotAtPY.bind(null, saleLotId);
  const [state, action, pending] = useActionState<SaleLotFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha y hora de recepción</span>
          <input name="received_at_py" type="datetime-local" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Almacén / planta de PY</span>
          <input name="py_warehouse" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Recibido por (PY)</span>
          <input name="py_received_by" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Peso oficial del trailer (kg)</span>
          <input name="py_official_weight_kg" type="number" step="0.01" className={inputClass} />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar recepción en PY"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
