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
import { createSchedule, deleteSchedule, updateSchedule, updateScheduleStatus, type ScheduleFormState } from "./actions";
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
          <h2 className="text-sm font-semibold text-slate-700">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <div className="flex gap-2">
            <Link
              href={`/calendario?month=${monthParam(prev.year, prev.month)}`}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-100"
            >
              ← Anterior
            </Link>
            <Link
              href={`/calendario?month=${monthParam(next.year, next.month)}`}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-100"
            >
              Siguiente →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-xs">
          {WEEKDAY_NAMES.map((w) => (
            <div key={w} className="bg-white px-2 py-1.5 text-center font-medium text-slate-500">
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
                className={`min-h-[76px] bg-white p-1.5 text-left align-top transition ${
                  inMonth ? "" : "opacity-40"
                } ${isSelected ? "ring-2 ring-inset ring-gold-500" : "hover:bg-slate-100"}`}
              >
                <div
                  className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    date === today ? "bg-navy-800 text-white" : "text-slate-500"
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
                          ? "bg-gold-100 text-gold-600"
                          : "bg-purple-100 text-purple-700"
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
            <span className="h-2.5 w-2.5 rounded-sm bg-gold-200" /> Compra (llegada de mina)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-purple-200" /> Despacho a Lima
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
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{formatLong(date)}</h3>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-xs text-gold-700 hover:underline"
        >
          {showForm ? "Cancelar" : "+ Programar volquete"}
        </button>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-3">
          {items.map((it) => (
            <ScheduleRow key={it.id} item={it} providers={providers} />
          ))}
        </ul>
      )}

      {items.length === 0 && !showForm && (
        <p className="mt-4 text-sm text-slate-500">Sin volquetes programados este día.</p>
      )}

      {showForm && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <ScheduleForm date={date} providers={providers} onDone={() => setShowForm(false)} />
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ item, providers }: { item: ScheduleItem; providers: Provider[] }) {
  const [editing, setEditing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const provider = providerOf(item);

  if (editing) {
    return (
      <li className="rounded-lg border border-gold-300 bg-white p-3 text-sm">
        <ScheduleForm
          date={item.scheduled_date}
          providers={providers}
          editing={item}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            item.type === "compra" ? "bg-gold-100 text-gold-600" : "bg-purple-100 text-purple-700"
          }`}
        >
          {item.type === "compra" ? "Compra" : "Despacho a Lima"}
        </span>
        <span className="text-xs text-slate-500">{item.scheduled_time?.slice(0, 5) ?? "sin hora"}</span>
      </div>
      <div className="mt-2 text-slate-700">
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
          onChange={async (e) => {
            const result = await updateScheduleStatus(item.id, e.target.value);
            if (result?.createdLotCode) {
              setStatusMsg({ text: `Se generó el lote ${result.createdLotCode}.` });
            } else if (result?.error) {
              setStatusMsg({ text: result.error, isError: true });
            } else {
              setStatusMsg(null);
            }
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-400"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
            Editar
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("¿Eliminar esta programación?")) deleteSchedule(item.id);
            }}
            className="text-xs text-red-600 hover:underline"
          >
            Eliminar
          </button>
        </div>
      </div>
      {statusMsg && (
        <p className={`mt-2 text-xs ${statusMsg.isError ? "text-red-600" : "text-gold-700"}`}>{statusMsg.text}</p>
      )}
    </li>
  );
}

function ScheduleForm({
  date,
  providers,
  editing,
  onDone,
}: {
  date: string;
  providers: Provider[];
  editing?: ScheduleItem;
  onDone: () => void;
}) {
  const [type, setType] = useState<"compra" | "despacho">(editing?.type ?? "compra");
  const editingProvider = editing ? providerOf(editing) : null;
  const [state, action, pending] = useActionState<ScheduleFormState, FormData>(
    async (prev, formData) => {
      const result = editing
        ? await updateSchedule(editing.id, type, prev, formData)
        : await createSchedule(prev, formData);
      if (!result?.error) onDone();
      return result;
    },
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="scheduled_date" value={date} />

      {editing ? (
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
            type === "compra" ? "bg-gold-100 text-gold-600" : "bg-purple-100 text-purple-700"
          }`}
        >
          {type === "compra" ? "Compra" : "Despacho a Lima"}
        </span>
      ) : (
        <div className="flex gap-2">
          <TypeButton label="Compra" active={type === "compra"} onClick={() => setType("compra")} />
          <TypeButton label="Despacho a Lima" active={type === "despacho"} onClick={() => setType("despacho")} />
        </div>
      )}
      <input type="hidden" name="type" value={type} />

      <label className="block">
        <FieldLabel>Hora estimada</FieldLabel>
        <input
          name="scheduled_time"
          type="time"
          defaultValue={editing?.scheduled_time?.slice(0, 5) ?? ""}
          className={inputClass}
        />
      </label>

      {type === "compra" ? (
        <label className="block">
          <FieldLabel>Proveedor</FieldLabel>
          <select name="provider_id" required defaultValue={editingProvider?.id ?? ""} className={inputClass}>
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
            <input
              name="destination"
              type="text"
              defaultValue={editing?.destination ?? "PY - Lima"}
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel>Big bags estimados</FieldLabel>
            <input
              name="estimated_big_bags"
              type="number"
              min="0"
              defaultValue={editing?.estimated_big_bags ?? ""}
              className={inputClass}
            />
          </label>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <FieldLabel>Placa</FieldLabel>
          <input name="truck_plate" type="text" defaultValue={editing?.truck_plate ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <FieldLabel>Transportista</FieldLabel>
          <select name="carrier_name" defaultValue={editing?.carrier_name ?? ""} className={inputClass}>
            <option value="">Elegir...</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-navy-800 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : editing ? "Guardar cambios" : "Programar"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cancelar
          </button>
        )}
      </div>
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
          ? "border-gold-600 bg-gold-100 text-gold-600"
          : "border-slate-300 text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-slate-500">{children}</span>;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500";

function formatLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
}
