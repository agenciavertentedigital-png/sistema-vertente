-- Diagnóstico Digital Gratuito: página pública (sem login) em /diagnostico.
-- O visitante responde o quiz; quem passa na nota de corte (verba >= R$1.500 em anúncios e faturamento > R$30 mil/mês)
-- informa ficha do Google, site e Instagram. Tudo é gravado pela função pública diagnostico-publico (service role);
-- o time só lê e atualiza por aqui (RLS).

create table if not exists public.diagnostico_leads (
  id uuid primary key default gen_random_uuid(),
  sessao uuid not null unique,                      -- gerado no navegador, permite gravar em etapas sem duplicar
  etapa text not null default 'qualificado' check (etapa in ('desqualificado', 'qualificado', 'completo')),
  motivo_corte text,                                -- 'verba', 'faturamento' ou 'verba_e_faturamento'
  nome text,
  empresa text,
  segmento text,
  faturamento text,
  verba text,
  ja_investe text,
  desafio text,
  atendimento text,
  decisor text,
  whatsapp text,
  oque_vende text,
  instagram text,
  site text,
  sem_site boolean not null default false,
  google_place_id text,
  google_nome text,
  google_endereco text,
  google_nota numeric(2,1),
  google_avaliacoes integer,
  google_categoria text,
  google_link text,
  aceite_lgpd boolean not null default false,
  utm jsonb not null default '{}'::jsonb,           -- utm_source, utm_campaign, fbclid… para saber de qual anúncio veio
  origem_url text,
  status text not null default 'novo' check (status in ('novo', 'em_contato', 'reuniao', 'proposta', 'cliente', 'perdido')),
  observacao text,
  ip_hash text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists diagnostico_leads_criado on public.diagnostico_leads (criado_em desc);
create index if not exists diagnostico_leads_whatsapp on public.diagnostico_leads (whatsapp) where whatsapp is not null;
alter table public.diagnostico_leads enable row level security;
drop policy if exists "diagnostico_leads: time lê" on public.diagnostico_leads;
create policy "diagnostico_leads: time lê" on public.diagnostico_leads for select to authenticated using ((select privado.eh_membro()));
drop policy if exists "diagnostico_leads: time atualiza" on public.diagnostico_leads;
create policy "diagnostico_leads: time atualiza" on public.diagnostico_leads for update to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
drop policy if exists "diagnostico_leads: admin apaga" on public.diagnostico_leads;
create policy "diagnostico_leads: admin apaga" on public.diagnostico_leads for delete to authenticated using ((select privado.eh_admin()));

drop trigger if exists diagnostico_leads_tocar on public.diagnostico_leads;
create trigger diagnostico_leads_tocar before update on public.diagnostico_leads
  for each row execute function privado.tocar_atualizado_em();

-- Configuração da página (uma linha só): WhatsApp comercial e link do conteúdo gratuito para quem não passa no corte
create table if not exists public.diagnostico_config (
  id boolean primary key default true check (id),
  whatsapp text,
  mensagem_whatsapp text not null default 'Olá! Acabei de fazer o Diagnóstico Digital da Vertente e quero conversar sobre o plano de execução.',
  link_conteudo text,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
insert into public.diagnostico_config (id) values (true) on conflict do nothing;
alter table public.diagnostico_config enable row level security;
drop policy if exists "diagnostico_config: time lê" on public.diagnostico_config;
create policy "diagnostico_config: time lê" on public.diagnostico_config for select to authenticated using ((select privado.eh_membro()));
drop policy if exists "diagnostico_config: admin edita" on public.diagnostico_config;
create policy "diagnostico_config: admin edita" on public.diagnostico_config for update to authenticated
  using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

-- Limite de uso por visitante (protege a cota paga da API do Google contra abuso)
create table if not exists public.diagnostico_uso (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  acao text not null,
  criado_em timestamptz not null default now()
);
create index if not exists diagnostico_uso_ip on public.diagnostico_uso (ip_hash, criado_em desc);
alter table public.diagnostico_uso enable row level security;
-- sem políticas: só a função (service role) lê e grava
