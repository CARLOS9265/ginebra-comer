-- Mismo bug que 0007/0008: falta de política RLS de DELETE, esta vez para
-- mill_receptions, comminutions y big_bags (nueva UI de recepción/conminución).

create policy "operaciones_elimina_mill_receptions" on public.mill_receptions
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

create policy "operaciones_elimina_comminutions" on public.comminutions
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

create policy "operaciones_elimina_big_bags" on public.big_bags
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );
