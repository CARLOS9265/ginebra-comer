"use client";

import { useActionState } from "react";
import { saveProvisionalLiquidation, type SampleBatchFormState } from "../actions";

export function ProvisionalLiquidationForm({ batchId }: { batchId: string }) {
  const boundAction = saveProvisionalLiquidation.bind(null, batchId);
  const [state, action, pending] = useActionState<SampleBatchFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">
        El precio se calcula solo: promedio de los últimos 5 días de mercado guardados en Precios,
        hasta la fecha de factura (cláusula 5.1).
      </p>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha de factura</span>
        <input
          name="prov_invoice_date"
          type="date"
          required
          className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Calculando..." : "Calcular liquidación provisional (90%)"}
      </button>
    </form>
  );
}
