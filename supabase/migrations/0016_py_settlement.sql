-- Liquidación de PY (leídas del contrato real PYCP-202656): ensaye
-- provisional (local, rápido) vs. ensaye final (conjunto, laboratorio
-- internacional), pago provisional al 90% del valor estimado usando el
-- promedio de precio de los últimos 5 días de mercado antes de la fecha
-- de factura (cláusula 5.1), y fijación de precio por metal dentro de una
-- ventana de 30 días calendario por entrega (cláusula 8.1).

-- Los campos de ensayo que ya existían pasan a ser el "provisional"
-- (ensaye rápido de laboratorio local, cláusula 11.1); se agrega un juego
-- paralelo para el "final" (conjunto, laboratorio internacional, 11.2).
alter table public.py_sample_batches rename column sampled_at to prov_sampled_at;
alter table public.py_sample_batches rename column lab_name to prov_lab_name;
alter table public.py_sample_batches rename column report_number to prov_report_number;
alter table public.py_sample_batches rename column au_gt to prov_au_gt;
alter table public.py_sample_batches rename column ag_gt to prov_ag_gt;
alter table public.py_sample_batches rename column pb_pct to prov_pb_pct;
alter table public.py_sample_batches rename column as_pct to prov_as_pct;
alter table public.py_sample_batches rename column sb_pct to prov_sb_pct;
alter table public.py_sample_batches rename column s_pct to prov_s_pct;
alter table public.py_sample_batches rename column humidity_pct to prov_humidity_pct;
alter table public.py_sample_batches rename column notes to prov_notes;

alter table public.py_sample_batches
  -- Ensaye final (conjunto, Alex Stewart / Alfred H Knight, cláusula 11.2)
  add column final_sampled_at timestamptz,
  add column final_lab_name text,
  add column final_report_number text,
  add column final_au_gt numeric(10, 3),
  add column final_ag_gt numeric(10, 3),
  add column final_pb_pct numeric(6, 3),
  add column final_as_pct numeric(6, 3),
  add column final_sb_pct numeric(6, 3),
  add column final_s_pct numeric(6, 3),
  add column final_humidity_pct numeric(6, 3),
  add column final_notes text,

  -- Pago provisional: 90% del valor estimado, precio = promedio de los 5
  -- días de mercado previos a la fecha de factura (cláusula 5.1).
  add column prov_invoice_date date,
  add column prov_price_au numeric(12, 4),
  add column prov_price_ag numeric(12, 4),
  add column prov_price_pb numeric(12, 4),
  add column prov_value_per_tmh numeric(12, 4),
  add column prov_value_total numeric(14, 2),
  add column prov_payment_total numeric(14, 2),
  add column prov_paid_at timestamptz,
  add column prov_paid_by uuid references public.profiles (id),

  -- Fijación de precio por metal, ventana compartida de 30 días
  -- calendario (cláusula 8.1); cada metal se fija de forma independiente.
  add column fixation_window_start date,
  add column fixation_window_end date,
  add column au_fixed_at date,
  add column au_fixed_price numeric(12, 4),
  add column ag_fixed_at date,
  add column ag_fixed_price numeric(12, 4),
  add column pb_fixed_at date,
  add column pb_fixed_price numeric(12, 4),

  -- Liquidación final: ley final + precios fijados por metal.
  add column final_value_per_tmh numeric(12, 4),
  add column final_value_total numeric(14, 2),
  add column final_balance_total numeric(14, 2),
  add column final_paid_at timestamptz,
  add column final_paid_by uuid references public.profiles (id);
