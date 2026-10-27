drop policy "membros: admin altera" on public.membros;
create policy "membros: admin cadastra" on public.membros
  for insert to authenticated with check ((select privado.eh_admin()));
create policy "membros: admin edita" on public.membros
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy "membros: admin remove" on public.membros
  for delete to authenticated using ((select privado.eh_admin()));
