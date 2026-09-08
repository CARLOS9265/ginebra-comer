"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type AdvanceFormState = { error?: string } | null;

// Mismos roles que pueden registrar la liquidación definitiva de un lote
// (0011_lot_settlements.sql / 0020_provider_advances.sql): es una decisión
// financiera de compras/contabilidad, no de operaciones/calidad.
const ALLOWED_ROLES = ["compras", "contabilidad", "gerencia", "administrador"];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createAdvance(
  _prevState: AdvanceFormState,
  formData: FormData,
): Promise<AdvanceFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar adelantos." };
  }

  const providerId = str(formData, "provider_id");
  const amount = Number(formData.get("amount_usd"));
  const givenAt = str(formData, "given_at");
  const note = str(formData, "note");

  if (!providerId) return { error: "Elegí un proveedor." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!givenAt) return { error: "Falta la fecha." };

  const supabase = await createClient();
  const { error } = await supabase.from("provider_advances").insert({
    provider_id: providerId,
    amount_usd: amount,
    given_at: givenAt,
    note: note || null,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/adelantos");
  return null;
}

export type DeleteAdvanceResult = { error?: string } | undefined;

export async function deleteAdvance(advanceId: string): Promise<DeleteAdvanceResult> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar adelantos." };
  }

  const supabase = await createClient();

  const { data: advance } = await supabase
    .from("provider_advances")
    .select("applied_lot_settlement_id")
    .eq("id", advanceId)
    .maybeSingle();

  if (advance?.applied_lot_settlement_id) {
    return {
      error: "No se puede eliminar: ya fue aplicado a una liquidación. Borrá esa liquidación primero.",
    };
  }

  const { error } = await supabase.from("provider_advances").delete().eq("id", advanceId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/adelantos");
}
