"use client";

import { useActionState, useEffect, useRef } from "react";
import { receiveSaleLotAtPY, updatePyReception, type SaleLotFormState } from "../actions";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type InitialValues = {
  received_at_py: string | null;
  py_warehouse: string | null;
  py_received_by: string | null;
  py_official_weight_kg: number | null;
};

export function PyReceptionForm({
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
  const boundAction = editing
    ? updatePyReception.bind(null, saleLotId)
    : receiveSaleLotAtPY.bind(null, saleLotId);
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
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha de recepción</span>
          <input
            name="received_at_py"
            type="date"
            defaultValue={toLocalInputValue(initialValues?.received_at_py ?? null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Almacén / planta de PY</span>
          <input name="py_warehouse" defaultValue={initialValues?.py_warehouse ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Recibido por (PY)</span>
          <input name="py_received_by" defaultValue={initialValues?.py_received_by ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Peso oficial del trailer (kg)</span>
          <input
            name="py_official_weight_kg"
            type="number"
            step="0.01"
            required
            defaultValue={initialValues?.py_official_weight_kg ?? ""}
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
          {pending ? "Guardando..." : editing ? "Guardar cambios" : "+ Registrar recepción en PY"}
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
