"use client";

import { useActionState } from "react";
import { createAdvance, type AdvanceFormState } from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

export function AdvanceForm({ providers }: { providers: { id: string; code: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AdvanceFormState, FormData>(createAdvance, null);

  return (
    <form action={action} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-5">
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Proveedor</span>
        <select name="provider_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Elegí un proveedor
          </option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Monto (USD)</span>
        <input name="amount_usd" type="number" step="0.01" min="0.01" required className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Fecha</span>
        <input name="given_at" type="date" defaultValue={today()} required className={inputClass} />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Nota (opcional)</span>
        <input name="note" placeholder="Ej. para asegurar próximo viaje" className={inputClass} />
      </label>

      {state?.error && <p className="text-sm text-red-600 sm:col-span-5">{state.error}</p>}

      <div className="sm:col-span-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "+ Registrar adelanto"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";
