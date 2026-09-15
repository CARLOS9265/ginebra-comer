"use client";

import { useActionState, useEffect, useRef } from "react";
import { createMillReception, updateMillReception, type LogisticsFormState } from "./actions";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type InitialValues = {
  received_at: string | null;
  supervisor_name: string | null;
};

export function MillReceptionForm({
  lotId,
  receptionId,
  initialValues,
  onDone,
}: {
  lotId: string;
  receptionId?: string;
  initialValues?: InitialValues;
  onDone?: () => void;
}) {
  const boundAction = receptionId
    ? updateMillReception.bind(null, lotId, receptionId)
    : createMillReception.bind(null, lotId);
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
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha de recepción</span>
          <input
            name="received_at"
            type="date"
            defaultValue={toLocalInputValue(initialValues?.received_at ?? null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Supervisor que recibe</span>
          <input name="supervisor_name" defaultValue={initialValues?.supervisor_name ?? ""} className={inputClass} />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : receptionId ? "Guardar cambios" : "+ Registrar recepción"}
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
