-- Costo del flete de Huanchaco a Lima (despacho a PY) — no se estaba registrando
-- en ningún lado, el usuario confirmó la tarifa real: S/ 135 por TMH, IGV incluido.
-- Mismo criterio que transport_events.tariff_pen_per_tmh y
-- comminutions.tariff_pen_per_ton: una tarifa por TMH con default, editable por
-- despacho si algún viaje sale distinto.

alter table public.sale_lots
  add column freight_tariff_pen_per_tmh numeric(10, 2) default 135;
