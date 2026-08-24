"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { generateContent, type GeminiContent, type GeminiPart } from "@/lib/assistant/gemini";
import { TOOL_DECLARATIONS, runTool } from "@/lib/assistant/tools";

export type ChatMessage = { role: "user" | "model"; text: string };

const SYSTEM_INSTRUCTION = `Sos el asistente interno de Ginebra ERP, el sistema de trazabilidad de compra y venta
de mineral (oro, plata, plomo) de la empresa Ginebra (Perú).

Cómo funciona el negocio, en resumen:
- Fase 1 (compra): se compra mineral a proveedores mineros, se transporta, se pesa, se recibe y muele en
  planta, se genera big bags, se analiza en laboratorio (ley real Au/Ag/Pb), y se liquida el pago definitivo
  al proveedor (lot_settlements) restando costos y un margen objetivo del valor que pagaría PY.
- Fase 2 (venta a PY): se arman lotes de venta juntando big bags (de uno o varios lotes de compra), se
  despachan a Lima, se reciben en PY, y varios lotes de venta se agrupan en un solo "muestreo conjunto"
  (py_sample_batches) porque ahí se mezclan físicamente. Ese muestreo tiene un ensaye provisional (rápido,
  paga el 90% del valor estimado) y un ensaye final (laboratorio internacional conjunto), con precios de
  metal que se "fijan" uno por uno dentro de una ventana de 30 días desde la entrega.
- Márgenes: se cruza lo pagado al proveedor contra lo cobrado a PY, prorrateado por peso a través de los
  big bags — un lote de compra puede terminar repartido en varios lotes de venta, y viceversa.

Tenés herramientas de solo lectura para consultar la base de datos real. Usalas en vez de inventar datos —
si no tenés la información, decilo. Nunca inventes números.

Para recomendaciones de cuándo fijar precio de un metal: consultá el detalle del muestreo (ventana de
fijación, si ya hay metales fijados) y el historial de precios recientes, mirá la tendencia, y sugerí fijar
pronto si el precio está favorable y bajando, o esperar (sin pasarse de la fecha límite) si está subiendo.
Siempre aclará que es una lectura de tendencia simple, no una predicción garantizada, y recordá la fecha
límite de la ventana.

Para alertas o "qué hay pendiente/urgente": usá la herramienta de alertas y resumilas priorizando severidad
alta primero.

Respondé siempre en español, de forma directa y concisa (Carlos, el dueño, no es técnico — nada de jerga de
programación ni de base de datos). Usá números concretos cuando los tengas. No uses markdown pesado, texto
plano con algún guion está bien.`;

function toGeminiContents(history: ChatMessage[]): GeminiContent[] {
  return history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

export async function sendMessage(
  history: ChatMessage[],
  message: string,
): Promise<{ history: ChatMessage[]; error?: string }> {
  const { profile } = await getCurrentUser();
  if (!profile || !profile.active) {
    return { history, error: "Tu usuario no está activo todavía." };
  }
  if (!message.trim()) return { history };

  const supabase = await createClient();
  const contents: GeminiContent[] = [...toGeminiContents(history), { role: "user", parts: [{ text: message }] }];

  let iterations = 0;
  while (iterations < 6) {
    iterations++;

    let result;
    try {
      result = await generateContent({
        contents,
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: TOOL_DECLARATIONS,
      });
    } catch (e) {
      return { history, error: e instanceof Error ? e.message : "Error llamando al asistente." };
    }

    if (result.functionCalls.length === 0) {
      const text = result.text ?? "No obtuve respuesta del asistente.";
      return { history: [...history, { role: "user", text: message }, { role: "model", text }] };
    }

    contents.push({ role: "model", parts: result.modelParts });

    const responses: GeminiPart[] = [];
    for (const fc of result.functionCalls) {
      const output = await runTool(supabase, fc.name, fc.args);
      responses.push({ functionResponse: { name: fc.name, response: { result: output } } });
    }
    contents.push({ role: "user", parts: responses });
  }

  return { history, error: "El asistente hizo demasiadas consultas sin llegar a una respuesta. Probá reformular." };
}
