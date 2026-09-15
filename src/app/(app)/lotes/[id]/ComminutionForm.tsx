"use client";

import { useActionState, useEffect, useRef } from "react";
import { createComminution, updateComminution, type LogisticsFormState } from "./actions";

type InitialValues = {
  processed_tons: number | null;
  tariff_pen_per_ton: number | null;
  bag_count: number | null;
};

export function ComminutionForm({
  lotId,
  officialWeightHint,
  comminutionId,
  initialValues,
  onDone,
}: {
  lotId: string;
  officialWeightHint?: string;
  comminutionId?: string;
  initialValues?: InitialValues;
  onDone?: () => void;
}) {
  const boundAction = comminutionId
    ? updateComminution.bind(null, lotId, comminutionId)
    : createComminution.bind(null, lotId);
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
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Toneladas procesadas (según molino)</span>
          <input
            name="processed_tons"
            type="number"
            step="0.01"
            defaultValue={initialValues?.processed_tons ?? ""}
            className={inputClass}
          />
          {officialWeightHint && <span className="mt-1 block text-xs text-slate-400">{officialWeightHint}</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Tarifa (S/ por tonelada)</span>
          <input
            name="tariff_pen_per_ton"
            type="number"
            step="0.01"
            defaultValue={initialValues?.tariff_pen_per_ton ?? "80"}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Cantidad de bolsones (big bags)</span>
          <input
            name="bag_count"
            type="number"
            step="1"
            min="1"
            defaultValue={initialValues?.bag_count ?? ""}
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
          {pending ? "Guardando..." : comminutionId ? "Guardar cambios" : "+ Registrar conminución"}
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
