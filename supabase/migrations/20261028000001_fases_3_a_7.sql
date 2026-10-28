-- Fases 3 a 7 · Google Meu Negócio, Social Media, Financeiro, Saúde dos clientes, Cadastro e Contratos.

-- ---------------------------------------------------------------
-- Ficha cadastral do cliente (Fase 7) e cobrança (Fase 5)
-- ---------------------------------------------------------------
alter table public.clientes
  add column razao_social text,
  add column documento text,              -- CNPJ ou CPF
  add column contato_nome text,
  add column contato_telefone text,
  add column contato_email text,
  add column endereco text,
  add column cidade text,
  add column segmento text,
  add column instagram text,
  add column site text,
  add column link_gmn text,
  add column dia_vencimento int check (dia_vencimento between 1 and 31),
  add column forma_pagamento text;        -- pix, boleto, cartão…

-- ---------------------------------------------------------------
-- Google Meu Negócio (Fase 3)
-- ---------------------------------------------------------------
create table public.gmn_perfis (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes (id) on delete cascade,  -- nulo = prospecção
  nome text not null,
  place_id text,
  endereco text,
  cidade text,
  categoria text,
  url_maps text,
  palavras text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index gmn_perfis_cliente_idx on public.gmn_perfis (cliente_id);

create table public.gmn_analises (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.gmn_perfis (id) on delete cascade,
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  nota int not null check (nota between 0 and 100),
  criterios jsonb not null default '[]',   -- [{id, nivel: 0|1|2, obs}]
  dados jsonb not null default '{}',       -- números lidos do Google (nota, avaliações, fotos…)
  origem text not null default 'manual' check (origem in ('manual', 'google')),
  observacoes text,
  autor_id uuid references public.membros (id) on delete set null default privado.membro_atual(),
  criado_em timestamptz not null default now()
);
create index gmn_analises_perfil_idx on public.gmn_analises (perfil_id, data desc);

-- ---------------------------------------------------------------
-- Social Media (Fase 4)
-- ---------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  data date not null,
  formato text not null default 'feed' check (formato in ('feed', 'carrossel', 'reels', 'stories')),
  tema text not null,
  legenda text,
  status text not null default 'ideia'
    check (status in ('ideia', 'producao', 'aprovacao', 'ajuste', 'aprovado', 'publicado')),
  responsavel_id uuid references public.membros (id) on delete set null,
  link_material text,
  link_publicado text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index posts_cliente_data_idx on public.posts (cliente_id, data);
create index posts_data_idx on public.posts (data);
create trigger posts_atualizado_em before update on public.posts
  for each row execute function privado.tocar_atualizado_em();

-- ---------------------------------------------------------------
-- Financeiro (Fase 5) · só administradores
-- ---------------------------------------------------------------
create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('receita', 'despesa')),
  cliente_id uuid references public.clientes (id) on delete set null,
  descricao text not null,
  categoria text not null default 'Mensalidade',
  valor numeric(12, 2) not null check (valor >= 0),
  competencia date not null,               -- primeiro dia do mês de referência
  vencimento date not null,
  pago_em date,
  forma text,
  observacoes text,
  criado_em timestamptz not null default now()
);
create index lancamentos_competencia_idx on public.lancamentos (competencia);
create index lancamentos_cliente_idx on public.lancamentos (cliente_id);
create unique index lancamentos_mensalidade_unica
  on public.lancamentos (cliente_id, competencia) where tipo = 'receita' and categoria = 'Mensalidade';

-- Cria as mensalidades do mês a partir dos serviços contratados (não duplica)
create or replace function public.gerar_mensalidades(mes date)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inicio date := date_trunc('month', mes)::date;
  criadas int;
begin
  if not (select privado.eh_admin()) then
    raise exception 'Só administradores geram mensalidades';
  end if;
  insert into public.lancamentos (tipo, cliente_id, descricao, categoria, valor, competencia, vencimento, forma)
  select 'receita', c.id, 'Mensalidade ' || c.nome, 'Mensalidade', s.total, inicio,
         least(inicio + (coalesce(c.dia_vencimento, 10) - 1), (inicio + interval '1 month - 1 day')::date),
         c.forma_pagamento
    from public.clientes c
    join (select cliente_id, sum(valor_mensal) total from public.cliente_servicos group by cliente_id) s on s.cliente_id = c.id
   where c.status = 'ativo' and s.total > 0
  on conflict do nothing;
  get diagnostics criadas = row_count;
  return criadas;
end;
$$;
revoke execute on function public.gerar_mensalidades(date) from public, anon;
grant execute on function public.gerar_mensalidades(date) to authenticated;

