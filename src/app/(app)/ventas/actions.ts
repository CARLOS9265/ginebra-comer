"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type SaleLotFormState = { error?: string } | null;

// Debe coincidir con las políticas RLS de sale_lots en 0013_sale_lots.sql.
const ALLOWED_ROLES = ["comercial", "operaciones", "gerencia", "administrador"];

export async function createSaleLot(
  _prevState: SaleLotFormState,
  formData: FormData,
): Promise<SaleLotFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede armar lotes de venta." };
  }

  const bagIds = formData.getAll("bag_id").map(String).filter(Boolean);
  if (bagIds.length === 0) {
    return { error: "Elegí al menos un big bag." };
  }

  const notes = String(formData.get("notes") ?? "").trim();
  const supabase = await createClient();
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

  const { error: updateError } = await supabase
    .from("big_bags")
    .update({ sale_lot_id: saleLot.id, status: "reservado" })
    .in("id", bagIds)
    .eq("status", "disponible");

  if (updateError) {
    return {
      error: `El lote ${code} se creó, pero hubo un error asignando los bolsones: ${updateError.message}`,
    };
  }

  redirect(`/ventas/${saleLot.id}`);
}

export async function addBigBagsToSaleLot(
  saleLotId: string,
  _prevState: SaleLotFormState,
  formData: FormData,
): Promise<SaleLotFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar este lote de venta." };
  }

  const bagIds = formData.getAll("bag_id").map(String).filter(Boolean);
  if (bagIds.length === 0) {
    return { error: "Elegí al menos un big bag." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("big_bags")
    .update({ sale_lot_id: saleLotId, status: "reservado" })
    .in("id", bagIds)
    .eq("status", "disponible");

  if (error) return { error: `No se pudo agregar: ${error.message}` };

  revalidatePath(`/ventas/${saleLotId}`);
  return null;
}

export async function removeBigBagFromSaleLot(saleLotId: string, bagId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar este lote de venta." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("big_bags")
    .update({ sale_lot_id: null, status: "disponible" })
    .eq("id", bagId)
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

  await supabase
    .from("big_bags")
    .update({ sale_lot_id: null, status: "disponible" })
    .eq("sale_lot_id", saleLotId);

  const { error } = await supabase.from("sale_lots").delete().eq("id", saleLotId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/big-bags");
  redirect("/ventas");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
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

  await supabase.from("big_bags").update({ status: "despachado" }).eq("sale_lot_id", saleLotId);

  revalidatePath(`/ventas/${saleLotId}`);
  revalidatePath("/big-bags");
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

  await supabase.from("big_bags").update({ status: "reservado" }).eq("sale_lot_id", saleLotId);

  revalidatePath(`/ventas/${saleLotId}`);
  revalidatePath("/big-bags");
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
      updated_by: profile.id,
    })
    .eq("id", saleLotId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await supabase.from("big_bags").update({ status: "recibido_py" }).eq("sale_lot_id", saleLotId);

  revalidatePath(`/ventas/${saleLotId}`);
  revalidatePath("/big-bags");
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
      updated_by: profile.id,
    })
    .eq("id", saleLotId);
  if (error) return { error: `No se pudo deshacer: ${error.message}` };

  await supabase.from("big_bags").update({ status: "despachado" }).eq("sale_lot_id", saleLotId);

  revalidatePath(`/ventas/${saleLotId}`);
  revalidatePath("/big-bags");
}
