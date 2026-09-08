-- Adelantos a proveedores: plata entregada por adelantado para asegurar
-- futura entrega de mineral, independiente de un lote puntual (confirmado
-- con el usuario — no es lo mismo que `purchase_lots.advance_pct`, que es el
-- % pagable inicial de UN lote ya creado). Se lleva como cuenta corriente por
-- proveedor: cada adelanto entregado es una fila con monto positivo; cuando
-- se aplica (se descuenta) en la liquidación definitiva de un lote de ese
-- proveedor, se agrega una fila con monto negativo enlazada a esa
-- liquidación. El saldo pendiente de un proveedor es la suma de sus filas.

create table public.provider_advances (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id),
  amount_usd numeric(12, 2) not null,
  given_at date not null default current_date,
  note text,
  applied_lot_settlement_id uuid references public.lot_settlements (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.provider_advances enable row level security;

create policy "activos_ven_provider_advances" on public.provider_advances
  for select using (public.is_active_user());

-- Mismos roles que pueden registrar la liquidación definitiva (0011): es una
-- decisión financiera de compras/contabilidad, no de operaciones/calidad.
create policy "compras_inserta_provider_advances" on public.provider_advances
  for insert with check (
    public.is_active_user() and public.current_role() in ('compras', 'contabilidad', 'gerencia', 'administrador')
  );

create policy "compras_elimina_provider_advances" on public.provider_advances
  for delete using (
    public.is_active_user() and public.current_role() in ('compras', 'contabilidad', 'gerencia', 'administrador')
  );

-- Cuánto de su adelanto pendiente se descontó en la liquidación definitiva de
-- este lote — separado de `saldo_pendiente` (que es puro cálculo del lote)
-- para no mezclar los dos conceptos.
alter table public.lot_settlements
  add column adelanto_aplicado_usd numeric(12, 2) not null default 0;
