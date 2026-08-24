import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BIG_BAG_STATUS_LABELS } from "@/lib/sale-lot-status";

const STATUS_COLORS: Record<string, string> = {
  disponible: "bg-slate-100 text-slate-400",
  reservado: "bg-sky-100 text-sky-700",
  despachado: "bg-amber-100 text-amber-700",
  recibido_py: "bg-gold-100 text-gold-700",
  liquidado: "bg-purple-100 text-purple-700",
};

const fmtKg = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("es-PE")} kg`);

const TABS = ["disponible", "reservado", "despachado", "recibido_py", "liquidado", "todos"] as const;

export default async function BigBagsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("big_bags")
    .select(
      "id, code, weight_kg, storage_location, status, purchase_lots(id, code), sale_lots(id, code)",
    )
    .order("code");

  if (estado && estado !== "todos") {
    query = query.eq("status", estado);
  } else if (!estado) {
    query = query.eq("status", "disponible");
  }

  const { data: bags } = await query;

  const totalKg = bags?.reduce((sum, b) => sum + (b.weight_kg ?? 0), 0) ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Big bags</h1>
          <p className="mt-1 text-sm text-slate-500">
            Inventario de bolsones generados en conminución, listos para armar un lote de venta.
          </p>
        </div>
        <Link
          href="/ventas/nuevo"
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700"
        >
          + Armar lote de venta
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "disponible" ? "/big-bags" : `/big-bags?estado=${t}`}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              (estado ?? "disponible") === t
                ? "bg-navy-800 text-white"
                : "bg-white text-slate-500 hover:bg-slate-100"
            }`}
          >
            {t === "todos" ? "Todos" : BIG_BAG_STATUS_LABELS[t]}
          </Link>
        ))}
      </div>

      {!bags || bags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No hay big bags en este estado.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Lote de compra</th>
                  <th className="px-4 py-3">Lote de venta</th>
                  <th className="px-4 py-3 text-right">Peso</th>
                  <th className="px-4 py-3">Ubicación</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {bags.map((b) => {
                  const purchaseLot = Array.isArray(b.purchase_lots) ? b.purchase_lots[0] : b.purchase_lots;
                  const saleLot = Array.isArray(b.sale_lots) ? b.sale_lots[0] : b.sale_lots;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-700">{b.code}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {purchaseLot ? (
                          <Link href={`/lotes/${purchaseLot.id}`} className="hover:text-gold-800 hover:underline">
                            {purchaseLot.code}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {saleLot ? (
                          <Link href={`/ventas/${saleLot.id}`} className="hover:text-gold-800 hover:underline">
                            {saleLot.code}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">{fmtKg(b.weight_kg)}</td>
                      <td className="px-4 py-3 text-slate-500">{b.storage_location ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            STATUS_COLORS[b.status] ?? "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {BIG_BAG_STATUS_LABELS[b.status] ?? b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {bags.length} big bag{bags.length === 1 ? "" : "s"} · Total {fmtKg(totalKg)}
          </p>
        </>
      )}
    </div>
  );
}
