import type { createClient } from "@/lib/supabase/server";
import type { GeminiFunctionDeclaration } from "./gemini";
import { computeMargins } from "@/lib/margins";
import { computeAlerts } from "./alerts";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: "buscar_lotes_compra",
    description:
      "Busca lotes de compra (mineral comprado a proveedores). Devuelve una lista resumida: código, proveedor, estado, peso estimado y si ya tiene liquidación definitiva.",
    parameters: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Código de lote o nombre/código de proveedor, búsqueda parcial." },
        estado: {
          type: "string",
          description:
            "Filtra por estado exacto: creado, en_transito, pesado, recibido_molino, conminuido, en_laboratorio, valorizado, en_almacen, cerrado.",
        },
        limite: { type: "number", description: "Máximo de resultados, default 20." },
      },
    },
  },
  {
    name: "detalle_lote_compra",
    description:
      "Trae el detalle completo de un lote de compra por su código: transporte, pesajes, recepción en molino, cantidad de bolsones generados, análisis de laboratorio y liquidación definitiva si existe.",
    parameters: {
      type: "object",
      properties: { codigo: { type: "string", description: "Código del lote, ej. BUS-26-01" } },
      required: ["codigo"],
    },
  },
  {
    name: "buscar_lotes_venta",
    description:
      "Busca lotes de venta a PY. Devuelve código, estado, cantidad de bolsones incluidos, si fue despachado/recibido/muestreado.",
    parameters: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Código de lote de venta, búsqueda parcial." },
        estado: {
          type: "string",
          description: "Filtra por estado exacto: armado, despachado, recibido_py, muestreado, liquidado_provisional, liquidado_final.",
        },
        limite: { type: "number", description: "Máximo de resultados, default 20." },
      },
    },
  },
  {
    name: "detalle_lote_venta",
    description:
      "Trae el detalle completo de un lote de venta por su código: cuántos bolsones aporta cada lote de compra, despacho, recepción en PY (con peso oficial), y a qué muestreo conjunto pertenece si ya fue agrupado.",
    parameters: {
      type: "object",
      properties: { codigo: { type: "string", description: "Código del lote de venta, ej. VTA-26-01" } },
      required: ["codigo"],
    },
  },
  {
    name: "buscar_muestreos",
    description:
      "Busca muestreos: se crean en Huanchaco agrupando lotes de COMPRA para el ensaye/liquidación provisional, y más tarde también agrupan los lotes de VENTA (una vez despachados y recibidos en Lima) para el ensaye/liquidación final. Devuelve código, cuántos lotes de cada lado agrupa, y estado de la liquidación.",
    parameters: {
      type: "object",
      properties: { limite: { type: "number", description: "Máximo de resultados, default 20." } },
    },
  },
  {
    name: "detalle_muestreo",
    description:
      "Trae el detalle completo de un muestreo por código: lotes de compra agrupados en Huanchaco (provisional) y lotes de venta agrupados en Lima (final, se van sumando a medida que se despachan y reciben), ensaye provisional y final, liquidación provisional (90%) y final, ventana de fijación de precio y qué metales ya están fijados.",
    parameters: {
      type: "object",
      properties: { codigo: { type: "string", description: "Código del muestreo, ej. MUE-26-01" } },
      required: ["codigo"],
    },
  },
  {
    name: "precios_metales_recientes",
    description: "Devuelve los precios diarios de oro/plata/plomo cargados en el sistema, más recientes primero.",
    parameters: {
      type: "object",
      properties: { dias: { type: "number", description: "Cuántos días de historial traer, default 10." } },
    },
  },
  {
    name: "resumen_margenes",
    description:
      "Devuelve el margen (ingreso de PY menos costo al proveedor) agregado por lote de compra y por lote de venta, más el margen total de la operación. Solo cuenta lotes con liquidación definitiva de ambos lados.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "calendario_proximo",
    description: "Devuelve la programación de volquetes (llegadas de compra o despachos a PY) próxima.",
    parameters: {
      type: "object",
      properties: { dias: { type: "number", description: "Cuántos días hacia adelante mirar, default 14." } },
    },
  },
  {
    name: "alertas_actuales",
    description:
      "Devuelve alertas automáticas sobre el estado del negocio: ventanas de fijación de precio por vencer o vencidas, diferencias de peso entre guía/oficial, despachos sin confirmar recepción, liquidaciones sin pagar, y programación vencida sin actualizar.",
    parameters: { type: "object", properties: {} },
  },
];

