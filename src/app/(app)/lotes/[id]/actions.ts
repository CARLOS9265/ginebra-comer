"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { LOT_STATUS_ORDER, type LotStatus } from "@/lib/lot-status";
import { estimateLot, type ContractSettings } from "@/lib/contract";

export type LogisticsFormState = { error?: string } | null;

// Debe coincidir con las políticas RLS de transport_events/weighings en 0001_init.sql.
const ALLOWED_ROLES = ["operaciones", "calidad", "gerencia", "administrador"];

// Debe coincidir con las políticas RLS de lot_settlements en 0011_lot_settlements.sql.
const SETTLEMENT_ROLES = ["compras", "contabilidad", "gerencia", "administrador"];

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function advanceLotStatus(
  supabase: SupabaseClient,
  lotId: string,
  minStatus: LotStatus,
  profileId: string,
) {
  const { data: lot } = await supabase
    .from("purchase_lots")
    .select("status")
    .eq("id", lotId)
    .maybeSingle();
  if (!lot) return;

  const currentIdx = LOT_STATUS_ORDER.indexOf(lot.status as LotStatus);
  const targetIdx = LOT_STATUS_ORDER.indexOf(minStatus);
  if (targetIdx > currentIdx) {
    await supabase
      .from("purchase_lots")
      .update({ status: minStatus, updated_by: profileId })
      .eq("id", lotId);
  }
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createTransportEvent(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar transporte." };
  }

  const supabase = await createClient();

  const { data: lot } = await supabase
    .from("purchase_lots")
    .select("loaded_at")
    .eq("id", lotId)
    .maybeSingle();
  if (!lot) return { error: "No se encontró el lote." };

  const { error } = await supabase.from("transport_events").insert({
    purchase_lot_id: lotId,
    departed_at: lot.loaded_at,
    carrier_name: str(formData, "carrier_name") || null,
    tariff_pen_per_tmh: num(formData, "tariff_pen_per_tmh"),
    security_cost_pen: num(formData, "security_cost_pen"),
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await advanceLotStatus(supabase, lotId, "en_transito", profile.id);

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function updateTransportEvent(
  lotId: string,
  eventId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar este registro." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("transport_events")
    .update({
      carrier_name: str(formData, "carrier_name") || null,
      tariff_pen_per_tmh: num(formData, "tariff_pen_per_tmh"),
      security_cost_pen: num(formData, "security_cost_pen"),
    })
    .eq("id", eventId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteTransportEvent(lotId: string, eventId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este registro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("transport_events").delete().eq("id", eventId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
}

export async function createWeighing(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar pesajes." };
  }

  const type = str(formData, "type");
  if (!["inicial", "oficial", "regularizacion", "huanchaco"].includes(type)) {
    return { error: "Elegí un tipo de pesaje válido." };
  }

  const net = num(formData, "net_weight");

  const supabase = await createClient();
  const { error } = await supabase.from("weighings").insert({
    purchase_lot_id: lotId,
    type,
    net_weight: net,
    ticket_number: str(formData, "ticket_number") || null,
    weighed_at: str(formData, "weighed_at") ? new Date(str(formData, "weighed_at")).toISOString() : null,
    reason: str(formData, "reason") || null,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  if (type === "oficial") {
    await advanceLotStatus(supabase, lotId, "pesado", profile.id);
  }

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function updateWeighing(
  lotId: string,
  weighingId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar este registro." };
  }

  const type = str(formData, "type");
  if (!["inicial", "oficial", "regularizacion", "huanchaco"].includes(type)) {
    return { error: "Elegí un tipo de pesaje válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("weighings")
    .update({
      type,
      net_weight: num(formData, "net_weight"),
      ticket_number: str(formData, "ticket_number") || null,
      weighed_at: str(formData, "weighed_at") ? new Date(str(formData, "weighed_at")).toISOString() : null,
      reason: str(formData, "reason") || null,
    })
    .eq("id", weighingId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteWeighing(lotId: string, weighingId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este registro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("weighings").delete().eq("id", weighingId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
}

export async function createMillReception(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar la recepción en molino." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mill_receptions").insert({
    purchase_lot_id: lotId,
    received_at: str(formData, "received_at") ? new Date(str(formData, "received_at")).toISOString() : null,
    supervisor_name: str(formData, "supervisor_name") || null,
    storage_location: str(formData, "storage_location") || null,
    incidents: str(formData, "incidents") || null,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await advanceLotStatus(supabase, lotId, "recibido_molino", profile.id);

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function updateMillReception(
  lotId: string,
  receptionId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar este registro." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("mill_receptions")
    .update({
      received_at: str(formData, "received_at") ? new Date(str(formData, "received_at")).toISOString() : null,
      supervisor_name: str(formData, "supervisor_name") || null,
      storage_location: str(formData, "storage_location") || null,
      incidents: str(formData, "incidents") || null,
    })
    .eq("id", receptionId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteMillReception(lotId: string, receptionId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este registro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mill_receptions").delete().eq("id", receptionId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
}

export async function createComminution(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar la conminución." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("comminutions").insert({
    purchase_lot_id: lotId,
    started_at: str(formData, "started_at") ? new Date(str(formData, "started_at")).toISOString() : null,
    finished_at: str(formData, "finished_at") ? new Date(str(formData, "finished_at")).toISOString() : null,
    processed_tons: num(formData, "processed_tons"),
    mill_invoice_number: str(formData, "mill_invoice_number") || null,
    tariff_pen_per_ton: num(formData, "tariff_pen_per_ton"),
    bag_count: num(formData, "bag_count"),
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await advanceLotStatus(supabase, lotId, "conminuido", profile.id);

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function updateComminution(
  lotId: string,
  comminutionId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar este registro." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("comminutions")
    .update({
      started_at: str(formData, "started_at") ? new Date(str(formData, "started_at")).toISOString() : null,
      finished_at: str(formData, "finished_at") ? new Date(str(formData, "finished_at")).toISOString() : null,
      processed_tons: num(formData, "processed_tons"),
      mill_invoice_number: str(formData, "mill_invoice_number") || null,
      tariff_pen_per_ton: num(formData, "tariff_pen_per_ton"),
      bag_count: num(formData, "bag_count"),
    })
    .eq("id", comminutionId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteComminution(lotId: string, comminutionId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este registro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("comminutions").delete().eq("id", comminutionId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
}

export async function createLabAnalysis(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar resultados de laboratorio." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lab_analyses").insert({
    purchase_lot_id: lotId,
    sampled_at: str(formData, "sampled_at") ? new Date(str(formData, "sampled_at")).toISOString() : null,
    analyzed_at: str(formData, "analyzed_at") ? new Date(str(formData, "analyzed_at")).toISOString() : null,
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
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await advanceLotStatus(supabase, lotId, "en_laboratorio", profile.id);

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function updateLabAnalysis(
  lotId: string,
  analysisId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar este registro." };
  }

  const supabase = await createClient();

  const { data: settlement } = await supabase
    .from("lot_settlements")
    .select("id")
    .eq("lab_analysis_id", analysisId)
    .maybeSingle();
  if (settlement) {
    return {
      error: "No se puede editar: ya hay una liquidación definitiva calculada con este resultado. Borrá esa primero.",
    };
  }

  const { error } = await supabase
    .from("lab_analyses")
    .update({
      sampled_at: str(formData, "sampled_at") ? new Date(str(formData, "sampled_at")).toISOString() : null,
      analyzed_at: str(formData, "analyzed_at") ? new Date(str(formData, "analyzed_at")).toISOString() : null,
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
    .eq("id", analysisId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteLabAnalysis(lotId: string, analysisId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este registro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lab_analyses").delete().eq("id", analysisId);
  if (error) {
    if (error.code === "23503") {
      return {
        error: "No se puede eliminar: ya hay una liquidación definitiva que usa este resultado. Borrá esa primero.",
      };
    }
    return { error: `No se pudo eliminar: ${error.message}` };
  }
  revalidatePath(`/lotes/${lotId}`);
}

export async function createSettlement(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !SETTLEMENT_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar la liquidación definitiva." };
  }

  const supabase = await createClient();

  const { data: lot } = await supabase
    .from("purchase_lots")
    .select(
      "code, provider_id, estimated_weight_tmh, provisional_price_per_tmh, estimated_price_au, estimated_price_ag, estimated_price_pb",
    )
    .eq("id", lotId)
    .maybeSingle();
  if (!lot) return { error: "No se encontró el lote." };

  const { data: analysis } = await supabase
    .from("lab_analyses")
    .select("id, au_gt, ag_gt, pb_pct, humidity_pct")
    .eq("purchase_lot_id", lotId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!analysis) {
    return { error: "Todavía no hay un resultado de laboratorio para este lote." };
  }

  const { data: oficial } = await supabase
    .from("weighings")
    .select("net_weight")
    .eq("purchase_lot_id", lotId)
    .eq("type", "oficial")
    .order("weighed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: settings } = await supabase.from("contract_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings) return { error: "No se encontró la configuración del contrato (contract_settings)." };

  const tmhUsed = oficial?.net_weight != null ? oficial.net_weight / 1000 : lot.estimated_weight_tmh;

  if (
    !tmhUsed ||
    lot.estimated_price_au == null ||
    lot.estimated_price_ag == null ||
    lot.estimated_price_pb == null ||
    analysis.au_gt == null ||
    analysis.ag_gt == null ||
    analysis.pb_pct == null
  ) {
    return {
      error:
        "Faltan datos para calcular (peso, precios de metal del provisional, o ley de laboratorio). Revisá el lote.",
    };
  }

  const result = estimateLot(
    {
      tmh: tmhUsed,
      ag: analysis.ag_gt,
      au: analysis.au_gt,
      pb: analysis.pb_pct,
      humidity: analysis.humidity_pct ?? 0,
      precioAg: lot.estimated_price_ag,
      precioAu: lot.estimated_price_au,
      precioPb: lot.estimated_price_pb,
      precioProvisionalPorTonelada: lot.provisional_price_per_tmh ?? 0,
    },
    settings as unknown as ContractSettings,
  );

  const provisionalPagadoTotal = (lot.provisional_price_per_tmh ?? 0) * tmhUsed;
  const saldoPendiente = result.precioMaximoCompraTotal - provisionalPagadoTotal;

  // Adelanto a aplicar (opcional): se recalcula el saldo pendiente real del
  // proveedor en el servidor, no se confía en lo que mandó el formulario.
  let applyAdvanceUsd = 0;
  const requestedApply = num(formData, "apply_advance_usd");
  if (requestedApply != null && requestedApply > 0 && lot.provider_id) {
    const { data: providerAdvances } = await supabase
      .from("provider_advances")
      .select("amount_usd")
      .eq("provider_id", lot.provider_id);
    const providerPendingUsd = Math.max(
      0,
      (providerAdvances ?? []).reduce((sum, a) => sum + a.amount_usd, 0),
    );
    applyAdvanceUsd = Math.min(requestedApply, providerPendingUsd, Math.max(0, saldoPendiente));
  }

  const { data: newSettlement, error } = await supabase
    .from("lot_settlements")
    .insert({
      purchase_lot_id: lotId,
      lab_analysis_id: analysis.id,
      tmh_used: tmhUsed,
      price_au: lot.estimated_price_au,
      price_ag: lot.estimated_price_ag,
      price_pb: lot.estimated_price_pb,
      au_payable_pct: result.auPagablePct,
      ag_payable_pct: result.agPagablePct,
      pb_payable_pct: result.pbPagableFactor,
      valor_py_per_tmh: result.valorPYxTMH,
      costos_per_tmh: result.costosXTMH,
      ganancia_objetivo_usd: settings.ganancia_objetivo_usd,
      precio_definitivo_per_tmh: result.precioMaximoCompra,
      precio_definitivo_total: result.precioMaximoCompraTotal,
      provisional_pagado_total: provisionalPagadoTotal,
      saldo_pendiente: saldoPendiente,
      adelanto_aplicado_usd: applyAdvanceUsd,
      final_invoice_number: str(formData, "final_invoice_number") || null,
      credit_debit_note_number: str(formData, "credit_debit_note_number") || null,
      notes: str(formData, "notes") || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  if (applyAdvanceUsd > 0 && lot.provider_id) {
    await supabase.from("provider_advances").insert({
      provider_id: lot.provider_id,
      amount_usd: -applyAdvanceUsd,
      given_at: new Date().toISOString().slice(0, 10),
      note: `Aplicado a liquidación del lote ${lot.code}`,
      applied_lot_settlement_id: newSettlement.id,
      created_by: profile.id,
    });
  }

  await advanceLotStatus(supabase, lotId, "valorizado", profile.id);

  revalidatePath(`/lotes/${lotId}`);
  revalidatePath("/adelantos");
  return null;
}

export async function updateSettlement(
  lotId: string,
  settlementId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !SETTLEMENT_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar la liquidación." };
  }

  const supabase = await createClient();

  const { data: settlement } = await supabase
    .from("lot_settlements")
    .select("paid_at")
    .eq("id", settlementId)
    .maybeSingle();
  if (settlement?.paid_at) {
    return { error: "No se puede editar: la liquidación ya está marcada como pagada." };
  }

  // Solo se editan los datos administrativos — los montos calculados no se
  // tocan a mano; si cambió la ley o el peso, hay que borrar y recalcular.
  const { error } = await supabase
    .from("lot_settlements")
    .update({
      final_invoice_number: str(formData, "final_invoice_number") || null,
      credit_debit_note_number: str(formData, "credit_debit_note_number") || null,
      notes: str(formData, "notes") || null,
    })
    .eq("id", settlementId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteSettlement(lotId: string, settlementId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !SETTLEMENT_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este registro." };
  }

  const supabase = await createClient();

  // Si esta liquidación tenía un adelanto aplicado, se revierte primero (se
  // borra la fila del descuento) para no dejar la FK colgando y para que el
  // proveedor recupere ese saldo pendiente.
  await supabase.from("provider_advances").delete().eq("applied_lot_settlement_id", settlementId);

  const { error } = await supabase.from("lot_settlements").delete().eq("id", settlementId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
  revalidatePath("/adelantos");
}

export async function createWarehouseTransfer(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar el traslado a almacén." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("warehouse_transfers").insert({
    purchase_lot_id: lotId,
    forklift_cost_pen: num(formData, "forklift_cost_pen"),
    dispatch_carrier: str(formData, "dispatch_carrier") || null,
    dispatch_truck_plate: str(formData, "dispatch_truck_plate") || null,
    departed_at: str(formData, "departed_at") ? new Date(str(formData, "departed_at")).toISOString() : null,
    arrived_at: str(formData, "arrived_at") ? new Date(str(formData, "arrived_at")).toISOString() : null,
    incidents: str(formData, "incidents") || null,
    created_by: profile.id,
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await advanceLotStatus(supabase, lotId, "en_almacen", profile.id);

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function updateWarehouseTransfer(
  lotId: string,
  transferId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede editar este registro." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("warehouse_transfers")
    .update({
      forklift_cost_pen: num(formData, "forklift_cost_pen"),
      dispatch_carrier: str(formData, "dispatch_carrier") || null,
      dispatch_truck_plate: str(formData, "dispatch_truck_plate") || null,
      departed_at: str(formData, "departed_at") ? new Date(str(formData, "departed_at")).toISOString() : null,
      arrived_at: str(formData, "arrived_at") ? new Date(str(formData, "arrived_at")).toISOString() : null,
      incidents: str(formData, "incidents") || null,
    })
    .eq("id", transferId);

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteWarehouseTransfer(lotId: string, transferId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este registro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("warehouse_transfers").delete().eq("id", transferId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
}

export async function uploadWarehousePhoto(
  lotId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede registrar el traslado a almacén." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí una foto para subir." };
  }

  const supabase = await createClient();
  const path = `${lotId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("lot-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (uploadError) return { error: `No se pudo subir la foto: ${uploadError.message}` };

  const { error: docError } = await supabase.from("documents").insert({
    entity_type: "purchase_lot",
    entity_id: lotId,
    doc_type: "foto_almacen",
    storage_path: path,
    uploaded_by: profile.id,
  });
  if (docError) return { error: `No se pudo guardar el registro: ${docError.message}` };

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteWarehousePhoto(lotId: string, docId: string, storagePath: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este registro." };
  }

  const supabase = await createClient();
  await supabase.storage.from("lot-photos").remove([storagePath]);
  const { error } = await supabase.from("documents").delete().eq("id", docId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
}

export async function uploadWeighingTicketPhoto(
  lotId: string,
  weighingId: string,
  _prevState: LogisticsFormState,
  formData: FormData,
): Promise<LogisticsFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede subir esta foto." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí una foto para subir." };
  }

  const supabase = await createClient();
  const path = `${lotId}/tickets/${weighingId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("lot-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (uploadError) return { error: `No se pudo subir la foto: ${uploadError.message}` };

  const { error: docError } = await supabase.from("documents").insert({
    entity_type: "weighing",
    entity_id: weighingId,
    doc_type: "ticket_balanza",
    storage_path: path,
    uploaded_by: profile.id,
  });
  if (docError) return { error: `No se pudo guardar el registro: ${docError.message}` };

  revalidatePath(`/lotes/${lotId}`);
  return null;
}

export async function deleteWeighingTicketPhoto(lotId: string, docId: string, storagePath: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede eliminar este registro." };
  }

  const supabase = await createClient();
  await supabase.storage.from("lot-photos").remove([storagePath]);
  const { error } = await supabase.from("documents").delete().eq("id", docId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
}

export async function markSettlementPaid(lotId: string, settlementId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !SETTLEMENT_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede marcar la liquidación como pagada." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("lot_settlements")
    .update({ paid_at: new Date().toISOString(), paid_by: profile.id })
    .eq("id", settlementId);
  if (error) return { error: `No se pudo actualizar: ${error.message}` };
  revalidatePath(`/lotes/${lotId}`);
}

export async function closeLot(lotId: string) {
  const { profile } = await getCurrentUser();
  if (!profile || !SETTLEMENT_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede cerrar la compra." };
  }

  const supabase = await createClient();
  const { data: settlement } = await supabase
    .from("lot_settlements")
    .select("paid_at")
    .eq("purchase_lot_id", lotId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!settlement?.paid_at) {
    return { error: "No se puede cerrar: la liquidación todavía no está marcada como pagada." };
  }

  await advanceLotStatus(supabase, lotId, "cerrado", profile.id);
  revalidatePath(`/lotes/${lotId}`);
}
