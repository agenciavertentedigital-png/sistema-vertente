-- Rastreamento próprio · Fase 1: links de rastreio e cliques (origem de cada conversa no WhatsApp)

create table if not exists public.rastreio_links (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  nome text not null,
  canal text not null default 'site' check (canal in ('site', 'bio', 'gmn', 'anuncio', 'qr', 'email', 'outro')),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  mensagem text not null default 'Olá! Vim pelo site e gostaria de mais informações.',
  codigo_visivel boolean not null default false,
  utm jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_por uuid default privado.membro_atual() references public.membros(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists rastreio_links_cliente on public.rastreio_links (cliente_id);
alter table public.rastreio_links enable row level security;
drop policy if exists "rastreio_links: time" on public.rastreio_links;
create policy "rastreio_links: time" on public.rastreio_links for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

-- Cada clique vira um código curto que vai escondido na primeira mensagem; na Fase 2 a conversa é ligada por ele
create table if not exists public.rastreio_cliques (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.rastreio_links(id) on delete set null,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  codigo text not null unique,
  origem text not null default 'direto',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  campaign_id text,
  adset_id text,
  ad_id text,
  gclid text,
  gbraid text,
  wbraid text,
  fbclid text,
  fbc text,
  fbp text,
  pagina text,
  referencia text,
  dispositivo text,
  navegador text,
  ip_hash text,
  primeiro_toque jsonb,
  conversa_id text,
  conversa_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists rastreio_cliques_cliente on public.rastreio_cliques (cliente_id, criado_em desc);
create index if not exists rastreio_cliques_link on public.rastreio_cliques (link_id, criado_em desc);
alter table public.rastreio_cliques enable row level security;
drop policy if exists "rastreio_cliques: time lê" on public.rastreio_cliques;
create policy "rastreio_cliques: time lê" on public.rastreio_cliques for select to authenticated using ((select privado.eh_membro()));
drop policy if exists "rastreio_cliques: time apaga" on public.rastreio_cliques;
create policy "rastreio_cliques: time apaga" on public.rastreio_cliques for delete to authenticated using ((select privado.eh_membro()));
