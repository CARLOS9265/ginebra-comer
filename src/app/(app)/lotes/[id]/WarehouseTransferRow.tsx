"use client";

import { useState } from "react";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteWarehouseTransfer } from "./actions";
import { WarehouseTransferForm } from "./WarehouseTransferForm";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

type Transfer = {
  id: string;
  dispatch_carrier: string | null;
  dispatch_truck_plate: string | null;
  departed_at: string | null;
};

export function WarehouseTransferRow({ lotId, transfer }: { lotId: string; transfer: Transfer }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <WarehouseTransferForm lotId={lotId} transferId={transfer.id} initialValues={transfer} onDone={() => setEditing(false)} />
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
      <div className="space-y-0.5 text-slate-400">
        <div>
          {transfer.dispatch_carrier ?? "Transportista sin datos"} · {fmtDate(transfer.departed_at) ?? "sin fecha"}
        </div>
        {transfer.dispatch_truck_plate && (
          <div className="text-xs text-slate-500">Placa {transfer.dispatch_truck_plate}</div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
          Editar
        </button>
        <DeleteRowButton
          action={deleteWarehouseTransfer.bind(null, lotId, transfer.id)}
          confirmText="¿Eliminar este traslado a almacén?"
        />
      </div>
    </div>
  );
}
