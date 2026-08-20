"use client";

import { useActionState } from "react";
import { upsertDailyPrice, type PriceFormState } from "./actions";

export function PriceForm({
  today,
  live,
  todayValues,
}: {
  today: string;
  live: { gold: number | null; silver: number | null; fetchedAt: string | null; error?: string };
  todayValues?: {
    gold_usd_oz: number;
    silver_usd_oz: number;
    lead_usd_ton: number | null;
    reference_pct: number;
  };
}) {
  const [state, action, pending] = useActionState<PriceFormState, FormData>(upsertDailyPrice, null);
  const gold = live.gold ?? todayValues?.gold_usd_oz ?? null;
  const silver = live.silver ?? todayValues?.silver_usd_oz ?? null;

  return (
    <form action={action} className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Oro y plata — en vivo</h2>
          {live.gold != null ? (
            <span className="flex items-center gap-1.5 text-xs text-teal-400">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" /> En vivo
            </span>
          ) : (
            <span className="text-xs text-amber-400">
              Sin conexión en vivo — usando el último valor guardado
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Oro (USD/oz)</span>
            <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-slate-100">
              {gold != null ? gold.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Plata (USD/oz)</span>
            <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-slate-100">
              {silver != null ? silver.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
            </div>
          </div>
        </div>
        {live.fetchedAt && (
          <p className="mt-2 text-xs text-slate-500">
            Fuente: inversoro.es · actualizado {new Date(live.fetchedAt).toLocaleTimeString("es-PE")}
          </p>
        )}
        <input type="hidden" name="gold_usd_oz" value={gold ?? ""} />
        <input type="hidden" name="silver_usd_oz" value={silver ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Fecha</span>
          <input name="price_date" type="date" defaultValue={today} required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Plomo (USD/TM)</span>
          <input
            name="lead_usd_ton"
            type="number"
            step="0.01"
            defaultValue={todayValues?.lead_usd_ton ?? undefined}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-slate-600">Sin fuente en vivo — se carga a mano.</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">% de referencia</span>
          <input
            name="reference_pct"
            type="number"
            step="1"
            defaultValue={todayValues?.reference_pct ?? 40}
            className={inputClass}
          />
        </label>

        {state?.error && <p className="col-span-full text-sm text-red-400">{state.error}</p>}

        <div className="col-span-full flex items-end">
          <button
            type="submit"
            disabled={pending || gold == null}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar snapshot del día"}
          </button>
        </div>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500";
