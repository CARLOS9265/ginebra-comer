"use client";

import { useState } from "react";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteFinalAssay } from "../actions";
import { FinalAssayForm } from "./FinalAssayForm";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

type Batch = {
  id: string;
  final_sampled_at: string | null;
  final_lab_name: string | null;
  final_report_number: string | null;
  final_au_gt: number | null;
  final_ag_gt: number | null;
  final_pb_pct: number | null;
  final_as_pct: number | null;
  final_sb_pct: number | null;
  final_s_pct: number | null;
  final_humidity_pct: number | null;
  final_notes: string | null;
};

export function FinalAssayRow({ batch, canEdit }: { batch: Batch; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <FinalAssayForm batchId={batch.id} editing initialValues={batch} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="space-y-1 text-slate-600">
        <div>
          {batch.final_lab_name ?? "Laboratorio sin datos"} · {fmtDate(batch.final_sampled_at) ?? "Sin fecha"}
          {batch.final_report_number && ` · Informe ${batch.final_report_number}`}
        </div>
        <div className="text-xs">
          Au {batch.final_au_gt} g/t · Ag {batch.final_ag_gt} g/t · Pb {batch.final_pb_pct}%
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
            Editar
          </button>
          <DeleteRowButton
            action={deleteFinalAssay.bind(null, batch.id)}
            confirmText="¿Eliminar este ensaye final?"
          />
        </div>
      )}
    </div>
  );
}
