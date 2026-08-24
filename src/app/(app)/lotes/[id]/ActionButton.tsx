"use client";

import { useState, useTransition } from "react";

export function ActionButton({
  action,
  label,
  pendingLabel,
  confirmText,
  variant = "primary",
}: {
  action: () => Promise<{ error?: string } | void>;
  label: string;
  pendingLabel?: string;
  confirmText?: string;
  variant?: "primary" | "danger";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const colorClass = variant === "danger" ? "bg-red-600 hover:bg-red-500" : "bg-teal-600 hover:bg-teal-500";

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result?.error) setError(result.error);
          });
        }}
        className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${colorClass}`}
      >
        {pending ? (pendingLabel ?? "...") : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
