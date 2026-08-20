"use client";

import { useTransition } from "react";

export function DeleteRowButton({
  action,
  confirmText,
}: {
  action: () => Promise<void>;
  confirmText: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(confirmText)) startTransition(() => action());
      }}
      className="shrink-0 text-xs text-red-400 hover:underline disabled:opacity-50"
    >
      Eliminar
    </button>
  );
}
