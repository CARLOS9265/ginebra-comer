"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type SampleBatchFormState = { error?: string } | null;

// Debe coincidir con las políticas RLS de py_sample_batches en 0015_py_sample_batches.sql.
const ALLOWED_ROLES = ["operaciones", "calidad", "comercial", "gerencia", "administrador"];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function createSampleBatch() {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede armar un muestreo." };
  }

  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("sale_lots")
    .select("id")
    .eq("status", "recibido_py")
    .is("sample_batch_id", null);

  if (!pending || pending.length === 0) {
    return { error: "No hay lotes de venta recibidos en PY esperando muestreo." };
  }

  const year = new Date().getFullYear();
  const { data: seq, error: seqError } = await supabase.rpc("next_lot_seq", {
    p_provider_code: "MUE",
    p_year: year,
  });
  if (seqError || seq == null) {
    return { error: "No se pudo generar el código del muestreo. Probá de nuevo." };
  }
  const code = `MUE-${String(year).slice(-2)}-${String(seq).padStart(2, "0")}`;

  const { data: batch, error: insertError } = await supabase
    .from("py_sample_batches")
    .insert({ code, created_by: profile.id })
    .select("id")
    .single();

  if (insertError || !batch) {
    return { error: `No se pudo crear el muestreo: ${insertError?.message ?? "error desconocido"}` };
  }

  const { error: updateError } = await supabase
    .from("sale_lots")
    .update({ sample_batch_id: batch.id, status: "muestreado", updated_by: profile.id })
    .in(
      "id",
      pending.map((p) => p.id),
    );

  if (updateError) {
    return {
      error: `El muestreo ${code} se creó, pero hubo un error asignando los lotes: ${updateError.message}`,
    };
  }

  redirect(`/muestreo/${batch.id}`);
}

export async function undoSampleBatch(batchId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede deshacer este muestreo." };
  }

  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("py_sample_batches")
    .select("id, au_gt")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return { error: "No se encontró el muestreo." };
  if (batch.au_gt != null) {
    return { error: "No se puede deshacer: ya tiene resultado de laboratorio cargado." };
  }

  await supabase
    .from("sale_lots")
    .update({ sample_batch_id: null, status: "recibido_py", updated_by: profile.id })
    .eq("sample_batch_id", batchId);

  const { error } = await supabase.from("py_sample_batches").delete().eq("id", batchId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/ventas");
  redirect("/muestreo");
}

export async function saveSampleResult(
  batchId: string,
  _prevState: SampleBatchFormState,
  formData: FormData,
): Promise<SampleBatchFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede cargar el resultado de laboratorio." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("py_sample_batches")
    .update({
      sampled_at: str(formData, "sampled_at") ? new Date(str(formData, "sampled_at")).toISOString() : null,
      lab_name: str(formData, "lab_name") || null,
      report_number: str(formData, "report_number") || null,
      au_gt: num(formData, "au_gt"),
      ag_gt: num(formData, "ag_gt"),
      pb_pct: num(formData, "pb_pct"),
      as_pct: num(formData, "as_pct"),
      sb_pct: num(formData, "sb_pct"),
      s_pct: num(formData, "s_pct"),
      humidity_pct: num(formData, "humidity_pct"),
      notes: str(formData, "notes") || null,
    })
    .eq("id", batchId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/muestreo/${batchId}`);
  return null;
}

export async function deleteSampleResult(batchId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este resultado." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("py_sample_batches")
    .update({
      sampled_at: null,
      lab_name: null,
      report_number: null,
      au_gt: null,
      ag_gt: null,
      pb_pct: null,
      as_pct: null,
      sb_pct: null,
      s_pct: null,
      humidity_pct: null,
      notes: null,
    })
    .eq("id", batchId);

  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
}
