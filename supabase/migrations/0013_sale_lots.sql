-- Fase 2: venta a PY. Un lote de venta puede juntar big bags de distintos
-- lotes de compra (confirmado con el usuario) — selección manual desde el
-- inventario, sin diseño de blending. Reutiliza next_lot_seq('VTA', año)
-- para el código (mismo generador que ya usan los lotes de compra).

create type public.sale_lot_status as enum (
  'armado', 'despachado', 'recibido_py', 'muestreado', 'liquidado_provisional', 'liquidado_final'
);

create table public.sale_lots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status public.sale_lot_status not null default 'armado',
  notes text,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sale_lots_set_updated_at
  before update on public.sale_lots
  for each row execute function public.set_updated_at();

alter table public.big_bags add column sale_lot_id uuid references public.sale_lots (id);

alter table public.sale_lots enable row level security;

create policy "activos_ven_sale_lots" on public.sale_lots
  for select using (public.is_active_user());

create policy "comercial_inserta_sale_lots" on public.sale_lots
  for insert with check (
    public.is_active_user() and public.current_role() in ('comercial', 'operaciones', 'gerencia', 'administrador')
  );

create policy "comercial_actualiza_sale_lots" on public.sale_lots
  for update using (
    public.is_active_user() and public.current_role() in ('comercial', 'operaciones', 'gerencia', 'administrador')
  );

create policy "comercial_elimina_sale_lots" on public.sale_lots
  for delete using (
    public.is_active_user() and public.current_role() in ('comercial', 'operaciones', 'gerencia', 'administrador')
  );

-- big_bags ya tenía UPDATE para operaciones/calidad/gerencia/administrador
-- (0001_init.sql); comercial también necesita poder asignar bolsones a un
-- lote de venta.
create policy "comercial_actualiza_big_bags" on public.big_bags
  for update using (
    public.is_active_user() and public.current_role() in ('comercial', 'gerencia', 'administrador')
  );
