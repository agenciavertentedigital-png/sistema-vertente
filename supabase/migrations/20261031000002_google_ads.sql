-- Google Ads: chaves na tela de Integrações e o refresh token gravado pela própria função (OAuth)
create or replace function public.integracoes_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select privado.eh_admin()) then raise exception 'Só administradores'; end if;
  return (
    select jsonb_object_agg(n, exists (select 1 from vault.decrypted_secrets s where s.name = n and coalesce(s.decrypted_secret, '') <> ''))
    from unnest(array['meta_access_token','google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo','dataforseo_login','dataforseo_senha',
                      'google_ads_mcc','google_ads_dev_token','google_ads_client_id','google_ads_client_secret','google_ads_refresh_token']) n
  );
end; $$;

create or replace function public.definir_integracao(nome text, valor text)
returns void language plpgsql security definer set search_path = '' as $$
declare existente uuid;
begin
  if not (select privado.eh_admin()) then raise exception 'Só administradores'; end if;
  if nome not in ('google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo','dataforseo_login','dataforseo_senha',
                  'google_ads_mcc','google_ads_dev_token','google_ads_client_id','google_ads_client_secret') then
    raise exception 'Integração desconhecida';
  end if;
  select id into existente from vault.secrets where name = nome;
  if existente is null then perform vault.create_secret(valor, nome);
  else perform vault.update_secret(existente, valor); end if;
end; $$;

-- Só o servidor (função google-ads) grava o refresh token depois que o admin autoriza no Google
create or replace function public.guardar_segredo_servidor(nome text, valor text)
returns void language plpgsql security definer set search_path = '' as $$
declare existente uuid;
begin
  if nome not in ('google_ads_refresh_token') then raise exception 'Segredo não permitido'; end if;
  select id into existente from vault.secrets where name = nome;
  if existente is null then perform vault.create_secret(valor, nome);
  else perform vault.update_secret(existente, valor); end if;
end; $$;
revoke all on function public.guardar_segredo_servidor(text, text) from public, anon, authenticated;
grant execute on function public.guardar_segredo_servidor(text, text) to service_role;

-- Sincronização automática junto com a da Meta
select cron.schedule('sincronizar-google-ads', '5 10,15,20 * * *', $$
  select net.http_post(
    url := 'https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/google-ads',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-chave-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'chave_cron_meta')),
    body := '{"acao":"sincronizar"}'::jsonb, timeout_milliseconds := 120000);
$$);
