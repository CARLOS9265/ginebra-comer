"use client";

import { useActionState } from "react";
import { addBigBag, type LogisticsFormState } from "./actions";

export function BigBagForm({ lotId, comminutionId }: { lotId: string; comminutionId: string }) {
  const boundAction = addBigBag.bind(null, lotId, comminutionId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-400">Peso (kg)</span>
        <input
          name="weight_kg"
          type="number"
          step="0.01"
          placeholder="≈ 1500"
          required
          className="w-32 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-400">Ubicación (opcional)</span>
        <input
          name="storage_location"
          className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Agregar big bag"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
