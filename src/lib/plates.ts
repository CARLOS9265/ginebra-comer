import { CARRIERS } from "./carriers";

// Placas conocidas y a qué transportista pertenece cada una — para que al elegir la
// placa se autocomplete el transportista en vez de tener que elegirlo aparte. Lista
// fija y corta a propósito, mismo criterio que carriers.ts; agregar una placa nueva
// es sumar una línea acá.
export const PLATE_CARRIERS: Record<string, (typeof CARRIERS)[number]> = {
  "THD-901": "Jose Miguel Rodriguez",
  "CCB-928": "Jose Miguel Rodriguez",
  "D4L-916": "Jose Miguel Rodriguez",
  "TCJ-838": "Jose Miguel Rodriguez",
};

export const KNOWN_PLATES = Object.keys(PLATE_CARRIERS);

export function carrierForPlate(plate: string): string | null {
  return PLATE_CARRIERS[plate.trim().toUpperCase()] ?? null;
}
