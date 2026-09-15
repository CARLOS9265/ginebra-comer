"use client";

import { useState } from "react";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteMillReception } from "./actions";
import { MillReceptionForm } from "./MillReceptionForm";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

type Reception = {
  id: string;
  received_at: string | null;
  supervisor_name: string | null;
};

export function MillReceptionRow({ lotId, reception }: { lotId: string; reception: Reception }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <MillReceptionForm
        lotId={lotId}
        receptionId={reception.id}
        initialValues={reception}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
      <div className="space-y-0.5 text-slate-400">
        <div>
          {reception.supervisor_name ?? "Supervisor sin datos"} · {fmtDate(reception.received_at) ?? "Sin fecha"}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
          Editar
        </button>
        <DeleteRowButton
          action={deleteMillReception.bind(null, lotId, reception.id)}
          confirmText="¿Eliminar esta recepción en molino?"
        />
      </div>
    </div>
  );
}
