// 1 tonelada métrica = 1,000,000 g. 1 onza troy = 31.1034768 g.
export const OZ_PER_METRIC_TON = 1_000_000 / 31.1034768;

/** Precio internacional (USD/oz) llevado a USD por tonelada métrica de metal puro. */
export function pricePerTon(pricePerOz: number): number {
  return pricePerOz * OZ_PER_METRIC_TON;
}

export type DailyMetalPrice = {
  price_date: string;
  gold_usd_oz: number;
  silver_usd_oz: number;
  lead_usd_ton: number | null;
  reference_pct: number;
};
