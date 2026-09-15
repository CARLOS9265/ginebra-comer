"use client";

import { useState, useTransition } from "react";
import { verifySeal, openSeal, voidSeal, deleteSeal, assignSealToLot } from "./actions";

type Lot = { id: string; code: string; dispatch_truck_plate: string | null };
type ActionResult = { error?: string } | null | void;

function lotLabel(l: Lot) {
  return l.dispatch_truck_plate ? `${l.dispatch_truck_plate} — ${l.code}` : l.code;
}

export function SealRowActions({ id, status, lots }: { id: string; status: string; lots: Lot[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [lotId, setLotId] = useState(lots[0]?.id ?? "");

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  if (status === "abierto" || status === "anulado") {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-3">
        {status === "disponible" && !assigning && (
          <button
            type="button"
            onClick={() => setAssigning(true)}
            className="text-xs text-gold-700 hover:underline"
          >
            Asignar a lote
          </button>
        )}
        {status === "colocado" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => verifySeal(id))}
            className="text-xs text-gold-700 hover:underline disabled:opacity-50"
          >
            Verificar
          </button>
        )}
        {(status === "colocado" || status === "verificado") && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("Motivo de apertura del precinto:");
              if (reason) run(() => openSeal(id, reason));
            }}
            className="text-xs text-amber-700 hover:underline disabled:opacity-50"
          >
            Abrir
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const reason = window.prompt("Motivo de anulación del precinto:");
            if (reason) run(() => voidSeal(id, reason));
          }}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          Anular
        </button>
        {status === "disponible" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("¿Eliminar este precinto?")) run(() => deleteSeal(id));
            }}
            className="text-xs text-slate-500 hover:underline disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
      </div>
      {assigning && (
        <div className="flex items-center gap-2">
          <select
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
          >
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {lotLabel(l)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !lotId}
            onClick={() => run(() => assignSealToLot(id, lotId))}
            className="text-xs text-gold-700 hover:underline disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => setAssigning(false)}
            className="text-xs text-slate-500 hover:underline"
          >
            Cancelar
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
