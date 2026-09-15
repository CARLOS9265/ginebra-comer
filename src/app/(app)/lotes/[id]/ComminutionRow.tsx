"use client";

import { useState } from "react";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteComminution } from "./actions";
import { ComminutionForm } from "./ComminutionForm";

type Comminution = {
  id: string;
  processed_tons: number | null;
  tariff_pen_per_ton: number | null;
  bag_count: number | null;
};

export function ComminutionRow({
  lotId,
  comminution,
  officialWeightHint,
}: {
  lotId: string;
  comminution: Comminution;
  officialWeightHint?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ComminutionForm
        lotId={lotId}
        comminutionId={comminution.id}
        initialValues={comminution}
        officialWeightHint={officialWeightHint}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
      <div className="space-y-0.5 text-slate-400">
        <div>
          {comminution.processed_tons != null && `Procesado (molino): ${comminution.processed_tons} TM · `}
          {comminution.tariff_pen_per_ton != null && `Tarifa S/ ${comminution.tariff_pen_per_ton}/TM`}
        </div>
        <div className="text-xs text-slate-500">
          {comminution.bag_count != null
            ? `${comminution.bag_count} ${comminution.bag_count === 1 ? "bolsón generado" : "bolsones generados"}`
            : "Cantidad de bolsones sin datos"}{" "}
          — el peso real se controla con el ticket de balanza (sección Pesajes), no bolsón por bolsón.
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
          Editar
        </button>
        <DeleteRowButton
          action={deleteComminution.bind(null, lotId, comminution.id)}
          confirmText="¿Eliminar esta conminución?"
        />
      </div>
    </div>
  );
}
