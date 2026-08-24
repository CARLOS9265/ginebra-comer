"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { undoPyReception } from "../actions";
import { PyReceptionForm } from "./PyReceptionForm";

const fmtKg = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("es-PE")} kg`);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

type SaleLot = {
  id: string;
  status: string;
  received_at_py: string | null;
  py_warehouse: string | null;
  py_received_by: string | null;
  py_official_weight_kg: number | null;
};

export function PyReceptionSection({ saleLot }: { saleLot: SaleLot }) {
  const [editing, setEditing] = useState(false);

  if (!saleLot.received_at_py) {
    return saleLot.status === "despachado" ? (
      <PyReceptionForm saleLotId={saleLot.id} />
    ) : (
      <p className="text-sm text-slate-500">—</p>
    );
  }

  if (editing) {
    return (
      <PyReceptionForm saleLotId={saleLot.id} editing initialValues={saleLot} onDone={() => setEditing(false)} />
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="text-slate-600">
        <div>
          {saleLot.py_received_by ?? "Sin datos de quién recibió"} · {fmtDate(saleLot.received_at_py)}
          {saleLot.py_warehouse && ` · ${saleLot.py_warehouse}`}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Peso oficial trailer: {fmtKg(saleLot.py_official_weight_kg)} — este es el peso de referencia del
          lote (no se pesa bolsón por bolsón).
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
          Editar
        </button>
        {saleLot.status === "recibido_py" && (
          <ActionButton
            action={undoPyReception.bind(null, saleLot.id)}
            label="Deshacer"
            pendingLabel="Deshaciendo..."
            variant="danger"
            confirmText="¿Deshacer la recepción en PY? El lote vuelve a estado 'despachado'."
          />
        )}
      </div>
    </div>
  );
}
