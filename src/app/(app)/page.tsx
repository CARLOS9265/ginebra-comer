import Link from "next/link";
import { getCurrentUser, ROLE_LABELS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/calendar";
import { fiveDayAveragePrices } from "@/lib/metal-prices";
import { PriceChart } from "./precios/PriceChart";

const fmtUSD = (n: number | null, decimals = 2) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals });

export default async function DashboardPage() {
  const { profile } = await getCurrentUser();
  if (!profile) return null;

  const today = todayISO();
  const supabase = await createClient();

  const [{ data: recent }, average] = await Promise.all([
    supabase
      .from("daily_metal_prices")
      .select("price_date, gold_usd_oz, silver_usd_oz")
      .order("price_date", { ascending: false })
      .limit(14),
    fiveDayAveragePrices(supabase, today),
  ]);

  const chronological = [...(recent ?? [])].reverse();
  const goldPoints = chronological
    .filter((p) => p.gold_usd_oz != null)
    .map((p) => ({ date: p.price_date, value: p.gold_usd_oz as number }));
  const silverPoints = chronological
    .filter((p) => p.silver_usd_oz != null)
    .map((p) => ({ date: p.price_date, value: p.silver_usd_oz as number }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Hola, {profile.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Rol: {ROLE_LABELS[profile.role]}. Esta es la base del sistema — el registro de lotes de
          compra se agrega en el próximo paso.
        </p>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Precios internacionales</h2>
          <Link href="/precios" className="text-xs text-gold-700 hover:underline">
            Ver más →
          </Link>
        </div>

        {average && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Promedio de los últimos {average.daysUsed} días</p>
            <div className="mt-2 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-slate-500">Oro</div>
                <div className="font-mono text-lg font-semibold text-gold-700">{fmtUSD(average.gold)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Plata</div>
                <div className="font-mono text-lg font-semibold text-navy-700">{fmtUSD(average.silver)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Plomo</div>
                <div className="font-mono text-lg font-semibold text-slate-700">{fmtUSD(average.lead, 0)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <PriceChart title="Oro (USD/oz)" unit="USD/oz" color="#a3730f" points={goldPoints} />
          <PriceChart title="Plata (USD/oz)" unit="USD/oz" color="#234066" points={silverPoints} />
        </div>
      </div>
    </div>
  );
}
