"use client";

import { useActionState, useEffect, useRef } from "react";
import { createWeighing, updateWeighing, type LogisticsFormState } from "./actions";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type InitialValues = { net_weight: number | null; ticket_number: string | null; weighed_at: string | null };

export function HuanchacoWeighingForm({
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
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state == null) onDone?.();
    prevPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="type" value="huanchaco" />
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Peso neto en Huanchaco (kg)</span>
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
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Guardando..." : weighingId ? "Guardar cambios" : "+ Registrar pesaje Huanchaco"}
      </button>
      {onDone && (
        <button type="button" onClick={onDone} className="text-xs text-slate-500 hover:underline">
          Cancelar
        </button>
      )}
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
