-- Situação das integrações e configuração do WhatsApp pela tela de Configurações (só administradores)
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
    from unnest(array['meta_access_token','google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo']) n
  );
end;
$$;

create or replace function public.whatsapp_config()
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
  return jsonb_build_object(
    'webhook', 'https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/whatsapp?chave=' ||
      coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_webhook_chave'), ''),
    'grupo', (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_grupo')
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
  if nome not in ('google_places_key','openai_api_key','anthropic_api_key','zapi_instancia','zapi_token','zapi_client_token','whatsapp_grupo') then
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

revoke execute on function public.integracoes_status() from public, anon;
revoke execute on function public.whatsapp_config() from public, anon;
revoke execute on function public.definir_integracao(text, text) from public, anon;
grant execute on function public.integracoes_status() to authenticated;
grant execute on function public.whatsapp_config() to authenticated;
grant execute on function public.definir_integracao(text, text) to authenticated;

select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'whatsapp_webhook_chave');
