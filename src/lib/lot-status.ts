export const LOT_STATUS_ORDER = [
  "creado",
  "en_transito",
  "pesado",
  "recibido_molino",
  "conminuido",
  "en_laboratorio",
  "valorizado",
  "en_almacen",
  "cerrado",
] as const;

export type LotStatus = (typeof LOT_STATUS_ORDER)[number];

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  creado: "Creado",
  en_transito: "En tránsito",
  pesado: "Pesado",
  recibido_molino: "Recibido en molino",
  conminuido: "Conminuido",
  en_laboratorio: "En laboratorio",
  valorizado: "Valorizado",
  en_almacen: "En almacén",
  cerrado: "Cerrado",
};
