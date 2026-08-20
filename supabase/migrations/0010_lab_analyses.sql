-- Muestreo y laboratorio: ley real del lote (muestra compuesta, un solo
-- laboratorio por ahora — sin comparación entre dos laboratorios todavía).
-- Au/Ag/Pb es lo que entra en la valorización definitiva de la compra;
-- As/Sb/S/humedad se registran para trazabilidad y decisiones de blending,
-- pero no afectan el pago al proveedor (la humedad sí afecta la venta a PY,
-- en una etapa posterior que todavía no está conectada).

create table public.lab_analyses (
  id uuid primary key default gen_random_uuid(),
  purchase_lot_id uuid not null references public.purchase_lots (id),
  sampled_at timestamptz,
  analyzed_at timestamptz,
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

alter table public.lab_analyses enable row level security;

create policy "activos_ven_lab_analyses" on public.lab_analyses
  for select using (public.is_active_user());

create policy "calidad_inserta_lab_analyses" on public.lab_analyses
  for insert with check (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

create policy "calidad_actualiza_lab_analyses" on public.lab_analyses
  for update using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

-- A diferencia de 0001_init.sql, esta tabla nace con su política de DELETE
-- (ver 0007/0008/0009: siempre se termina necesitando).
create policy "calidad_elimina_lab_analyses" on public.lab_analyses
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );
