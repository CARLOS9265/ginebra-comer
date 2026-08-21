import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLiveGoldSilver } from "@/lib/live-metal-prices";
import { LotForm, type ReferencePrices } from "../LotForm";

export default async function NewLotPage() {
  const supabase = await createClient();

  const [{ data: providers }, { data: latestPrice }, live] = await Promise.all([
    supabase.from("providers").select("id, code, name, concession").order("name"),
    supabase
      .from("daily_metal_prices")
      .select("*")
      .order("price_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getLiveGoldSilver(),
  ]);

  if (!providers || providers.length === 0) {
    return (
      <div className="max-w-lg rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
        Todavía no hay proveedores registrados.{" "}
        <Link href="/proveedores/nuevo" className="text-teal-400 hover:underline">
          Creá el primero
        </Link>{" "}
        antes de registrar un lote.
      </div>
    );
  }

  const refPrices: ReferencePrices = {
    gold: live.gold ?? latestPrice?.gold_usd_oz ?? null,
    silver: live.silver ?? latestPrice?.silver_usd_oz ?? null,
    lead: latestPrice?.lead_usd_ton ?? null,
    referencePct: latestPrice?.reference_pct ?? 40,
    isLive: live.gold != null && live.silver != null,
  };

  return (
    <div>
      <Link href="/lotes" className="text-sm text-slate-500 hover:text-slate-300">
        ← Lotes de compra
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-50">Nuevo lote de compra</h1>
      <p className="mt-1 text-sm text-slate-400">
        Se registra en el momento en que el mineral se carga en la mina. A partir de acá el
        mineral es propiedad de Ginebra.
      </p>

      <div className="mt-6">
        <LotForm providers={providers} mode="create" refPrices={refPrices} />
      </div>
    </div>
  );
}
