import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLiveGoldSilver } from "@/lib/live-metal-prices";
import { LotForm, type LotInitialValues, type ReferencePrices } from "../../LotForm";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function s(v: number | string | null): string {
  return v == null ? "" : String(v);
}

export default async function EditLotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: lot }, { data: providers }, { data: latestPrice }, live] = await Promise.all([
    supabase.from("purchase_lots").select("*").eq("id", id).maybeSingle(),
    supabase.from("providers").select("id, code, name, concession").order("name"),
    supabase
      .from("daily_metal_prices")
      .select("*")
      .order("price_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getLiveGoldSilver(),
  ]);

  if (!lot) notFound();

  const initialValues: LotInitialValues = {
    code: lot.code,
    provider_id: lot.provider_id,
    concession: s(lot.concession),
    loaded_at_local: toLocalInput(lot.loaded_at),
    truck_plate: s(lot.truck_plate),
    carrier_name: s(lot.carrier_name),
    estimated_weight_tmh: s(lot.estimated_weight_tmh),
    initial_guide_number: s(lot.initial_guide_number),
    initial_invoice_number: s(lot.initial_invoice_number),
    estimated_au: s(lot.estimated_au),
    estimated_ag: s(lot.estimated_ag),
    provisional_price_per_tmh: s(lot.provisional_price_per_tmh),
    price_fixing_date: s(lot.price_fixing_date),
    estimated_price_au: s(lot.estimated_price_au),
    estimated_price_ag: s(lot.estimated_price_ag),
  };

  const refPrices: ReferencePrices = {
    gold: live.gold ?? latestPrice?.gold_usd_oz ?? null,
    silver: live.silver ?? latestPrice?.silver_usd_oz ?? null,
    lead: latestPrice?.lead_usd_ton ?? null,
    referencePct: latestPrice?.reference_pct ?? 40,
    isLive: live.gold != null && live.silver != null,
  };

  return (
    <div>
      <Link href="/lotes" className="text-sm text-slate-500 hover:text-slate-900">
        ← Lotes de compra
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">
        Editar lote <span className="font-mono">{lot.code}</span>
      </h1>

      <div className="mt-6">
        <LotForm
          providers={providers ?? []}
          mode="edit"
          lotId={lot.id}
          initialValues={initialValues}
          refPrices={refPrices}
        />
      </div>
    </div>
  );
}
