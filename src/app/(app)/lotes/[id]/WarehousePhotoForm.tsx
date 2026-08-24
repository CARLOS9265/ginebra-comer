"use client";

import { useActionState } from "react";
import { uploadWarehousePhoto, type LogisticsFormState } from "./actions";

export function WarehousePhotoForm({ lotId }: { lotId: string }) {
  const boundAction = uploadWarehousePhoto.bind(null, lotId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-400">Foto</span>
        <input
          name="photo"
          type="file"
          accept="image/*"
          required
          className="block text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:text-slate-200 hover:file:bg-slate-700"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
      >
        {pending ? "Subiendo..." : "+ Agregar foto"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
