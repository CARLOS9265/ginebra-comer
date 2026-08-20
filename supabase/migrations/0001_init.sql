-- Ginebra ERP — Fase 1
-- Login + roles, proveedores, lote de compra, precintos, documentos,
-- transporte, pesajes, recepción en molino, conminución y big bags.

-- ============================================================
-- 1. Roles y perfiles de usuario
-- ============================================================

create type public.user_role as enum (
  'operaciones', 'compras', 'calidad', 'comercial',
  'contabilidad', 'gerencia', 'administrador'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'operaciones',
  active boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Un perfil por usuario de Ginebra. Se crea automáticamente al registrarse, pero queda inactivo hasta que un administrador le asigna rol y lo activa.';

-- Cuando alguien se registra en Supabase Auth, se crea su perfil automáticamente (inactivo).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'operaciones', false);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Funciones auxiliares para las políticas de seguridad (RLS).
create function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

alter table public.profiles enable row level security;

create policy "usuarios_activos_ven_perfiles" on public.profiles
  for select using (public.is_active_user());

create policy "propio_perfil_visible_aunque_inactivo" on public.profiles
  for select using (id = auth.uid());

create policy "administrador_modifica_perfiles" on public.profiles
  for update using (public.current_role() = 'administrador' and public.is_active_user());

-- ============================================================
-- 2. Utilidad: updated_at automático
-- ============================================================

create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 3. Proveedores
-- ============================================================

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- ej. BUS, GC — se usa en el código del lote
  name text not null,
  mine_name text,
  concession text,
  created_at timestamptz not null default now()
);

alter table public.providers enable row level security;

create policy "activos_ven_proveedores" on public.providers
  for select using (public.is_active_user());

create policy "compras_gestiona_proveedores" on public.providers
  for insert with check (public.is_active_user() and public.current_role() in ('compras', 'gerencia', 'administrador'));

create policy "compras_actualiza_proveedores" on public.providers
  for update using (public.is_active_user() and public.current_role() in ('compras', 'gerencia', 'administrador'));

-- ============================================================
-- 4. Generador de código de lote (GIN-<PROVEEDOR>-<AÑO>-<NNNN>)
-- ============================================================

create table public.lot_code_counters (
  provider_code text not null,
  year int not null,
  last_seq int not null default 0,
  primary key (provider_code, year)
);

