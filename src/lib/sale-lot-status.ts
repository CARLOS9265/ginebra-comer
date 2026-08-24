export const SALE_LOT_STATUS_ORDER = [
  "armado",
  "despachado",
  "recibido_py",
  "muestreado",
  "liquidado_provisional",
  "liquidado_final",
] as const;

export type SaleLotStatus = (typeof SALE_LOT_STATUS_ORDER)[number];

export const SALE_LOT_STATUS_LABELS: Record<SaleLotStatus, string> = {
  armado: "Armado",
  despachado: "Despachado",
  recibido_py: "Recibido en PY",
  muestreado: "Muestreado",
  liquidado_provisional: "Liquidado (provisional)",
  liquidado_final: "Liquidado (final)",
};

export const BIG_BAG_STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  despachado: "Despachado",
  recibido_py: "Recibido en PY",
  liquidado: "Liquidado",
};
