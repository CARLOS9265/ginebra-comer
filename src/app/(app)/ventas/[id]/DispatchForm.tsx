"use client";

import { useActionState, useEffect, useRef } from "react";
import { dispatchSaleLot, updateDispatch, type SaleLotFormState } from "../actions";
import { CARRIERS } from "@/lib/carriers";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type InitialValues = {
  dispatched_at: string | null;
  dispatch_carrier: string | null;
  dispatch_truck_plate: string | null;
};

export function DispatchForm({
  saleLotId,
  editing,
  initialValues,
  onDone,
}: {
  saleLotId: string;
  editing?: boolean;
  initialValues?: InitialValues;
  onDone?: () => void;
}) {
  const boundAction = editing ? updateDispatch.bind(null, saleLotId) : dispatchSaleLot.bind(null, saleLotId);
  const [state, action, pending] = useActionState<SaleLotFormState, FormData>(boundAction, null);
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state == null) onDone?.();
    prevPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha y hora de salida</span>
          <input
            name="dispatched_at"
            type="datetime-local"
            defaultValue={toLocalInputValue(initialValues?.dispatched_at ?? null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Transportista</span>
          <select name="dispatch_carrier" defaultValue={initialValues?.dispatch_carrier ?? ""} className={inputClass}>
            <option value="">Elegir...</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Placa del volquete</span>
          <input
            name="dispatch_truck_plate"
            defaultValue={initialValues?.dispatch_truck_plate ?? ""}
            className={inputClass}
          />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : editing ? "Guardar cambios" : "+ Registrar despacho"}
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
