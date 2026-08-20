// Precio spot de oro y plata en vivo, leído de la misma página que se usaba a mano
// (inversoro.es). La página carga el precio vía una llamada JSON a su propio backend;
// replicamos esa llamada acá. Si el sitio cambia o falla, esto devuelve null y quien
// llama debe mostrar el último precio guardado a mano como respaldo.
//
// Nota técnica: el sitio bloquea el fetch() nativo de Node (por huella TLS), pero no
// bloquea curl. Por eso acá se invoca el binario curl del sistema en vez de fetch().
// Si en algún momento se despliega en un entorno sin curl disponible (por ejemplo
// algunos runtimes serverless), esto va a fallar de forma silenciosa (error) y hay que
// revisar esta parte.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SOURCE_PAGE = "https://www.inversoro.es/precio-de-la-plata/precio-internacional-plata/";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const CACHE_TTL_MS = 45_000;

export type LiveMetalPrices = {
  gold: number | null;
  silver: number | null;
  fetchedAt: string | null;
  error?: string;
};

let cache: { data: LiveMetalPrices; expiresAt: number } | null = null;

async function curlGet(url: string): Promise<string> {
  const { stdout } = await execFileAsync("curl", ["-s", "-A", USER_AGENT, url], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 10_000,
  });
  return stdout;
}

async function extractPriceToken(): Promise<string | null> {
  const html = await curlGet(SOURCE_PAGE);
  const match = html.match(/price_update_token\s*=\s*"([a-zA-Z0-9]+)"/);
  return match ? match[1] : null;
}

async function fetchSpot(token: string, code: "XAU" | "XAG"): Promise<number | null> {
  const url = `https://www.inversoro.es/charts/data/${token}/?period=today&xignite_code=${code}&currency=USD&weight_unit=ounces`;
  const raw = await curlGet(url);
  const json = JSON.parse(raw);
  const price = Number(json?.data?.current_price);
  return Number.isFinite(price) ? price : null;
}

/** Precio spot de oro y plata (USD/oz), cacheado un rato corto para no golpear la fuente en cada carga de página. */
export async function getLiveGoldSilver(): Promise<LiveMetalPrices> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  try {
    const token = await extractPriceToken();
    if (!token) {
      return { gold: null, silver: null, fetchedAt: null, error: "No se pudo leer la página de precios." };
    }
    const [gold, silver] = await Promise.all([fetchSpot(token, "XAU"), fetchSpot(token, "XAG")]);
    const data: LiveMetalPrices = { gold, silver, fetchedAt: new Date().toISOString() };
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  } catch (err) {
    return {
      gold: null,
      silver: null,
      fetchedAt: null,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}
