// Cálculo del "primera factura" / pago provisional al proveedor: prorrateo del valor
// pagable de cada metal usando el precio internacional del día, un % pagable inicial
// (normalmente 40%) y una ley ESTIMADA (no de laboratorio — un promedio histórico o
// acordado con el proveedor). La ley real de laboratorio llega después de la molienda,
// en la "segunda factura" / fijación final, que reliquida con la ley real y el %
// pagable definitivo del contrato.

const OZ_TO_GRAM = 31.1034768;

export type ProvisionalPriceInput = {
  tmh: number;
  payablePct: number; // % pagable inicial, ej. 40
  goldPriceUsdOz: number;
  silverPriceUsdOz: number;
  leadPriceUsdTon: number;
  goldGradeGT: number; // ley estimada de oro, g/t
  silverGradeGT: number; // ley estimada de plata, g/t
  leadGradePct: number; // ley estimada de plomo, %
};

export type ProvisionalPriceResult = {
  goldPricePerGram: number;
  silverPricePerGram: number;
  goldUsdPerTms: number;
  silverUsdPerTms: number;
  leadUsdPerTms: number;
  unitPriceUsdPerTms: number;
  totalUsd: number;
};

export function calcProvisionalPrice(input: ProvisionalPriceInput): ProvisionalPriceResult {
  const pct = input.payablePct / 100;
  const goldPricePerGram = input.goldPriceUsdOz / OZ_TO_GRAM;
  const silverPricePerGram = input.silverPriceUsdOz / OZ_TO_GRAM;

  const goldUsdPerTms = goldPricePerGram * pct * input.goldGradeGT;
  const silverUsdPerTms = silverPricePerGram * pct * input.silverGradeGT;
  const leadUsdPerTms = input.leadPriceUsdTon * pct * (input.leadGradePct / 100);

  const unitPriceUsdPerTms = goldUsdPerTms + silverUsdPerTms + leadUsdPerTms;

  return {
    goldPricePerGram,
    silverPricePerGram,
    goldUsdPerTms,
    silverUsdPerTms,
    leadUsdPerTms,
    unitPriceUsdPerTms,
    totalUsd: unitPriceUsdPerTms * input.tmh,
  };
}
