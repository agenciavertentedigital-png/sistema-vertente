-- WhatsApp pela Evolution API (QR code): credenciais no cofre, grupos ligados aos clientes e mensagens sem duplicar

create or replace function public.definir_integracao(nome text, valor text)
returns void language plpgsql security definer set search_path = '' as $function$
declare existente uuid;
begin
  if not (select privado.eh_admin()) then raise exception 'Só administradores'; end if;
  if nome not in ('google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo','dataforseo_login','dataforseo_senha',
                  'google_ads_mcc','google_ads_dev_token','google_ads_client_id','google_ads_client_secret',
                  'evolution_url','evolution_apikey','evolution_instancia') then
    raise exception 'Integração desconhecida';
  end if;
  select id into existente from vault.secrets where name = nome;
  if existente is null then perform vault.create_secret(valor, nome);
  else perform vault.update_secret(existente, valor); end if;
end; $function$;

create or replace function public.integracoes_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  if not (select privado.eh_admin()) then raise exception 'Só administradores'; end if;
  return (
    select jsonb_object_agg(n, exists (select 1 from vault.decrypted_secrets s where s.name = n and coalesce(s.decrypted_secret, '') <> ''))
    from unnest(array['meta_access_token','google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo','dataforseo_login','dataforseo_senha',
                      'google_ads_mcc','google_ads_dev_token','google_ads_client_id','google_ads_client_secret','google_ads_refresh_token',
                      'evolution_url','evolution_apikey','evolution_instancia']) n
  );
end; $function$;

-- Cada grupo do WhatsApp: a que cliente pertence e que tipo de grupo é
create table if not exists public.whatsapp_grupos (
  grupo text primary key,
  nome text,
  cliente_id uuid references public.clientes(id) on delete set null,
  tipo text not null default 'pendente' check (tipo in ('pendente', 'cliente', 'time', 'parceria', 'suporte', 'ignorar')),
  atualizado_em timestamptz not null default now()
);
alter table public.whatsapp_grupos enable row level security;
drop policy if exists "whatsapp_grupos: time" on public.whatsapp_grupos;
create policy "whatsapp_grupos: time" on public.whatsapp_grupos for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

-- Mensagens: id da mensagem (evita duplicar quando o webhook repete) e papel "grupo" para as conversas dos clientes
alter table public.whatsapp_mensagens add column if not exists msg_id text;
create unique index if not exists whatsapp_mensagens_msg_id on public.whatsapp_mensagens (msg_id) where msg_id is not null;
alter table public.whatsapp_mensagens drop constraint if exists whatsapp_mensagens_papel_check;
alter table public.whatsapp_mensagens add constraint whatsapp_mensagens_papel_check check (papel in ('user', 'assistant', 'ignorada', 'grupo'));
drop policy if exists "whatsapp_mensagens: time lê" on public.whatsapp_mensagens;
create policy "whatsapp_mensagens: time lê" on public.whatsapp_mensagens for select to authenticated using ((select privado.eh_membro()));
