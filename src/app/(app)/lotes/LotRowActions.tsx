"use client";

import Link from "next/link";
import { deletePurchaseLot } from "./actions";

export function LotRowActions({ id, canDelete }: { id: string; canDelete: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={`/lotes/${id}/editar`} className="text-xs text-teal-400 hover:underline">
        Editar
      </Link>
      {canDelete && (
        <button
          type="button"
          onClick={() => {
            if (confirm("¿Eliminar este lote? Esta acción no se puede deshacer.")) {
              deletePurchaseLot(id);
            }
          }}
          className="text-xs text-red-400 hover:underline"
        >
          Eliminar
        </button>
      )}
    </div>
  );
}
