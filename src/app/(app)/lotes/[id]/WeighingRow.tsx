"use client";

import { useState } from "react";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteWeighing, deleteWeighingTicketPhoto } from "./actions";
import { WeighingForm } from "./WeighingForm";
import { WeighingTicketPhotoForm } from "./WeighingTicketPhotoForm";

const WEIGHING_TYPE_LABELS: Record<string, string> = {
  inicial: "Inicial (guía)",
  oficial: "Oficial (balanza Trujillo)",
  regularizacion: "Regularización",
};

const fmtTon = (n: number | null) =>
  n == null ? "—" : `${(n / 1000).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TM`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("es-PE") : null);

type Weighing = {
  id: string;
  type: string;
  net_weight: number | null;
  ticket_number: string | null;
  weighed_at: string | null;
  reason: string | null;
};

type TicketPhoto = { id: string; url: string | null; storagePath: string };

export function WeighingRow({
  lotId,
  weighing,
  ticketPhotos,
}: {
  lotId: string;
  weighing: Weighing;
  ticketPhotos: TicketPhoto[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm">
      {editing ? (
        <WeighingForm lotId={lotId} weighingId={weighing.id} initialValues={weighing} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 text-slate-400">
            <div className="font-medium">{WEIGHING_TYPE_LABELS[weighing.type] ?? weighing.type}</div>
            <div className="text-xs text-slate-500">
              Neto {fmtTon(weighing.net_weight)}
              {weighing.ticket_number && ` · Ticket ${weighing.ticket_number}`}
              {weighing.weighed_at && ` · ${fmtDate(weighing.weighed_at)}`}
            </div>
            {weighing.reason && <div className="text-xs text-amber-700">Motivo: {weighing.reason}</div>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
              Editar
            </button>
            <DeleteRowButton
              action={deleteWeighing.bind(null, lotId, weighing.id)}
              confirmText="¿Eliminar este pesaje?"
            />
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {ticketPhotos.map((p) => (
          <div key={p.id} className="relative">
            {p.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.url}
                alt="Foto del ticket de balanza"
                className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-slate-200 text-xs text-slate-400">
                Sin vista previa
              </div>
            )}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <DeleteRowButton
                action={deleteWeighingTicketPhoto.bind(null, lotId, p.id, p.storagePath)}
                confirmText="¿Eliminar esta foto del ticket?"
              />
            </div>
          </div>
        ))}
        <WeighingTicketPhotoForm lotId={lotId} weighingId={weighing.id} />
      </div>
    </div>
  );
}
