-- Mismo bug que 0007 (falta de política RLS de DELETE), esta vez para las
-- tablas que recién obtienen su primera UI: transport_events y weighings.

create policy "operaciones_elimina_transport_events" on public.transport_events
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );

create policy "operaciones_elimina_weighings" on public.weighings
  for delete using (
    public.is_active_user() and public.current_role() in ('operaciones', 'calidad', 'gerencia', 'administrador')
  );
