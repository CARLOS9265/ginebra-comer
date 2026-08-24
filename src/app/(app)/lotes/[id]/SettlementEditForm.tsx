"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateSettlement, type LogisticsFormState } from "./actions";

type InitialValues = {
  final_invoice_number: string | null;
  credit_debit_note_number: string | null;
  notes: string | null;
};

export function SettlementEditForm({
  lotId,
  settlementId,
  initialValues,
  onDone,
}: {
  lotId: string;
  settlementId: string;
  initialValues: InitialValues;
  onDone: () => void;
}) {
  const boundAction = updateSettlement.bind(null, lotId, settlementId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state == null) onDone();
    prevPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-400">
        Solo se pueden editar los datos administrativos — los montos calculados no cambian acá.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de factura final</span>
          <input
            name="final_invoice_number"
            defaultValue={initialValues.final_invoice_number ?? ""}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">N° de nota de crédito/débito</span>
          <input
            name="credit_debit_note_number"
            defaultValue={initialValues.credit_debit_note_number ?? ""}
            className={inputClass}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Notas</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initialValues.notes ?? ""}
          className={`${inputClass} resize-none`}
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-slate-500 hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
