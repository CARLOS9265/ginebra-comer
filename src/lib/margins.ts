import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type AllocationRow = {
  id: string;
  bag_count: number;
  purchase_lot_id: string;
  sale_lot_id: string;
  purchase_lots: { id: string; code: string } | { id: string; code: string }[] | null;
  sale_lots:
    | { id: string; code: string; sample_batch_id: string | null }
    | { id: string; code: string; sample_batch_id: string | null }[]
    | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type MarginAgg = { code: string; totalBags: number; pendingBags: number; margin: number; hasComplete: boolean };

export type MarginsResult = {
  byPurchaseLot: [string, MarginAgg][];
  bySaleLot: [string, MarginAgg][];
  totalMargin: number;
};

/**
 * Cruza el costo definitivo de cada lote de compra (lot_settlements) contra
 * el ingreso final de cada muestreo de PY (py_sample_batches), prorrateado
 * por CANTIDAD DE BOLSONES a través de sale_lot_allocations — el peso real
 * de cada bolsón nunca se conoce con exactitud, así que la unidad de
 * prorrateo es la cantidad, no el peso. Solo suma margen en asignaciones
 * donde ambos lados tienen liquidación definitiva; el resto queda como
 * bolsones pendientes.
 */
export async function computeMargins(supabase: SupabaseClient): Promise<MarginsResult> {
  const { data: allocationsRaw } = await supabase
    .from("sale_lot_allocations")
    .select(
      "id, bag_count, purchase_lot_id, purchase_lots(id, code), sale_lot_id, sale_lots(id, code, sample_batch_id)",
    );
  const allocations = (allocationsRaw ?? []) as AllocationRow[];

  const batchBagCounts = new Map<string, number>();
  for (const a of allocations) {
    const saleLot = one(a.sale_lots);
    const batchId = saleLot?.sample_batch_id;
    if (batchId) batchBagCounts.set(batchId, (batchBagCounts.get(batchId) ?? 0) + a.bag_count);
  }

  const batchIds = [...batchBagCounts.keys()];
  const { data: batches } =
    batchIds.length > 0
      ? await supabase.from("py_sample_batches").select("id, code, final_value_total").in("id", batchIds)
      : { data: [] as { id: string; code: string; final_value_total: number | null }[] };
  const batchById = new Map((batches ?? []).map((b) => [b.id, b]));

  const purchaseLotIds = [...new Set(allocations.map((a) => a.purchase_lot_id).filter(Boolean))];
  const [{ data: settlements }, { data: comminutions }] = await Promise.all([
    purchaseLotIds.length > 0
      ? supabase
          .from("lot_settlements")
          .select("purchase_lot_id, precio_definitivo_total, created_at")
          .in("purchase_lot_id", purchaseLotIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as { purchase_lot_id: string; precio_definitivo_total: number | null; created_at: string }[],
        }),
    purchaseLotIds.length > 0
      ? supabase.from("comminutions").select("purchase_lot_id, bag_count").in("purchase_lot_id", purchaseLotIds)
      : Promise.resolve({ data: [] as { purchase_lot_id: string; bag_count: number | null }[] }),
  ]);

  const totalBagsByLot = new Map<string, number>();
  for (const c of comminutions ?? []) {
    if (c.bag_count != null) {
      totalBagsByLot.set(c.purchase_lot_id, (totalBagsByLot.get(c.purchase_lot_id) ?? 0) + c.bag_count);
    }
  }

  const settlementByLot = new Map<string, number>();
  for (const s of settlements ?? []) {
    if (!settlementByLot.has(s.purchase_lot_id) && s.precio_definitivo_total != null) {
      settlementByLot.set(s.purchase_lot_id, s.precio_definitivo_total);
    }
  }

  const byPurchaseLot = new Map<string, MarginAgg>();
  const bySaleLot = new Map<string, MarginAgg>();

  for (const a of allocations) {
    const purchaseLot = one(a.purchase_lots);
    const saleLot = one(a.sale_lots);
    if (!purchaseLot || !saleLot) continue;

    const settlementTotal = settlementByLot.get(purchaseLot.id);
    const lotTotalBags = totalBagsByLot.get(purchaseLot.id);
    const costPerBag = settlementTotal != null && lotTotalBags ? settlementTotal / lotTotalBags : null;

    const batch = saleLot.sample_batch_id ? batchById.get(saleLot.sample_batch_id) : null;
    const batchTotalBags = saleLot.sample_batch_id ? batchBagCounts.get(saleLot.sample_batch_id) : null;
    const revenuePerBag =
      batch?.final_value_total != null && batchTotalBags ? batch.final_value_total / batchTotalBags : null;

    const complete = costPerBag != null && revenuePerBag != null;
    const marginTotal = complete ? a.bag_count * (revenuePerBag! - costPerBag!) : 0;

    const pl = byPurchaseLot.get(purchaseLot.id) ?? {
      code: purchaseLot.code,
      totalBags: 0,
      pendingBags: 0,
      margin: 0,
      hasComplete: false,
    };
    pl.totalBags += a.bag_count;
    if (complete) {
      pl.margin += marginTotal;
      pl.hasComplete = true;
    } else {
      pl.pendingBags += a.bag_count;
    }
    byPurchaseLot.set(purchaseLot.id, pl);

    const sl = bySaleLot.get(saleLot.id) ?? {
      code: saleLot.code,
      totalBags: 0,
      pendingBags: 0,
      margin: 0,
      hasComplete: false,
    };
    sl.totalBags += a.bag_count;
    if (complete) {
      sl.margin += marginTotal;
      sl.hasComplete = true;
    } else {
      sl.pendingBags += a.bag_count;
    }
    bySaleLot.set(saleLot.id, sl);
  }

  const byPurchaseLotSorted = [...byPurchaseLot.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
  const bySaleLotSorted = [...bySaleLot.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
  const totalMargin = byPurchaseLotSorted.reduce((sum, [, v]) => sum + v.margin, 0);

  return { byPurchaseLot: byPurchaseLotSorted, bySaleLot: bySaleLotSorted, totalMargin };
}
