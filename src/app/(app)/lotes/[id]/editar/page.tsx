import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LotForm, type LotInitialValues } from "../../LotForm";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function s(v: number | string | null): string {
  return v == null ? "" : String(v);
}

export default async function EditLotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: lot }, { data: providers }] = await Promise.all([
    supabase.from("purchase_lots").select("*").eq("id", id).maybeSingle(),
    supabase.from("providers").select("id, code, name").order("name"),
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
    reference_price_usd: s(lot.reference_price_usd),
    initial_guide_number: s(lot.initial_guide_number),
    initial_invoice_number: s(lot.initial_invoice_number),
    provisional_price_per_tmh: s(lot.provisional_price_per_tmh),
    advance_pct: s(lot.advance_pct),
  };

  return (
    <div>
      <Link href="/lotes" className="text-sm text-slate-500 hover:text-slate-300">
        ← Lotes de compra
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-50">
        Editar lote <span className="font-mono">{lot.code}</span>
      </h1>

      <div className="mt-6">
        <LotForm providers={providers ?? []} mode="edit" lotId={lot.id} initialValues={initialValues} />
      </div>
    </div>
  );
}
