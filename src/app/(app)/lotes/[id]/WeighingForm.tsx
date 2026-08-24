"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createWeighing, updateWeighing, type LogisticsFormState } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  inicial: "Inicial (guía)",
  oficial: "Oficial (balanza Trujillo)",
  regularizacion: "Regularización",
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type InitialValues = {
  type: string;
  net_weight: number | null;
  ticket_number: string | null;
  weighed_at: string | null;
  reason: string | null;
};

export function WeighingForm({
  lotId,
  weighingId,
  initialValues,
  onDone,
}: {
  lotId: string;
  weighingId?: string;
  initialValues?: InitialValues;
  onDone?: () => void;
}) {
  const boundAction = weighingId ? updateWeighing.bind(null, lotId, weighingId) : createWeighing.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);
  const [type, setType] = useState(initialValues?.type ?? "inicial");
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state == null) onDone?.();
    prevPending.current = pending;
  }, [pending, state, onDone]);

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
          <input
            name="net_weight"
            type="number"
            step="0.01"
            required
            defaultValue={initialValues?.net_weight ?? ""}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de ticket</span>
          <input name="ticket_number" defaultValue={initialValues?.ticket_number ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha y hora</span>
          <input
            name="weighed_at"
            type="datetime-local"
            defaultValue={toLocalInputValue(initialValues?.weighed_at ?? null)}
            className={inputClass}
          />
        </label>
        {type === "regularizacion" && (
          <label className="col-span-2 block sm:col-span-3">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Motivo de la regularización</span>
            <input name="reason" defaultValue={initialValues?.reason ?? ""} className={inputClass} />
          </label>
        )}
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : weighingId ? "Guardar cambios" : "+ Registrar pesaje"}
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
