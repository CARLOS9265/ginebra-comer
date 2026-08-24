"use client";

import { useActionState } from "react";
import { createMillReception, type LogisticsFormState } from "./actions";

export function MillReceptionForm({ lotId }: { lotId: string }) {
  const boundAction = createMillReception.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha y hora de recepción</span>
          <input name="received_at" type="datetime-local" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Supervisor que recibe</span>
          <input name="supervisor_name" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Ubicación de almacenamiento</span>
          <input name="storage_location" className={inputClass} />
        </label>
        <label className="col-span-2 block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Incidentes</span>
          <textarea name="incidents" rows={2} className={`${inputClass} resize-none`} />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar recepción"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
