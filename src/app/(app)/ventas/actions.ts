"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getAvailablePurchaseLots } from "./available-bags";

export type SaleLotFormState = { error?: string } | null;

// Debe coincidir con las políticas RLS de sale_lots/sale_lot_allocations en 0013/0017.
const ALLOWED_ROLES = ["comercial", "operaciones", "gerencia", "administrador"];

function parseAllocations(formData: FormData): { purchaseLotId: string; qty: number }[] {
  const result: { purchaseLotId: string; qty: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const qty = Number(value);
    if (Number.isFinite(qty) && qty > 0) {
      result.push({ purchaseLotId: key.slice(4), qty: Math.trunc(qty) });
    }
  }
  return result;
}

export async function createSaleLot(
  _prevState: SaleLotFormState,
  formData: FormData,
): Promise<SaleLotFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede armar lotes de venta." };
  }

  const picks = parseAllocations(formData);
  if (picks.length === 0) {
    return { error: "Ingresá una cantidad de bolsones de al menos un lote de compra." };
  }

  const supabase = await createClient();

  const available = await getAvailablePurchaseLots(supabase);
  const availableById = new Map(available.map((a) => [a.purchaseLotId, a.available]));
  for (const p of picks) {
    const max = availableById.get(p.purchaseLotId) ?? 0;
    if (p.qty > max) {
      return { error: `Solo hay ${max} bolsones disponibles de ese lote de compra. Recargá la página.` };
    }
  }

  const notes = String(formData.get("notes") ?? "").trim();
  const year = new Date().getFullYear();

  const { data: seq, error: seqError } = await supabase.rpc("next_lot_seq", {
    p_provider_code: "VTA",
    p_year: year,
  });
  if (seqError || seq == null) {
    return { error: "No se pudo generar el código del lote de venta. Probá de nuevo." };
  }
  const code = `VTA-${String(year).slice(-2)}-${String(seq).padStart(2, "0")}`;

  const { data: saleLot, error: insertError } = await supabase
    .from("sale_lots")
    .insert({ code, notes: notes || null, created_by: profile.id, updated_by: profile.id })
    .select("id")
    .single();

  if (insertError || !saleLot) {
    return { error: `No se pudo crear el lote de venta: ${insertError?.message ?? "error desconocido"}` };
  }

  const { error: allocError } = await supabase.from("sale_lot_allocations").insert(
    picks.map((p) => ({
      sale_lot_id: saleLot.id,
      purchase_lot_id: p.purchaseLotId,
      bag_count: p.qty,
      created_by: profile.id,
    })),
  );

  if (allocError) {
    return {
      error: `El lote ${code} se creó, pero hubo un error asignando los bolsones: ${allocError.message}`,
    };
  }

  redirect(`/ventas/${saleLot.id}`);
}

export async function addAllocation(
  saleLotId: string,
  _prevState: SaleLotFormState,
  formData: FormData,
): Promise<SaleLotFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar este lote de venta." };
  }

  const purchaseLotId = String(formData.get("purchase_lot_id") ?? "");
  const qty = Math.trunc(Number(formData.get("qty") ?? 0));
  if (!purchaseLotId || !Number.isFinite(qty) || qty <= 0) {
    return { error: "Elegí un lote de compra y una cantidad válida." };
  }

  const supabase = await createClient();

  const available = await getAvailablePurchaseLots(supabase);
  const max = available.find((a) => a.purchaseLotId === purchaseLotId)?.available ?? 0;
  if (qty > max) {
    return { error: `Solo hay ${max} bolsones disponibles de ese lote de compra.` };
  }

  const { data: existing } = await supabase
    .from("sale_lot_allocations")
    .select("id, bag_count")
    .eq("sale_lot_id", saleLotId)
    .eq("purchase_lot_id", purchaseLotId)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("sale_lot_allocations")
        .update({ bag_count: existing.bag_count + qty })
        .eq("id", existing.id)
    : await supabase.from("sale_lot_allocations").insert({
        sale_lot_id: saleLotId,
        purchase_lot_id: purchaseLotId,
        bag_count: qty,
        created_by: profile.id,
      });

  if (error) return { error: `No se pudo agregar: ${error.message}` };

  revalidatePath(`/ventas/${saleLotId}`);
  return null;
}

export async function removeAllocation(saleLotId: string, allocationId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar este lote de venta." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("sale_lot_allocations")
    .delete()
    .eq("id", allocationId)
    .eq("sale_lot_id", saleLotId);

  if (error) return { error: `No se pudo quitar: ${error.message}` };
  revalidatePath(`/ventas/${saleLotId}`);
}

