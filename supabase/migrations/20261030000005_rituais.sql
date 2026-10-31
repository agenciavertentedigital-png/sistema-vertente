-- Daily e Weekly com respostas: cada pessoa responde, o sistema consolida por dia/semana
create table if not exists public.rituais_respostas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('daily', 'weekly')),
  data date not null,                -- daily: o dia; weekly: a segunda-feira da semana
  membro_id uuid not null default privado.membro_atual() references public.membros(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,  -- weekly por cliente
  setor text,                        -- weekly por setor da Vertente (administrativo, comercial…)
  respostas jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists rituais_respostas_unica
  on public.rituais_respostas (tipo, data, membro_id, coalesce(cliente_id::text, ''), coalesce(setor, ''));
create index if not exists rituais_respostas_data on public.rituais_respostas (tipo, data desc);

alter table public.rituais_respostas enable row level security;
drop policy if exists "rituais: time" on public.rituais_respostas;
create policy "rituais: time" on public.rituais_respostas for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
