"use client";

import { useState, useTransition } from "react";

export function DeleteRowButton({
  action,
  confirmText,
}: {
  action: () => Promise<{ error?: string } | void>;
  confirmText: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result?.error) setError(result.error);
          });
        }}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        Eliminar
      </button>
      {error && <p className="mt-1 max-w-[220px] text-xs text-red-600">{error}</p>}
    </div>
  );
}
