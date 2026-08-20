"use client";

import { useActionState, useMemo, useState } from "react";
import { createPurchaseLot, updatePurchaseLot, type LotFormState } from "./actions";
import { CARRIERS } from "@/lib/carriers";
import { calcProvisionalPrice } from "@/lib/provisional-price";

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
  estimated_ag: string;
  estimated_au: string;
  estimated_pb: string;
  provisional_price_per_tmh: string;
  advance_pct: string;
};

export type ReferencePrices = {
  gold: number | null;
  silver: number | null;
  lead: number | null;
  referencePct: number;
  isLive: boolean;
};

const fmtUSD = (n: number, decimals = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals });

export function LotForm({
  providers,
  mode,
  lotId,
  initialValues,
  refPrices,
}: {
  providers: Provider[];
  mode: "create" | "edit";
  lotId?: string;
  initialValues?: LotInitialValues;
  refPrices?: ReferencePrices;
}) {
  const boundAction =
    mode === "edit" && lotId ? updatePurchaseLot.bind(null, lotId) : createPurchaseLot;
  const [state, action, pending] = useActionState<LotFormState, FormData>(boundAction, null);

  const [providerId, setProviderId] = useState(initialValues?.provider_id ?? providers[0]?.id ?? "");
  const providerCode = providers.find((p) => p.id === providerId)?.code ?? "";
  const [tmh, setTmh] = useState(initialValues?.estimated_weight_tmh ?? "");
  const [payablePct, setPayablePct] = useState(String(refPrices?.referencePct ?? 40));
  const [goldGrade, setGoldGrade] = useState(initialValues?.estimated_au ?? "");
  const [silverGrade, setSilverGrade] = useState(initialValues?.estimated_ag ?? "");
  const [leadGrade, setLeadGrade] = useState(initialValues?.estimated_pb ?? "");
  const [provisional, setProvisional] = useState(initialValues?.provisional_price_per_tmh ?? "");

  const suggestion = useMemo(() => {
    if (!refPrices || refPrices.gold == null || refPrices.silver == null) return null;
    const tmhNum = Number(tmh);
    const pctNum = Number(payablePct);
    if (!tmhNum || !pctNum) return null;
    return calcProvisionalPrice({
      tmh: tmhNum,
      payablePct: pctNum,
      goldPriceUsdOz: refPrices.gold,
      silverPriceUsdOz: refPrices.silver,
      leadPriceUsdTon: refPrices.lead ?? 0,
      goldGradeGT: Number(goldGrade) || 0,
      silverGradeGT: Number(silverGrade) || 0,
      leadGradePct: Number(leadGrade) || 0,
    });
  }, [refPrices, tmh, payablePct, goldGrade, silverGrade, leadGrade]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
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
                value={tmh}
                onChange={(e) => setTmh(e.target.value)}
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

        <Section title="Ley estimada (para el pago provisional)">
          <p className="mb-3 text-xs text-slate-500">
            No es un resultado de laboratorio — es una ley asumida (promedio histórico del
            proveedor o acordada) que sirve solo para calcular el pago inicial. La ley real
            llega después de la molienda y ahí se reliquida (segunda fijación).
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="block">
              <FieldLabel>Au (g/t)</FieldLabel>
              <input
                name="estimated_au"
                type="number"
                step="0.01"
                value={goldGrade}
                onChange={(e) => setGoldGrade(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel>Ag (g/t)</FieldLabel>
              <input
                name="estimated_ag"
                type="number"
                step="0.01"
                value={silverGrade}
                onChange={(e) => setSilverGrade(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel>Pb (%)</FieldLabel>
              <input
                name="estimated_pb"
                type="number"
                step="0.01"
                value={leadGrade}
                onChange={(e) => setLeadGrade(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel>% pagable inicial</FieldLabel>
              <input
                name="payable_pct"
                type="number"
                step="1"
                value={payablePct}
                onChange={(e) => setPayablePct(e.target.value)}
                className={inputClass}
              />
              <Hint>Por defecto viene de Precios, pero se puede ajustar acá.</Hint>
            </label>
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
                value={provisional}
                onChange={(e) => setProvisional(e.target.value)}
                className={inputClass}
              />
              {suggestion && (
                <button
                  type="button"
                  onClick={() => setProvisional(suggestion.unitPriceUsdPerTms.toFixed(2))}
                  className="mt-1.5 text-xs text-teal-400 hover:underline"
                >
                  Usar sugerido ({fmtUSD(suggestion.unitPriceUsdPerTms)}/TMH)
                </button>
              )}
            </label>
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

      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Pago provisional sugerido</h2>
            {refPrices?.isLive && (
              <span className="flex items-center gap-1.5 text-xs text-teal-400">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" /> En vivo
              </span>
            )}
          </div>
          {!refPrices || (refPrices.gold == null && refPrices.silver == null) ? (
            <p className="text-sm text-slate-500">No se pudo leer el precio internacional ahora mismo.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <Row label="Oro (USD/oz)" value={fmtUSD(refPrices.gold)} />
              <Row label="Plata (USD/oz)" value={fmtUSD(refPrices.silver)} />
              {refPrices.lead != null && <Row label="Plomo (USD/TM)" value={fmtUSD(refPrices.lead, 0)} />}
              <Row label="% pagable inicial" value={`${payablePct || 0}%`} />

              <div className="border-t border-dashed border-slate-800 pt-3">
                {!tmh || !goldGrade && !silverGrade && !leadGrade ? (
                  <p className="text-xs text-slate-600">
                    Cargá el peso (TMH) y al menos una ley estimada para ver el cálculo.
                  </p>
                ) : suggestion ? (
                  <>
                    <Row label="Au → USD/TMS" value={fmtUSD(suggestion.goldUsdPerTms)} />
                    <Row label="Ag → USD/TMS" value={fmtUSD(suggestion.silverUsdPerTms)} />
                    <Row label="Pb → USD/TMS" value={fmtUSD(suggestion.leadUsdPerTms)} />
                    <div className="mt-2 border-t border-dashed border-slate-800 pt-2">
                      <Row label="Precio unitario" value={`${fmtUSD(suggestion.unitPriceUsdPerTms)}/TMH`} strong />
                      <Row label="Total del lote" value={fmtUSD(suggestion.totalUsd, 0)} strong />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-600">Cargá el peso y la ley estimada.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${strong ? "text-base font-semibold text-teal-400" : "text-slate-200"}`}>
        {value}
      </span>
    </div>
  );
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
