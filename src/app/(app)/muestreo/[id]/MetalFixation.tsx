"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { fixMetalPrice, autoFixMetalPrice, unfixMetalPrice, type SampleBatchFormState } from "../actions";

const LABELS: Record<"au" | "ag" | "pb", string> = { au: "Oro", ag: "Plata", pb: "Plomo" };
const UNITS: Record<"au" | "ag" | "pb", string> = { au: "USD/oz", ag: "USD/oz", pb: "USD/TM" };

export function MetalFixation({
  batchId,
  metal,
  fixedAt,
  fixedPrice,
  windowEnded,
  locked,
}: {
  batchId: string;
  metal: "au" | "ag" | "pb";
  fixedAt: string | null;
  fixedPrice: number | null;
  windowEnded: boolean;
  locked?: boolean;
}) {
  const boundAction = fixMetalPrice.bind(null, batchId, metal);
  const [state, action, pending] = useActionState<SampleBatchFormState, FormData>(boundAction, null);
  const [editing, setEditing] = useState(false);
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state == null) setEditing(false);
    prevPending.current = pending;
  }, [pending, state]);

  if (fixedAt && fixedPrice != null && !editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <div className="text-slate-600">
          <span className="font-medium">{LABELS[metal]}</span> fijado el {fixedAt} a{" "}
          {fixedPrice.toLocaleString("en-US")} {UNITS[metal]}
        </div>
        {!locked && (
          <div className="flex items-center gap-3">
            <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
              Editar
            </button>
            <ActionButton
              action={unfixMetalPrice.bind(null, batchId, metal)}
              label="Deshacer"
              pendingLabel="..."
              variant="danger"
              confirmText={`¿Deshacer la fijación de ${LABELS[metal]}?`}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{LABELS[metal]}</span>
        {windowEnded && (
          <ActionButton
            action={autoFixMetalPrice.bind(null, batchId, metal)}
            label="Fijar con cierre de ventana"
            pendingLabel="Fijando..."
            confirmText={`La ventana de fijación de ${LABELS[metal]} ya venció. ¿Fijar con el precio más cercano al cierre?`}
          />
        )}
      </div>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Fecha</span>
          <input
            name="fixed_at"
            type="date"
            required
            defaultValue={fixedAt ?? ""}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-gold-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Precio ({UNITS[metal]})</span>
          <input
            name="fixed_price"
            type="number"
            step="0.0001"
            required
            defaultValue={fixedPrice ?? ""}
            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-gold-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Fijando..." : "Fijar"}
        </button>
        {editing && (
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:underline">
            Cancelar
          </button>
        )}
      </form>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
