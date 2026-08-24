const MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
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
}): Promise<{ text: string | null; functionCalls: { name: string; args: Record<string, unknown> }[] }> {
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
  const parts: GeminiPart[] = candidate?.content?.parts ?? [];

  const text = parts
    .filter((p): p is { text: string } => "text" in p)
    .map((p) => p.text)
    .join("")
    .trim();

  const functionCalls = parts
    .filter((p): p is { functionCall: { name: string; args: Record<string, unknown> } } => "functionCall" in p)
    .map((p) => p.functionCall);

  return { text: text || null, functionCalls };
}
