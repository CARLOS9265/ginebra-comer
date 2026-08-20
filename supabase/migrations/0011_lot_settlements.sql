-- Valorización definitiva de compra + liquidación al proveedor (puntos 7 y 8
-- del pedido original). Reutiliza la misma fórmula de contract_settings /
-- lib/contract.ts que se usa para lo que Ginebra le cobra a PY: el precio
-- definitivo que se le paga al proveedor es "valor de venta a PY − costos
-- hasta la venta − margen objetivo (ganancia_objetivo_usd, hoy USD 400/TM)",
-- calculado con la ley REAL de laboratorio (no la estimada) y el mismo precio
-- de metales que se usó en el pago provisional. El saldo pendiente resta el
-- precio provisional COMPLETO ya pagado (no solo un adelanto parcial) —
-- confirmado con el usuario.

create table public.lot_settlements (
  id uuid primary key default gen_random_uuid(),
  purchase_lot_id uuid not null references public.purchase_lots (id),
  lab_analysis_id uuid references public.lab_analyses (id),
  tmh_used numeric(10, 2),
  price_au numeric(12, 4),
  price_ag numeric(12, 4),
  price_pb numeric(12, 4),
  au_payable_pct numeric(6, 2),
  ag_payable_pct numeric(6, 2),
  pb_payable_pct numeric(6, 2),
  valor_py_per_tmh numeric(12, 4),
  costos_per_tmh numeric(12, 4),
  ganancia_objetivo_usd numeric(10, 2),
  precio_definitivo_per_tmh numeric(12, 4),
  precio_definitivo_total numeric(14, 2),
  provisional_pagado_total numeric(14, 2),
  saldo_pendiente numeric(14, 2),
  final_invoice_number text,
  credit_debit_note_number text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.lot_settlements enable row level security;

create policy "activos_ven_lot_settlements" on public.lot_settlements
  for select using (public.is_active_user());

-- Cierre financiero: compras/contabilidad/gerencia/administrador, no operaciones/calidad.
create policy "contabilidad_inserta_lot_settlements" on public.lot_settlements
  for insert with check (
    public.is_active_user() and public.current_role() in ('compras', 'contabilidad', 'gerencia', 'administrador')
  );

create policy "contabilidad_actualiza_lot_settlements" on public.lot_settlements
  for update using (
    public.is_active_user() and public.current_role() in ('compras', 'contabilidad', 'gerencia', 'administrador')
  );

create policy "contabilidad_elimina_lot_settlements" on public.lot_settlements
  for delete using (
    public.is_active_user() and public.current_role() in ('compras', 'contabilidad', 'gerencia', 'administrador')
  );
