import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SALE_LOT_STATUS_LABELS } from "@/lib/sale-lot-status";
import { getAvailablePurchaseLots } from "../available-bags";
import { DeleteRowButton } from "@/components/DeleteRowButton";
import { deleteSaleLot } from "../actions";
import { AllocationForm } from "./AllocationForm";
import { AllocationRow } from "./AllocationRow";
import { DispatchSection } from "./DispatchSection";
import { PyReceptionSection } from "./PyReceptionSection";

export default async function SaleLotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: saleLot } = await supabase
    .from("sale_lots")
    .select(
      "id, code, status, notes, created_at, dispatched_at, dispatch_carrier, dispatch_truck_plate, freight_tariff_pen_per_tmh, received_at_py, py_warehouse, py_received_by, py_official_weight_kg, sample_batch_id, py_sample_batches(code)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!saleLot) notFound();

  const [{ data: allocations }, availableLots] = await Promise.all([
    supabase
      .from("sale_lot_allocations")
      .select("id, bag_count, purchase_lots(id, code)")
      .eq("sale_lot_id", id)
      .order("created_at"),
    saleLot.status === "armado" ? getAvailablePurchaseLots(supabase) : Promise.resolve([]),
  ]);

  const totalBags = (allocations ?? []).reduce((sum, a) => sum + a.bag_count, 0);
  const sampleBatch = Array.isArray(saleLot.py_sample_batches)
    ? saleLot.py_sample_batches[0]
    : saleLot.py_sample_batches;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/ventas" className="text-xs text-slate-500 hover:text-slate-900">
          ← Lotes de venta
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{saleLot.code}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Armado el {new Date(saleLot.created_at).toLocaleDateString("es-PE")} · {totalBags}{" "}
              {totalBags === 1 ? "bolsón" : "bolsones"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-400">
              {SALE_LOT_STATUS_LABELS[saleLot.status as keyof typeof SALE_LOT_STATUS_LABELS] ?? saleLot.status}
            </span>
            {saleLot.status === "armado" && (
              <DeleteRowButton
                action={deleteSaleLot.bind(null, saleLot.id)}
                confirmText="¿Eliminar este lote de venta? Los bolsones vuelven a quedar disponibles."
              />
            )}
          </div>
        </div>
        {saleLot.notes && <p className="mt-2 text-sm text-slate-500">Notas: {saleLot.notes}</p>}
      </div>

      <div>
        <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Bolsones en este lote
        </h2>
        {!allocations || allocations.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay bolsones asignados.</p>
        ) : (
          <div className="space-y-2">
            {allocations.map((a) => {
              const purchaseLot = Array.isArray(a.purchase_lots) ? a.purchase_lots[0] : a.purchase_lots;
              return (
                <AllocationRow
                  key={a.id}
                  saleLotId={saleLot.id}
                  canEdit={saleLot.status === "armado"}
                  allocation={{
                    id: a.id,
                    bag_count: a.bag_count,
                    purchaseLotId: purchaseLot?.id ?? null,
                    purchaseLotCode: purchaseLot?.code ?? "—",
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {saleLot.status === "armado" && <AllocationForm saleLotId={saleLot.id} lots={availableLots} />}

      <div>
        <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Despacho
        </h2>
        <DispatchSection saleLot={saleLot} />
      </div>

      {saleLot.dispatched_at && (
        <div>
          <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recepción en PY
          </h2>
          <PyReceptionSection saleLot={saleLot} />
        </div>
      )}

      {sampleBatch && (
        <div>
          <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Muestreo conjunto
          </h2>
          <p className="text-sm text-slate-600">
            Este lote se mezcló con otros para el muestreo:{" "}
            <Link href={`/muestreo/${saleLot.sample_batch_id}`} className="text-gold-700 hover:underline">
              {sampleBatch.code}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
