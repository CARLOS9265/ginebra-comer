"use client";

import { useActionState } from "react";
import { createSeal, type SealFormState } from "./actions";

type Lot = { id: string; code: string };

export function NewSealForm({ lots }: { lots: Lot[] }) {
  const [state, action, pending] = useActionState<SealFormState, FormData>(createSeal, null);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-400">Código del precinto</span>
        <input
          name="code"
          required
          className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-400">Lote (opcional)</span>
        <select
          name="purchase_lot_id"
          defaultValue=""
          className="w-48 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
        >
          <option value="">Sin asignar (stock)</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Agregar precinto"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
