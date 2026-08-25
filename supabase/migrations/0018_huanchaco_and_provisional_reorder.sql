-- Corrección grande de proceso, confirmada con el usuario: el muestreo
-- PROVISIONAL no pasa en Lima mezclado con el final — pasa en el almacén
-- de Huanchaco, ANTES de armar los lotes de venta: se junta TODO el mineral
-- que está esperando embarque, un supervisor toma una sola muestra de todo,
-- y con ese resultado se calcula la liquidación provisional (90%). Recién
-- después se decide qué va en cada trailer y se despacha a Lima, donde pasa
-- el muestreo FINAL (conjunto, laboratorio internacional) tal como ya
-- estaba construido.

-- Nuevo tramo del proceso: traslado del molino al almacén de Huanchaco
-- (montacarga + trailer + pesaje propio + descarga), hoy inexistente —
-- antes "Traslado a almacén" era solo una foto.
create table public.warehouse_transfers (
  id uuid primary key default gen_random_uuid(),
  purchase_lot_id uuid not null references public.purchase_lots (id),
  forklift_cost_pen numeric(10, 2),
  dispatch_carrier text,
  dispatch_truck_plate text,
  departed_at timestamptz,
  arrived_at timestamptz,
  incidents text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.warehouse_transfers enable row level security;

create policy "activos_ven_warehouse_transfers" on public.warehouse_transfers
  for select using (public.is_active_user());

create policy "operaciones_inserta_warehouse_transfers" on public.warehouse_transfers
  for insert with check (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

create policy "operaciones_actualiza_warehouse_transfers" on public.warehouse_transfers
  for update using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

create policy "operaciones_elimina_warehouse_transfers" on public.warehouse_transfers
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

-- Pesaje propio de Huanchaco (distinto al de la balanza de Trujillo) —
-- reusa la tabla weighings existente, solo se agrega el tipo.
alter type public.weighing_type add value 'huanchaco';

-- El muestreo conjunto (py_sample_batches) ahora se crea en la etapa
-- PROVISIONAL, agrupando LOTES DE COMPRA (no lotes de venta) que ya
-- llegaron a Huanchaco. Un lote de compra pertenece a un solo muestreo
-- (mismo patrón que ya usa sale_lots.sample_batch_id del lado de venta).
alter table public.purchase_lots add column sample_batch_id uuid references public.py_sample_batches (id);
