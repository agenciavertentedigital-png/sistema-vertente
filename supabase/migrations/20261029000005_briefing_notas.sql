-- Briefing estratégico (um por cliente) e anotações vinculadas ao cliente
create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references public.clientes (id) on delete cascade,
  campos jsonb not null default '{}',          -- {chave: texto}; chaves em src/data/briefingCampos.json
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.membros (id) on delete set null,
  respondido_cliente_em timestamptz            -- última vez que o cliente preencheu pelo link
);

create table public.notas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes (id) on delete cascade,  -- nulo = nota interna da agência
  titulo text,
  texto text not null,
  etiqueta text not null default 'geral' check (etiqueta in ('geral', 'estrategia', 'reuniao', 'ideia', 'alinhamento', 'aprendizado', 'pendencia')),
  fixada boolean not null default false,
  autor_id uuid references public.membros (id) on delete set null default privado.membro_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index notas_cliente_idx on public.notas (cliente_id, atualizado_em desc);

create trigger notas_atualizado_em before update on public.notas
  for each row execute function privado.tocar_atualizado_em();
create trigger briefings_atualizado_em before update on public.briefings
  for each row execute function privado.tocar_atualizado_em();

alter table public.briefings enable row level security;
alter table public.notas enable row level security;
create policy "briefings: time" on public.briefings
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
create policy "notas: time" on public.notas
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

-- O link público passa a servir para cadastro ou briefing
alter table public.cadastro_links add column tipo text not null default 'cadastro' check (tipo in ('cadastro', 'briefing'));
