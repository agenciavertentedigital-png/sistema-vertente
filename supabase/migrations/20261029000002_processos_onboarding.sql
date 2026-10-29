-- Processos aplicáveis a um cliente (pré-onboarding, onboarding…) e pasta do Drive na ficha
alter table public.clientes add column pasta_drive text;

create table public.processos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null default 'outro' check (tipo in ('pre_onboarding', 'onboarding', 'outro')),
  descricao text,
  etapas jsonb not null default '[]',   -- [{titulo, pilar, dias, prioridade, checklist[]}]
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create table public.processos_aplicados (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references public.processos (id) on delete set null,
  nome text not null,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  inicio date not null,
  autor_id uuid references public.membros (id) on delete set null default privado.membro_atual(),
  criado_em timestamptz not null default now()
);
create index processos_aplicados_cliente_idx on public.processos_aplicados (cliente_id);

alter table public.tarefas add column processo_aplicado_id uuid references public.processos_aplicados (id) on delete set null;
create index tarefas_processo_idx on public.tarefas (processo_aplicado_id);

alter table public.processos enable row level security;
alter table public.processos_aplicados enable row level security;
create policy "processos: time" on public.processos
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
create policy "processos_aplicados: time" on public.processos_aplicados
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
