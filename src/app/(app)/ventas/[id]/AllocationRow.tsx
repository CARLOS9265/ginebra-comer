"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { removeAllocation, updateAllocation, type SaleLotFormState } from "../actions";

type Allocation = { id: string; bag_count: number; purchaseLotId: string | null; purchaseLotCode: string };

export function AllocationRow({
  saleLotId,
  allocation,
  canEdit,
}: {
  saleLotId: string;
  allocation: Allocation;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const boundAction = updateAllocation.bind(null, saleLotId, allocation.id);
  const [state, action, pending] = useActionState<SaleLotFormState, FormData>(boundAction, null);
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && state == null) setEditing(false);
    prevPending.current = pending;
  }, [pending, state]);

  if (editing) {
    return (
      <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-2.5 text-sm">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">
            Cantidad de {allocation.purchaseLotCode}
          </span>
          <input
            name="qty"
            type="number"
            min="1"
            step="1"
            defaultValue={allocation.bag_count}
            className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-gold-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:underline">
          Cancelar
        </button>
        {state?.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2.5 text-sm">
      <div className="text-slate-400">
        <span className="font-mono text-slate-700">{allocation.bag_count}</span>{" "}
        {allocation.bag_count === 1 ? "bolsón" : "bolsones"} de{" "}
        {allocation.purchaseLotId ? (
          <Link href={`/lotes/${allocation.purchaseLotId}`} className="text-gold-700 hover:underline">
            {allocation.purchaseLotCode}
          </Link>
        ) : (
          allocation.purchaseLotCode
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
            Editar
          </button>
          <DeleteRowButton
            action={removeAllocation.bind(null, saleLotId, allocation.id)}
            confirmText="¿Quitar esta asignación? Los bolsones vuelven a quedar disponibles."
          />
        </div>
      )}
    </div>
  );
}
