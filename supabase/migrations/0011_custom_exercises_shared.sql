-- Los ejercicios personalizados del catálogo compartido los pueden editar o borrar los dos usuarios
drop policy if exists "update own exercises" on public.exercises;
drop policy if exists "delete own exercises" on public.exercises;
create policy "update custom exercises" on public.exercises for update to authenticated
  using (is_custom) with check (is_custom);
create policy "delete custom exercises" on public.exercises for delete to authenticated
  using (is_custom);
