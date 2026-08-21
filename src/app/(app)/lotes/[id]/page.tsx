import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOT_STATUS_LABELS } from "@/lib/lot-status";
import { TransportForm } from "./TransportForm";
import { WeighingForm } from "./WeighingForm";
import { MillReceptionForm } from "./MillReceptionForm";
import { ComminutionForm } from "./ComminutionForm";
import { BigBagForm } from "./BigBagForm";
import { LabAnalysisForm } from "./LabAnalysisForm";
import { SettlementForm } from "./SettlementForm";
import { DeleteRowButton } from "./DeleteRowButton";
import {
  deleteTransportEvent,
  deleteWeighing,
  deleteMillReception,
  deleteComminution,
  deleteBigBag,
  deleteLabAnalysis,
  deleteSettlement,
} from "./actions";
import { estimateLot, type ContractSettings } from "@/lib/contract";

const SEAL_STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  colocado: "Colocado",
  verificado: "Verificado",
  abierto: "Abierto",
  anulado: "Anulado",
};

const WEIGHING_TYPE_LABELS: Record<string, string> = {
  inicial: "Pesaje inicial (guía)",
  oficial: "Pesaje oficial (balanza Trujillo)",
  regularizacion: "Regularización",
};

const fmtKg = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("es-PE")} kg`);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lot } = await supabase
    .from("purchase_lots")
    .select(
      "id, code, status, loaded_at, estimated_weight_tmh, provisional_price_per_tmh, carrier_name, truck_plate, estimated_au, estimated_ag, estimated_pb, estimated_price_au, estimated_price_ag, estimated_price_pb, providers(name, code)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!lot) notFound();

  const provider = Array.isArray(lot.providers) ? lot.providers[0] : lot.providers;

  const [
    { data: events },
    { data: weighings },
    { data: seals },
    { data: receptions },
    { data: comminutions },
    { data: labAnalyses },
    { data: settlements },
    { data: settings },
  ] = await Promise.all([
      supabase
        .from("transport_events")
        .select("id, departed_at, carrier_name, tariff_pen_per_tmh, security_cost_pen")
        .eq("purchase_lot_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("weighings")
        .select("id, type, gross_weight, tare_weight, net_weight, ticket_number, weighed_at, reason")
        .eq("purchase_lot_id", id)
        .order("weighed_at", { ascending: true }),
      supabase.from("seals").select("id, code, status").eq("purchase_lot_id", id).order("code"),
      supabase
        .from("mill_receptions")
        .select("id, received_at, supervisor_name, storage_location, incidents")
        .eq("purchase_lot_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("comminutions")
        .select(
          "id, started_at, finished_at, processed_tons, mill_invoice_number, tariff_pen_per_ton, responsible_name",
        )
        .eq("purchase_lot_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("lab_analyses")
        .select(
          "id, sampled_at, analyzed_at, lab_name, report_number, au_gt, ag_gt, pb_pct, as_pct, sb_pct, s_pct, humidity_pct, notes",
        )
        .eq("purchase_lot_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("lot_settlements")
        .select(
          "id, tmh_used, precio_definitivo_per_tmh, precio_definitivo_total, provisional_pagado_total, saldo_pendiente, valor_py_per_tmh, costos_per_tmh, ganancia_objetivo_usd, final_invoice_number, credit_debit_note_number, notes, created_at",
        )
        .eq("purchase_lot_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("contract_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

  const inicial = weighings?.find((w) => w.type === "inicial");
  const oficial = weighings?.find((w) => w.type === "oficial");
  const diffKg =
    inicial?.net_weight != null && oficial?.net_weight != null
      ? Number((oficial.net_weight - inicial.net_weight).toFixed(2))
      : null;

  const reception = receptions?.[0];
  const comminution = comminutions?.[0];

  const { data: bigBags } = comminution
    ? await supabase
        .from("big_bags")
        .select("id, code, weight_kg, storage_location")
        .eq("purchase_lot_id", id)
        .order("code")
    : { data: null };

  const bagsTotalKg = bigBags?.reduce((sum, b) => sum + (b.weight_kg ?? 0), 0) ?? 0;
  const processedKg = comminution?.processed_tons != null ? comminution.processed_tons * 1000 : null;
  const bagsDiffKg = processedKg != null && bigBags && bigBags.length > 0 ? Number((bagsTotalKg - processedKg).toFixed(2)) : null;

  const officialWeightHint =
    oficial?.net_weight != null
      ? `Pesaje oficial: ${fmtKg(oficial.net_weight)} (${(oficial.net_weight / 1000).toFixed(2)} TM)`
      : undefined;

  const analysis = labAnalyses?.[0];
  const settlement = settlements?.[0];

  const settlementTmh = oficial?.net_weight != null ? oficial.net_weight / 1000 : lot.estimated_weight_tmh;
  const canPreviewSettlement =
    !settlement &&
    !!analysis &&
    settings != null &&
    settlementTmh != null &&
    lot.estimated_price_au != null &&
    lot.estimated_price_ag != null &&
    lot.estimated_price_pb != null &&
    analysis.au_gt != null &&
    analysis.ag_gt != null &&
    analysis.pb_pct != null;

  const settlementPreview = canPreviewSettlement
    ? estimateLot(
        {
          tmh: settlementTmh!,
          ag: analysis!.ag_gt!,
          au: analysis!.au_gt!,
          pb: analysis!.pb_pct!,
          humidity: analysis!.humidity_pct ?? 0,
          precioAg: lot.estimated_price_ag!,
          precioAu: lot.estimated_price_au!,
          precioPb: lot.estimated_price_pb!,
          precioProvisionalPorTonelada: lot.provisional_price_per_tmh ?? 0,
        },
        settings as unknown as ContractSettings,
      )
    : null;

  const previewProvisionalTotal = (lot.provisional_price_per_tmh ?? 0) * (settlementTmh ?? 0);
  const previewSaldo = settlementPreview ? settlementPreview.precioMaximoCompraTotal - previewProvisionalTotal : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/lotes" className="text-xs text-slate-500 hover:text-slate-300">
          ← Lotes de compra
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-50">{lot.code}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {provider?.name ?? "—"} · Cargado el {new Date(lot.loaded_at).toLocaleDateString("es-PE")} ·{" "}
              {lot.estimated_weight_tmh ?? "—"} TMH estimadas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
              {LOT_STATUS_LABELS[lot.status as keyof typeof LOT_STATUS_LABELS] ?? lot.status}
            </span>
            <Link href={`/lotes/${lot.id}/editar`} className="text-xs text-teal-400 hover:underline">
              Editar datos del lote
            </Link>
          </div>
        </div>
      </div>

      <Section title="Precintos">
        {!seals || seals.length === 0 ? (
          <p className="text-sm text-slate-500">No hay precintos asignados a este lote todavía.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {seals.map((s) => (
              <span
                key={s.id}
                className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-mono text-slate-300"
              >
                {s.code} · {SEAL_STATUS_LABELS[s.status] ?? s.status}
              </span>
            ))}
          </div>
        )}
        <Link href="/precintos" className="mt-3 inline-block text-xs text-teal-400 hover:underline">
          Gestionar precintos →
        </Link>
      </Section>

      <Section title="Transporte">
        {events && events.length > 0 && (
          <div className="mb-4 space-y-2">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm"
              >
                <div className="space-y-0.5 text-slate-300">
                  <div>
                    {e.carrier_name ?? "Transportista sin datos"} ·{" "}
                    {fmtDate(e.departed_at) ?? "Sin fecha de salida"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {e.tariff_pen_per_tmh != null && `Tarifa S/ ${e.tariff_pen_per_tmh}/TMH`}
                    {e.security_cost_pen != null && ` · Seguridad S/ ${e.security_cost_pen}`}
                  </div>
                </div>
                <DeleteRowButton
                  action={deleteTransportEvent.bind(null, lot.id, e.id)}
                  confirmText="¿Eliminar este evento de transporte?"
                />
              </div>
            ))}
          </div>
        )}
        <TransportForm lotId={lot.id} defaultCarrier={lot.carrier_name ?? undefined} />
      </Section>

      <Section title="Pesajes">
        {weighings && weighings.length > 0 && (
          <div className="mb-4 space-y-2">
            {weighings.map((w) => (
              <div
                key={w.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm"
              >
                <div className="space-y-0.5 text-slate-300">
                  <div className="font-medium">{WEIGHING_TYPE_LABELS[w.type] ?? w.type}</div>
                  <div className="text-xs text-slate-500">
                    Bruto {fmtKg(w.gross_weight)} · Tara {fmtKg(w.tare_weight)} · Neto {fmtKg(w.net_weight)}
                    {w.ticket_number && ` · Ticket ${w.ticket_number}`}
                    {w.weighed_at && ` · ${fmtDate(w.weighed_at)}`}
                  </div>
                  {w.reason && <div className="text-xs text-amber-400">Motivo: {w.reason}</div>}
                </div>
                <DeleteRowButton
                  action={deleteWeighing.bind(null, lot.id, w.id)}
                  confirmText="¿Eliminar este pesaje?"
                />
              </div>
            ))}
            {diffKg != null && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  diffKg === 0
                    ? "border-slate-800 text-slate-400"
                    : diffKg > 0
                      ? "border-teal-900 bg-teal-950/30 text-teal-400"
                      : "border-red-900 bg-red-950/30 text-red-400"
                }`}
              >
                Diferencia oficial vs. inicial: {diffKg > 0 ? "+" : ""}
                {diffKg.toLocaleString("es-PE")} kg
              </div>
            )}
          </div>
        )}
        <WeighingForm lotId={lot.id} />
      </Section>

      <Section title="Recepción en molino">
        {reception ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm">
            <div className="space-y-0.5 text-slate-300">
              <div>
                {reception.supervisor_name ?? "Supervisor sin datos"} ·{" "}
                {fmtDate(reception.received_at) ?? "Sin fecha"}
              </div>
              {reception.storage_location && (
                <div className="text-xs text-slate-500">Ubicación: {reception.storage_location}</div>
              )}
              {reception.incidents && (
                <div className="text-xs text-amber-400">Incidente: {reception.incidents}</div>
              )}
            </div>
            <DeleteRowButton
              action={deleteMillReception.bind(null, lot.id, reception.id)}
              confirmText="¿Eliminar esta recepción en molino?"
            />
          </div>
        ) : (
          <MillReceptionForm lotId={lot.id} />
        )}
      </Section>

      <Section title="Conminución y big bags">
        {comminution ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm">
              <div className="space-y-0.5 text-slate-300">
                <div>
                  {comminution.responsible_name ?? "Responsable sin datos"} ·{" "}
                  {fmtDate(comminution.started_at) ?? "Sin fecha de inicio"}
                  {comminution.finished_at && ` → ${fmtDate(comminution.finished_at)}`}
                </div>
                <div className="text-xs text-slate-500">
                  {comminution.processed_tons != null && `Procesado (molino): ${comminution.processed_tons} TM · `}
                  {comminution.tariff_pen_per_ton != null && `Tarifa S/ ${comminution.tariff_pen_per_ton}/TM`}
                  {comminution.mill_invoice_number && ` · Factura ${comminution.mill_invoice_number}`}
                </div>
              </div>
              <DeleteRowButton
                action={deleteComminution.bind(null, lot.id, comminution.id)}
                confirmText="¿Eliminar esta conminución? También podés dejar los big bags y borrar solo el encabezado."
              />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium text-slate-500">Big bags generados</h3>
              {bigBags && bigBags.length > 0 ? (
                <div className="mb-3 space-y-2">
                  {bigBags.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 p-2.5 text-sm"
                    >
                      <div className="text-slate-300">
                        <span className="font-mono">{b.code}</span> · {fmtKg(b.weight_kg)}
                        {b.storage_location && ` · ${b.storage_location}`}
                      </div>
                      <DeleteRowButton
                        action={deleteBigBag.bind(null, lot.id, b.id)}
                        confirmText={`¿Eliminar el big bag ${b.code}?`}
                      />
                    </div>
                  ))}
                  {bagsDiffKg != null && (
                    <div
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        bagsDiffKg === 0
                          ? "border-slate-800 text-slate-400"
                          : Math.abs(bagsDiffKg) <= 50
                            ? "border-teal-900 bg-teal-950/30 text-teal-400"
                            : "border-red-900 bg-red-950/30 text-red-400"
                      }`}
                    >
                      Total en big bags: {fmtKg(bagsTotalKg)} · Diferencia vs. procesado (molino):{" "}
                      {bagsDiffKg > 0 ? "+" : ""}
                      {bagsDiffKg.toLocaleString("es-PE")} kg
                    </div>
                  )}
                </div>
              ) : (
                <p className="mb-3 text-sm text-slate-500">Todavía no se cargó ningún big bag.</p>
              )}
              <BigBagForm lotId={lot.id} comminutionId={comminution.id} />
            </div>
          </div>
        ) : (
          <ComminutionForm lotId={lot.id} officialWeightHint={officialWeightHint} />
        )}
      </Section>

      <Section title="Laboratorio">
        {analysis ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm">
            <div className="space-y-2 text-slate-300">
              <div>
                {analysis.lab_name ?? "Laboratorio sin datos"} ·{" "}
                {fmtDate(analysis.analyzed_at) ?? fmtDate(analysis.sampled_at) ?? "Sin fecha"}
                {analysis.report_number && ` · Informe ${analysis.report_number}`}
              </div>
              <div className="space-y-1">
                <MetalCompareRow label="Au" unit="g/t" real={analysis.au_gt} estimated={lot.estimated_au} />
                <MetalCompareRow label="Ag" unit="g/t" real={analysis.ag_gt} estimated={lot.estimated_ag} />
                <MetalCompareRow label="Pb" unit="%" real={analysis.pb_pct} estimated={lot.estimated_pb} />
              </div>
              <div className="text-xs text-slate-500">
                {analysis.as_pct != null && `As ${analysis.as_pct}% · `}
                {analysis.sb_pct != null && `Sb ${analysis.sb_pct}% · `}
                {analysis.s_pct != null && `S ${analysis.s_pct}% · `}
                {analysis.humidity_pct != null && `Humedad ${analysis.humidity_pct}%`}
              </div>
              {analysis.notes && <div className="text-xs text-slate-500">Notas: {analysis.notes}</div>}
            </div>
            <DeleteRowButton
              action={deleteLabAnalysis.bind(null, lot.id, analysis.id)}
              confirmText="¿Eliminar este resultado de laboratorio?"
            />
          </div>
        ) : (
          <LabAnalysisForm lotId={lot.id} />
        )}
      </Section>

      <Section title="Valorización definitiva y liquidación">
        {settlement ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm">
            <div className="space-y-1 text-slate-300">
              <Row label="Precio definitivo /TMH" value={fmtUSD(settlement.precio_definitivo_per_tmh)} strong />
              <Row label="Total definitivo" value={fmtUSD(settlement.precio_definitivo_total, 0)} />
              <Row label="Ya pagado (provisional)" value={fmtUSD(settlement.provisional_pagado_total, 0)} />
              <div className="border-t border-dashed border-slate-800 pt-1">
                <Row
                  label={settlement.saldo_pendiente >= 0 ? "Saldo a favor del proveedor" : "Saldo a favor de Ginebra"}
                  value={fmtUSD(Math.abs(settlement.saldo_pendiente), 0)}
                  strong
                />
              </div>
              {(settlement.final_invoice_number || settlement.credit_debit_note_number) && (
                <div className="text-xs text-slate-500">
                  {settlement.final_invoice_number && `Factura final: ${settlement.final_invoice_number} · `}
                  {settlement.credit_debit_note_number && `N/C-D: ${settlement.credit_debit_note_number}`}
                </div>
              )}
              {settlement.notes && <div className="text-xs text-slate-500">Notas: {settlement.notes}</div>}
            </div>
            <DeleteRowButton
              action={deleteSettlement.bind(null, lot.id, settlement.id)}
              confirmText="¿Eliminar esta liquidación definitiva?"
            />
          </div>
        ) : !analysis ? (
          <p className="text-sm text-slate-500">
            Falta el resultado de laboratorio para poder calcular la valorización definitiva.
          </p>
        ) : !settlementPreview ? (
          <p className="text-sm text-slate-500">
            Faltan datos para calcular (precios de metal del provisional, peso, o configuración del contrato).
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
              <p className="mb-2 text-xs font-medium text-slate-500">
                Vista previa (con ley real de laboratorio y el precio de metales del provisional)
              </p>
              <Row label="Valor de venta a PY /TMH" value={fmtUSD(settlementPreview.valorPYxTMH)} />
              <Row label="Costos hasta la venta /TMH" value={fmtUSD(settlementPreview.costosXTMH)} />
              <Row label="Margen objetivo" value={fmtUSD(settings!.ganancia_objetivo_usd, 0)} />
              <div className="my-2 border-t border-dashed border-slate-800" />
              <Row label="Precio definitivo /TMH" value={fmtUSD(settlementPreview.precioMaximoCompra)} strong />
              <Row label="Total definitivo" value={fmtUSD(settlementPreview.precioMaximoCompraTotal, 0)} />
              <Row label="Ya pagado (provisional)" value={fmtUSD(previewProvisionalTotal, 0)} />
              <Row
                label={
                  (previewSaldo ?? 0) >= 0 ? "Saldo a favor del proveedor" : "Saldo a favor de Ginebra"
                }
                value={fmtUSD(Math.abs(previewSaldo ?? 0), 0)}
                strong
              />
            </div>
            <SettlementForm lotId={lot.id} />
          </div>
        )}
      </Section>
    </div>
  );
}

const fmtUSD = (n: number | null, decimals = 2) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals });

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${strong ? "text-sm font-semibold text-teal-400" : "text-slate-300"}`}>
        {value}
      </span>
    </div>
  );
}

function MetalCompareRow({
  label,
  unit,
  real,
  estimated,
}: {
  label: string;
  unit: string;
  real: number | null;
  estimated: number | null;
}) {
  if (real == null) return null;
  const isLow = estimated != null && real < estimated;
  return (
    <div className={`text-xs ${isLow ? "text-amber-400" : "text-slate-300"}`}>
      {label}: {real} {unit}
      {estimated != null && ` (estimado: ${estimated} ${unit})`}
      {isLow && " — menor al estimado, revisar"}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </div>
  );
}
