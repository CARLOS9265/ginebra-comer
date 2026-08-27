// La red de esta máquina a veces tarda muchísimo (30s a varios minutos) en llegar a
// Supabase — el mismo tipo de problema que ya se vio con fetch() hacia inversoro.es.
// Sin esto, una consulta colgada deja la pantalla cargando indefinidamente. Con un
// límite de tiempo, en vez de colgarse falla rápido y se puede reintentar.
const TIMEOUT_MS = 15_000;

export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}
