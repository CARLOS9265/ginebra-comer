"use client";

import { useActionState, useState } from "react";
import { addAllocation, type SaleLotFormState } from "../actions";
import type { AvailableLot } from "../available-bags";

export function AllocationForm({ saleLotId, lots }: { saleLotId: string; lots: AvailableLot[] }) {
  const boundAction = addAllocation.bind(null, saleLotId);
  const [state, action, pending] = useActionState<SaleLotFormState, FormData>(boundAction, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-gold-700 hover:underline">
        + Agregar más bolsones
      </button>
    );
  }

  if (lots.length === 0) {
    return <p className="text-sm text-slate-500">No hay bolsones disponibles de otros lotes de compra.</p>;
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Lote de compra</span>
        <select
          name="purchase_lot_id"
          required
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500"
        >
          <option value="">Elegir...</option>
          {lots.map((l) => (
            <option key={l.purchaseLotId} value={l.purchaseLotId}>
              {l.code} ({l.available} disponibles)
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Cantidad</span>
        <input
          name="qty"
          type="number"
          min="1"
          step="1"
          required
          className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Agregando..." : "Agregar"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">
        Cancelar
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
