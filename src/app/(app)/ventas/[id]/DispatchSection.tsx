"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { undoDispatch } from "../actions";
import { DispatchForm } from "./DispatchForm";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

type SaleLot = {
  id: string;
  status: string;
  dispatched_at: string | null;
  dispatch_carrier: string | null;
  dispatch_truck_plate: string | null;
  freight_tariff_pen_per_tmh: number | null;
};

export function DispatchSection({ saleLot }: { saleLot: SaleLot }) {
  const [editing, setEditing] = useState(false);

  if (!saleLot.dispatched_at) {
    return saleLot.status === "armado" ? (
      <DispatchForm saleLotId={saleLot.id} />
    ) : (
      <p className="text-sm text-slate-500">—</p>
    );
  }

  if (editing) {
    return <DispatchForm saleLotId={saleLot.id} editing initialValues={saleLot} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="text-slate-600">
        {saleLot.dispatch_carrier ?? "Transportista sin datos"} · {fmtDate(saleLot.dispatched_at)}
        {saleLot.dispatch_truck_plate && ` · Placa ${saleLot.dispatch_truck_plate}`}
        {saleLot.freight_tariff_pen_per_tmh != null && ` · Flete S/ ${saleLot.freight_tariff_pen_per_tmh}/TMH`}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
          Editar
        </button>
        {saleLot.status === "despachado" && (
          <ActionButton
            action={undoDispatch.bind(null, saleLot.id)}
            label="Deshacer"
            pendingLabel="Deshaciendo..."
            variant="danger"
            confirmText="¿Deshacer el despacho? El lote vuelve a estado 'armado'."
          />
        )}
      </div>
    </div>
  );
}
