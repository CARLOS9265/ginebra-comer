import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type Alert = {
  severity: "alta" | "media";
  title: string;
  detail: string;
  link: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const todayISO = () => new Date().toISOString().slice(0, 10);

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

/**
 * Chequeos deterministas (sin IA) sobre el estado actual de lotes, muestreos
 * y programación. Pensado para que el asistente los use como una herramienta
 * más, y eventualmente para un panel en Inicio.
 */
export async function computeAlerts(supabase: SupabaseClient): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();

  // 1. Ventanas de fijación de precio en PY por vencer o vencidas sin fijar los 3 metales.
  const { data: batches } = await supabase
    .from("py_sample_batches")
    .select("id, code, fixation_window_end, au_fixed_price, ag_fixed_price, pb_fixed_price, final_value_total")
    .not("fixation_window_end", "is", null)
    .is("final_value_total", null);

  for (const b of batches ?? []) {
    const allFixed = b.au_fixed_price != null && b.ag_fixed_price != null && b.pb_fixed_price != null;
    if (allFixed || !b.fixation_window_end) continue;
    const daysLeft = daysBetween(new Date(b.fixation_window_end), now);
    const missing = [
      b.au_fixed_price == null && "oro",
      b.ag_fixed_price == null && "plata",
      b.pb_fixed_price == null && "plomo",
    ].filter(Boolean);
    if (daysLeft < 0) {
      alerts.push({
        severity: "alta",
        title: `Muestreo ${b.code}: ventana de fijación vencida`,
        detail: `Venció el ${b.fixation_window_end} y todavía falta fijar ${missing.join(", ")}. Hay que fijar con el cierre de ventana.`,
        link: `/muestreo/${b.id}`,
      });
    } else if (daysLeft <= 5) {
      alerts.push({
        severity: "media",
        title: `Muestreo ${b.code}: ventana de fijación vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`,
        detail: `Vence el ${b.fixation_window_end}. Falta fijar ${missing.join(", ")}.`,
        link: `/muestreo/${b.id}`,
      });
    }
  }

  // 2. Pesaje oficial de compra muy distinto al pesaje inicial (posible error o merma real).
  const { data: purchaseLots } = await supabase
    .from("purchase_lots")
    .select("id, code, weighings(type, net_weight)")
    .in("status", ["pesado", "recibido_molino", "conminuido", "en_laboratorio", "valorizado"]);

  for (const lot of purchaseLots ?? []) {
    const weighings = Array.isArray(lot.weighings) ? lot.weighings : [];
    const inicial = weighings.find((w) => w.type === "inicial")?.net_weight;
    const oficial = weighings.find((w) => w.type === "oficial")?.net_weight;
    if (inicial == null || oficial == null || inicial === 0) continue;
    const diffPct = (Math.abs(oficial - inicial) / inicial) * 100;
    if (diffPct >= 2) {
      alerts.push({
        severity: diffPct >= 5 ? "alta" : "media",
        title: `Lote ${lot.code}: diferencia de peso guía vs. oficial (${diffPct.toFixed(1)}%)`,
        detail: `Peso inicial ${inicial} kg vs. oficial ${oficial} kg.`,
        link: `/lotes/${lot.id}`,
      });
    }
  }

  // 3. Lotes de venta despachados hace más de 10 días sin recepción confirmada en PY.
  const { data: dispatched } = await supabase
    .from("sale_lots")
    .select("id, code, dispatched_at")
    .not("dispatched_at", "is", null)
    .is("received_at_py", null);

  for (const lot of dispatched ?? []) {
    if (!lot.dispatched_at) continue;
    const daysSince = daysBetween(now, new Date(lot.dispatched_at));
    if (daysSince >= 10) {
      alerts.push({
        severity: daysSince >= 20 ? "alta" : "media",
        title: `Lote de venta ${lot.code}: despachado hace ${daysSince} días sin confirmar recepción en PY`,
        detail: `Despachado el ${new Date(lot.dispatched_at).toLocaleDateString("es-PE")}.`,
        link: `/ventas/${lot.id}`,
      });
    }
  }

  // 4. Liquidación de compra calculada pero sin pagar hace más de 15 días.
  const { data: unpaidSettlements } = await supabase
    .from("lot_settlements")
    .select("id, purchase_lot_id, created_at, purchase_lots(code)")
    .is("paid_at", null);

  for (const s of unpaidSettlements ?? []) {
    const daysSince = daysBetween(now, new Date(s.created_at));
    if (daysSince >= 15) {
      const lot = Array.isArray(s.purchase_lots) ? s.purchase_lots[0] : s.purchase_lots;
      alerts.push({
        severity: daysSince >= 30 ? "alta" : "media",
        title: `Lote ${lot?.code ?? s.purchase_lot_id}: liquidación calculada hace ${daysSince} días sin marcar como pagada`,
        detail: `Liquidación definitiva calculada el ${new Date(s.created_at).toLocaleDateString("es-PE")}.`,
        link: `/lotes/${s.purchase_lot_id}`,
      });
    }
  }

  // 5. Volquetes programados cuya fecha ya pasó sin actualizar el estado.
  const { data: overdueSchedule } = await supabase
    .from("truck_schedule")
    .select("id, scheduled_date, type, destination, providers(name)")
    .eq("status", "programado")
    .lt("scheduled_date", todayISO());

  for (const s of overdueSchedule ?? []) {
    const provider = Array.isArray(s.providers) ? s.providers[0] : s.providers;
    const label = s.type === "compra" ? (provider?.name ?? "compra") : (s.destination ?? "despacho");
    alerts.push({
      severity: "media",
      title: `Programación vencida sin actualizar: ${label} (${s.scheduled_date})`,
      detail: `Sigue en estado "programado" aunque la fecha ya pasó. Confirmá si se hizo o cancelala.`,
      link: `/calendario`,
    });
  }

  const severityRank = { alta: 0, media: 1 } as const;
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
