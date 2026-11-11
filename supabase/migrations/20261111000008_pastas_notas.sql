-- Pastas e subpastas para as anotações (por cliente ou da agência)
create table if not exists public.pastas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade, -- nulo = pasta da agência
  pai_id uuid references public.pastas(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 80),
  cor text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists pastas_cliente on public.pastas (cliente_id);
create index if not exists pastas_pai on public.pastas (pai_id);
alter table public.pastas enable row level security;
drop policy if exists "pastas: time" on public.pastas;
create policy "pastas: time" on public.pastas for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

alter table public.notas add column if not exists pasta_id uuid references public.pastas(id) on delete set null;
create index if not exists notas_pasta on public.notas (pasta_id);
