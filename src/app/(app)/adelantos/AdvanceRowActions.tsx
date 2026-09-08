"use client";

import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteAdvance } from "./actions";

export function AdvanceRowActions({ id }: { id: string }) {
  return (
    <DeleteRowButton
      action={deleteAdvance.bind(null, id)}
      confirmText="¿Eliminar este adelanto? Esta acción no se puede deshacer."
    />
  );
}
