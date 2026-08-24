import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SALE_LOT_STATUS_LABELS } from "@/lib/sale-lot-status";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { removeBigBagFromSaleLot, deleteSaleLot } from "../actions";
import { AddBigBagsSection } from "./AddBigBagsSection";

const fmtKg = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("es-PE")} kg`);

export default async function SaleLotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: saleLot } = await supabase
    .from("sale_lots")
    .select("id, code, status, notes, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!saleLot) notFound();

  const [{ data: bags }, { data: availableBags }] = await Promise.all([
    supabase
      .from("big_bags")
      .select("id, code, weight_kg, purchase_lots(id, code)")
      .eq("sale_lot_id", id)
      .order("code"),
    saleLot.status === "armado"
      ? supabase
          .from("big_bags")
          .select("id, code, weight_kg, purchase_lots(code)")
          .eq("status", "disponible")
          .is("sale_lot_id", null)
          .order("code")
      : Promise.resolve({ data: [] }),
  ]);

  const totalKg = bags?.reduce((sum, b) => sum + (b.weight_kg ?? 0), 0) ?? 0;

  const availableRows = (availableBags ?? []).map((b) => {
    const purchaseLot = Array.isArray(b.purchase_lots) ? b.purchase_lots[0] : b.purchase_lots;
    return { id: b.id, code: b.code, weightKg: b.weight_kg, purchaseLotCode: purchaseLot?.code ?? "—" };
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/ventas" className="text-xs text-slate-500 hover:text-slate-300">
          ← Lotes de venta
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-50">{saleLot.code}</h1>
            <p className="mt-1 text-sm text-slate-400">
              Armado el {new Date(saleLot.created_at).toLocaleDateString("es-PE")} · {bags?.length ?? 0} big bags ·{" "}
              {fmtKg(totalKg)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
              {SALE_LOT_STATUS_LABELS[saleLot.status as keyof typeof SALE_LOT_STATUS_LABELS] ?? saleLot.status}
            </span>
            {saleLot.status === "armado" && (
              <DeleteRowButton
                action={deleteSaleLot.bind(null, saleLot.id)}
                confirmText="¿Eliminar este lote de venta? Los big bags vuelven a quedar disponibles."
              />
            )}
          </div>
        </div>
        {saleLot.notes && <p className="mt-2 text-sm text-slate-500">Notas: {saleLot.notes}</p>}
      </div>

      <div>
        <h2 className="mb-3 border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Big bags en este lote
        </h2>
        {!bags || bags.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay big bags asignados.</p>
        ) : (
          <div className="space-y-2">
            {bags.map((b) => {
              const purchaseLot = Array.isArray(b.purchase_lots) ? b.purchase_lots[0] : b.purchase_lots;
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 p-2.5 text-sm"
                >
                  <div className="text-slate-300">
                    <span className="font-mono">{b.code}</span> · {fmtKg(b.weight_kg)}
                    {purchaseLot && (
                      <>
                        {" · "}
                        <Link href={`/lotes/${purchaseLot.id}`} className="text-teal-400 hover:underline">
                          {purchaseLot.code}
                        </Link>
                      </>
                    )}
                  </div>
                  {saleLot.status === "armado" && (
                    <DeleteRowButton
                      action={removeBigBagFromSaleLot.bind(null, saleLot.id, b.id)}
                      confirmText={`¿Quitar el big bag ${b.code} de este lote de venta?`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {saleLot.status === "armado" && (
        <AddBigBagsSection saleLotId={saleLot.id} bags={availableRows} />
      )}
    </div>
  );
}
