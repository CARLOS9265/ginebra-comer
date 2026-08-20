"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  buildMonthGrid,
  MONTH_NAMES,
  WEEKDAY_NAMES,
  monthParam,
  shiftMonth,
  todayISO,
} from "@/lib/calendar";
import { createSchedule, deleteSchedule, updateScheduleStatus, type ScheduleFormState } from "./actions";
import { CARRIERS } from "@/lib/carriers";

type Provider = { id: string; code: string; name: string };
type ScheduleItem = {
  id: string;
  type: "compra" | "despacho";
  scheduled_date: string;
  scheduled_time: string | null;
  status: "programado" | "confirmado" | "completado" | "cancelado";
  destination: string | null;
  estimated_big_bags: number | null;
  truck_plate: string | null;
  carrier_name: string | null;
  notes: string | null;
  providers: Provider | Provider[] | null;
};

const STATUS_LABELS: Record<string, string> = {
  programado: "Programado",
  confirmado: "Confirmado",
  completado: "Completado",
  cancelado: "Cancelado",
};

function providerOf(item: ScheduleItem): Provider | null {
  if (!item.providers) return null;
  return Array.isArray(item.providers) ? item.providers[0] ?? null : item.providers;
}

export function CalendarView({
  year,
  month,
  schedule,
  providers,
}: {
  year: number;
  month: number;
  schedule: ScheduleItem[];
  providers: Provider[];
}) {
  const today = todayISO();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of schedule) {
      const list = map.get(item.scheduled_date) ?? [];
      list.push(item);
      map.set(item.scheduled_date, list);
    }
    return map;
  }, [schedule]);

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <div className="flex gap-2">
            <Link
              href={`/calendario?month=${monthParam(prev.year, prev.month)}`}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              ← Anterior
            </Link>
            <Link
              href={`/calendario?month=${monthParam(next.year, next.month)}`}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Siguiente →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 text-xs">
          {WEEKDAY_NAMES.map((w) => (
            <div key={w} className="bg-slate-900 px-2 py-1.5 text-center font-medium text-slate-500">
              {w}
            </div>
          ))}
          {grid.map(({ date, inMonth }) => {
            const items = byDate.get(date) ?? [];
            const isSelected = date === selectedDate;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`min-h-[76px] bg-slate-900 p-1.5 text-left align-top transition ${
                  inMonth ? "" : "opacity-40"
                } ${isSelected ? "ring-2 ring-inset ring-teal-500" : "hover:bg-slate-850"}`}
              >
                <div
                  className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    date === today ? "bg-teal-600 text-white" : "text-slate-400"
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((it) => (
                    <div
                      key={it.id}
                      className={`truncate rounded px-1 py-0.5 text-[10px] ${
                        it.type === "compra"
                          ? "bg-teal-950/60 text-teal-300"
                          : "bg-purple-950/60 text-purple-300"
                      }`}
                    >
                      {it.type === "compra" ? providerOf(it)?.code ?? "Compra" : it.destination ?? "Despacho"}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-[10px] text-slate-500">+{items.length - 3} más</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-800" /> Compra (llegada de mina)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-purple-800" /> Despacho a Lima
          </span>
        </div>
      </div>

      <DayPanel date={selectedDate} items={byDate.get(selectedDate) ?? []} providers={providers} />
    </div>
  );
}

function DayPanel({
  date,
  items,
  providers,
}: {
  date: string;
  items: ScheduleItem[];
  providers: Provider[];
}) {
  const [showForm, setShowForm] = useState(items.length === 0);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">{formatLong(date)}</h3>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-xs text-teal-400 hover:underline"
        >
          {showForm ? "Cancelar" : "+ Programar volquete"}
        </button>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-3">
          {items.map((it) => (
            <ScheduleRow key={it.id} item={it} />
          ))}
        </ul>
      )}

      {items.length === 0 && !showForm && (
        <p className="mt-4 text-sm text-slate-500">Sin volquetes programados este día.</p>
      )}

      {showForm && (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <ScheduleForm date={date} providers={providers} onDone={() => setShowForm(false)} />
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ item }: { item: ScheduleItem }) {
  const provider = providerOf(item);
  return (
    <li className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            item.type === "compra" ? "bg-teal-950 text-teal-300" : "bg-purple-950 text-purple-300"
          }`}
        >
          {item.type === "compra" ? "Compra" : "Despacho a Lima"}
        </span>
        <span className="text-xs text-slate-500">{item.scheduled_time?.slice(0, 5) ?? "sin hora"}</span>
      </div>
      <div className="mt-2 text-slate-200">
        {item.type === "compra" ? provider?.name ?? "Proveedor sin especificar" : item.destination}
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-slate-500">
        {item.truck_plate && <div>Placa: {item.truck_plate}</div>}
        {item.carrier_name && <div>Transportista: {item.carrier_name}</div>}
        {item.estimated_big_bags != null && <div>Big bags estimados: {item.estimated_big_bags}</div>}
        {item.notes && <div>{item.notes}</div>}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <select
          defaultValue={item.status}
          onChange={(e) => updateScheduleStatus(item.id, e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (confirm("¿Eliminar esta programación?")) deleteSchedule(item.id);
          }}
          className="text-xs text-red-400 hover:underline"
        >
          Eliminar
        </button>
      </div>
    </li>
  );
}

function ScheduleForm({
  date,
  providers,
  onDone,
}: {
  date: string;
  providers: Provider[];
  onDone: () => void;
}) {
  const [type, setType] = useState<"compra" | "despacho">("compra");
  const [state, action, pending] = useActionState<ScheduleFormState, FormData>(
    async (prev, formData) => {
      const result = await createSchedule(prev, formData);
      if (!result?.error) onDone();
      return result;
    },
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="scheduled_date" value={date} />

      <div className="flex gap-2">
        <TypeButton label="Compra" active={type === "compra"} onClick={() => setType("compra")} />
        <TypeButton label="Despacho a Lima" active={type === "despacho"} onClick={() => setType("despacho")} />
      </div>
      <input type="hidden" name="type" value={type} />

      <label className="block">
        <FieldLabel>Hora estimada</FieldLabel>
        <input name="scheduled_time" type="time" className={inputClass} />
      </label>

      {type === "compra" ? (
        <label className="block">
          <FieldLabel>Proveedor</FieldLabel>
          <select name="provider_id" required className={inputClass}>
            <option value="">Elegir...</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label className="block">
            <FieldLabel>Destino</FieldLabel>
            <input name="destination" type="text" defaultValue="PY - Lima" className={inputClass} />
          </label>
          <label className="block">
            <FieldLabel>Big bags estimados</FieldLabel>
            <input name="estimated_big_bags" type="number" min="0" className={inputClass} />
          </label>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <FieldLabel>Placa</FieldLabel>
          <input name="truck_plate" type="text" className={inputClass} />
        </label>
        <label className="block">
          <FieldLabel>Transportista</FieldLabel>
          <select name="carrier_name" defaultValue="" className={inputClass}>
            <option value="">Elegir...</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <FieldLabel>Notas</FieldLabel>
        <textarea name="notes" rows={2} className={`${inputClass} resize-none`} />
      </label>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Programar"}
      </button>
    </form>
  );
}

function TypeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-teal-600 bg-teal-950/60 text-teal-300"
          : "border-slate-700 text-slate-400 hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-slate-400">{children}</span>;
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500";

function formatLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
}
