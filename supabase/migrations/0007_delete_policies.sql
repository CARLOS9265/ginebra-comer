-- Faltaban políticas de DELETE para proveedores, lotes de compra y precintos.
-- Los botones "Eliminar" ya existían en la UI, pero RLS bloqueaba el borrado
-- en silencio (sin error): el delete corría, afectaba 0 filas, y la pantalla
-- se actualizaba como si hubiese funcionado.

create policy "compras_elimina_proveedores" on public.providers
  for delete using (
    public.is_active_user() and public.current_role() in ('compras', 'gerencia', 'administrador')
  );

create policy "operaciones_elimina_lotes" on public.purchase_lots
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'compras', 'gerencia', 'administrador')
  );

create policy "operaciones_elimina_seals" on public.seals
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );
