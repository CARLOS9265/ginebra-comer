import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LotRowActions } from "./LotRowActions";
import { LotPipelineBoard } from "./LotPipelineBoard";
import { LOT_STATUS_LABELS } from "@/lib/lot-status";

const fmtUSD = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const fmtPEN = (n: number | null) =>
  n == null ? "—" : `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<{ creado?: string; editado?: string }>;
}) {
  const { creado, editado } = await searchParams;
  const supabase = await createClient();
  const [{ data: lots }, { data: settings }] = await Promise.all([
    supabase
      .from("purchase_lots")
      .select(
        "id, code, loaded_at, estimated_weight_tmh, provisional_price_per_tmh, projected_margin_per_tmh, status, requires_approval, approved_at, providers(name, code)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("contract_settings").select("tipo_cambio").eq("id", 1).maybeSingle(),
  ]);
  const tipoCambio = settings?.tipo_cambio ?? null;

  return (
    <div>
      {creado && (
        <div className="mb-4 rounded-lg border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm text-gold-600">
          Lote <span className="font-mono">{creado}</span> registrado correctamente.
        </div>
      )}
      {editado && (
        <div className="mb-4 rounded-lg border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm text-gold-600">
          Lote <span className="font-mono">{editado}</span> actualizado correctamente.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lotes de compra</h1>
          <p className="mt-1 text-sm text-slate-500">Desde la carga en mina hasta el cierre de compra.</p>
        </div>
        <Link
          href="/lotes/nuevo"
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700"
        >
          + Nuevo lote
        </Link>
      </div>

      {lots && lots.length > 0 && <LotPipelineBoard lots={lots} />}

      {!lots || lots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          Todavía no hay lotes registrados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Carga</th>
                <th className="px-4 py-3 text-right">TMH</th>
                <th className="px-4 py-3 text-right">Precio prov. /TMH</th>
                <th className="px-4 py-3 text-right">Total S/</th>
                <th className="px-4 py-3 text-right">Margen proy. /TMH</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {lots.map((l) => {
                const provider = Array.isArray(l.providers) ? l.providers[0] : l.providers;
                const totalPen =
                  l.estimated_weight_tmh != null && l.provisional_price_per_tmh != null && tipoCambio != null
                    ? l.estimated_weight_tmh * l.provisional_price_per_tmh * tipoCambio
                    : null;
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-700">
                      <Link href={`/lotes/${l.id}`} className="hover:text-gold-800 hover:underline">
                        {l.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{provider?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(l.loaded_at).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {l.estimated_weight_tmh ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {fmtUSD(l.provisional_price_per_tmh)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{fmtPEN(totalPen)}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        (l.projected_margin_per_tmh ?? 0) >= 0 ? "text-gold-700" : "text-red-600"
                      }`}
                    >
                      {fmtUSD(l.projected_margin_per_tmh)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-400">
                        {LOT_STATUS_LABELS[l.status as keyof typeof LOT_STATUS_LABELS] ?? l.status}
                      </span>
                      {l.requires_approval && !l.approved_at && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">
                          Pendiente de aprobación
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LotRowActions id={l.id} canDelete={l.status === "creado"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