function arr<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export async function runTool(
  supabase: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "buscar_lotes_compra": {
      const limite = Math.min(Number(args.limite) || 20, 50);
      let q = supabase
        .from("purchase_lots")
        .select("id, code, status, estimated_weight_tmh, loaded_at, providers(name, code), lot_settlements(precio_definitivo_total)")
        .order("created_at", { ascending: false })
        .limit(limite);
      if (typeof args.estado === "string" && args.estado) q = q.eq("status", args.estado);
      if (typeof args.texto === "string" && args.texto) q = q.ilike("code", `%${args.texto}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return (data ?? []).map((l) => {
        const provider = arr(l.providers)[0];
        const settlements = arr(l.lot_settlements);
        return {
          codigo: l.code,
          proveedor: provider?.name ?? null,
          estado: l.status,
          peso_estimado_tmh: l.estimated_weight_tmh,
          cargado: l.loaded_at,
          tiene_liquidacion_definitiva: settlements.some((s) => s.precio_definitivo_total != null),
        };
      });
    }

    case "detalle_lote_compra": {
      const codigo = String(args.codigo ?? "");
      const { data: lot } = await supabase
        .from("purchase_lots")
        .select(
          "id, code, status, estimated_weight_tmh, loaded_at, truck_plate, carrier_name, providers(name, code), transport_events(departed_at, carrier_name, incidents), weighings(type, net_weight, weighed_at, reason), mill_receptions(received_at, incidents), comminutions(bag_count), lab_analyses(au_gt, ag_gt, pb_pct, humidity_pct, lab_name), lot_settlements(precio_definitivo_total, precio_definitivo_per_tmh, saldo_pendiente, paid_at)",
        )
        .eq("code", codigo)
        .maybeSingle();
      if (!lot) return { error: `No se encontró el lote de compra "${codigo}".` };
      return { ...lot, providers: arr(lot.providers)[0] };
    }

    case "buscar_lotes_venta": {
      const limite = Math.min(Number(args.limite) || 20, 50);
      let q = supabase
        .from("sale_lots")
        .select(
          "id, code, status, dispatched_at, received_at_py, py_official_weight_kg, sample_batch_id, sale_lot_allocations(bag_count)",
        )
        .order("created_at", { ascending: false })
        .limit(limite);
      if (typeof args.estado === "string" && args.estado) q = q.eq("status", args.estado);
      if (typeof args.texto === "string" && args.texto) q = q.ilike("code", `%${args.texto}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return (data ?? []).map((l) => ({
        codigo: l.code,
        estado: l.status,
        cantidad_bolsones: arr(l.sale_lot_allocations).reduce((s, a) => s + (a.bag_count ?? 0), 0),
        peso_oficial_py_kg: l.py_official_weight_kg,
        despachado: l.dispatched_at,
        recibido_en_py: l.received_at_py,
        tiene_muestreo: l.sample_batch_id != null,
      }));
    }

    case "detalle_lote_venta": {
      const codigo = String(args.codigo ?? "");
      const { data: lot } = await supabase
        .from("sale_lots")
        .select(
          "id, code, status, dispatched_at, dispatch_carrier, dispatch_truck_plate, received_at_py, py_warehouse, py_official_weight_kg, sample_batch_id, py_sample_batches(code), sale_lot_allocations(bag_count, purchase_lots(code))",
        )
        .eq("code", codigo)
        .maybeSingle();
      if (!lot) return { error: `No se encontró el lote de venta "${codigo}".` };
      const allocations = arr(lot.sale_lot_allocations).map((a) => ({
        cantidad_bolsones: a.bag_count,
        lote_de_compra: arr(a.purchase_lots)[0]?.code ?? null,
      }));
      return {
        codigo: lot.code,
        estado: lot.status,
        despachado: lot.dispatched_at,
        transportista_despacho: lot.dispatch_carrier,
        placa: lot.dispatch_truck_plate,
        recibido_en_py: lot.received_at_py,
        almacen_py: lot.py_warehouse,
        peso_oficial_py_kg: lot.py_official_weight_kg,
        muestreo: arr(lot.py_sample_batches)[0]?.code ?? null,
        bolsones_por_lote_de_compra: allocations,
        cantidad_bolsones_total: allocations.reduce((s, a) => s + (a.cantidad_bolsones ?? 0), 0),
      };
    }

    case "buscar_muestreos": {
      const limite = Math.min(Number(args.limite) || 20, 50);
      const { data, error } = await supabase
        .from("py_sample_batches")
        .select(
          "id, code, created_at, prov_au_gt, prov_value_total, final_value_total, purchase_lots(id), sale_lots(id)",
        )
        .order("created_at", { ascending: false })
        .limit(limite);
      if (error) return { error: error.message };
      return (data ?? []).map((b) => ({
        codigo: b.code,
        creado: b.created_at,
        lotes_de_compra_agrupados: arr(b.purchase_lots).length,
        lotes_de_venta_despachados: arr(b.sale_lots).length,
        estado: b.final_value_total != null ? "liquidado_final" : b.prov_value_total != null ? "liquidado_provisional" : b.prov_au_gt != null ? "con_ensaye_provisional" : "pendiente",
      }));
    }

    case "detalle_muestreo": {
      const codigo = String(args.codigo ?? "");
      const { data: batch } = await supabase.from("py_sample_batches").select("*").eq("code", codigo).maybeSingle();
      if (!batch) return { error: `No se encontró el muestreo "${codigo}".` };
      const [{ data: purchaseLots }, { data: saleLots }] = await Promise.all([
        supabase.from("purchase_lots").select("code").eq("sample_batch_id", batch.id),
        supabase.from("sale_lots").select("code").eq("sample_batch_id", batch.id),
      ]);
      return {
        codigo: batch.code,
        lotes_de_compra_provisional: (purchaseLots ?? []).map((l) => l.code),
        lotes_de_venta_final: (saleLots ?? []).map((l) => l.code),
        ensaye_provisional: {
          au_gt: batch.prov_au_gt,
          ag_gt: batch.prov_ag_gt,
          pb_pct: batch.prov_pb_pct,
          laboratorio: batch.prov_lab_name,
        },
        liquidacion_provisional: {
          valor_por_tmh: batch.prov_value_per_tmh,
          valor_total: batch.prov_value_total,
          pago_90pct: batch.prov_payment_total,
          pagado: batch.prov_paid_at,
        },
        ensaye_final: {
          au_gt: batch.final_au_gt,
          ag_gt: batch.final_ag_gt,
          pb_pct: batch.final_pb_pct,
          laboratorio: batch.final_lab_name,
        },
        ventana_fijacion: { inicio: batch.fixation_window_start, fin: batch.fixation_window_end },
        fijaciones: {
          oro: { fecha: batch.au_fixed_at, precio: batch.au_fixed_price },
          plata: { fecha: batch.ag_fixed_at, precio: batch.ag_fixed_price },
          plomo: { fecha: batch.pb_fixed_at, precio: batch.pb_fixed_price },
        },
        liquidacion_final: {
          valor_por_tmh: batch.final_value_per_tmh,
          valor_total: batch.final_value_total,
          saldo: batch.final_balance_total,
          pagado: batch.final_paid_at,
        },
      };
    }

    case "precios_metales_recientes": {
      const dias = Math.min(Number(args.dias) || 10, 60);
      const { data, error } = await supabase
        .from("daily_metal_prices")
        .select("price_date, gold_usd_oz, silver_usd_oz, lead_usd_ton")
        .order("price_date", { ascending: false })
        .limit(dias);
      if (error) return { error: error.message };
      return data;
    }

    case "resumen_margenes": {
      const result = await computeMargins(supabase);
      return {
        margen_total_usd: result.totalMargin,
        por_lote_de_compra: result.byPurchaseLot.map(([, v]) => ({
          codigo: v.code,
          cantidad_bolsones: v.totalBags,
          bolsones_pendientes: v.pendingBags,
          costo_de_compra_usd: v.hasComplete ? v.costoCompra : null,
          gastos_operativos_usd: v.hasComplete ? v.gastosOperativos : null,
          precio_de_venta_usd: v.hasComplete ? v.precioVenta : null,
          margen_usd: v.hasComplete ? v.margin : null,
        })),
        por_lote_de_venta: result.bySaleLot.map(([, v]) => ({
          codigo: v.code,
          cantidad_bolsones: v.totalBags,
          bolsones_pendientes: v.pendingBags,
          costo_de_compra_usd: v.hasComplete ? v.costoCompra : null,
          gastos_operativos_usd: v.hasComplete ? v.gastosOperativos : null,
          precio_de_venta_usd: v.hasComplete ? v.precioVenta : null,
          margen_usd: v.hasComplete ? v.margin : null,
        })),
      };
    }

    case "calendario_proximo": {
      const dias = Math.min(Number(args.dias) || 14, 90);
      const today = new Date().toISOString().slice(0, 10);
      const until = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("truck_schedule")
        .select("scheduled_date, scheduled_time, type, status, destination, providers(name)")
        .gte("scheduled_date", today)
        .lte("scheduled_date", until)
        .order("scheduled_date", { ascending: true });
      if (error) return { error: error.message };
      return (data ?? []).map((s) => ({
        fecha: s.scheduled_date,
        hora: s.scheduled_time,
        tipo: s.type,
        estado: s.status,
        proveedor_o_destino: s.type === "compra" ? (arr(s.providers)[0]?.name ?? null) : s.destination,
      }));
    }

    case "alertas_actuales": {
      const alerts = await computeAlerts(supabase);
      return alerts;
    }

    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}
