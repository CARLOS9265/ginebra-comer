-- Traslado a almacén (solo evidencia fotográfica, según el usuario) y
-- cierre de compra (solo permitido si la liquidación ya está pagada).

-- Bucket privado para las fotos. Se listan/suben vía la tabla `documents`
-- ya existente (entity_type='purchase_lot', doc_type='foto_almacen').
insert into storage.buckets (id, name, public)
values ('lot-photos', 'lot-photos', false)
on conflict (id) do nothing;

create policy "activos_ven_lot_photos" on storage.objects
  for select using (bucket_id = 'lot-photos' and public.is_active_user());

create policy "operaciones_sube_lot_photos" on storage.objects
  for insert with check (
    bucket_id = 'lot-photos' and public.is_active_user()
    and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

create policy "operaciones_elimina_lot_photos" on storage.objects
  for delete using (
    bucket_id = 'lot-photos' and public.is_active_user()
    and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

-- `documents` ya tenía SELECT/INSERT/UPDATE desde 0001_init.sql pero,
-- mismo patrón de siempre, le faltaba DELETE.
create policy "operaciones_elimina_documents" on public.documents
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

-- Seguimiento de pago de la liquidación definitiva: el cierre de compra
-- solo se habilita cuando esto está seteado.
alter table public.lot_settlements
  add column paid_at timestamptz,
  add column paid_by uuid references public.profiles (id);
