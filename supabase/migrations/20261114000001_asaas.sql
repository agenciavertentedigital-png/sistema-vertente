-- Integração com o Asaas: baixa automática das receitas pelo webhook, vínculo de clientes e cobranças.

alter table public.clientes add column if not exists asaas_id text;
create unique index if not exists clientes_asaas_id_uk on public.clientes (asaas_id) where asaas_id is not null;

alter table public.lancamentos add column if not exists asaas_id text;
alter table public.lancamentos add column if not exists asaas_link text;
create unique index if not exists lancamentos_asaas_id_uk on public.lancamentos (asaas_id) where asaas_id is not null;

-- Registro de tudo que o Asaas mandou (para conferência e para não processar duas vezes)
create table if not exists public.asaas_eventos (
  id text primary key,                 -- id do evento no Asaas
  evento text not null,
  cobranca_id text,
  cliente_asaas text,
  valor numeric,
  resultado text,
  lancamento_id uuid references public.lancamentos(id) on delete set null,
  payload jsonb,
  criado_em timestamptz not null default now()
);
alter table public.asaas_eventos enable row level security;
drop policy if exists asaas_eventos_admin on public.asaas_eventos;
create policy asaas_eventos_admin on public.asaas_eventos for select using ((select privado.eh_admin()));

-- Aviso financeiro: só para administradores (não vai para o grupo do time)
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check check (tipo = any (array['mencao','atribuicao','alerta','financeiro']));

-- Token que o Asaas manda no webhook (gerado aqui, nunca sai do cofre)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'asaas_webhook_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'asaas_webhook_token');
  end if;
end $$;

create or replace function public.definir_integracao(nome text, valor text)
 returns void language plpgsql security definer set search_path to '' as $function$
declare existente uuid;
begin
  if not (select privado.eh_admin()) then raise exception 'Só administradores'; end if;
  if nome not in ('meta_access_token','google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo','dataforseo_login','dataforseo_senha',
                  'google_ads_mcc','google_ads_dev_token','google_ads_client_id','google_ads_client_secret',
                  'evolution_url','evolution_apikey','evolution_instancia','asaas_api_key') then
    raise exception 'Integração desconhecida';
  end if;
  select id into existente from vault.secrets where name = nome;
  if existente is null then perform vault.create_secret(valor, nome);
  else perform vault.update_secret(existente, valor); end if;
end; $function$;

create or replace function public.integracoes_status()
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not (select privado.eh_admin()) then raise exception 'Só administradores'; end if;
  return (
    select jsonb_object_agg(n, exists (select 1 from vault.decrypted_secrets s where s.name = n and coalesce(s.decrypted_secret, '') <> ''))
    from unnest(array['meta_access_token','google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo','dataforseo_login','dataforseo_senha',
                      'google_ads_mcc','google_ads_dev_token','google_ads_client_id','google_ads_client_secret','google_ads_refresh_token',
                      'evolution_url','evolution_apikey','evolution_instancia','asaas_api_key']) n
  );
end; $function$;
