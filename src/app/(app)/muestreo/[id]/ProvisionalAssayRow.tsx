"use client";

import { useState } from "react";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteProvisionalAssay } from "../actions";
import { ProvisionalAssayForm } from "./ProvisionalAssayForm";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

type Batch = {
  id: string;
  prov_sampled_at: string | null;
  prov_lab_name: string | null;
  prov_report_number: string | null;
  prov_au_gt: number | null;
  prov_ag_gt: number | null;
  prov_pb_pct: number | null;
  prov_as_pct: number | null;
  prov_sb_pct: number | null;
  prov_s_pct: number | null;
  prov_humidity_pct: number | null;
  prov_notes: string | null;
};

export function ProvisionalAssayRow({ batch, canEdit }: { batch: Batch; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ProvisionalAssayForm batchId={batch.id} editing initialValues={batch} onDone={() => setEditing(false)} />
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="space-y-1 text-slate-600">
        <div>
          {batch.prov_lab_name ?? "Laboratorio sin datos"} · {fmtDate(batch.prov_sampled_at) ?? "Sin fecha"}
          {batch.prov_report_number && ` · Informe ${batch.prov_report_number}`}
        </div>
        <div className="text-xs">
          Au {batch.prov_au_gt} g/t · Ag {batch.prov_ag_gt} g/t · Pb {batch.prov_pb_pct}%
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
            Editar
          </button>
          <DeleteRowButton
            action={deleteProvisionalAssay.bind(null, batch.id)}
            confirmText="¿Eliminar este ensaye provisional?"
          />
        </div>
      )}
    </div>
  );
}
