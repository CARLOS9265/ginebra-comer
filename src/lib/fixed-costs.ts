// Costos fijos del transporte de mineral de mina a Trujillo (compra). No se
// cargan a mano en cada lote (a pedido del usuario): se aplican solos al
// registrar la salida del lote y quedan guardados en transport_events, de
// donde /margenes los toma como parte del gasto operativo. Si algún día
// cambian, se edita acá — afecta a los registros de transporte NUEVOS; los ya
// guardados conservan el monto con el que se registraron.
export const TRANSPORT_TARIFF_PEN_PER_TMH = 212;
export const TRANSPORT_SECURITY_COST_PEN = 1350;
