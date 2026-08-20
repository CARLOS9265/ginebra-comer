"use client";

import Link from "next/link";
import { deleteProvider } from "./actions";

export function ProviderRowActions({ id }: { id: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={`/proveedores/${id}/editar`} className="text-xs text-teal-400 hover:underline">
        Editar
      </Link>
      <button
        type="button"
        onClick={async () => {
          if (!confirm("¿Eliminar este proveedor? Esta acción no se puede deshacer.")) return;
          const result = await deleteProvider(id);
          if (result?.error) alert(result.error);
        }}
        className="text-xs text-red-400 hover:underline"
      >
        Eliminar
      </button>
    </div>
  );
}
