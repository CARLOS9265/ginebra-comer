-- Fecha de fijación de precio: el día al que corresponde el valor de mercado
-- (oro/plata/plomo) fijado para el pago provisional del lote. Los valores en
-- sí ya se guardaban en estimated_price_au/ag/pb (0004_lot_edit_support.sql);
-- lo que faltaba era guardar A QUÉ FECHA corresponden — antes el selector de
-- fecha del formulario era solo una ayuda y la fecha se perdía al guardar.
alter table public.purchase_lots
  add column price_fixing_date date;
