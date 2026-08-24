"use client";

import { useActionState } from "react";
import { uploadWeighingTicketPhoto, type LogisticsFormState } from "./actions";

export function WeighingTicketPhotoForm({ lotId, weighingId }: { lotId: string; weighingId: string }) {
  const boundAction = uploadWeighingTicketPhoto.bind(null, lotId, weighingId);
  const [state, action, pending] = useActionState<LogisticsFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="flex items-end gap-2">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Foto del ticket</span>
        <input
          name="photo"
          type="file"
          accept="image/*"
          required
          className="block text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs file:text-slate-700 hover:file:bg-slate-200"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {pending ? "Subiendo..." : "+ Foto"}
      </button>
      {state?.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
