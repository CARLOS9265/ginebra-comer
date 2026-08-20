"use client";

import { useActionState, useMemo, useState } from "react";
import { createPurchaseLot, type LotFormState } from "../actions";
import { canEstimate, estimateLot, type ContractSettings } from "@/lib/contract";

type Provider = { id: string; code: string; name: string };

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function NewLotForm({
  providers,
  contractSettings,
}: {
  providers: Provider[];
  contractSettings: ContractSettings | null;
}) {
  const [state, action, pending] = useActionState<LotFormState, FormData>(
    createPurchaseLot,
    null,
  );

  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const providerCode = providers.find((p) => p.id === providerId)?.code ?? "";

  const [tmh, setTmh] = useState("");
  const [ag, setAg] = useState("");
  const [au, setAu] = useState("");
  const [pb, setPb] = useState("");
  const [humidity, setHumidity] = useState("");
  const [precioAg, setPrecioAg] = useState("");
  const [precioAu, setPrecioAu] = useState("");
  const [precioPb, setPrecioPb] = useState("");
  const [precioProvisional, setPrecioProvisional] = useState("");

  const estimate = useMemo(() => {
    if (!contractSettings) return null;
    const input = {
      tmh: Number(tmh),
      ag: Number(ag),
      au: Number(au),
      pb: Number(pb),
      humidity: Number(humidity),
      precioAg: Number(precioAg),
      precioAu: Number(precioAu),
      precioPb: Number(precioPb),
      precioProvisionalPorTonelada: Number(precioProvisional) || 0,
    };
    if (!canEstimate(input)) return null;
    return estimateLot(input, contractSettings);
  }, [contractSettings, tmh, ag, au, pb, humidity, precioAg, precioAu, precioPb, precioProvisional]);

  const requiresApproval = estimate?.requiereAprobacion ?? false;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <form action={action} className="space-y-6">
        <input type="hidden" name="provider_code" value={providerCode} />

        <Section title="Datos del lote">
          <div className="grid grid-cols-2 gap-4">
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
            <TextField label="Mina de origen" name="mine_name" required={false} />
            <TextField label="Concesión" name="concession" required={false} />
            <label className="block">
              <FieldLabel>Fecha y hora de carga</FieldLabel>
              <input name="loaded_at" type="datetime-local" required className={inputClass} />
            </label>
            <TextField label="Placa del volquete" name="truck_plate" required={false} />
            <TextField label="Conductor" name="driver_name" required={false} />
            <TextField label="Transportista" name="carrier_name" required={false} />
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
                value={tmh}
                onChange={(e) => setTmh(e.target.value)}
                className={inputClass}
              />
              <Hint>De la balanza de ejes.</Hint>
            </label>
            <TextField label="Precio internacional de referencia (USD/TMH)" name="reference_price_usd" type="number" step="0.01" required={false} />
            <TextField label="Número de guía inicial" name="initial_guide_number" required={false} />
            <TextField label="Número de factura inicial" name="initial_invoice_number" required={false} />
            <label className="col-span-2 block">
              <FieldLabel>Precintos colocados</FieldLabel>
              <textarea
                name="seals"
                rows={2}
                placeholder="Uno por línea o separados por coma"
                className={`${inputClass} resize-none`}
              />
            </label>
          </div>
        </Section>

        <Section title="Estimación de leyes (para proyectar el lote)" optional>
          <p className="mb-3 text-xs text-slate-500">
            Opcional en este paso — todavía no hay resultado de laboratorio. Si cargás una
            estimación, el sistema te muestra la proyección de venta, costos y margen.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <TextField label="Ag (g/TM)" name="estimated_ag" type="number" step="0.01" required={false} value={ag} onChange={setAg} />
            <TextField label="Au (g/TM)" name="estimated_au" type="number" step="0.01" required={false} value={au} onChange={setAu} />
            <TextField label="Pb (%)" name="estimated_pb" type="number" step="0.01" required={false} value={pb} onChange={setPb} />
            <TextField label="Humedad (%)" name="estimated_humidity" type="number" step="0.01" required={false} value={humidity} onChange={setHumidity} />
            <TextField label="Precio Ag (USD/oz)" name="precio_ag" type="number" step="0.01" required={false} value={precioAg} onChange={setPrecioAg} />
            <TextField label="Precio Au (USD/oz)" name="precio_au" type="number" step="0.01" required={false} value={precioAu} onChange={setPrecioAu} />
            <TextField label="Precio Pb (USD/TM)" name="precio_pb" type="number" step="0.01" required={false} value={precioPb} onChange={setPrecioPb} />
          </div>
        </Section>

        <Section title="Negociación con el proveedor">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <FieldLabel>Precio provisional (USD/TMH)</FieldLabel>
              <input
                name="provisional_price_per_tmh"
                type="number"
                step="0.01"
                required
                value={precioProvisional}
                onChange={(e) => setPrecioProvisional(e.target.value)}
                className={inputClass}
              />
            </label>
            <TextField label="% Adelanto al proveedor" name="advance_pct" type="number" step="1" required={false} />
          </div>

          {requiresApproval && (
            <label className="mt-4 block">
              <FieldLabel>
                <span className="text-amber-400">Motivo (requiere aprobación de gerencia)</span>
              </FieldLabel>
              <textarea
                name="approval_reason"
                rows={2}
                required
                className={`${inputClass} resize-none border-amber-700/60`}
              />
            </label>
          )}
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
          {pending ? "Guardando..." : "Registrar lote"}
        </button>
      </form>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Proyección del lote</h2>
          {!estimate ? (
            <p className="mt-3 text-sm text-slate-500">
              Completá peso, leyes estimadas, humedad y precios de metales para ver la
              proyección.
            </p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              {(estimate.agRecortado || estimate.auRecortado) && (
                <p className="rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-400">
                  Ley por encima del rango contractual — recortada para la proyección.
                </p>
              )}
              <Row label="Venta estimada a PY / TMH" value={fmtUSD(estimate.valorPYxTMH)} />
              <Row label="Venta estimada total" value={fmtUSD(estimate.valorPYTotal)} strong />
              <Row label="Costos esperados / TMH" value={fmtUSD(estimate.costosXTMH)} />
              <Row
                label="Precio máximo recomendable / TMH"
                value={fmtUSD(estimate.precioMaximoCompra)}
                strong
              />
              <Row
                label="Margen esperado / TMH"
                value={fmtUSD(estimate.margenXTMH)}
                tone={estimate.margenXTMH >= 0 ? "good" : "bad"}
              />
              <Row
                label="Margen esperado total"
                value={fmtUSD(estimate.margenTotal)}
                tone={estimate.margenTotal >= 0 ? "good" : "bad"}
                strong
              />
              {requiresApproval && (
                <p className="rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-400">
                  El precio provisional supera el máximo recomendado — el lote va a quedar
                  pendiente de aprobación de gerencia.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  optional,
  children,
}: {
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-3 border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
        {optional && <span className="ml-2 normal-case text-slate-600">(opcional)</span>}
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
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={inputClass}
      />
    </label>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "good" | "bad";
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-slate-800 pb-2 last:border-none">
      <span className="text-slate-500">{label}</span>
      <span
        className={`font-mono ${strong ? "text-base font-semibold" : ""} ${
          tone === "good" ? "text-teal-400" : tone === "bad" ? "text-red-400" : "text-slate-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
