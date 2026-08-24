"use client";

import { useActionState, useMemo, useState } from "react";
import { createSaleLot, type SaleLotFormState } from "./actions";
import type { AvailableLot } from "./available-bags";

export function NewSaleLotForm({ lots }: { lots: AvailableLot[] }) {
  const [state, action, pending] = useActionState<SaleLotFormState, FormData>(createSaleLot, null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const totalBags = useMemo(
    () => Object.values(quantities).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [quantities],
  );

  return (
    <form action={action} className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Lote de compra</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3 text-right">Disponibles</th>
              <th className="px-4 py-3 text-right">Cantidad a incluir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {lots.map((l) => (
              <tr key={l.purchaseLotId}>
                <td className="px-4 py-3 font-mono text-slate-700">{l.code}</td>
                <td className="px-4 py-3 text-slate-400">{l.providerName ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-400">{l.available}</td>
                <td className="px-4 py-3 text-right">
                  <input
                    name={`qty_${l.purchaseLotId}`}
                    type="number"
                    min="0"
                    max={l.available}
                    step="1"
                    value={quantities[l.purchaseLotId] ?? ""}
                    onChange={(e) =>
                      setQuantities((prev) => ({ ...prev, [l.purchaseLotId]: e.target.value }))
                    }
                    className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right text-sm text-slate-800 outline-none focus:border-gold-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-slate-500">Total</span>
        <span className="font-mono font-semibold text-gold-700">
          {totalBags} {totalBags === 1 ? "bolsón" : "bolsones"}
        </span>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Notas (opcional)</span>
        <textarea
          name="notes"
          rows={2}
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500"
        />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending || totalBags === 0}
        className="rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Creando..." : `Armar lote de venta (${totalBags})`}
      </button>
    </form>
  );
}
