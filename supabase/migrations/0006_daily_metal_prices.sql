-- Precios internacionales del día (oro, plata, plomo), cargados a mano por ahora.
-- Sirven como referencia rápida al momento de cargar un volquete, antes de tener
-- ley real de laboratorio. Más adelante puede conectarse a una fuente automática
-- (LBMA/LME/Fastmarkets) sin cambiar cómo se consumen estos datos.

create table public.daily_metal_prices (
  price_date date primary key,
  gold_usd_oz numeric(12, 4) not null,
  silver_usd_oz numeric(12, 4) not null,
  lead_usd_ton numeric(12, 4),
  reference_pct numeric(5, 2) not null default 40,
  entered_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger daily_metal_prices_set_updated_at
  before update on public.daily_metal_prices
  for each row execute function public.set_updated_at();

alter table public.daily_metal_prices enable row level security;

create policy "activos_ven_precios" on public.daily_metal_prices
  for select using (public.is_active_user());

create policy "roles_cargan_precios" on public.daily_metal_prices
  for insert with check (
    public.is_active_user() and public.current_role() in ('compras', 'comercial', 'gerencia', 'administrador')
  );

create policy "roles_actualizan_precios" on public.daily_metal_prices
  for update using (
    public.is_active_user() and public.current_role() in ('compras', 'comercial', 'gerencia', 'administrador')
  );
