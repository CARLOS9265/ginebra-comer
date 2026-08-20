"use client";

import { useActionState, useState } from "react";
import { createPurchaseLot, updatePurchaseLot, type LotFormState } from "./actions";
import { CARRIERS } from "@/lib/carriers";

type Provider = { id: string; code: string; name: string };

export type LotInitialValues = {
  code: string;
  provider_id: string;
  concession: string;
  loaded_at_local: string; // yyyy-MM-ddTHH:mm
  truck_plate: string;
  carrier_name: string;
  estimated_weight_tmh: string;
  reference_price_usd: string;
  initial_guide_number: string;
  initial_invoice_number: string;
  provisional_price_per_tmh: string;
  advance_pct: string;
};

export function LotForm({
  providers,
  mode,
  lotId,
  initialValues,
}: {
  providers: Provider[];
  mode: "create" | "edit";
  lotId?: string;
  initialValues?: LotInitialValues;
}) {
  const boundAction =
    mode === "edit" && lotId ? updatePurchaseLot.bind(null, lotId) : createPurchaseLot;
  const [state, action, pending] = useActionState<LotFormState, FormData>(boundAction, null);

  const [providerId, setProviderId] = useState(initialValues?.provider_id ?? providers[0]?.id ?? "");
  const providerCode = providers.find((p) => p.id === providerId)?.code ?? "";

  return (
    <div className="max-w-2xl">
      <form action={action} className="space-y-6">
        <input type="hidden" name="provider_code" value={providerCode} />

        <Section title="Datos del lote">
          <div className="grid grid-cols-2 gap-4">
            {mode === "edit" && (
              <TextField
                label="Código del lote"
                name="code"
                defaultValue={initialValues?.code}
                hint="Único. Formato sugerido: PROVEEDOR-AÑO-SECUENCIA, ej. BUS-26-01."
              />
            )}
            <label className="col-span-2 block">
              <FieldLabel>Proveedor</FieldLabel>
              <select
                name="provider_id"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className={selectClass}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Concesión" name="concession" required={false} defaultValue={initialValues?.concession} />
            <label className="block">
              <FieldLabel>Fecha y hora de carga</FieldLabel>
              <input
                name="loaded_at"
                type="datetime-local"
                required
                defaultValue={initialValues?.loaded_at_local}
                className={inputClass}
              />
            </label>
            <TextField label="Placa del volquete" name="truck_plate" required={false} defaultValue={initialValues?.truck_plate} />
            <label className="block">
              <FieldLabel>Transportista</FieldLabel>
              <select name="carrier_name" defaultValue={initialValues?.carrier_name ?? ""} className={selectClass}>
                <option value="">Elegir...</option>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Section>

        <Section title="Peso y documentación">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <FieldLabel>Peso estimado (TMH)</FieldLabel>
              <input
                name="estimated_weight_tmh"
                type="number"
                step="0.01"
                required
                defaultValue={initialValues?.estimated_weight_tmh}
                className={inputClass}
              />
              <Hint>De la balanza de ejes.</Hint>
            </label>
            <TextField
              label="Precio internacional de referencia (USD/TMH)"
              name="reference_price_usd"
              type="number"
              step="0.01"
              required={false}
              defaultValue={initialValues?.reference_price_usd}
            />
            <TextField label="Número de guía inicial" name="initial_guide_number" required={false} defaultValue={initialValues?.initial_guide_number} />
            <TextField label="Número de factura inicial" name="initial_invoice_number" required={false} defaultValue={initialValues?.initial_invoice_number} />
            {mode === "create" && (
              <label className="col-span-2 block">
                <FieldLabel>Precintos colocados</FieldLabel>
                <textarea
                  name="seals"
                  rows={2}
                  placeholder="Uno por línea o separados por coma"
                  className={`${inputClass} resize-none`}
                />
              </label>
            )}
          </div>
        </Section>

        <Section title="Negociación con el proveedor">
          <p className="mb-3 text-xs text-slate-500">
            Precio provisional acordado con el proveedor. La ley todavía no se conoce en este
            paso — se carga después de la molienda, en el paso de laboratorio y valorización.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Precio provisional (USD/TMH)"
              name="provisional_price_per_tmh"
              type="number"
              step="0.01"
              defaultValue={initialValues?.provisional_price_per_tmh}
            />
            <TextField label="% Adelanto al proveedor" name="advance_pct" type="number" step="1" required={false} defaultValue={initialValues?.advance_pct} />
          </div>
        </Section>

        {state?.error && (
          <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-400">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
        >
          {pending ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Registrar lote"}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-medium text-slate-400">{children}</span>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-xs text-slate-600">{children}</span>;
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500";
const selectClass = inputClass;

function TextField({
  label,
  name,
  type = "text",
  step,
  required = true,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue}
        className={inputClass}
      />
      {hint && <Hint>{hint}</Hint>}
    </label>
  );
}
