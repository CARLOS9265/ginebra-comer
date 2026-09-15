"use client";

import { useActionState, useEffect, useRef } from "react";
import { createWarehouseTransfer, updateWarehouseTransfer, type LogisticsFormState } from "./actions";
import { CARRIERS } from "@/lib/carriers";
import { KNOWN_PLATES, carrierForPlate } from "@/lib/plates";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type InitialValues = {
  forklift_cost_pen: number | null;
  dispatch_carrier: string | null;
  dispatch_truck_plate: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  incidents: string | null;
};

export function WarehouseTransferForm({
  lotId,
  transferId,
  initialValues,
  onDone,
}: {
  lotId: string;
  transferId?: string;
  initialValues?: InitialValues;
  onDone?: () => void;
}) {
  const boundAction = transferId
    ? updateWarehouseTransfer.bind(null, lotId, transferId)
    : createWarehouseTransfer.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);
  const prevPending = useRef(false);
  const carrierSelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (prevPending.current && !pending && state == null) onDone?.();
    prevPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <datalist id="known-plates">
        {KNOWN_PLATES.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Costo de montacarga (S/)</span>
          <input
            name="forklift_cost_pen"
            type="number"
            step="0.01"
            defaultValue={initialValues?.forklift_cost_pen ?? ""}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Transportista</span>
          <select
            name="dispatch_carrier"
            ref={carrierSelectRef}
            defaultValue={initialValues?.dispatch_carrier ?? ""}
            className={inputClass}
          >
            <option value="">Elegir...</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Placa del trailer</span>
          <input
            name="dispatch_truck_plate"
            list="known-plates"
            defaultValue={initialValues?.dispatch_truck_plate ?? ""}
            onChange={(e) => {
              const carrier = carrierForPlate(e.target.value);
              if (carrier && carrierSelectRef.current) carrierSelectRef.current.value = carrier;
            }}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Salida del molino</span>
          <input
            name="departed_at"
            type="date"
            defaultValue={toLocalInputValue(initialValues?.departed_at ?? null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Descarga en almacén</span>
          <input
            name="arrived_at"
            type="date"
            defaultValue={toLocalInputValue(initialValues?.arrived_at ?? null)}
            className={inputClass}
          />
        </label>
        <label className="col-span-2 block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Incidentes</span>
          <textarea
            name="incidents"
            rows={2}
            defaultValue={initialValues?.incidents ?? ""}
            className={`${inputClass} resize-none`}
          />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : transferId ? "Guardar cambios" : "+ Registrar traslado"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="text-xs text-slate-500 hover:underline">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
