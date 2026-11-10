-- Dashboards personalizáveis e Funil de Vendas do cliente

-- Como cada aba do dashboard do cliente está montada (métricas, gráficos, fórmulas e etapas do funil)
create table if not exists public.dashboard_config (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  aba text not null check (aba in ('geral', 'meta', 'google', 'funil')),
  config jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default privado.membro_atual() references public.membros(id) on delete set null,
  primary key (cliente_id, aba)
);
alter table public.dashboard_config enable row level security;
drop policy if exists "dashboard_config: time" on public.dashboard_config;
create policy "dashboard_config: time" on public.dashboard_config for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

-- Números que o cliente informa (qualificados, vendas, valor de vendas…) por período; as chaves vêm das etapas do funil
create table if not exists public.funil_lancamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  inicio date not null,
  fim date not null,
  valores jsonb not null default '{}'::jsonb,
  observacao text,
  autor_id uuid default privado.membro_atual() references public.membros(id) on delete set null,
  criado_em timestamptz not null default now(),
  check (inicio <= fim)
);
create index if not exists funil_lancamentos_cliente on public.funil_lancamentos (cliente_id, inicio desc);
alter table public.funil_lancamentos enable row level security;
drop policy if exists "funil_lancamentos: time" on public.funil_lancamentos;
create policy "funil_lancamentos: time" on public.funil_lancamentos for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

-- Análises de IA guardadas (Analisar funil do cliente)
create table if not exists public.analises_ia (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null default 'funil',
  inicio date,
  fim date,
  texto text not null,
  autor_id uuid default privado.membro_atual() references public.membros(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists analises_ia_cliente on public.analises_ia (cliente_id, criado_em desc);
alter table public.analises_ia enable row level security;
drop policy if exists "analises_ia: time" on public.analises_ia;
create policy "analises_ia: time" on public.analises_ia for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
