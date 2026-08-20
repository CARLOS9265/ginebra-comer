-- Guarda los precios de metales usados en la proyección (antes solo se guardaba el
-- resultado), para poder precargarlos al editar un lote.

alter table public.purchase_lots
  add column estimated_price_ag numeric(12, 4),
  add column estimated_price_au numeric(12, 4),
  add column estimated_price_pb numeric(12, 4);
