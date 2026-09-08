"use client";

import { useState } from "react";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteSettlement } from "./actions";
import { SettlementEditForm } from "./SettlementEditForm";

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

type Settlement = {
  id: string;
  precio_definitivo_per_tmh: number;
  precio_definitivo_total: number;
  provisional_pagado_total: number;
  saldo_pendiente: number;
  adelanto_aplicado_usd: number;
  final_invoice_number: string | null;
  credit_debit_note_number: string | null;
  notes: string | null;
  paid_at: string | null;
};

export function SettlementRow({ lotId, settlement }: { lotId: string; settlement: Settlement }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <SettlementEditForm lotId={lotId} settlementId={settlement.id} initialValues={settlement} onDone={() => setEditing(false)} />
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
      <div className="space-y-1 text-slate-400">
        <Row label="Precio definitivo /TMH" value={fmtUSD(settlement.precio_definitivo_per_tmh)} strong />
        <Row label="Total definitivo" value={fmtUSD(settlement.precio_definitivo_total, 0)} />
        <Row label="Ya pagado (provisional)" value={fmtUSD(settlement.provisional_pagado_total, 0)} />
        <div className="border-t border-dashed border-slate-200 pt-1">
          <Row
            label={settlement.saldo_pendiente >= 0 ? "Saldo a favor del proveedor" : "Saldo a favor de Ginebra"}
            value={fmtUSD(Math.abs(settlement.saldo_pendiente), 0)}
            strong
          />
        </div>
        {settlement.adelanto_aplicado_usd > 0 && (
          <div className="border-t border-dashed border-slate-200 pt-1">
            <Row label="Adelanto aplicado" value={`− ${fmtUSD(settlement.adelanto_aplicado_usd, 0)}`} />
            <Row
              label="Neto a pagar al proveedor"
              value={fmtUSD(Math.abs(settlement.saldo_pendiente - settlement.adelanto_aplicado_usd), 0)}
              strong
            />
          </div>
        )}
        {(settlement.final_invoice_number || settlement.credit_debit_note_number) && (
          <div className="text-xs text-slate-500">
            {settlement.final_invoice_number && `Factura final: ${settlement.final_invoice_number} · `}
            {settlement.credit_debit_note_number && `N/C-D: ${settlement.credit_debit_note_number}`}
          </div>
        )}
        {settlement.notes && <div className="text-xs text-slate-500">Notas: {settlement.notes}</div>}
      </div>
      <div className="flex items-center gap-3">
        {!settlement.paid_at && (
          <button onClick={() => setEditing(true)} className="text-xs text-gold-700 hover:underline">
            Editar
          </button>
        )}
        <DeleteRowButton
          action={deleteSettlement.bind(null, lotId, settlement.id)}
          confirmText="¿Eliminar esta liquidación definitiva?"
        />
      </div>
    </div>
  );
}
