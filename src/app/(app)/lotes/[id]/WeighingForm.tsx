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
    <form action={action} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Tipo</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Peso bruto (kg)</span>
          <input name="gross_weight" type="number" step="0.01" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Tara (kg)</span>
          <input name="tare_weight" type="number" step="0.01" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Peso neto (kg)</span>
          <input name="net_weight" type="number" step="0.01" className={inputClass} />
          <span className="mt-1 block text-xs text-slate-600">Si lo dejás vacío, se calcula bruto − tara.</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">N° de ticket</span>
          <input name="ticket_number" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Fecha y hora</span>
          <input name="weighed_at" type="datetime-local" className={inputClass} />
        </label>
        {type === "regularizacion" && (
          <label className="col-span-2 block sm:col-span-3">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Motivo de la regularización</span>
            <input name="reason" className={inputClass} />
          </label>
        )}
      </div>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar pesaje"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500";
