import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type FiveDayAverage = {
  gold: number | null;
  silver: number | null;
  lead: number | null;
  daysUsed: number;
};

/** Promedio de los últimos 5 días de mercado guardados en daily_metal_prices, hasta refDate (cláusula 5.1). */
export async function fiveDayAveragePrices(
  supabase: SupabaseClient,
  refDate: string,
): Promise<FiveDayAverage | null> {
  const { data } = await supabase
    .from("daily_metal_prices")
    .select("gold_usd_oz, silver_usd_oz, lead_usd_ton")
    .lte("price_date", refDate)
    .order("price_date", { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return null;

  const avg = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v != null);
    if (present.length === 0) return null;
    return present.reduce((s, v) => s + v, 0) / present.length;
  };

  return {
    gold: avg(data.map((d) => d.gold_usd_oz)),
    silver: avg(data.map((d) => d.silver_usd_oz)),
    lead: avg(data.map((d) => d.lead_usd_ton)),
    daysUsed: data.length,
  };
}
