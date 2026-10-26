-- Fase 0 · Fundação
-- Time (membros), clientes, serviços contratados e regras de acesso.
-- Só quem está em `membros` (ativo) enxerga ou altera dados.

-- ---------------------------------------------------------------
-- Time
-- ---------------------------------------------------------------
create table public.membros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null unique,
  nome text not null,
  papel text not null default 'gestor'
    check (papel in ('admin', 'gestor', 'cs', 'visualizador')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Quem está logado é membro ativo? (por id do login ou pelo e-mail)
create or replace function public.eh_membro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.ativo
      and (m.user_id = auth.uid()
           or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.ativo and m.papel = 'admin'
      and (m.user_id = auth.uid()
           or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

-- Liga o login ao membro na primeira entrada (mesmo e-mail)
create or replace function public.vincular_membro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.membros
     set user_id = new.id
   where lower(email) = lower(new.email)
     and user_id is null;
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.vincular_membro();

-- ---------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  origem text not null default 'vertente'
    check (origem in ('vertente', 'parceria_marcone')),
  marca text,                       -- agrupa unidades (ex.: Óticas Carol)
  status text not null default 'ativo'
    check (status in ('ativo', 'pausado', 'encerrado')),
  responsavel_id uuid references public.membros (id) on delete set null,
  cliente_desde date,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger clientes_atualizado_em
  before update on public.clientes
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------
-- Serviços (catálogo) e serviços contratados por cliente
-- ---------------------------------------------------------------
create table public.servicos (
  codigo text primary key,
  nome text not null,
  pilar text not null check (pilar in ('trafego', 'social', 'gmn', 'cs'))
);

insert into public.servicos (codigo, nome, pilar) values
  ('trafego_meta',   'Tráfego Meta Ads',     'trafego'),
  ('trafego_google', 'Tráfego Google Ads',   'trafego'),
  ('gmn',            'Google Meu Negócio',   'gmn'),
  ('social_media',   'Social Media',         'social'),
  ('consultoria',    'Assessoria Estratégica', 'cs');

create table public.cliente_servicos (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  servico_codigo text not null references public.servicos (codigo),
  valor_mensal numeric(12, 2),
  inicio date,
  primary key (cliente_id, servico_codigo)
);

create index cliente_servicos_servico_idx on public.cliente_servicos (servico_codigo);
create index clientes_responsavel_idx on public.clientes (responsavel_id);

-- ---------------------------------------------------------------
-- Regras de acesso (RLS)
-- ---------------------------------------------------------------
alter table public.membros enable row level security;
alter table public.clientes enable row level security;
alter table public.servicos enable row level security;
alter table public.cliente_servicos enable row level security;

create policy "membros: time lê" on public.membros
  for select to authenticated using ((select public.eh_membro()));
create policy "membros: admin altera" on public.membros
  for all to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));

create policy "clientes: time lê e altera" on public.clientes
  for all to authenticated using ((select public.eh_membro())) with check ((select public.eh_membro()));

create policy "servicos: time lê" on public.servicos
  for select to authenticated using ((select public.eh_membro()));

create policy "cliente_servicos: time lê e altera" on public.cliente_servicos
  for all to authenticated using ((select public.eh_membro())) with check ((select public.eh_membro()));

revoke execute on function public.eh_membro() from anon;
revoke execute on function public.eh_admin() from anon;
revoke execute on function public.vincular_membro() from anon, authenticated;

-- ---------------------------------------------------------------
-- Base inicial
-- ---------------------------------------------------------------
insert into public.membros (email, nome, papel) values
  ('agenciavertentedigital@gmail.com', 'Rener', 'admin');

insert into public.clientes (nome, origem, marca) values
  ('Clínica Nobre Fio', 'vertente', null),
  ('Agência Vertente Digital', 'vertente', null),
  ('Óticas Carol SVA - Ipatinga', 'vertente', 'Óticas Carol'),
  ('Óticas Carol Santa Maria', 'vertente', 'Óticas Carol'),
  ('Óticas Carol RJ - Bangu Shopping', 'vertente', 'Óticas Carol'),
  ('Óticas Carol - West Shopping', 'vertente', 'Óticas Carol'),
  ('Óticas Carol - Carioca Shopping', 'vertente', 'Óticas Carol'),
  ('Óticas Carol - Bangu Centro', 'vertente', 'Óticas Carol'),
  ('Espaço Larissa Lemos', 'vertente', null),
  ('Lourdes Samora', 'vertente', null),
  ('Madalena Brandão', 'vertente', null),
  ('Cecy Lessa', 'vertente', null),
  ('CDT Porto Seguro', 'vertente', null),
  ('Tríade Fibra', 'parceria_marcone', null),
  ('Apple Mania', 'parceria_marcone', null),
  ('Ital''in House', 'parceria_marcone', null),
  ('Gildomar Baterias', 'parceria_marcone', null),
  ('Dra Marcela Galli', 'parceria_marcone', null),
  ('Aloísio Gás', 'parceria_marcone', null),
  ('Plus Sain', 'parceria_marcone', null);
