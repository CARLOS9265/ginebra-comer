import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewSaleLotForm } from "../NewSaleLotForm";

export default async function NewSaleLotPage() {
  const supabase = await createClient();
  const { data: bags } = await supabase
    .from("big_bags")
    .select("id, code, weight_kg, purchase_lots(code)")
    .eq("status", "disponible")
    .is("sale_lot_id", null)
    .order("code");

  const rows = (bags ?? []).map((b) => {
    const purchaseLot = Array.isArray(b.purchase_lots) ? b.purchase_lots[0] : b.purchase_lots;
    return {
      id: b.id,
      code: b.code,
      weightKg: b.weight_kg,
      purchaseLotCode: purchaseLot?.code ?? "—",
    };
  });

  return (
    <div>
      <Link href="/big-bags" className="text-sm text-slate-500 hover:text-slate-300">
        ← Big bags
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-50">Armar lote de venta</h1>
      <p className="mt-1 text-sm text-slate-400">
        Elegí los big bags que van en este despacho a PY. Pueden ser de distintos lotes de compra.
      </p>

      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
            No hay big bags disponibles para armar un lote de venta.
          </div>
        ) : (
          <NewSaleLotForm bags={rows} />
        )}
      </div>
    </div>
  );
}
