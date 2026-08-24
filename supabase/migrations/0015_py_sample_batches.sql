-- Muestreo conjunto en PY: al llegar, se pesan los trailers, se rompen los
-- big bags en una plataforma y se mezclan — varios lotes de venta se
-- convierten en uno solo para el muestreo. Confirmado con el usuario: la
-- agrupación es automática (todos los lotes pendientes de muestrear, sin
-- selección manual) y el resultado de laboratorio usa los mismos elementos
-- que ya se cargan del lado de compra (Au/Ag/Pb + As/Sb/S/humedad).

create table public.py_sample_batches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  sampled_at timestamptz,
  lab_name text,
  report_number text,
  au_gt numeric(10, 3),
  ag_gt numeric(10, 3),
  pb_pct numeric(6, 3),
  as_pct numeric(6, 3),
  sb_pct numeric(6, 3),
  s_pct numeric(6, 3),
  humidity_pct numeric(6, 3),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Peso oficial del trailer en Lima (por lote de venta / camión), comparable
-- contra la suma de los big bags que Ginebra ya tenía cargada — mismo
-- control que el pesaje oficial de Trujillo del lado de compra.
alter table public.sale_lots
  add column py_official_weight_kg numeric(12, 2),
  add column sample_batch_id uuid references public.py_sample_batches (id);

alter table public.py_sample_batches enable row level security;

create policy "activos_ven_py_sample_batches" on public.py_sample_batches
  for select using (public.is_active_user());

create policy "operaciones_inserta_py_sample_batches" on public.py_sample_batches
  for insert with check (
    public.is_active_user()
    and public.current_role() in ('operaciones', 'calidad', 'comercial', 'gerencia', 'administrador')
  );

create policy "operaciones_actualiza_py_sample_batches" on public.py_sample_batches
  for update using (
    public.is_active_user()
    and public.current_role() in ('operaciones', 'calidad', 'comercial', 'gerencia', 'administrador')
  );

create policy "operaciones_elimina_py_sample_batches" on public.py_sample_batches
  for delete using (
    public.is_active_user()
    and public.current_role() in ('operaciones', 'calidad', 'comercial', 'gerencia', 'administrador')
  );
