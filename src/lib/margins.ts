import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type BagRow = {
  id: string;
  weight_kg: number | null;
  purchase_lot_id: string | null;
  sale_lot_id: string | null;
  purchase_lots: { id: string; code: string } | { id: string; code: string }[] | null;
  sale_lots:
    | { id: string; code: string; sample_batch_id: string | null }
    | { id: string; code: string; sample_batch_id: string | null }[]
    | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type MarginAgg = { code: string; totalKg: number; pendingKg: number; margin: number; hasComplete: boolean };

export type MarginsResult = {
  byPurchaseLot: [string, MarginAgg][];
  bySaleLot: [string, MarginAgg][];
  totalMargin: number;
};

/**
 * Cruza el costo definitivo de cada lote de compra (lot_settlements) contra
 * el ingreso final de cada muestreo de PY (py_sample_batches), prorrateado
 * por peso a través de los big bags. Solo suma margen en lotes donde ambos
 * lados tienen liquidación definitiva; el resto queda como peso pendiente.
 */
export async function computeMargins(supabase: SupabaseClient): Promise<MarginsResult> {
  const { data: bagsRaw } = await supabase
    .from("big_bags")
    .select(
      "id, weight_kg, purchase_lot_id, purchase_lots(id, code), sale_lot_id, sale_lots(id, code, sample_batch_id)",
    );
  const bags = (bagsRaw ?? []) as BagRow[];

  const batchWeights = new Map<string, number>();
  for (const b of bags) {
    const saleLot = one(b.sale_lots);
    const batchId = saleLot?.sample_batch_id;
    if (batchId) batchWeights.set(batchId, (batchWeights.get(batchId) ?? 0) + (b.weight_kg ?? 0));
  }

  const batchIds = [...batchWeights.keys()];
  const { data: batches } =
    batchIds.length > 0
      ? await supabase.from("py_sample_batches").select("id, code, final_value_total").in("id", batchIds)
      : { data: [] as { id: string; code: string; final_value_total: number | null }[] };
  const batchById = new Map((batches ?? []).map((b) => [b.id, b]));

  const purchaseLotIds = [...new Set(bags.map((b) => b.purchase_lot_id).filter((v): v is string => !!v))];
  const { data: settlements } =
    purchaseLotIds.length > 0
      ? await supabase
          .from("lot_settlements")
          .select("purchase_lot_id, precio_definitivo_total, tmh_used, created_at")
          .in("purchase_lot_id", purchaseLotIds)
          .order("created_at", { ascending: false })
      : {
          data: [] as {
            purchase_lot_id: string;
            precio_definitivo_total: number | null;
            tmh_used: number | null;
            created_at: string;
          }[],
        };

  const settlementByLot = new Map<string, { total: number; tmh: number }>();
  for (const s of settlements ?? []) {
    if (!settlementByLot.has(s.purchase_lot_id) && s.precio_definitivo_total != null && s.tmh_used) {
      settlementByLot.set(s.purchase_lot_id, { total: s.precio_definitivo_total, tmh: s.tmh_used });
    }
  }

  const byPurchaseLot = new Map<string, MarginAgg>();
  const bySaleLot = new Map<string, MarginAgg>();

  for (const b of bags) {
    const weightKg = b.weight_kg ?? 0;
    const purchaseLot = one(b.purchase_lots);
    const saleLot = one(b.sale_lots);
    if (!purchaseLot) continue;

    const settlement = settlementByLot.get(purchaseLot.id);
    const batch = saleLot?.sample_batch_id ? batchById.get(saleLot.sample_batch_id) : null;
    const batchTotalWeight = saleLot?.sample_batch_id ? batchWeights.get(saleLot.sample_batch_id) : null;

    const costPerKg = settlement ? settlement.total / (settlement.tmh * 1000) : null;
    const revenuePerKg =
      batch?.final_value_total != null && batchTotalWeight ? batch.final_value_total / batchTotalWeight : null;
    const complete = costPerKg != null && revenuePerKg != null;
    const marginTotal = complete ? weightKg * (revenuePerKg! - costPerKg!) : 0;

    const pl = byPurchaseLot.get(purchaseLot.id) ?? {
      code: purchaseLot.code,
      totalKg: 0,
      pendingKg: 0,
      margin: 0,
      hasComplete: false,
    };
    pl.totalKg += weightKg;
    if (complete) {
      pl.margin += marginTotal;
      pl.hasComplete = true;
    } else {
      pl.pendingKg += weightKg;
    }
    byPurchaseLot.set(purchaseLot.id, pl);

    if (saleLot) {
      const sl = bySaleLot.get(saleLot.id) ?? {
        code: saleLot.code,
        totalKg: 0,
        pendingKg: 0,
        margin: 0,
        hasComplete: false,
      };
      sl.totalKg += weightKg;
      if (complete) {
        sl.margin += marginTotal;
        sl.hasComplete = true;
      } else {
        sl.pendingKg += weightKg;
      }
      bySaleLot.set(saleLot.id, sl);
    }
  }

  const byPurchaseLotSorted = [...byPurchaseLot.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
  const bySaleLotSorted = [...bySaleLot.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
  const totalMargin = byPurchaseLotSorted.reduce((sum, [, v]) => sum + v.margin, 0);

  return { byPurchaseLot: byPurchaseLotSorted, bySaleLot: bySaleLotSorted, totalMargin };
}
