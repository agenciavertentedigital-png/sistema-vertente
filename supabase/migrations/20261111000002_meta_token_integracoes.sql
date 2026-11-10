-- Permite trocar o token da Meta pela tela de Integrações (só administradores)
create or replace function public.definir_integracao(nome text, valor text)
returns void language plpgsql security definer set search_path = '' as $function$
declare existente uuid;
begin
  if not (select privado.eh_admin()) then raise exception 'Só administradores'; end if;
  if nome not in ('meta_access_token','google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo','dataforseo_login','dataforseo_senha',
                  'google_ads_mcc','google_ads_dev_token','google_ads_client_id','google_ads_client_secret',
                  'evolution_url','evolution_apikey','evolution_instancia') then
    raise exception 'Integração desconhecida';
  end if;
  select id into existente from vault.secrets where name = nome;
  if existente is null then perform vault.create_secret(valor, nome);
  else perform vault.update_secret(existente, valor); end if;
end; $function$;
