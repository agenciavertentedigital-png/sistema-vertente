-- Funil comercial informado pelo cliente (o que a Meta não vê): atendidos, agendamentos, vendas, faturamento
create table if not exists public.funil_comercial (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  inicio date not null,
  fim date not null check (fim >= inicio),
  atendidos integer check (atendidos >= 0),
  qualificados integer check (qualificados >= 0),
  agendamentos integer check (agendamentos >= 0),
  comparecimentos integer check (comparecimentos >= 0),
  vendas integer check (vendas >= 0),
  faturamento numeric(12,2) check (faturamento >= 0),
  observacao text,
  autor_id uuid default privado.membro_atual() references public.membros(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists funil_comercial_cliente on public.funil_comercial (cliente_id, inicio desc);
alter table public.funil_comercial enable row level security;
drop policy if exists "funil_comercial: time" on public.funil_comercial;
create policy "funil_comercial: time" on public.funil_comercial for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
