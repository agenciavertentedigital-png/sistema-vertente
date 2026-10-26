-- Tira as funções auxiliares da API pública (schema não exposto)
create schema if not exists privado;
grant usage on schema privado to authenticated;

alter function public.eh_membro() set schema privado;
alter function public.eh_admin() set schema privado;
alter function public.vincular_membro() set schema privado;
alter function public.tocar_atualizado_em() set schema privado;

revoke execute on function privado.eh_membro() from public, anon;
revoke execute on function privado.eh_admin() from public, anon;
revoke execute on function privado.vincular_membro() from public, anon, authenticated;
grant execute on function privado.eh_membro() to authenticated;
grant execute on function privado.eh_admin() to authenticated;