create function public.next_lot_seq(p_provider_code text, p_year int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_seq int;
begin
  insert into public.lot_code_counters (provider_code, year, last_seq)
  values (p_provider_code, p_year, 1)
  on conflict (provider_code, year)
  do update set last_seq = lot_code_counters.last_seq + 1
  returning last_seq into v_seq;
  return v_seq;
end;
$$;

-- ============================================================
-- 5. Lote de compra
-- ============================================================

create type public.purchase_lot_status as enum (
  'creado', 'en_transito', 'pesado', 'recibido_molino',
  'conminuido', 'en_laboratorio', 'valorizado', 'en_almacen', 'cerrado'
);

create table public.purchase_lots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  provider_id uuid not null references public.providers (id),
  mine_name text,
  concession text,
  loaded_at timestamptz not null,
  truck_plate text,
  driver_name text,
  carrier_name text,
  estimated_weight_tmh numeric(10, 2),
  reference_price_usd numeric(12, 2),
  provider_avg_grade_note text,
  provisional_price_per_tmh numeric(12, 2),
  advance_pct numeric(5, 2),
  initial_guide_number text,
  initial_invoice_number text,
  status public.purchase_lot_status not null default 'creado',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger purchase_lots_set_updated_at
  before update on public.purchase_lots
  for each row execute function public.set_updated_at();

alter table public.purchase_lots enable row level security;

create policy "activos_ven_lotes" on public.purchase_lots
  for select using (public.is_active_user());

create policy "operaciones_crea_lotes" on public.purchase_lots
  for insert with check (public.is_active_user() and public.current_role() in ('operaciones', 'compras', 'gerencia', 'administrador'));

create policy "operaciones_actualiza_lotes" on public.purchase_lots
  for update using (public.is_active_user() and public.current_role() in ('operaciones', 'compras', 'gerencia', 'administrador'));

-- ============================================================
-- 6. Conminución y big bags (se crean antes de precintos por la FK cruzada)
-- ============================================================

create table public.comminutions (
  id uuid primary key default gen_random_uuid(),
  purchase_lot_id uuid not null references public.purchase_lots (id),
  started_at timestamptz,
  finished_at timestamptz,
  processed_tons numeric(10, 2),
  mill_invoice_number text,
  tariff_pen_per_ton numeric(10, 2) default 80,
  responsible_name text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create type public.big_bag_status as enum (
  'disponible', 'reservado', 'despachado', 'recibido_py', 'liquidado'
);

create table public.big_bags (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  purchase_lot_id uuid not null references public.purchase_lots (id),
  comminution_id uuid references public.comminutions (id),
  weight_kg numeric(10, 2),
  status public.big_bag_status not null default 'disponible',
  storage_location text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger big_bags_set_updated_at
  before update on public.big_bags
  for each row execute function public.set_updated_at();

-- ============================================================
-- 7. Precintos (pueden ir sobre un volquete/lote o sobre un big bag)
-- ============================================================

create type public.seal_status as enum (
  'disponible', 'colocado', 'verificado', 'abierto', 'anulado'
);

create table public.seals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  purchase_lot_id uuid references public.purchase_lots (id),
  big_bag_id uuid references public.big_bags (id),
  status public.seal_status not null default 'disponible',
  opened_reason text,
  opened_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint seal_belongs_to_one_thing check (
    (purchase_lot_id is not null and big_bag_id is null) or
    (purchase_lot_id is null and big_bag_id is not null) or
    (purchase_lot_id is null and big_bag_id is null)
  )
);

create trigger seals_set_updated_at
  before update on public.seals
  for each row execute function public.set_updated_at();

-- ============================================================
-- 8. Transporte, pesajes y recepción en molino
-- ============================================================

create table public.transport_events (
  id uuid primary key default gen_random_uuid(),
  purchase_lot_id uuid not null references public.purchase_lots (id),
  departed_at timestamptz,
  carrier_name text,
  tariff_pen_per_tmh numeric(10, 2) default 179.66,
  security_group_code text,
  security_cost_pen numeric(10, 2),
  incidents text,
  estimated_arrival timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create type public.weighing_type as enum ('inicial', 'oficial', 'regularizacion');

create table public.weighings (
  id uuid primary key default gen_random_uuid(),
  purchase_lot_id uuid not null references public.purchase_lots (id),
  type public.weighing_type not null,
  gross_weight numeric(10, 2),
  tare_weight numeric(10, 2),
  net_weight numeric(10, 2),
  ticket_number text,
  weighed_at timestamptz,
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.mill_receptions (
  id uuid primary key default gen_random_uuid(),
  purchase_lot_id uuid not null references public.purchase_lots (id),
  received_at timestamptz,
  supervisor_name text,
  storage_location text,
  incidents text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. Documentos (fotos, guías, facturas, tickets — genérico por entidad)
-- ============================================================

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null, -- 'purchase_lot' | 'transport_event' | 'weighing' | 'comminution' | 'big_bag'
  entity_id uuid not null,
  doc_type text not null,    -- 'guia_ginebra' | 'guia_transportista' | 'factura' | 'foto' | 'ticket_balanza' | ...
  storage_path text not null,
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- 10. Bitácora de auditoría (quién cambió qué, cuándo y por qué)
-- ============================================================

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  field_name text,
  old_value text,
  new_value text,
  reason text,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

-- ============================================================
-- 11. RLS para el resto de tablas operativas
--     Lectura: cualquier usuario activo. Escritura: roles operativos.
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'comminutions', 'big_bags', 'seals', 'transport_events',
    'weighings', 'mill_receptions', 'documents'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "activos_ven_%1$s" on public.%1$s for select using (public.is_active_user())', t
    );
    execute format(
      'create policy "operaciones_inserta_%1$s" on public.%1$s for insert with check (public.is_active_user() and public.current_role() in (''operaciones'', ''calidad'', ''gerencia'', ''administrador''))', t
    );
    execute format(
      'create policy "operaciones_actualiza_%1$s" on public.%1$s for update using (public.is_active_user() and public.current_role() in (''operaciones'', ''calidad'', ''gerencia'', ''administrador''))', t
    );
  end loop;
end $$;

alter table public.audit_log enable row level security;

create policy "activos_ven_auditoria" on public.audit_log
  for select using (public.is_active_user());

create policy "activos_insertan_auditoria" on public.audit_log
  for insert with check (public.is_active_user());
