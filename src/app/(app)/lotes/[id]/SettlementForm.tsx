"use client";

import { useActionState } from "react";
import { createSettlement, type LogisticsFormState } from "./actions";

export function SettlementForm({ lotId }: { lotId: string }) {
  const boundAction = createSettlement.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">N° de factura final</span>
          <input name="final_invoice_number" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">N° de nota de crédito/débito</span>
          <input name="credit_debit_note_number" className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-400">Notas</span>
        <textarea name="notes" rows={2} className={`${inputClass} resize-none`} />
      </label>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar liquidación definitiva"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500";
