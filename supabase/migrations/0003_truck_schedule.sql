-- Programación de volquetes: llegada de mina para compra, o despacho hacia Lima (venta a PY).
-- Es un calendario operativo independiente de los lotes ya creados; un registro puede
-- vincularse a un lote de compra una vez que el volquete efectivamente llegó.

create type public.truck_schedule_type as enum ('compra', 'despacho');
create type public.truck_schedule_status as enum ('programado', 'confirmado', 'completado', 'cancelado');

create table public.truck_schedule (
  id uuid primary key default gen_random_uuid(),
  type public.truck_schedule_type not null,
  scheduled_date date not null,
  scheduled_time time,
  status public.truck_schedule_status not null default 'programado',

  -- Compra: de qué proveedor/mina viene.
  provider_id uuid references public.providers (id),

  -- Despacho: a dónde va y cuánto se estima llevar.
  destination text,
  estimated_big_bags int,

  truck_plate text,
  carrier_name text,
  notes text,

  purchase_lot_id uuid references public.purchase_lots (id),

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger truck_schedule_set_updated_at
  before update on public.truck_schedule
  for each row execute function public.set_updated_at();

alter table public.truck_schedule enable row level security;

create policy "activos_ven_programacion" on public.truck_schedule
  for select using (public.is_active_user());

create policy "operaciones_crea_programacion" on public.truck_schedule
  for insert with check (
    public.is_active_user() and public.current_role() in ('operaciones', 'compras', 'comercial', 'gerencia', 'administrador')
  );

create policy "operaciones_actualiza_programacion" on public.truck_schedule
  for update using (
    public.is_active_user() and public.current_role() in ('operaciones', 'compras', 'comercial', 'gerencia', 'administrador')
  );

create policy "operaciones_elimina_programacion" on public.truck_schedule
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'compras', 'comercial', 'gerencia', 'administrador')
  );
