"use client";

import { useActionState } from "react";
import { createTransportEvent, type LogisticsFormState } from "./actions";
import { CARRIERS } from "@/lib/carriers";

export function TransportForm({ lotId, defaultCarrier }: { lotId: string; defaultCarrier?: string }) {
  const boundAction = createTransportEvent.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Transportista</span>
          <select name="carrier_name" defaultValue={defaultCarrier ?? ""} className={inputClass}>
            <option value="">Elegir...</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Tarifa (S/ por TMH)</span>
          <input name="tariff_pen_per_tmh" type="number" step="0.01" defaultValue="179.66" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Costo de seguridad (S/)</span>
          <input name="security_cost_pen" type="number" step="0.01" className={inputClass} />
        </label>
      </div>
      <p className="text-xs text-slate-400">
        La fecha de salida se toma de la fecha y hora de carga del lote.
      </p>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar salida"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