-- ---------------------------------------------------------------
-- Contratos (Fase 7)
-- ---------------------------------------------------------------
create table public.contrato_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  corpo text not null,                      -- com {{variaveis}}
  criado_em timestamptz not null default now()
);

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  modelo_id uuid references public.contrato_modelos (id) on delete set null,
  titulo text not null,
  corpo text not null,
  valor_mensal numeric(12, 2),
  inicio date,
  meses int,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'assinado', 'cancelado')),
  enviado_em timestamptz,
  assinado_em date,
  criado_em timestamptz not null default now()
);
create index contratos_cliente_idx on public.contratos (cliente_id);

-- ---------------------------------------------------------------
-- Link de cadastro para o cliente preencher (Fase 7)
-- ---------------------------------------------------------------
create table public.cadastro_links (
  token text primary key default encode(extensions.gen_random_bytes(16), 'hex'),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  expira_em timestamptz not null default now() + interval '30 days',
  preenchido_em timestamptz,
  respostas jsonb,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Segredos de integrações (Google, etc.) lidos só pelas funções do servidor
-- ---------------------------------------------------------------
create or replace function public.ler_segredo(nome text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = nome limit 1;
$$;
revoke execute on function public.ler_segredo(text) from public, anon, authenticated;
grant execute on function public.ler_segredo(text) to service_role;

-- ---------------------------------------------------------------
-- Regras de acesso
-- ---------------------------------------------------------------
alter table public.gmn_perfis enable row level security;
alter table public.gmn_analises enable row level security;
alter table public.posts enable row level security;
alter table public.lancamentos enable row level security;
alter table public.contrato_modelos enable row level security;
alter table public.contratos enable row level security;
alter table public.cadastro_links enable row level security;

create policy "gmn_perfis: time" on public.gmn_perfis
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
create policy "gmn_analises: time" on public.gmn_analises
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
create policy "posts: time" on public.posts
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
create policy "lancamentos: admin" on public.lancamentos
  for all to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy "contrato_modelos: time lê" on public.contrato_modelos
  for select to authenticated using ((select privado.eh_membro()));
create policy "contrato_modelos: admin altera" on public.contrato_modelos
  for all to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy "contratos: time lê" on public.contratos
  for select to authenticated using ((select privado.eh_membro()));
create policy "contratos: admin altera" on public.contratos
  for all to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy "cadastro_links: time" on public.cadastro_links
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

-- ---------------------------------------------------------------
-- Modelo de contrato inicial
-- ---------------------------------------------------------------
insert into public.contrato_modelos (nome, corpo) values (
'Prestação de serviços de marketing digital',
$m$CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MARKETING DIGITAL

CONTRATANTE: {{razao_social}}, inscrita no CPF/CNPJ sob o nº {{documento}}, com endereço em {{endereco}}, {{cidade}}, neste ato representada por {{contato_nome}}.

CONTRATADA: VERTENTE DIGITAL, agência de marketing digital, doravante denominada AGÊNCIA.

1. OBJETO
1.1. A AGÊNCIA prestará à CONTRATANTE os seguintes serviços: {{servicos}}.
1.2. O investimento em mídia (valor pago diretamente às plataformas de anúncio) não está incluído e é de responsabilidade da CONTRATANTE.

2. VALOR E PAGAMENTO
2.1. Pelos serviços, a CONTRATANTE pagará o valor mensal de {{valor_mensal}}, com vencimento todo dia {{dia_vencimento}}, por {{forma_pagamento}}.
2.2. O atraso superior a 10 dias poderá suspender a execução dos serviços até a regularização.

3. PRAZO
3.1. Este contrato vigora por {{meses}} meses a partir de {{inicio}}, renovando-se automaticamente por iguais períodos se nenhuma das partes se manifestar com 30 dias de antecedência.

4. OBRIGAÇÕES DA CONTRATANTE
4.1. Fornecer acessos, materiais e informações necessárias em tempo hábil.
4.2. Manter saldo e forma de pagamento ativos nas plataformas de anúncio.

5. OBRIGAÇÕES DA AGÊNCIA
5.1. Executar os serviços com diligência, apresentando acompanhamento e relatórios periódicos.
5.2. Manter sigilo sobre as informações da CONTRATANTE.

6. RESCISÃO
6.1. Qualquer das partes pode rescindir este contrato mediante aviso prévio de 30 dias.

{{cidade_agencia}}, {{data_hoje}}.


______________________________________
{{razao_social}}

______________________________________
VERTENTE DIGITAL$m$
);
