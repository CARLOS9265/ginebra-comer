"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { estimateLot, type ContractSettings } from "@/lib/contract";
import { fiveDayAveragePrices } from "@/lib/metal-prices";

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

  // Listos para el muestreo provisional: ya tienen pesaje en Huanchaco
  // (llegaron al almacén) y todavía no entraron a ningún muestreo.
  const { data: huanchacoWeighings } = await supabase
    .from("weighings")
    .select("purchase_lot_id")
    .eq("type", "huanchaco");

  const { data: pending } = await supabase
    .from("purchase_lots")
    .select("id")
    .is("sample_batch_id", null)
    .in("id", (huanchacoWeighings ?? []).map((w) => w.purchase_lot_id));

  if (!pending || pending.length === 0) {
    return { error: "No hay lotes de compra que hayan llegado a Huanchaco esperando muestreo." };
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
    .from("purchase_lots")
    .update({ sample_batch_id: batch.id })
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
    .select("id, prov_au_gt")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return { error: "No se encontró el muestreo." };
  if (batch.prov_au_gt != null) {
    return { error: "No se puede deshacer: ya tiene resultado de laboratorio cargado." };
  }

  const { count: saleLotCount } = await supabase
    .from("sale_lots")
    .select("id", { count: "exact", head: true })
    .eq("sample_batch_id", batchId);
  if (saleLotCount && saleLotCount > 0) {
    return { error: "No se puede deshacer: ya se armaron lotes de venta a partir de este muestreo." };
  }

  await supabase.from("purchase_lots").update({ sample_batch_id: null }).eq("sample_batch_id", batchId);

  const { error } = await supabase.from("py_sample_batches").delete().eq("id", batchId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/lotes");
  redirect("/muestreo");
}

// ---------- Ensaye provisional (laboratorio local, cláusula 11.1) ----------

export async function saveProvisionalAssay(
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
      prov_sampled_at: str(formData, "prov_sampled_at")
        ? new Date(str(formData, "prov_sampled_at")).toISOString()
        : null,
      prov_lab_name: str(formData, "prov_lab_name") || null,
      prov_report_number: str(formData, "prov_report_number") || null,
      prov_au_gt: num(formData, "prov_au_gt"),
      prov_ag_gt: num(formData, "prov_ag_gt"),
      prov_pb_pct: num(formData, "prov_pb_pct"),
      prov_as_pct: num(formData, "prov_as_pct"),
      prov_sb_pct: num(formData, "prov_sb_pct"),
      prov_s_pct: num(formData, "prov_s_pct"),
      prov_humidity_pct: num(formData, "prov_humidity_pct"),
      prov_notes: str(formData, "prov_notes") || null,
    })
    .eq("id", batchId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/muestreo/${batchId}`);
  return null;
}

export async function deleteProvisionalAssay(batchId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este resultado." };
  }

  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("py_sample_batches")
    .select("prov_value_total")
    .eq("id", batchId)
    .maybeSingle();
  if (batch?.prov_value_total != null) {
    return { error: "No se puede eliminar: ya hay una liquidación provisional calculada con este ensaye." };
  }

  const { error } = await supabase
    .from("py_sample_batches")
    .update({
      prov_sampled_at: null,
      prov_lab_name: null,
      prov_report_number: null,
      prov_au_gt: null,
      prov_ag_gt: null,
      prov_pb_pct: null,
      prov_as_pct: null,
      prov_sb_pct: null,
      prov_s_pct: null,
      prov_humidity_pct: null,
      prov_notes: null,
    })
    .eq("id", batchId);

  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
}

// ---------- Liquidación provisional (90%, promedio 5 días, cláusula 5.1) ----------

export async function saveProvisionalLiquidation(
  batchId: string,
  _prevState: SampleBatchFormState,
  formData: FormData,
): Promise<SampleBatchFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede calcular la liquidación provisional." };
  }

  const invoiceDate = str(formData, "prov_invoice_date");
  if (!invoiceDate) return { error: "Ingresá la fecha de factura." };

  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("py_sample_batches")
    .select("prov_au_gt, prov_ag_gt, prov_pb_pct, prov_humidity_pct")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return { error: "No se encontró el muestreo." };
  if (batch.prov_au_gt == null || batch.prov_ag_gt == null || batch.prov_pb_pct == null) {
    return { error: "Falta el ensaye provisional (Au/Ag/Pb) para poder calcular." };
  }

  const { data: lots } = await supabase.from("purchase_lots").select("id").eq("sample_batch_id", batchId);
  const lotIds = (lots ?? []).map((l) => l.id);
  const { data: huanchacoWeighings } = lotIds.length
    ? await supabase
        .from("weighings")
        .select("purchase_lot_id, net_weight")
        .eq("type", "huanchaco")
        .in("purchase_lot_id", lotIds)
    : { data: [] };

  const totalKg = (huanchacoWeighings ?? []).reduce((sum, w) => sum + (w.net_weight ?? 0), 0);
  if (totalKg <= 0) return { error: "No se pudo calcular el peso total del muestreo (pesaje de Huanchaco)." };
  const tmh = totalKg / 1000;

  const prices = await fiveDayAveragePrices(supabase, invoiceDate);
  if (!prices || prices.gold == null || prices.silver == null) {
    return { error: "No hay suficiente historial de precios (daily_metal_prices) antes de esa fecha." };
  }

  const { data: settings } = await supabase.from("contract_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings) return { error: "No se encontró la configuración del contrato." };

  const result = estimateLot(
    {
      tmh,
      ag: batch.prov_ag_gt,
      au: batch.prov_au_gt,
      pb: batch.prov_pb_pct,
      humidity: batch.prov_humidity_pct ?? 0,
      precioAg: prices.silver,
      precioAu: prices.gold,
      precioPb: prices.lead ?? 0,
      precioProvisionalPorTonelada: 0,
    },
    settings as unknown as ContractSettings,
  );

  const valuePerTmh = result.valorPYxTMH;
  const valueTotal = valuePerTmh * tmh;
  const paymentPct = (settings.adelanto_py_pct ?? 90) / 100;
  const paymentTotal = valueTotal * paymentPct;

  const { error } = await supabase
    .from("py_sample_batches")
    .update({
      prov_invoice_date: invoiceDate,
      prov_price_au: prices.gold,
      prov_price_ag: prices.silver,
      prov_price_pb: prices.lead,
      prov_value_per_tmh: valuePerTmh,
      prov_value_total: valueTotal,
      prov_payment_total: paymentTotal,
    })
    .eq("id", batchId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/muestreo/${batchId}`);
  return null;
}

