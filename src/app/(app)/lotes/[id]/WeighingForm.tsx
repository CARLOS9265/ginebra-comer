"use client";

import { useActionState, useState } from "react";
import { createWeighing, type LogisticsFormState } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  inicial: "Inicial (guía)",
  oficial: "Oficial (balanza Trujillo)",
  regularizacion: "Regularización",
};

export function WeighingForm({ lotId }: { lotId: string }) {
  const boundAction = createWeighing.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);
  const [type, setType] = useState("inicial");

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Tipo</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Peso neto (kg)</span>
          <input name="net_weight" type="number" step="0.01" required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de ticket</span>
          <input name="ticket_number" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha y hora</span>
          <input name="weighed_at" type="datetime-local" className={inputClass} />
        </label>
        {type === "regularizacion" && (
          <label className="col-span-2 block sm:col-span-3">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Motivo de la regularización</span>
            <input name="reason" className={inputClass} />
          </label>
        )}
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar pesaje"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
