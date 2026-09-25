import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOT_STATUS_LABELS, LOT_STATUS_ORDER } from "@/lib/lot-status";
import { TransportForm } from "./TransportForm";
import { TransportEventRow } from "./TransportEventRow";
import { WeighingForm } from "./WeighingForm";
import { WeighingRow } from "./WeighingRow";
import { ComminutionForm } from "./ComminutionForm";
import { ComminutionRow } from "./ComminutionRow";
import { LabAnalysisForm } from "./LabAnalysisForm";
import { LabAnalysisRow } from "./LabAnalysisRow";
import { SettlementForm } from "./SettlementForm";
import { SettlementRow } from "./SettlementRow";
import { WarehousePhotoForm } from "./WarehousePhotoForm";
import { WarehouseTransferForm } from "./WarehouseTransferForm";
import { WarehouseTransferRow } from "./WarehouseTransferRow";
import { HuanchacoWeighingForm } from "./HuanchacoWeighingForm";
import { HuanchacoWeighingRow } from "./HuanchacoWeighingRow";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { ActionButton } from "@/components/ActionButton";
import { deleteWarehousePhoto, markSettlementPaid, closeLot, markReceivedAtMill } from "./actions";
import { estimateLot, type ContractSettings } from "@/lib/contract";

const fmtTon = (n: number | null) =>
  n == null ? "—" : `${(n / 1000).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TM`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lot } = await supabase
    .from("purchase_lots")
    .select(
      "id, code, status, loaded_at, estimated_weight_tmh, provisional_price_per_tmh, carrier_name, truck_plate, estimated_au, estimated_ag, estimated_pb, estimated_price_au, estimated_price_ag, estimated_price_pb, price_fixing_date, providers(id, name, code)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!lot) notFound();

  const provider = Array.isArray(lot.providers) ? lot.providers[0] : lot.providers;

  const [
    { data: events },
    { data: weighings },
    { data: comminutions },
    { data: labAnalyses },
    { data: settlements },
    { data: settings },
    { data: photoDocs },
    { data: advances },
  ] = await Promise.all([
      supabase
        .from("transport_events")
        .select("id, departed_at, carrier_name, tariff_pen_per_tmh, security_cost_pen")
        .eq("purchase_lot_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("weighings")
        .select("id, type, net_weight, ticket_number, weighed_at, reason")
        .eq("purchase_lot_id", id)
        .order("weighed_at", { ascending: true }),
      supabase
        .from("comminutions")
        .select("id, processed_tons, tariff_pen_per_ton, bag_count")
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
          "id, tmh_used, precio_definitivo_per_tmh, precio_definitivo_total, provisional_pagado_total, saldo_pendiente, adelanto_aplicado_usd, valor_py_per_tmh, costos_per_tmh, ganancia_objetivo_usd, final_invoice_number, credit_debit_note_number, notes, paid_at, created_at",
        )
        .eq("purchase_lot_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("contract_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("documents")
        .select("id, storage_path, uploaded_at")
        .eq("entity_type", "purchase_lot")
        .eq("entity_id", id)
        .eq("doc_type", "foto_almacen")
        .order("uploaded_at", { ascending: false }),
      provider
        ? supabase.from("provider_advances").select("amount_usd").eq("provider_id", provider.id)
        : Promise.resolve({ data: [] as { amount_usd: number }[] }),
    ]);

  // En la compra ya no se fija plomo (solo oro y plata): la valorización
  // definitiva toma el plomo del lote si ya lo tenía guardado, y si no, el
  // último precio de plomo cargado en Precios.
  const { data: latestLead } = await supabase
    .from("daily_metal_prices")
    .select("price_date, lead_usd_ton")
    .not("lead_usd_ton", "is", null)
    .order("price_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const settlementLead: number | null = lot.estimated_price_pb ?? latestLead?.lead_usd_ton ?? null;
  const leadIsFallback = lot.estimated_price_pb == null && latestLead?.lead_usd_ton != null;

  const { data: transfers } = await supabase
    .from("warehouse_transfers")
    .select("id, forklift_cost_pen, dispatch_carrier, dispatch_truck_plate, departed_at, arrived_at, incidents")
    .eq("purchase_lot_id", id)
    .order("created_at", { ascending: false });

  const trujilloWeighings = (weighings ?? []).filter((w) => w.type !== "huanchaco");
  const huanchacoWeighing = weighings?.find((w) => w.type === "huanchaco");

  const inicial = weighings?.find((w) => w.type === "inicial");
  const oficial = weighings?.find((w) => w.type === "oficial");
  const diffKg =
    inicial?.net_weight != null && oficial?.net_weight != null
      ? Number((oficial.net_weight - inicial.net_weight).toFixed(2))
      : null;

  const comminution = comminutions?.[0];
  const receivedAtMill = LOT_STATUS_ORDER.indexOf(lot.status as (typeof LOT_STATUS_ORDER)[number]) >=
    LOT_STATUS_ORDER.indexOf("recibido_molino");

  const { data: ticketDocs } =
    weighings && weighings.length > 0
      ? await supabase
          .from("documents")
          .select("id, entity_id, storage_path, uploaded_at")
          .eq("entity_type", "weighing")
          .eq("doc_type", "ticket_balanza")
          .in(
            "entity_id",
            weighings.map((w) => w.id),
          )
          .order("uploaded_at", { ascending: false })
      : { data: null };

  let ticketPhotosByWeighing = new Map<
    string,
    { id: string; url: string | null; storagePath: string }[]
  >();
  if (ticketDocs && ticketDocs.length > 0) {
    const { data: signedTickets } = await supabase.storage
      .from("lot-photos")
      .createSignedUrls(
        ticketDocs.map((d) => d.storage_path),
        3600,
      );
    ticketDocs.forEach((d, i) => {
      const list = ticketPhotosByWeighing.get(d.entity_id) ?? [];
      list.push({ id: d.id, url: signedTickets?.[i]?.signedUrl ?? null, storagePath: d.storage_path });
      ticketPhotosByWeighing.set(d.entity_id, list);
    });
  }

  const officialWeightHint =
    oficial?.net_weight != null ? `Pesaje oficial: ${fmtTon(oficial.net_weight)}` : undefined;

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
    settlementLead != null &&
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
          precioPb: settlementLead!,
          precioProvisionalPorTonelada: lot.provisional_price_per_tmh ?? 0,
        },
        settings as unknown as ContractSettings,
      )
    : null;

  const previewProvisionalTotal = (lot.provisional_price_per_tmh ?? 0) * (settlementTmh ?? 0);
  const previewSaldo = settlementPreview ? settlementPreview.precioMaximoCompraTotal - previewProvisionalTotal : null;

  // Saldo de adelantos pendientes de este proveedor (suma de todos sus
  // movimientos: adelantos dados en positivo, ya aplicados en negativo).
  const pendingAdvanceUsd = Math.max(0, (advances ?? []).reduce((sum, a) => sum + a.amount_usd, 0));

  const isPaid = settlement?.paid_at != null;

  let photos: { id: string; url: string | null; uploadedAt: string; storagePath: string }[] = [];
  if (photoDocs && photoDocs.length > 0) {
    const { data: signed } = await supabase.storage
      .from("lot-photos")
      .createSignedUrls(
        photoDocs.map((d) => d.storage_path),
        3600,
      );
    photos = photoDocs.map((d, i) => ({
      id: d.id,
      url: signed?.[i]?.signedUrl ?? null,
      uploadedAt: d.uploaded_at,
      storagePath: d.storage_path,
    }));
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/lotes" className="text-xs text-slate-500 hover:text-slate-900">
          ← Lotes de compra
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{lot.code}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {provider?.name ?? "—"} · Cargado el {new Date(lot.loaded_at).toLocaleDateString("es-PE")} ·{" "}
              {lot.estimated_weight_tmh ?? "—"} TMH estimadas
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {lot.price_fixing_date ? (
                <>
                  Precio fijado el {new Date(`${lot.price_fixing_date}T00:00:00`).toLocaleDateString("es-PE")} · Au{" "}
                  {fmtUSD(lot.estimated_price_au, 2)}/oz · Ag {fmtUSD(lot.estimated_price_ag, 2)}/oz
                </>
              ) : (
                "Sin fecha de fijación de precio — editá el lote para cargarla."
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-400">
              {LOT_STATUS_LABELS[lot.status as keyof typeof LOT_STATUS_LABELS] ?? lot.status}
            </span>
            <Link href={`/lotes/${lot.id}/editar`} className="text-xs text-gold-700 hover:underline">
              Editar datos del lote
            </Link>
          </div>
        </div>
      </div>

      <Section title="Transporte">
        {events && events.length > 0 && (
          <div className="mb-4 space-y-2">
            {events.map((e) => (
              <TransportEventRow key={e.id} lotId={lot.id} event={e} />
            ))}
          </div>
        )}
        <TransportForm lotId={lot.id} defaultCarrier={lot.carrier_name ?? undefined} />
      </Section>

      <Section title="Pesajes (balanza Trujillo)">
        {trujilloWeighings.length > 0 && (
          <div className="mb-4 space-y-2">
            {trujilloWeighings.map((w) => (
              <WeighingRow
                key={w.id}
                lotId={lot.id}
                weighing={w}
                ticketPhotos={ticketPhotosByWeighing.get(w.id) ?? []}
              />
            ))}
            {diffKg != null && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  diffKg === 0
                    ? "border-slate-200 text-slate-500"
                    : diffKg > 0
                      ? "border-gold-200 bg-gold-50 text-gold-700"
                      : "border-red-200 bg-red-50 text-red-600"
                }`}
              >
                Diferencia oficial vs. inicial: {diffKg > 0 ? "+" : ""}
                {(diffKg / 1000).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TM
              </div>
            )}
          </div>
        )}
        <WeighingForm lotId={lot.id} />
      </Section>

      <Section title="Recepción en molino">
        {receivedAtMill ? (
          <p className="text-sm text-gold-700">✓ Recibido en molino</p>
        ) : (
          <ActionButton action={() => markReceivedAtMill(lot.id)} label="Marcar como recibido en molino" />
        )}
      </Section>

      <Section title="Conminución y big bags">
        {comminution ? (
          <ComminutionRow lotId={lot.id} comminution={comminution} officialWeightHint={officialWeightHint} />
        ) : (
          <ComminutionForm lotId={lot.id} officialWeightHint={officialWeightHint} />
        )}
      </Section>

      <Section title="Laboratorio">
        {analysis ? (
          <LabAnalysisRow
            lotId={lot.id}
            analysis={analysis}
            estimatedAu={lot.estimated_au}
            estimatedAg={lot.estimated_ag}
            estimatedPb={lot.estimated_pb}
          />
        ) : (
          <LabAnalysisForm lotId={lot.id} />
        )}
      </Section>

      <Section title="Valorización definitiva y liquidación">
        {settlement ? (
          <SettlementRow lotId={lot.id} settlement={settlement} />
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
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="mb-2 text-xs font-medium text-slate-500">
                Vista previa (con ley real de laboratorio y el precio de oro y plata fijado en la compra)
              </p>
              {leadIsFallback && latestLead && (
                <p className="mb-2 text-xs text-amber-700">
                  Plomo: {fmtUSD(settlementLead, 0)}/TM — último precio cargado en Precios (
                  {new Date(`${latestLead.price_date}T00:00:00`).toLocaleDateString("es-PE")}), porque en la
                  compra ya no se fija plomo.
                </p>
              )}
              <Row label="Valor de venta a PY /TMH" value={fmtUSD(settlementPreview.valorPYxTMH)} />
              <Row label="Costos hasta la venta /TMH" value={fmtUSD(settlementPreview.costosXTMH)} />
              <Row label="Margen objetivo" value={fmtUSD(settings!.ganancia_objetivo_usd, 0)} />
              <div className="my-2 border-t border-dashed border-slate-200" />
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
              {pendingAdvanceUsd > 0 && (
                <p className="mt-2 border-t border-dashed border-slate-200 pt-2 text-xs text-gold-700">
                  Este proveedor tiene {fmtUSD(pendingAdvanceUsd, 0)} de adelanto pendiente —{" "}
                  <Link href="/adelantos" className="underline">
                    ver detalle
                  </Link>
                  .
                </p>
              )}
            </div>
            <SettlementForm lotId={lot.id} pendingAdvanceUsd={pendingAdvanceUsd} maxApplyUsd={Math.max(0, previewSaldo ?? 0)} />
          </div>
        )}
      </Section>

      <Section title="Traslado a almacén (Huanchaco)">
        <p className="mb-3 text-xs text-slate-500">
          Del molino al almacén de Huanchaco: montacarga, trailer, pesaje propio (distinto al de Trujillo) y
          descarga.
        </p>
        {transfers && transfers.length > 0 && (
          <div className="mb-3 space-y-2">
            {transfers.map((t) => (
              <WarehouseTransferRow key={t.id} lotId={lot.id} transfer={t} />
            ))}
          </div>
        )}
        <WarehouseTransferForm lotId={lot.id} />

        <div className="mt-4">
          {huanchacoWeighing ? (
            <HuanchacoWeighingRow lotId={lot.id} weighing={huanchacoWeighing} />
          ) : (
            <HuanchacoWeighingForm lotId={lot.id} />
          )}
        </div>

        <h3 className="mb-2 mt-6 text-xs font-medium text-slate-500">Foto de evidencia</h3>
        {photos.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-3">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt="Foto de traslado a almacén"
                    className="h-28 w-28 rounded-lg border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-slate-200 text-xs text-slate-400">
                    Sin vista previa
                  </div>
                )}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <DeleteRowButton
                    action={deleteWarehousePhoto.bind(null, lot.id, p.id, p.storagePath)}
                    confirmText="¿Eliminar esta foto?"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <WarehousePhotoForm lotId={lot.id} />
      </Section>

      <Section title="Cierre de compra">
        {!settlement ? (
          <p className="text-sm text-slate-500">
            Falta la liquidación definitiva para poder cerrar la compra.
          </p>
        ) : lot.status === "cerrado" ? (
          <p className="text-sm text-gold-700">Compra cerrada.</p>
        ) : !isPaid ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Saldo pendiente: {fmtUSD(Math.abs(settlement.saldo_pendiente), 0)}{" "}
              {settlement.saldo_pendiente >= 0 ? "a favor del proveedor" : "a favor de Ginebra"}.
            </p>
            <ActionButton
              action={markSettlementPaid.bind(null, lot.id, settlement.id)}
              label="Marcar como pagado"
              pendingLabel="Guardando..."
              confirmText="¿Confirmás que el saldo de este lote ya se pagó?"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gold-700">Pagado el {fmtDate(settlement.paid_at)}.</p>
            <ActionButton
              action={closeLot.bind(null, lot.id)}
              label="Cerrar compra"
              pendingLabel="Cerrando..."
              confirmText="¿Cerrar la compra de este lote? Es el paso final del flujo de compra."
            />
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
      <span className={`font-mono ${strong ? "text-sm font-semibold text-gold-700" : "text-slate-400"}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </div>
  );
}
