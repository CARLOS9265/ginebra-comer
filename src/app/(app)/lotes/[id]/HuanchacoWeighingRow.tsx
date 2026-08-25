"use client";

import { useState } from "react";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteWeighing } from "./actions";
import { HuanchacoWeighingForm } from "./HuanchacoWeighingForm";

const fmtKg = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("es-PE")} kg`);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

type Weighing = { id: string; net_weight: number | null; ticket_number: string | null; weighed_at: string | null };

export function HuanchacoWeighingRow({ lotId, weighing }: { lotId: string; weighing: Weighing }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <HuanchacoWeighingForm lotId={lotId} weighingId={weighing.id} initialValues={weighing} onDone={() => setEditing(false)} />
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="text-slate-400">
        Pesaje Huanchaco: {fmtKg(weighing.net_weight)}
        {weighing.ticket_number && ` · Ticket ${weighing.ticket_number}`}
        {weighing.weighed_at && ` · ${fmtDate(weighing.weighed_at)}`}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
          Editar
        </button>
        <DeleteRowButton action={deleteWeighing.bind(null, lotId, weighing.id)} confirmText="¿Eliminar este pesaje?" />
      </div>
    </div>
  );
}
