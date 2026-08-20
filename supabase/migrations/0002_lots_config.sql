-- Configuración del contrato con PY (bandas, pagables, costos, objetivos) y
-- campos de aprobación gerencial sobre el lote de compra.

create table public.contract_settings (
  id int primary key default 1 check (id = 1),
  tipo_cambio numeric(10, 4) not null default 3.7,
  merma_pct numeric(6, 3) not null default 0.30,
  ag_banda numeric(10, 2) not null default 900,
  ag_techo numeric(10, 2) not null default 1100,
  ag_pagable_bajo numeric(6, 2) not null default 72.5,
  ag_pagable_alto numeric(6, 2) not null default 74.5,
  au_banda numeric(10, 2) not null default 6,
  au_techo numeric(10, 2) not null default 8,
  au_pagable_bajo numeric(6, 2) not null default 68.5,
  au_pagable_alto numeric(6, 2) not null default 70.5,
  pb_descuento numeric(6, 2) not null default 3.5,
  pb_pagable_pct numeric(6, 2) not null default 60,
  ganancia_objetivo_usd numeric(10, 2) not null default 400,
  reserva_riesgo_usd numeric(10, 2) not null default 0,
  adelanto_py_pct numeric(5, 2) not null default 90,
  adelanto_proveedor_pct numeric(5, 2) not null default 70,
  costo_transporte_pen_tmh numeric(10, 2) not null default 179.66,
  costo_conminucion_pen_tmh numeric(10, 2) not null default 80,
  costo_seguridad_pen_tmh numeric(10, 2) not null default 40.51,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

insert into public.contract_settings (id) values (1);

create trigger contract_settings_set_updated_at
  before update on public.contract_settings
  for each row execute function public.set_updated_at();

alter table public.contract_settings enable row level security;

create policy "activos_ven_config_contrato" on public.contract_settings
  for select using (public.is_active_user());

create policy "gerencia_edita_config_contrato" on public.contract_settings
  for update using (
    public.is_active_user() and public.current_role() in ('gerencia', 'administrador')
  );

-- Campos de aprobación y proyección sobre el lote de compra.
alter table public.purchase_lots
  add column estimated_ag numeric(10, 2),
  add column estimated_au numeric(10, 2),
  add column estimated_pb numeric(6, 2),
  add column estimated_humidity numeric(6, 3),
  add column projected_py_value_per_tmh numeric(12, 2),
  add column projected_max_price_per_tmh numeric(12, 2),
  add column projected_margin_per_tmh numeric(12, 2),
  add column requires_approval boolean not null default false,
  add column approval_reason text,
  add column approved_by uuid references public.profiles (id),
  add column approved_at timestamptz;
