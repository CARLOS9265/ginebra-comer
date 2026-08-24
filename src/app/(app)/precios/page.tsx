import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/calendar";
import { getLiveGoldSilver } from "@/lib/live-metal-prices";
import { PriceForm } from "./PriceForm";

const fmtUSD = (n: number | null, decimals = 2) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals });

export default async function PricesPage() {
  const today = todayISO();
  const supabase = await createClient();

  const [{ data: todayRow }, { data: recent }, live] = await Promise.all([
    supabase.from("daily_metal_prices").select("*").eq("price_date", today).maybeSingle(),
    supabase
      .from("daily_metal_prices")
      .select("*")
      .order("price_date", { ascending: false })
      .limit(14),
    getLiveGoldSilver(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Precios internacionales</h1>
      <p className="mt-1 text-sm text-slate-500">
        Oro y plata se leen en vivo. El plomo se carga a mano porque no hay fuente en vivo
        conectada. Se usan como referencia rápida al momento de cargar un volquete — no
        reemplazan la valorización final, que se hace con la ley real de laboratorio.
      </p>

      <div className="mt-6">
        <PriceForm today={today} live={live} todayValues={todayRow ?? undefined} />
      </div>

      {recent && recent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Últimos días</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Oro USD/oz</th>
                  <th className="px-4 py-3 text-right">Plata USD/oz</th>
                  <th className="px-4 py-3 text-right">Plomo USD/TM</th>
                  <th className="px-4 py-3 text-right">% ref.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recent.map((p) => (
                  <tr key={p.price_date} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(p.price_date + "T00:00:00").toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{fmtUSD(p.gold_usd_oz)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{fmtUSD(p.silver_usd_oz)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">{fmtUSD(p.lead_usd_ton)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{p.reference_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