export async function markProvisionalPaid(batchId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede marcar el pago provisional." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("py_sample_batches")
    .update({ prov_paid_at: new Date().toISOString(), prov_paid_by: profile.id })
    .eq("id", batchId);
  if (error) return { error: `No se pudo actualizar: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
}

// ---------- Ensaye final (conjunto, cláusula 11.2) ----------

export async function saveFinalAssay(
  batchId: string,
  _prevState: SampleBatchFormState,
  formData: FormData,
): Promise<SampleBatchFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede cargar el ensaye final." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("py_sample_batches")
    .update({
      final_sampled_at: str(formData, "final_sampled_at")
        ? new Date(str(formData, "final_sampled_at")).toISOString()
        : null,
      final_lab_name: str(formData, "final_lab_name") || null,
      final_report_number: str(formData, "final_report_number") || null,
      final_au_gt: num(formData, "final_au_gt"),
      final_ag_gt: num(formData, "final_ag_gt"),
      final_pb_pct: num(formData, "final_pb_pct"),
      final_as_pct: num(formData, "final_as_pct"),
      final_sb_pct: num(formData, "final_sb_pct"),
      final_s_pct: num(formData, "final_s_pct"),
      final_humidity_pct: num(formData, "final_humidity_pct"),
      final_notes: str(formData, "final_notes") || null,
    })
    .eq("id", batchId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
  return null;
}

export async function deleteFinalAssay(batchId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este resultado." };
  }

  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("py_sample_batches")
    .select("final_value_total")
    .eq("id", batchId)
    .maybeSingle();
  if (batch?.final_value_total != null) {
    return { error: "No se puede eliminar: ya hay una liquidación final calculada con este ensaye." };
  }

  const { error } = await supabase
    .from("py_sample_batches")
    .update({
      final_sampled_at: null,
      final_lab_name: null,
      final_report_number: null,
      final_au_gt: null,
      final_ag_gt: null,
      final_pb_pct: null,
      final_as_pct: null,
      final_sb_pct: null,
      final_s_pct: null,
      final_humidity_pct: null,
      final_notes: null,
    })
    .eq("id", batchId);

  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
}

// ---------- Ventana de fijación (cláusula 8.1) ----------

export async function updateFixationWindow(
  batchId: string,
  _prevState: SampleBatchFormState,
  formData: FormData,
): Promise<SampleBatchFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar la ventana de fijación." };
  }

  const start = str(formData, "fixation_window_start");
  const end = str(formData, "fixation_window_end");
  if (!start || !end) return { error: "Completá las dos fechas." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("py_sample_batches")
    .update({ fixation_window_start: start, fixation_window_end: end })
    .eq("id", batchId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
  return null;
}

// ---------- Fijación por metal (cláusula 8.1/8.2) ----------

const METAL_COLUMNS = {
  au: { at: "au_fixed_at", price: "au_fixed_price" },
  ag: { at: "ag_fixed_at", price: "ag_fixed_price" },
  pb: { at: "pb_fixed_at", price: "pb_fixed_price" },
} as const;

export async function fixMetalPrice(
  batchId: string,
  metal: "au" | "ag" | "pb",
  _prevState: SampleBatchFormState,
  formData: FormData,
): Promise<SampleBatchFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede fijar el precio." };
  }

  const date = str(formData, "fixed_at");
  const price = num(formData, "fixed_price");
  if (!date || price == null) return { error: "Completá la fecha y el precio." };

  const supabase = await createClient();
  const cols = METAL_COLUMNS[metal];
  const { error } = await supabase
    .from("py_sample_batches")
    .update({ [cols.at]: date, [cols.price]: price })
    .eq("id", batchId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
  return null;
}

export async function autoFixMetalPrice(batchId: string, metal: "au" | "ag" | "pb") {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede fijar el precio." };
  }

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("py_sample_batches")
    .select("fixation_window_end")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch?.fixation_window_end) return { error: "No hay ventana de fijación definida." };

  const { data: priceRow } = await supabase
    .from("daily_metal_prices")
    .select("price_date, gold_usd_oz, silver_usd_oz, lead_usd_ton")
    .lte("price_date", batch.fixation_window_end)
    .order("price_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!priceRow) return { error: "No hay precio guardado cerca del cierre de la ventana." };

  const priceByMetal = { au: priceRow.gold_usd_oz, ag: priceRow.silver_usd_oz, pb: priceRow.lead_usd_ton };
  const price = priceByMetal[metal];
  if (price == null) return { error: "No hay precio de ese metal para esa fecha." };

  const cols = METAL_COLUMNS[metal];
  const { error } = await supabase
    .from("py_sample_batches")
    .update({ [cols.at]: priceRow.price_date, [cols.price]: price })
    .eq("id", batchId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
}

export async function unfixMetalPrice(batchId: string, metal: "au" | "ag" | "pb") {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede deshacer la fijación." };
  }

  const supabase = await createClient();
  const cols = METAL_COLUMNS[metal];
  const { error } = await supabase
    .from("py_sample_batches")
    .update({ [cols.at]: null, [cols.price]: null })
    .eq("id", batchId);
  if (error) return { error: `No se pudo deshacer: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
}

// ---------- Liquidación final (cláusula 5.1 modalidad final) ----------

export async function saveFinalLiquidation(batchId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede calcular la liquidación final." };
  }

  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("py_sample_batches")
    .select(
      "final_au_gt, final_ag_gt, final_pb_pct, final_humidity_pct, au_fixed_price, ag_fixed_price, pb_fixed_price, prov_payment_total",
    )
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return { error: "No se encontró el muestreo." };

  if (batch.final_au_gt == null || batch.final_ag_gt == null || batch.final_pb_pct == null) {
    return { error: "Falta el ensaye final (Au/Ag/Pb)." };
  }
  if (batch.au_fixed_price == null || batch.ag_fixed_price == null || batch.pb_fixed_price == null) {
    return { error: "Faltan fijar precios: todavía no están los 3 metales fijados." };
  }
  if (batch.prov_payment_total == null) {
    return { error: "Falta la liquidación provisional (para calcular el saldo)." };
  }

  const { data: saleLots } = await supabase
    .from("sale_lots")
    .select("id, py_official_weight_kg")
    .eq("sample_batch_id", batchId);

  const totalKg = (saleLots ?? []).reduce((sum, l) => sum + (l.py_official_weight_kg ?? 0), 0);
  if (totalKg <= 0) return { error: "No se pudo calcular el peso total del muestreo (peso oficial en PY)." };
  const tmh = totalKg / 1000;

  const { data: settings } = await supabase.from("contract_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings) return { error: "No se encontró la configuración del contrato." };

  const result = estimateLot(
    {
      tmh,
      ag: batch.final_ag_gt,
      au: batch.final_au_gt,
      pb: batch.final_pb_pct,
      humidity: batch.final_humidity_pct ?? 0,
      precioAg: batch.ag_fixed_price,
      precioAu: batch.au_fixed_price,
      precioPb: batch.pb_fixed_price,
      precioProvisionalPorTonelada: 0,
    },
    settings as unknown as ContractSettings,
  );

  const valuePerTmh = result.valorPYxTMH;
  const valueTotal = valuePerTmh * tmh;
  const balanceTotal = valueTotal - batch.prov_payment_total;

  const { error } = await supabase
    .from("py_sample_batches")
    .update({
      final_value_per_tmh: valuePerTmh,
      final_value_total: valueTotal,
      final_balance_total: balanceTotal,
    })
    .eq("id", batchId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
}

export async function markFinalPaid(batchId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede marcar el pago final." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("py_sample_batches")
    .update({ final_paid_at: new Date().toISOString(), final_paid_by: profile.id })
    .eq("id", batchId);
  if (error) return { error: `No se pudo actualizar: ${error.message}` };
  revalidatePath(`/muestreo/${batchId}`);
}
