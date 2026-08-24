"use client";

import { useActionState, useState } from "react";
import { addBigBagsToSaleLot, type SaleLotFormState } from "../actions";

type Bag = { id: string; code: string; weightKg: number | null; purchaseLotCode: string };

export function AddBigBagsSection({ saleLotId, bags }: { saleLotId: string; bags: Bag[] }) {
  const boundAction = addBigBagsToSaleLot.bind(null, saleLotId);
  const [state, action, pending] = useActionState<SaleLotFormState, FormData>(boundAction, null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-gold-700 hover:underline"
      >
        + Agregar más big bags
      </button>
    );
  }

  if (bags.length === 0) {
    return <p className="text-sm text-slate-500">No hay big bags disponibles para agregar.</p>;
  }

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="max-h-64 overflow-y-auto overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Lote de compra</th>
              <th className="px-3 py-2 text-right">Peso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {bags.map((b) => (
              <tr key={b.id} className="cursor-pointer hover:bg-slate-100/50" onClick={() => toggle(b.id)}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    name="bag_id"
                    value={b.id}
                    checked={selected.has(b.id)}
                    onChange={() => toggle(b.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-slate-700">{b.code}</td>
                <td className="px-3 py-2 text-slate-400">{b.purchaseLotCode}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">
                  {b.weightKg != null ? `${b.weightKg.toLocaleString("es-PE")} kg` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || selected.size === 0}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Agregando..." : `Agregar (${selected.size})`}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
