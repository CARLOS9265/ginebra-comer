-- Los precintos no se usan en la compra (nunca se colocan de verdad en el
-- volquete que llega de mina) — se usan del lado de VENTA: se colocan en el
-- trailer/bolsones antes de despachar a Lima, se verifican antes de la
-- salida hacia Lima, y se abren cuando PY los recibe. Confirmado con el
-- usuario.

-- Las 8 filas existentes eran pruebas del modelo anterior (atado a un lote
-- de compra) — ninguna tiene a qué lote de venta migrarse (no existe
-- todavía ningún sale_lot), así que se limpian junto con el cambio de
-- esquema.
delete from public.seals;

alter table public.seals
  drop column purchase_lot_id,
  add column sale_lot_id uuid references public.sale_lots (id);

-- RLS: cambia el rol responsable de colocar/verificar/abrir precintos —
-- calidad (laboratorio) no tiene nada que ver con el despacho a Lima;
-- comercial sí (mismos roles que ya manejan sale_lots).
drop policy if exists "operaciones_inserta_seals" on public.seals;
drop policy if exists "operaciones_actualiza_seals" on public.seals;
drop policy if exists "operaciones_elimina_seals" on public.seals;

create policy "comercial_inserta_seals" on public.seals
  for insert with check (
    public.is_active_user() and public.current_role() in ('operaciones', 'comercial', 'gerencia', 'administrador')
  );

create policy "comercial_actualiza_seals" on public.seals
  for update using (
    public.is_active_user() and public.current_role() in ('operaciones', 'comercial', 'gerencia', 'administrador')
  );

create policy "comercial_elimina_seals" on public.seals
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'comercial', 'gerencia', 'administrador')
  );