export async function deleteSaleLot(saleLotId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este lote de venta." };
  }

  const supabase = await createClient();

  const { data: saleLot } = await supabase
    .from("sale_lots")
    .select("status")
    .eq("id", saleLotId)
    .maybeSingle();
  if (!saleLot || saleLot.status !== "armado") {
    return { error: "Solo se puede eliminar un lote de venta mientras está en estado 'armado'." };
  }

  const { error } = await supabase.from("sale_lots").delete().eq("id", saleLotId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  redirect("/ventas");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function dispatchSaleLot(
  saleLotId: string,
  _prevState: SaleLotFormState,
  formData: FormData,
): Promise<SaleLotFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar el despacho." };
  }

  const supabase = await createClient();

  const { data: saleLot } = await supabase
    .from("sale_lots")
    .select("status")
    .eq("id", saleLotId)
    .maybeSingle();
  if (!saleLot || saleLot.status !== "armado") {
    return { error: "Este lote de venta ya fue despachado." };
  }

  const dispatchedAt = str(formData, "dispatched_at");

  const { error } = await supabase
    .from("sale_lots")
    .update({
      status: "despachado",
      dispatched_at: dispatchedAt ? new Date(dispatchedAt).toISOString() : new Date().toISOString(),
      dispatch_carrier: str(formData, "dispatch_carrier") || null,
      dispatch_truck_plate: str(formData, "dispatch_truck_plate") || null,
      updated_by: profile.id,
    })
    .eq("id", saleLotId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/ventas/${saleLotId}`);
  return null;
}

export async function undoDispatch(saleLotId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede deshacer el despacho." };
  }

  const supabase = await createClient();
  const { data: saleLot } = await supabase
    .from("sale_lots")
    .select("status")
    .eq("id", saleLotId)
    .maybeSingle();
  if (!saleLot || saleLot.status !== "despachado") {
    return { error: "Solo se puede deshacer mientras está en estado 'despachado'." };
  }

  const { error } = await supabase
    .from("sale_lots")
    .update({
      status: "armado",
      dispatched_at: null,
      dispatch_carrier: null,
      dispatch_truck_plate: null,
      updated_by: profile.id,
    })
    .eq("id", saleLotId);
  if (error) return { error: `No se pudo deshacer: ${error.message}` };

  revalidatePath(`/ventas/${saleLotId}`);
}

export async function receiveSaleLotAtPY(
  saleLotId: string,
  _prevState: SaleLotFormState,
  formData: FormData,
): Promise<SaleLotFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar la recepción en PY." };
  }

  const officialWeight = num(formData, "py_official_weight_kg");
  if (officialWeight == null) {
    return { error: "El peso oficial del trailer es obligatorio — es la única referencia de peso confiable." };
  }

  const supabase = await createClient();

  const { data: saleLot } = await supabase
    .from("sale_lots")
    .select("status")
    .eq("id", saleLotId)
    .maybeSingle();
  if (!saleLot || saleLot.status !== "despachado") {
    return { error: "Este lote todavía no fue despachado, o ya fue recibido." };
  }

  const receivedAt = str(formData, "received_at_py");

  const { error } = await supabase
    .from("sale_lots")
    .update({
      status: "recibido_py",
      received_at_py: receivedAt ? new Date(receivedAt).toISOString() : new Date().toISOString(),
      py_warehouse: str(formData, "py_warehouse") || null,
      py_received_by: str(formData, "py_received_by") || null,
      py_official_weight_kg: officialWeight,
      updated_by: profile.id,
    })
    .eq("id", saleLotId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/ventas/${saleLotId}`);
  return null;
}

export async function undoPyReception(saleLotId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede deshacer la recepción." };
  }

  const supabase = await createClient();
  const { data: saleLot } = await supabase
    .from("sale_lots")
    .select("status")
    .eq("id", saleLotId)
    .maybeSingle();
  if (!saleLot || saleLot.status !== "recibido_py") {
    return { error: "Solo se puede deshacer mientras está en estado 'recibido_py'." };
  }

  const { error } = await supabase
    .from("sale_lots")
    .update({
      status: "despachado",
      received_at_py: null,
      py_warehouse: null,
      py_received_by: null,
      py_official_weight_kg: null,
      updated_by: profile.id,
    })
    .eq("id", saleLotId);
  if (error) return { error: `No se pudo deshacer: ${error.message}` };

  revalidatePath(`/ventas/${saleLotId}`);
}
