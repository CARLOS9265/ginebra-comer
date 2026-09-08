import { createClient } from "@/lib/supabase/server";
import { AdvanceForm } from "./AdvanceForm";
import { AdvanceRowActions } from "./AdvanceRowActions";

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("es-PE");

export default async function AdvancesPage() {
  const supabase = await createClient();

  const [{ data: providers }, { data: advances }] = await Promise.all([
    supabase.from("providers").select("id, code, name").order("name"),
    supabase
      .from("provider_advances")
      .select("id, provider_id, amount_usd, given_at, note, applied_lot_settlement_id, providers(name, code)")
      .order("given_at", { ascending: false }),
  ]);

  const settlementIds = [...new Set((advances ?? []).map((a) => a.applied_lot_settlement_id).filter(Boolean))] as string[];

  const { data: settlements } =
    settlementIds.length > 0
      ? await supabase.from("lot_settlements").select("id, purchase_lot_id").in("id", settlementIds)
      : { data: [] as { id: string; purchase_lot_id: string }[] };

  const lotIds = [...new Set((settlements ?? []).map((s) => s.purchase_lot_id))];
  const { data: lots } =
    lotIds.length > 0
      ? await supabase.from("purchase_lots").select("id, code").in("id", lotIds)
      : { data: [] as { id: string; code: string }[] };

  const lotCodeBySettlement = new Map<string, string>();
  for (const s of settlements ?? []) {
    const lot = (lots ?? []).find((l) => l.id === s.purchase_lot_id);
    if (lot) lotCodeBySettlement.set(s.id, lot.code);
  }

  const saldoByProvider = new Map<string, number>();
  for (const a of advances ?? []) {
    saldoByProvider.set(a.provider_id, (saldoByProvider.get(a.provider_id) ?? 0) + a.amount_usd);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Adelantos a proveedores</h1>
        <p className="mt-1 text-sm text-slate-500">
          Plata entregada por adelantado para asegurar la entrega de un próximo lote — independiente de un
          lote puntual. Se descuenta (total o parcial) cuando se registra la liquidación definitiva de un
          lote de ese proveedor.
        </p>
      </div>

      <div className="mb-8">
        <AdvanceForm providers={providers ?? []} />
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Saldo pendiente por proveedor</h2>
        {!providers || providers.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay proveedores registrados.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Saldo pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {providers.map((p) => {
                  const saldo = saldoByProvider.get(p.id) ?? 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">
                        {p.name} <span className="font-mono text-xs text-slate-400">({p.code})</span>
                      </td>
                      <td className="px-4 py-3">
                        {saldo > 0 ? (
                          <span className="font-mono font-semibold text-gold-700">{fmtUSD(saldo)}</span>
                        ) : (
                          <span className="font-mono text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Historial de movimientos</h2>
        {!advances || advances.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Todavía no se registró ningún adelanto.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Nota</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {advances.map((a) => {
                  const provider = Array.isArray(a.providers) ? a.providers[0] : a.providers;
                  const lotCode = a.applied_lot_settlement_id
                    ? lotCodeBySettlement.get(a.applied_lot_settlement_id)
                    : null;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{fmtDate(a.given_at)}</td>
                      <td className="px-4 py-3 text-slate-700">{provider?.name ?? "—"}</td>
                      <td
                        className={`px-4 py-3 font-mono ${a.amount_usd < 0 ? "text-slate-400" : "text-slate-700"}`}
                      >
                        {a.amount_usd < 0 ? "− " : ""}
                        {fmtUSD(Math.abs(a.amount_usd))}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {a.applied_lot_settlement_id ? (
                          <span className="text-slate-400">Aplicado{lotCode ? ` — lote ${lotCode}` : ""}</span>
                        ) : (
                          <span className="text-gold-700">Pendiente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{a.note ?? "—"}</td>
                      <td className="px-4 py-3">
                        {!a.applied_lot_settlement_id && <AdvanceRowActions id={a.id} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
