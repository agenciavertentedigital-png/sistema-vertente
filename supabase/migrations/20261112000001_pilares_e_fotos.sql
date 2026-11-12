-- Pilares CRM e Comercial nas tarefas e rotinas (aplicado em 12/11/2026)
alter table public.tarefas drop constraint tarefas_pilar_check;
alter table public.tarefas add constraint tarefas_pilar_check check (pilar in ('trafego','social','gmn','cs','crm','comercial','interno'));
alter table public.rotinas drop constraint rotinas_pilar_check;
alter table public.rotinas add constraint rotinas_pilar_check check (pilar in ('trafego','social','gmn','cs','crm','comercial','interno'));

-- Foto de perfil do time (aplicado em 12/11/2026)
alter table public.membros add column if not exists foto_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "avatares: envia a própria" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and ((storage.foldername(name))[1] = (select privado.membro_atual())::text or (select privado.eh_admin())));
create policy "avatares: troca a própria" on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and ((storage.foldername(name))[1] = (select privado.membro_atual())::text or (select privado.eh_admin())));
create policy "avatares: remove a própria" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and ((storage.foldername(name))[1] = (select privado.membro_atual())::text or (select privado.eh_admin())));

create or replace function public.definir_minha_foto(url text)
returns void language plpgsql security definer set search_path = '' as $$
declare eu uuid := privado.membro_atual();
begin
  if eu is null then raise exception 'Sem acesso'; end if;
  if url is not null and url !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatares/' || eu::text || '/') then
    raise exception 'Foto inválida';
  end if;
  update public.membros set foto_url = url where id = eu;
end $$;
revoke all on function public.definir_minha_foto(text) from public, anon;
grant execute on function public.definir_minha_foto(text) to authenticated;
