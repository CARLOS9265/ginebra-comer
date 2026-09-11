// Correlativo de código de lote de compra: único para toda la empresa (no se
// diferencia por proveedor) — a pedido del usuario. Se guarda en
// lot_code_counters/next_lot_seq bajo este mismo "provider_code" fijo para
// que todos los lotes, sin importar el proveedor, compartan una sola
// secuencia por año.
export const LOT_CODE_PREFIX = "GINE";

export function buildLotCode(year: number, seq: number): string {
  return `${LOT_CODE_PREFIX}-${String(year).slice(-2)}-${String(seq).padStart(2, "0")}`;
}
