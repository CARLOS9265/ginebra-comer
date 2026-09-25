-- Contrato PYCP-202656, versión final del 01/09/2026 — cláusula 4.1 (pagables).
--
-- Plata (contenido final, g/t; cada tramo es "mayor que" el límite inferior y
-- "menor o igual" al superior):
--   500 – 900       -> 72.5 %   (ag_pagable_bajo)
--   900 – 1,200     -> 74.5 %   (ag_pagable_alto)
--   1,200 – 1,500   -> 76.5 %   (ag_pagable_3)   <- nuevo
--   más de 1,500    -> 77.5 %   (ag_pagable_4)   <- nuevo
-- Oro (g/t): 4 – 6 -> 68.5 %; 6 – 8 -> 70.5 %   (sin cambios)
-- Plomo: se paga 60 % del contenido tras deducir 3.5 puntos  (sin cambios)
--
-- El contrato anterior limitaba la plata a 1,100 g/t (ag_techo); la versión
-- final ya no tiene tope de plata (el último tramo es abierto), así que el
-- techo pasa a NULL = sin tope. El techo de oro (8 g/t) se mantiene: por
-- encima de 8 g/t el contrato dice que las partes lo acuerdan caso por caso.

alter table public.contract_settings
  add column ag_banda_2 numeric(10, 2) not null default 1200,
  add column ag_banda_3 numeric(10, 2) not null default 1500,
  add column ag_pagable_3 numeric(6, 2) not null default 76.5,
  add column ag_pagable_4 numeric(6, 2) not null default 77.5;

alter table public.contract_settings
  alter column ag_techo drop not null;

update public.contract_settings
  set ag_banda = 900,
      ag_banda_2 = 1200,
      ag_banda_3 = 1500,
      ag_pagable_bajo = 72.5,
      ag_pagable_alto = 74.5,
      ag_pagable_3 = 76.5,
      ag_pagable_4 = 77.5,
      ag_techo = null,
      au_banda = 6,
      au_techo = 8,
      au_pagable_bajo = 68.5,
      au_pagable_alto = 70.5,
      pb_descuento = 3.5,
      pb_pagable_pct = 60
  where id = 1;
