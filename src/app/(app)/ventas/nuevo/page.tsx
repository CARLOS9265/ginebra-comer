import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAvailablePurchaseLots } from "../available-bags";
import { NewSaleLotForm } from "../NewSaleLotForm";

export default async function NewSaleLotPage() {
  const supabase = await createClient();
  const lots = await getAvailablePurchaseLots(supabase);

  return (
    <div>
      <Link href="/ventas" className="text-sm text-slate-500 hover:text-slate-900">
        ← Lotes de venta
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Armar lote de venta</h1>
      <p className="mt-1 text-sm text-slate-500">
        Elegí cuántos bolsones va a llevar este despacho, de cada lote de compra. Podés mezclar
        varios lotes de compra en un mismo despacho.
      </p>

      <div className="mt-6">
        {lots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            No hay lotes de compra con bolsones disponibles todavía.
          </div>
        ) : (
          <NewSaleLotForm lots={lots} />
        )}
      </div>
    </div>
  );
}
