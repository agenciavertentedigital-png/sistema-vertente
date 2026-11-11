-- Agente Gestor de Tráfego (IA): membro do sistema sem login que faz as Revisões diárias
insert into public.membros (email, nome, papel, ativo, acesso)
select 'agente.trafego@agenciavertente.com.br', 'Agente de Tráfego · IA', 'gestor', true, false
where not exists (select 1 from public.membros where email = 'agente.trafego@agenciavertente.com.br');

do $$
declare v_agente uuid; v_rotina uuid;
begin
  select id into v_agente from public.membros where email = 'agente.trafego@agenciavertente.com.br';
  select id into v_rotina from public.rotinas where nome ilike 'revis%di%' order by criado_em limit 1;
  if v_rotina is null then return; end if;

  -- Revisão diária para todo cliente ativo com conta de anúncio e sem a rotina
  insert into public.cliente_rotinas (cliente_id, rotina_id, canal, responsavel_id, frequencia, ativa)
  select c.id, v_rotina, 'meta', v_agente, 'diaria', true
  from public.clientes c
  where c.status = 'ativo'
    and exists (select 1 from public.contas_anuncio a where a.cliente_id = c.id and a.ativa)
    and not exists (select 1 from public.cliente_rotinas cr where cr.cliente_id = c.id and cr.rotina_id = v_rotina);

  -- Revisões de clientes com conta de anúncio passam para o agente
  update public.cliente_rotinas cr set responsavel_id = v_agente
  where cr.rotina_id = v_rotina and cr.ativa
    and exists (select 1 from public.contas_anuncio a where a.cliente_id = cr.cliente_id and a.ativa);

  update public.tarefas t set responsavel_id = v_agente
  from public.cliente_rotinas cr
  where t.cliente_rotina_id = cr.id and cr.rotina_id = v_rotina and cr.responsavel_id = v_agente
    and t.status in ('a_fazer', 'fazendo');
end $$;

-- Rodadas às 07h10–07h58 (logo após a sincronização da Meta das 07h)
select cron.unschedule('agente-trafego') where exists (select 1 from cron.job where jobname = 'agente-trafego');
select cron.schedule('agente-trafego', '10,16,22,28,34,40,46,52,58 10 * * *', $c$
  select net.http_post(
    url := 'https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/agente-trafego',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-chave-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'chave_cron_meta')),
    body := '{}'::jsonb, timeout_milliseconds := 150000);
$c$);

select privado.gerar_rotinas();
