const OZ_PER_TM = 31.1034768;

// Cláusula 8.1 (versión final del contrato, 01/09/2026): la ventana de
// fijación es el mes siguiente a la semana de entrega ("M+1") — desde el lunes
// de la semana siguiente a la entrega hasta el mismo día del mes siguiente. (La
// versión anterior decía "30 días calendario".)
export function computeFixationWindow(deliveryDate: Date): { start: string; end: string } {
  const d = new Date(deliveryDate);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday); // lunes de la semana de entrega
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 7); // M+1: lunes de la semana siguiente
  const start = new Date(d);
  const end = new Date(d);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export type ContractSettings = {
  tipo_cambio: number;
  merma_pct: number;
  ag_banda: number; // 900: hasta acá se paga ag_pagable_bajo
  ag_banda_2: number; // 1,200: hasta acá ag_pagable_alto
  ag_banda_3: number; // 1,500: hasta acá ag_pagable_3; por encima ag_pagable_4
  ag_techo: number | null; // null = la plata no tiene tope (contrato del 01/09/2026)
  ag_pagable_bajo: number;
  ag_pagable_alto: number;
  ag_pagable_3: number;
  ag_pagable_4: number;
  au_banda: number;
  au_techo: number;
  au_pagable_bajo: number;
  au_pagable_alto: number;
  pb_descuento: number;
  pb_pagable_pct: number;
  ganancia_objetivo_usd: number;
  reserva_riesgo_usd: number;
  adelanto_py_pct: number;
  adelanto_proveedor_pct: number;
  costo_transporte_pen_tmh: number;
  costo_conminucion_pen_tmh: number;
  costo_seguridad_pen_tmh: number;
};

export type LotEstimateInput = {
  tmh: number;
  ag: number;
  au: number;
  pb: number;
  humidity: number;
  precioAg: number;
  precioAu: number;
  precioPb: number;
  precioProvisionalPorTonelada: number;
};

export type LotEstimate = {
  agRecortado: boolean;
  auRecortado: boolean;
  agPagablePct: number;
  auPagablePct: number;
  pbPagableFactor: number;
  valorPYxTMH: number;
  valorPYTotal: number;
  valorBrutoxTMH: number;
  costosXTMH: number;
  precioMaximoCompra: number;
  precioMaximoCompraTotal: number;
  margenXTMH: number;
  margenTotal: number;
  requiereAprobacion: boolean;
};

/** Ninguno de los campos numéricos puede faltar para poder proyectar el lote. */
export function canEstimate(input: Partial<LotEstimateInput>): input is LotEstimateInput {
  return (
    !!input.tmh &&
    input.ag != null &&
    input.au != null &&
    input.pb != null &&
    input.humidity != null &&
    !!input.precioAg &&
    !!input.precioAu &&
    !!input.precioPb
  );
}

export function estimateLot(input: LotEstimateInput, cfg: ContractSettings): LotEstimate {
  const { tmh, ag, au, pb, humidity, precioAg, precioAu, precioPb, precioProvisionalPorTonelada } =
    input;

  let agVal = ag;
  let auVal = au;
  const agRecortado = cfg.ag_techo != null && ag > cfg.ag_techo;
  const auRecortado = au > cfg.au_techo;
  if (agRecortado) agVal = cfg.ag_techo!;
  if (auRecortado) auVal = cfg.au_techo;

  // Cláusula 4.1: cada tramo es "mayor que" su límite inferior y "menor o
  // igual" al superior — o sea, una ley exactamente en el límite (900, 1,200,
  // 1,500 g/t de plata; 6 g/t de oro) cae en el tramo de ABAJO. Por debajo del
  // primer tramo el contrato no define pagable (ensaye fuera de calidad, se
  // negocia): se aplica el tramo más bajo.
  const agPagablePct =
    agVal > cfg.ag_banda_3
      ? cfg.ag_pagable_4
      : agVal > cfg.ag_banda_2
        ? cfg.ag_pagable_3
        : agVal > cfg.ag_banda
          ? cfg.ag_pagable_alto
          : cfg.ag_pagable_bajo;
  const auPagablePct = auVal > cfg.au_banda ? cfg.au_pagable_alto : cfg.au_pagable_bajo;
  const pbPagablePct = Math.max(pb - cfg.pb_descuento, 0) * (cfg.pb_pagable_pct / 100);

  const agOzTMS = agVal / OZ_PER_TM;
  const auOzTMS = auVal / OZ_PER_TM;

  const valorAgTMS = agOzTMS * (agPagablePct / 100) * precioAg;
  const valorAuTMS = auOzTMS * (auPagablePct / 100) * precioAu;
  const valorPbTMS = (pbPagablePct / 100) * precioPb;
  const valorPYTMS = valorAgTMS + valorAuTMS + valorPbTMS;
  const valorPYxTMH = valorPYTMS * (1 - humidity / 100) * (1 - cfg.merma_pct / 100);

  const valorBrutoTMS = (ag / OZ_PER_TM) * precioAg + (au / OZ_PER_TM) * precioAu + (pb / 100) * precioPb;
  const valorBrutoxTMH = valorBrutoTMS * (1 - humidity / 100);

  const costosXTMH =
    (cfg.costo_transporte_pen_tmh + cfg.costo_conminucion_pen_tmh + cfg.costo_seguridad_pen_tmh) /
    cfg.tipo_cambio;

  const precioMaximoCompra =
    valorPYxTMH - costosXTMH - cfg.ganancia_objetivo_usd - cfg.reserva_riesgo_usd;

  const margenXTMH = valorPYxTMH - costosXTMH - precioProvisionalPorTonelada;

  return {
    agRecortado,
    auRecortado,
    agPagablePct,
    auPagablePct,
    pbPagableFactor: pbPagablePct,
    valorPYxTMH,
    valorPYTotal: valorPYxTMH * tmh,
    valorBrutoxTMH,
    costosXTMH,
    precioMaximoCompra,
    precioMaximoCompraTotal: precioMaximoCompra * tmh,
    margenXTMH,
    margenTotal: margenXTMH * tmh,
    requiereAprobacion: precioProvisionalPorTonelada > precioMaximoCompra,
  };
}
