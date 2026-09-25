"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTransportEvent, updateTransportEvent, type LogisticsFormState } from "./actions";
import { CARRIERS } from "@/lib/carriers";

type InitialValues = {
  carrier_name: string | null;
};

export function TransportForm({
  lotId,
  defaultCarrier,
  eventId,
  initialValues,
  onDone,
}: {
  lotId: string;
  defaultCarrier?: string;
  eventId?: string;
  initialValues?: InitialValues;
  onDone?: () => void;
}) {
  const boundAction = eventId
    ? updateTransportEvent.bind(null, lotId, eventId)
    : createTransportEvent.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state == null) onDone?.();
    prevPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Transportista</span>
          <select
            name="carrier_name"
            defaultValue={initialValues?.carrier_name ?? defaultCarrier ?? ""}
            className={inputClass}
          >
            <option value="">Elegir...</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-400">
        La fecha de salida se toma de la fecha de carga del lote. La tarifa de transporte y el costo de
        seguridad son fijos: se suman solos al costo del lote.
      </p>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : eventId ? "Guardar cambios" : "+ Registrar salida"}
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
