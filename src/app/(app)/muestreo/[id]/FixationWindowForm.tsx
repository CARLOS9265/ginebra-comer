"use client";

import { useActionState } from "react";
import { updateFixationWindow, type SampleBatchFormState } from "../actions";

export function FixationWindowForm({
  batchId,
  start,
  end,
}: {
  batchId: string;
  start: string | null;
  end: string | null;
}) {
  const boundAction = updateFixationWindow.bind(null, batchId);
  const [state, action, pending] = useActionState<SampleBatchFormState, FormData>(boundAction, null);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Desde</span>
        <input
          name="fixation_window_start"
          type="date"
          defaultValue={start ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Hasta</span>
        <input
          name="fixation_window_end"
          type="date"
          defaultValue={end ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Ajustar ventana"}
      </button>
      {state?.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
