const MODEL = "gemini-3.6-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> }; thoughtSignature?: string }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

/**
 * Llama a la API de Gemini directamente por REST (sin SDK) — mismo enfoque
 * que ya usa `live-metal-prices.ts` para no depender de un paquete externo
 * cuya forma exacta no podemos verificar en este entorno.
 */
export async function generateContent(params: {
  contents: GeminiContent[];
  systemInstruction: string;
  tools: GeminiFunctionDeclaration[];
}): Promise<{
  text: string | null;
  functionCalls: { name: string; args: Record<string, unknown> }[];
  modelParts: GeminiPart[];
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY en .env.local. Conseguí una key gratis en aistudio.google.com y pegala ahí.",
    );
  }

  const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: params.contents,
      systemInstruction: { parts: [{ text: params.systemInstruction }] },
      tools: params.tools.length > 0 ? [{ functionDeclarations: params.tools }] : undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini respondió ${res.status}: ${body.slice(0, 500)}`);
  }

  const json = await res.json();
  const candidate = json.candidates?.[0];
  // Se reenvía tal cual (incluyendo thoughtSignature) — Gemini 3 exige la
  // firma exacta de vuelta en el siguiente turno o rechaza la llamada.
  const modelParts: GeminiPart[] = candidate?.content?.parts ?? [];

  const text = modelParts
    .filter((p): p is { text: string } => "text" in p)
    .map((p) => p.text)
    .join("")
    .trim();

  const functionCalls = modelParts
    .filter((p): p is { functionCall: { name: string; args: Record<string, unknown> } } => "functionCall" in p)
    .map((p) => p.functionCall);

  return { text: text || null, functionCalls, modelParts };
}

/**
 * Llamada de un solo turno para leer un documento (foto o PDF de un ticket de
 * balanza) y devolver campos estructurados — sin tools ni historial, solo
 * imagen + esquema de salida. Separado de `generateContent` (que arma el chat
 * del asistente) porque acá no hace falta esa maquinaria, solo extracción.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Errores por sobrecarga transitoria del lado de Gemini (503 "modelo con
// demanda alta", 429 rate limit) — no tienen que ver con el ticket en sí, y
// suelen resolverse solos en unos segundos. Se reintenta antes de rendirse.
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAYS_MS = [1500, 3500];

export async function extractFromDocument<T>(params: {
  prompt: string;
  base64Data: string;
  mimeType: string;
  responseSchema: Record<string, unknown>;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY en .env.local. Conseguí una key gratis en aistudio.google.com y pegala ahí.",
    );
  }

  let lastStatus = 0;
  let lastBody = "";
  let json: { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: params.prompt }, { inlineData: { mimeType: params.mimeType, data: params.base64Data } }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: params.responseSchema,
        },
      }),
    });

    if (res.ok) {
      json = await res.json();
      break;
    }

    lastStatus = res.status;
    lastBody = await res.text().catch(() => "");
    if (!RETRYABLE_STATUS.has(res.status) || attempt === RETRY_DELAYS_MS.length) break;
    await sleep(RETRY_DELAYS_MS[attempt]);
  }

  if (!json) {
    if (RETRYABLE_STATUS.has(lastStatus)) {
      throw new Error("Gemini está saturado en este momento (probá de nuevo en un rato, o cargá los datos a mano).");
    }
    throw new Error(`Gemini respondió ${lastStatus}: ${lastBody.slice(0, 500)}`);
  }

  const text: string | undefined = json.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
  if (!text) throw new Error("Gemini no devolvió resultado.");
  return JSON.parse(text) as T;
}
