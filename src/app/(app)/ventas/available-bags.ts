import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AvailableLot = { purchaseLotId: string; code: string; providerName: string | null; available: number };

/**
 * Lotes de compra con bolsones todavía sin asignar a ningún lote de venta
 * (cantidad generada en la conminución menos lo ya repartido en
 * sale_lot_allocations).
 */
export async function getAvailablePurchaseLots(supabase: SupabaseClient): Promise<AvailableLot[]> {
  const [{ data: comminutions }, { data: allocations }, { data: lots }] = await Promise.all([
    supabase.from("comminutions").select("purchase_lot_id, bag_count").not("bag_count", "is", null),
    supabase.from("sale_lot_allocations").select("purchase_lot_id, bag_count"),
    supabase.from("purchase_lots").select("id, code, providers(name)"),
  ]);

  const totalByLot = new Map<string, number>();
  for (const c of comminutions ?? []) {
    totalByLot.set(c.purchase_lot_id, (totalByLot.get(c.purchase_lot_id) ?? 0) + (c.bag_count ?? 0));
  }
  const allocatedByLot = new Map<string, number>();
  for (const a of allocations ?? []) {
    allocatedByLot.set(a.purchase_lot_id, (allocatedByLot.get(a.purchase_lot_id) ?? 0) + a.bag_count);
  }
  const lotById = new Map((lots ?? []).map((l) => [l.id, l]));

  const rows: AvailableLot[] = [];
  for (const [lotId, total] of totalByLot) {
    const available = total - (allocatedByLot.get(lotId) ?? 0);
    if (available <= 0) continue;
    const lot = lotById.get(lotId);
    if (!lot) continue;
    const provider = Array.isArray(lot.providers) ? lot.providers[0] : lot.providers;
    rows.push({ purchaseLotId: lotId, code: lot.code, providerName: provider?.name ?? null, available });
  }
  return rows.sort((a, b) => a.code.localeCompare(b.code));
}
