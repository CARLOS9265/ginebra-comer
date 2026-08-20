"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canEstimate, estimateLot, type ContractSettings } from "@/lib/contract";

export type LotFormState = { error?: string } | null;

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createPurchaseLot(
  _prevState: LotFormState,
  formData: FormData,
): Promise<LotFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !["operaciones", "compras", "gerencia", "administrador"].includes(profile.role)) {
    return { error: "Tu rol no puede registrar lotes de compra." };
  }

  const providerId = str(formData, "provider_id");
  const providerCode = str(formData, "provider_code");
  const loadedAt = str(formData, "loaded_at");
  const tmh = num(formData, "estimated_weight_tmh");
  const precioProvisional = num(formData, "provisional_price_per_tmh");

  if (!providerId || !providerCode || !loadedAt || !tmh || precioProvisional == null) {
    return {
      error: "Completá proveedor, fecha/hora de carga, peso estimado y precio provisional.",
    };
  }

  const supabase = await createClient();

  const { data: cfg } = await supabase.from("contract_settings").select("*").eq("id", 1).single();
  if (!cfg) return { error: "No se pudo leer la configuración del contrato." };

  const estimateInput = {
    tmh,
    ag: num(formData, "estimated_ag") ?? 0,
    au: num(formData, "estimated_au") ?? 0,
    pb: num(formData, "estimated_pb") ?? 0,
    humidity: num(formData, "estimated_humidity") ?? 0,
    precioAg: num(formData, "precio_ag") ?? 0,
    precioAu: num(formData, "precio_au") ?? 0,
    precioPb: num(formData, "precio_pb") ?? 0,
    precioProvisionalPorTonelada: precioProvisional,
  };

  const hasEstimate = canEstimate(estimateInput);
  const estimate = hasEstimate ? estimateLot(estimateInput, cfg as ContractSettings) : null;

  const requiresApproval = estimate?.requiereAprobacion ?? false;
  const approvalReason = str(formData, "approval_reason");
  if (requiresApproval && !approvalReason) {
    return {
      error:
        "El precio provisional supera el precio máximo recomendado. Explicá el motivo para poder registrar el lote (queda pendiente de aprobación de gerencia).",
    };
  }

  const year = new Date(loadedAt).getFullYear();
  const { data: seq, error: seqError } = await supabase.rpc("next_lot_seq", {
    p_provider_code: providerCode,
    p_year: year,
  });
  if (seqError || seq == null) {
    return { error: "No se pudo generar el código del lote. Probá de nuevo." };
  }
  const code = `GIN-${providerCode}-${year}-${String(seq).padStart(4, "0")}`;

  const { data: lot, error: insertError } = await supabase
    .from("purchase_lots")
    .insert({
      code,
      provider_id: providerId,
      mine_name: str(formData, "mine_name") || null,
      concession: str(formData, "concession") || null,
      loaded_at: new Date(loadedAt).toISOString(),
      truck_plate: str(formData, "truck_plate") || null,
      driver_name: str(formData, "driver_name") || null,
      carrier_name: str(formData, "carrier_name") || null,
      estimated_weight_tmh: tmh,
      reference_price_usd: num(formData, "reference_price_usd"),
      provisional_price_per_tmh: precioProvisional,
      advance_pct: num(formData, "advance_pct"),
      initial_guide_number: str(formData, "initial_guide_number") || null,
      initial_invoice_number: str(formData, "initial_invoice_number") || null,
      estimated_ag: estimateInput.ag || null,
      estimated_au: estimateInput.au || null,
      estimated_pb: estimateInput.pb || null,
      estimated_humidity: estimateInput.humidity || null,
      projected_py_value_per_tmh: estimate?.valorPYxTMH ?? null,
      projected_max_price_per_tmh: estimate?.precioMaximoCompra ?? null,
      projected_margin_per_tmh: estimate?.margenXTMH ?? null,
      requires_approval: requiresApproval,
      approval_reason: requiresApproval ? approvalReason : null,
      created_by: profile.id,
      status: "creado",
    })
    .select("id")
    .single();

  if (insertError || !lot) {
    return { error: `No se pudo guardar el lote: ${insertError?.message ?? "error desconocido"}` };
  }

  const sealsRaw = str(formData, "seals");
  const sealCodes = sealsRaw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sealCodes.length > 0) {
    const { error: sealsError } = await supabase.from("seals").insert(
      sealCodes.map((code) => ({
        code,
        purchase_lot_id: lot.id,
        status: "colocado",
        updated_by: profile.id,
      })),
    );
    if (sealsError) {
      return {
        error: `El lote ${code} se guardó, pero hubo un error con los precintos: ${sealsError.message}`,
      };
    }
  }

  redirect(`/lotes?creado=${code}`);
}
