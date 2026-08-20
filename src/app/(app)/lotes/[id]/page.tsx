import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOT_STATUS_LABELS } from "@/lib/lot-status";
import { TransportForm } from "./TransportForm";
import { WeighingForm } from "./WeighingForm";
import { MillReceptionForm } from "./MillReceptionForm";
import { ComminutionForm } from "./ComminutionForm";
import { BigBagForm } from "./BigBagForm";
import { DeleteRowButton } from "./DeleteRowButton";
import {
  deleteTransportEvent,
  deleteWeighing,
  deleteMillReception,
  deleteComminution,
  deleteBigBag,
} from "./actions";

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
      "id, code, status, loaded_at, estimated_weight_tmh, provisional_price_per_tmh, carrier_name, truck_plate, providers(name, code)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!lot) notFound();

  const provider = Array.isArray(lot.providers) ? lot.providers[0] : lot.providers;

  const [{ data: events }, { data: weighings }, { data: seals }, { data: receptions }, { data: comminutions }] =
    await Promise.all([
      supabase
        .from("transport_events")
        .select(
          "id, departed_at, carrier_name, tariff_pen_per_tmh, security_group_code, security_cost_pen, estimated_arrival, incidents",
        )
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
                    {e.tariff_pen_per_tmh != null && `Tarifa S/ ${e.tariff_pen_per_tmh}/TMH · `}
                    {e.security_group_code && `Seguridad: ${e.security_group_code} · `}
                    {e.estimated_arrival && `Llegada estimada: ${fmtDate(e.estimated_arrival)}`}
                  </div>
                  {e.incidents && <div className="text-xs text-amber-400">Incidente: {e.incidents}</div>}
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
