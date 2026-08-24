-- Reemplaza el tracking individual de big bags (código, peso, estado por
-- bolsón) por un modelo de cantidades: el peso real de cada bolsón nunca se
-- conoce con exactitud (confirmado con el usuario), así que la identidad
-- individual no aporta nada — lo único que hace falta es CUÁNTOS bolsones
-- genera un lote de compra, y CUÁNTOS de esos bolsones van en cada lote de
-- venta (un lote de venta puede juntar bolsones de varios lotes de compra,
-- como ya funcionaba). El peso real y confiable sigue siendo el de los
-- tickets de balanza oficiales (pesaje en Trujillo del lado de compra,
-- peso oficial del trailer del lado de PY) — eso no cambia.

alter table public.comminutions add column bag_count int;

create table public.sale_lot_allocations (
  id uuid primary key default gen_random_uuid(),
  sale_lot_id uuid not null references public.sale_lots (id) on delete cascade,
  purchase_lot_id uuid not null references public.purchase_lots (id),
  bag_count int not null check (bag_count > 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (sale_lot_id, purchase_lot_id)
);

alter table public.sale_lot_allocations enable row level security;

create policy "activos_ven_sale_lot_allocations" on public.sale_lot_allocations
  for select using (public.is_active_user());

create policy "comercial_inserta_sale_lot_allocations" on public.sale_lot_allocations
  for insert with check (
    public.is_active_user() and public.current_role() in ('comercial', 'operaciones', 'gerencia', 'administrador')
  );

create policy "comercial_elimina_sale_lot_allocations" on public.sale_lot_allocations
  for delete using (
    public.is_active_user() and public.current_role() in ('comercial', 'operaciones', 'gerencia', 'administrador')
  );

-- big_bags nunca tuvo UI que use seals.big_bag_id (los precintos solo se
-- colocan sobre el lote de compra en la práctica), así que se puede dropear
-- junto con la tabla sin perder nada en uso real.
alter table public.seals drop column if exists big_bag_id;
drop table if exists public.big_bags;
