-- Fase 2 · Gestão de Tráfego: contas de anúncio e métricas diárias vindas da API da Meta.
-- Escrita só pela função sincronizar-meta (service role). O time lê.

create extension if not exists pg_net with schema extensions;

create table public.contas_anuncio (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  plataforma text not null default 'meta' check (plataforma in ('meta', 'google')),
  conta_id text not null,                    -- id numérico da conta (sem "act_")
  nome text not null,
  moeda text,
  ativa boolean not null default true,       -- sincroniza e aparece na visão geral
  status text,                               -- ativa | desativada | pagamento_pendente | em_analise | fechada | ...
  motivo_bloqueio text,
  pre_paga boolean,
  saldo numeric(14,2),                       -- saldo disponível (pré-paga), quando a Meta informa
  saldo_texto text,                          -- texto da forma de pagamento como a Meta mostra
  limite_gasto numeric(14,2),
  gasto_total numeric(14,2),
  ultimo_sync timestamptz,
  erro_sync text,
  alerta_status_enviado text,                -- último status que gerou aviso (evita repetir)
  alerta_saldo_em date,                      -- último dia que avisou saldo baixo
  criado_em timestamptz not null default now(),
  unique (plataforma, conta_id)
);
create index contas_anuncio_cliente on public.contas_anuncio (cliente_id);

create table public.metricas_diarias (
  conta_id uuid not null references public.contas_anuncio(id) on delete cascade,
  data date not null,
  campanha_id text not null,
  campanha text not null,
  objetivo text,
  status_campanha text,
  gasto numeric(14,2) not null default 0,
  impressoes integer not null default 0,
  alcance integer not null default 0,
  cliques integer not null default 0,        -- cliques no link
  resultados numeric(14,2) not null default 0,
  tipo_resultado text,                       -- indicador da Meta (ex.: onsite_conversion.messaging_conversation_started_7d)
  leads integer not null default 0,
  conversas integer not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (conta_id, data, campanha_id)
);
create index metricas_diarias_data on public.metricas_diarias (data);

alter table public.contas_anuncio enable row level security;
alter table public.metricas_diarias enable row level security;

create policy "contas_anuncio: time lê" on public.contas_anuncio for select to authenticated using ((select privado.eh_membro()));
create policy "contas_anuncio: admin vincula" on public.contas_anuncio for insert to authenticated with check ((select privado.eh_admin()));
create policy "contas_anuncio: admin edita" on public.contas_anuncio for update to authenticated using ((select privado.eh_admin()));
create policy "contas_anuncio: admin remove" on public.contas_anuncio for delete to authenticated using ((select privado.eh_admin()));
create policy "metricas_diarias: time lê" on public.metricas_diarias for select to authenticated using ((select privado.eh_membro()));

-- Agendamento: 07h, 12h e 17h (horário de Brasília). A chave fica no Vault e a função confere por validar_chave_cron.
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'chave_cron_meta', 'Chave que o agendamento usa para chamar sincronizar-meta');

create or replace function public.validar_chave_cron(chave text)
returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'chave_cron_meta' and decrypted_secret = chave);
$$;
revoke all on function public.validar_chave_cron(text) from public, anon, authenticated;
grant execute on function public.validar_chave_cron(text) to service_role;

select cron.schedule('sincronizar-meta', '0 10,15,20 * * *', $$
  select net.http_post(
    url := 'https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/sincronizar-meta',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-chave-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'chave_cron_meta')),
    body := '{"origem":"agendamento"}'::jsonb, timeout_milliseconds := 120000);
$$);

-- Visão por conta e dia (por tipo de resultado), usada na Visão geral.
create view public.metricas_conta_dia with (security_invoker = true) as
select conta_id, data, coalesce(tipo_resultado, '') as tipo_resultado,
  sum(gasto)::numeric(14,2) as gasto, sum(impressoes)::int as impressoes, sum(cliques)::int as cliques,
  sum(resultados)::numeric(14,2) as resultados, sum(leads)::int as leads, sum(conversas)::int as conversas
from public.metricas_diarias
group by conta_id, data, coalesce(tipo_resultado, '');

-- Token da Meta guardado no Vault (valor inserido direto no banco, fora do repositório):
-- select vault.create_secret('<token>', 'meta_access_token', 'Token da Meta Ads');
create or replace function public.ler_token_meta()
returns text language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'meta_access_token' order by created_at desc limit 1;
$$;
revoke all on function public.ler_token_meta() from public, anon, authenticated;
grant execute on function public.ler_token_meta() to service_role;
