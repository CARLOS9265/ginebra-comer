-- Permite 4 decimales en toneladas procesadas (molino) — antes solo
-- guardaba 2, que redondeaba silenciosamente cualquier precisión extra
-- que el operador cargara.
alter table public.comminutions
  alter column processed_tons type numeric(12, 4);
