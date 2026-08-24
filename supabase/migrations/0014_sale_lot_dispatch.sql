-- Despacho del lote de venta + recepción en PY. Evento único por lote de
-- venta (como recepción en molino del lado de compra), no una tabla de
-- eventos aparte — más simple, y un lote de venta ya representa un solo
-- despacho/camión.

alter table public.sale_lots
  add column dispatched_at timestamptz,
  add column dispatch_carrier text,
  add column dispatch_truck_plate text,
  add column received_at_py timestamptz,
  add column py_warehouse text,
  add column py_received_by text;
