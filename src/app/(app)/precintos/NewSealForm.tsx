"use client";

import { useActionState } from "react";
import { createSeal, type SealFormState } from "./actions";

type Lot = { id: string; code: string; dispatch_truck_plate: string | null };

function lotLabel(l: Lot) {
  return l.dispatch_truck_plate ? `${l.dispatch_truck_plate} — ${l.code}` : l.code;
}

export function NewSealForm({ lots }: { lots: Lot[] }) {
  const [state, action, pending] = useActionState<SealFormState, FormData>(createSeal, null);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Código del precinto</span>
        <input
          name="code"
          required
          className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Placa / Lote (opcional)</span>
        <select
          name="sale_lot_id"
          defaultValue=""
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500"
        >
          <option value="">Sin asignar (stock)</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {lotLabel(l)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Agregar precinto"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
