"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createSettlement, type LogisticsFormState } from "./actions";

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function SettlementForm({
  lotId,
  pendingAdvanceUsd,
  maxApplyUsd,
}: {
  lotId: string;
  pendingAdvanceUsd: number;
  maxApplyUsd: number;
}) {
  const boundAction = createSettlement.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);
  const [applyAdvance, setApplyAdvance] = useState(false);
  const suggestedApply = Math.min(pendingAdvanceUsd, maxApplyUsd);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de factura final</span>
          <input name="final_invoice_number" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de nota de crédito/débito</span>
          <input name="credit_debit_note_number" className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Notas</span>
        <textarea name="notes" rows={2} className={`${inputClass} resize-none`} />
      </label>

      {pendingAdvanceUsd > 0 && (
        <div className="rounded-lg border border-gold-200 bg-gold-50 p-3">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={applyAdvance}
              onChange={(e) => setApplyAdvance(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              El proveedor tiene <strong>{fmtUSD(pendingAdvanceUsd)}</strong> de adelanto pendiente — aplicar
              a esta liquidación
            </span>
          </label>
          {applyAdvance && (
            <label className="mt-2 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">Monto a aplicar (USD)</span>
              <input
                name="apply_advance_usd"
                type="number"
                step="0.01"
                min="0"
                max={pendingAdvanceUsd}
                defaultValue={suggestedApply.toFixed(2)}
                className={inputClass}
              />
            </label>
          )}
        </div>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "+ Registrar liquidación definitiva"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
