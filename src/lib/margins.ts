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

export type MarginAgg = {
  code: string;
  totalBags: number;
  pendingBags: number;
  costoCompra: number;
  gastosOperativos: number;
  precioVenta: number;
  margin: number;
  hasComplete: boolean;
};

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
 *
 * "Gastos operativos" es la suma de lo REALMENTE gastado (no un estimado de
 * `contract_settings`): transporte a Trujillo + seguridad + molienda, del
 * lado del lote de compra, más el flete de Huanchaco a Lima, del lado del
 * lote de venta (un solo despacho puede llevar bolsones de varios lotes de
 * compra, así que el flete se prorratea entre ellos por bolsones igual que
 * todo lo demás). Todo se carga en soles y se convierte a USD con el tipo
 * de cambio de `contract_settings`.
 */
export async function computeMargins(supabase: SupabaseClient): Promise<MarginsResult> {
  const { data: allocationsRaw } = await supabase
    .from("sale_lot_allocations")
    .select(
      "id, bag_count, purchase_lot_id, purchase_lots(id, code), sale_lot_id, sale_lots(id, code, sample_batch_id)",
    );
  const allocations = (allocationsRaw ?? []) as AllocationRow[];

  const batchBagCounts = new Map<string, number>();
  const saleLotTotalBags = new Map<string, number>();
  for (const a of allocations) {
    const saleLot = one(a.sale_lots);
    const batchId = saleLot?.sample_batch_id;
    if (batchId) batchBagCounts.set(batchId, (batchBagCounts.get(batchId) ?? 0) + a.bag_count);
    saleLotTotalBags.set(a.sale_lot_id, (saleLotTotalBags.get(a.sale_lot_id) ?? 0) + a.bag_count);
  }

  const batchIds = [...batchBagCounts.keys()];
  const saleLotIds = [...new Set(allocations.map((a) => a.sale_lot_id).filter(Boolean))];
  const purchaseLotIds = [...new Set(allocations.map((a) => a.purchase_lot_id).filter(Boolean))];

  const [{ data: batches }, { data: saleLotsFreight }, { data: settings }, { data: settlements }, { data: comminutions }, { data: transportEvents }, { data: warehouseTransfers }] =
    await Promise.all([
      batchIds.length > 0
        ? supabase.from("py_sample_batches").select("id, code, final_value_total").in("id", batchIds)
        : Promise.resolve({ data: [] as { id: string; code: string; final_value_total: number | null }[] }),
      saleLotIds.length > 0
        ? supabase.from("sale_lots").select("id, freight_tariff_pen_per_tmh, py_official_weight_kg").in("id", saleLotIds)
        : Promise.resolve({
            data: [] as { id: string; freight_tariff_pen_per_tmh: number | null; py_official_weight_kg: number | null }[],
          }),
      supabase.from("contract_settings").select("tipo_cambio").eq("id", 1).maybeSingle(),
      purchaseLotIds.length > 0
        ? supabase
            .from("lot_settlements")
            .select("purchase_lot_id, precio_definitivo_total, tmh_used, created_at")
            .in("purchase_lot_id", purchaseLotIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({
            data: [] as {
              purchase_lot_id: string;
              precio_definitivo_total: number | null;
              tmh_used: number | null;
              created_at: string;
            }[],
          }),
      purchaseLotIds.length > 0
        ? supabase
            .from("comminutions")
            .select("purchase_lot_id, bag_count, processed_tons, tariff_pen_per_ton")
            .in("purchase_lot_id", purchaseLotIds)
        : Promise.resolve({
            data: [] as {
              purchase_lot_id: string;
              bag_count: number | null;
              processed_tons: number | null;
              tariff_pen_per_ton: number | null;
            }[],
          }),
      purchaseLotIds.length > 0
        ? supabase
            .from("transport_events")
            .select("purchase_lot_id, tariff_pen_per_tmh, security_cost_pen, created_at")
            .in("purchase_lot_id", purchaseLotIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({
            data: [] as {
              purchase_lot_id: string;
              tariff_pen_per_tmh: number | null;
              security_cost_pen: number | null;
              created_at: string;
            }[],
          }),
      purchaseLotIds.length > 0
        ? supabase.from("warehouse_transfers").select("purchase_lot_id, forklift_cost_pen").in("purchase_lot_id", purchaseLotIds)
        : Promise.resolve({ data: [] as { purchase_lot_id: string; forklift_cost_pen: number | null }[] }),
    ]);

  const tipoCambio = settings?.tipo_cambio ?? 3.7;
  const batchById = new Map((batches ?? []).map((b) => [b.id, b]));
  const saleLotFreightInfo = new Map((saleLotsFreight ?? []).map((s) => [s.id, s]));

  const totalBagsByLot = new Map<string, number>();
  const comminucionPenByLot = new Map<string, number>();
  for (const c of comminutions ?? []) {
    if (c.bag_count != null) {
      totalBagsByLot.set(c.purchase_lot_id, (totalBagsByLot.get(c.purchase_lot_id) ?? 0) + c.bag_count);
    }
    if (c.processed_tons != null && c.tariff_pen_per_ton != null) {
      comminucionPenByLot.set(
        c.purchase_lot_id,
        (comminucionPenByLot.get(c.purchase_lot_id) ?? 0) + c.processed_tons * c.tariff_pen_per_ton,
      );
    }
  }

  const settlementByLot = new Map<string, number>();
  const tmhUsedByLot = new Map<string, number>();
  for (const s of settlements ?? []) {
    if (!settlementByLot.has(s.purchase_lot_id)) {
      if (s.precio_definitivo_total != null) settlementByLot.set(s.purchase_lot_id, s.precio_definitivo_total);
      if (s.tmh_used != null) tmhUsedByLot.set(s.purchase_lot_id, s.tmh_used);
    }
  }

  const transportPenByLot = new Map<string, number>();
  const seenTransport = new Set<string>();
  for (const t of transportEvents ?? []) {
    if (seenTransport.has(t.purchase_lot_id)) continue;
    seenTransport.add(t.purchase_lot_id);
    const tmhUsed = tmhUsedByLot.get(t.purchase_lot_id) ?? 0;
    const tariffPen = t.tariff_pen_per_tmh != null ? t.tariff_pen_per_tmh * tmhUsed : 0;
    const securityPen = t.security_cost_pen ?? 0;
    transportPenByLot.set(t.purchase_lot_id, tariffPen + securityPen);
  }

  const montacargaPenByLot = new Map<string, number>();
  for (const w of warehouseTransfers ?? []) {
    if (w.forklift_cost_pen != null) {
      montacargaPenByLot.set(w.purchase_lot_id, (montacargaPenByLot.get(w.purchase_lot_id) ?? 0) + w.forklift_cost_pen);
    }
  }

  // Gastos operativos del lado de compra (transporte + seguridad + molienda) en USD.
  const operatingCostByLot = new Map<string, number>();
  for (const lotId of purchaseLotIds) {
    const penTotal =
      (transportPenByLot.get(lotId) ?? 0) + (comminucionPenByLot.get(lotId) ?? 0) + (montacargaPenByLot.get(lotId) ?? 0);
    operatingCostByLot.set(lotId, penTotal / tipoCambio);
  }

  // Flete a Lima del lado de venta (un despacho), en USD.
  const freightUsdBySaleLot = new Map<string, number>();
  for (const saleLotId of saleLotIds) {
    const info = saleLotFreightInfo.get(saleLotId);
    if (info?.freight_tariff_pen_per_tmh != null && info.py_official_weight_kg != null) {
      const freightPen = info.freight_tariff_pen_per_tmh * (info.py_official_weight_kg / 1000);
      freightUsdBySaleLot.set(saleLotId, freightPen / tipoCambio);
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

    const operatingCostTotal = operatingCostByLot.get(purchaseLot.id) ?? 0;
    const operatingCostPerBag = lotTotalBags ? operatingCostTotal / lotTotalBags : 0;

    const saleLotBags = saleLotTotalBags.get(saleLot.id);
    const freightTotal = freightUsdBySaleLot.get(saleLot.id) ?? 0;
    const freightPerBag = saleLotBags ? freightTotal / saleLotBags : 0;

    const batch = saleLot.sample_batch_id ? batchById.get(saleLot.sample_batch_id) : null;
    const batchTotalBags = saleLot.sample_batch_id ? batchBagCounts.get(saleLot.sample_batch_id) : null;
    const revenuePerBag =
      batch?.final_value_total != null && batchTotalBags ? batch.final_value_total / batchTotalBags : null;

    const complete = costPerBag != null && revenuePerBag != null;
    const costoCompraTotal = complete ? a.bag_count * costPerBag! : 0;
    const precioVentaTotal = complete ? a.bag_count * revenuePerBag! : 0;
    const gastosOperativosTotal = complete ? a.bag_count * (operatingCostPerBag + freightPerBag) : 0;
    const marginTotal = complete ? precioVentaTotal - costoCompraTotal - gastosOperativosTotal : 0;

    const pl = byPurchaseLot.get(purchaseLot.id) ?? {
      code: purchaseLot.code,
      totalBags: 0,
      pendingBags: 0,
      costoCompra: 0,
      gastosOperativos: 0,
      precioVenta: 0,
      margin: 0,
      hasComplete: false,
    };
    pl.totalBags += a.bag_count;
    if (complete) {
      pl.costoCompra += costoCompraTotal;
      pl.gastosOperativos += gastosOperativosTotal;
      pl.precioVenta += precioVentaTotal;
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
      costoCompra: 0,
      gastosOperativos: 0,
      precioVenta: 0,
      margin: 0,
      hasComplete: false,
    };
    sl.totalBags += a.bag_count;
    if (complete) {
      sl.costoCompra += costoCompraTotal;
      sl.gastosOperativos += gastosOperativosTotal;
      sl.precioVenta += precioVentaTotal;
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
