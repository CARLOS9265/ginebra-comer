"use client";

import { useActionState, useMemo, useState } from "react";
import { createSaleLot, type SaleLotFormState } from "./actions";

type Bag = { id: string; code: string; weightKg: number | null; purchaseLotCode: string };

export function NewSaleLotForm({ bags }: { bags: Bag[] }) {
  const [state, action, pending] = useActionState<SaleLotFormState, FormData>(createSaleLot, null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const totalKg = useMemo(
    () => bags.filter((b) => selected.has(b.id)).reduce((sum, b) => sum + (b.weightKg ?? 0), 0),
    [bags, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Lote de compra</th>
              <th className="px-4 py-3 text-right">Peso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {bags.map((b) => (
              <tr
                key={b.id}
                className="cursor-pointer hover:bg-slate-900/50"
                onClick={() => toggle(b.id)}
              >
                <td className="px-4 py-3">
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
                <td className="px-4 py-3 font-mono text-slate-200">{b.code}</td>
                <td className="px-4 py-3 text-slate-300">{b.purchaseLotCode}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">
                  {b.weightKg != null ? `${b.weightKg.toLocaleString("es-PE")} kg` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
        <span className="text-slate-400">{selected.size} seleccionados</span>
        <span className="font-mono font-semibold text-teal-400">
          {totalKg.toLocaleString("es-PE")} kg ({(totalKg / 1000).toFixed(2)} TM)
        </span>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-400">Notas (opcional)</span>
        <textarea
          name="notes"
          rows={2}
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
        />
      </label>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending || selected.size === 0}
        className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
      >
        {pending ? "Creando..." : `Armar lote de venta (${selected.size})`}
      </button>
    </form>
  );
}
