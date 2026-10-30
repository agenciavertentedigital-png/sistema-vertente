-- DataForSEO na tela de Integrações
create or replace function public.integracoes_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select privado.eh_admin()) then
    raise exception 'Só administradores';
  end if;
  return (
    select jsonb_object_agg(n, exists (select 1 from vault.decrypted_secrets s where s.name = n and coalesce(s.decrypted_secret, '') <> ''))
    from unnest(array['meta_access_token','google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo','dataforseo_login','dataforseo_senha']) n
  );
end;
$$;

-- Guarda um segredo de integração (cria ou atualiza). Só os nomes da lista são aceitos.
create or replace function public.definir_integracao(nome text, valor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existente uuid;
begin
  if not (select privado.eh_admin()) then
    raise exception 'Só administradores';
  end if;
  if nome not in ('google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo','dataforseo_login','dataforseo_senha') then
    raise exception 'Integração desconhecida';
  end if;
  select id into existente from vault.secrets where name = nome;
  if existente is null then
    perform vault.create_secret(valor, nome);
  else
    perform vault.update_secret(existente, valor);
  end if;
end;
$$;

