-- Anexos em PDF nas tarefas, registros (notas, otimizações, retornos…), reuniões e arquivos do cliente.
-- O arquivo fica no bucket privado "anexos"; aqui fica a referência. Só o time lê e envia.

create table if not exists public.anexos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  tarefa_id uuid references public.tarefas(id) on delete cascade,
  registro_id uuid references public.registros(id) on delete cascade,
  reuniao_id uuid references public.reunioes(id) on delete cascade,
  nome text not null,
  caminho text not null unique,
  tamanho bigint,
  criado_por uuid references public.membros(id) on delete set null default privado.membro_atual(),
  criado_em timestamptz not null default now()
);
create index if not exists anexos_cliente on public.anexos (cliente_id, criado_em desc);
create index if not exists anexos_tarefa on public.anexos (tarefa_id) where tarefa_id is not null;
create index if not exists anexos_registro on public.anexos (registro_id) where registro_id is not null;
create index if not exists anexos_reuniao on public.anexos (reuniao_id) where reuniao_id is not null;
create index if not exists anexos_criado_por on public.anexos (criado_por);

alter table public.anexos enable row level security;
drop policy if exists "anexos: time" on public.anexos;
create policy "anexos: time" on public.anexos for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

-- Bucket privado: só PDF, até 20 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anexos: time lê" on storage.objects;
create policy "anexos: time lê" on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (select privado.eh_membro()));
drop policy if exists "anexos: time envia" on storage.objects;
create policy "anexos: time envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (select privado.eh_membro()));
drop policy if exists "anexos: time remove" on storage.objects;
create policy "anexos: time remove" on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (select privado.eh_membro()));
