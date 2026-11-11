-- Logo de cada cliente (cards dos dashboards e telas do cliente)
alter table public.clientes add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "logos: time envia" on storage.objects;
create policy "logos: time envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (select privado.eh_membro()));
drop policy if exists "logos: time troca" on storage.objects;
create policy "logos: time troca" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (select privado.eh_membro()));
drop policy if exists "logos: time remove" on storage.objects;
create policy "logos: time remove" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (select privado.eh_membro()));
