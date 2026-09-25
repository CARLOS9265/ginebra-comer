"use client";

import { useState } from "react";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteTransportEvent } from "./actions";
import { TransportForm } from "./TransportForm";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

type TransportEvent = {
  id: string;
  departed_at: string | null;
  carrier_name: string | null;
};

export function TransportEventRow({ lotId, event }: { lotId: string; event: TransportEvent }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TransportForm lotId={lotId} eventId={event.id} initialValues={event} onDone={() => setEditing(false)} />
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
      <div className="space-y-0.5 text-slate-400">
        <div>
          {event.carrier_name ?? "Transportista sin datos"} · {fmtDate(event.departed_at) ?? "Sin fecha de salida"}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
          Editar
        </button>
        <DeleteRowButton
          action={deleteTransportEvent.bind(null, lotId, event.id)}
          confirmText="¿Eliminar este registro de transporte?"
        />
      </div>
    </div>
  );
}
