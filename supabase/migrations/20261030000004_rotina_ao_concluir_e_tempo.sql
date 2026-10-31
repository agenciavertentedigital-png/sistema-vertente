-- 1) Rotinas recorrentes ao concluir: a próxima tarefa nasce na hora, com checklist e comentários
-- 2) Controle de tempo nas tarefas (estimativa, tempo gasto, cronômetro automático em "Fazendo")

alter table public.tarefas
  add column if not exists estimativa_min integer check (estimativa_min is null or estimativa_min >= 0),
  add column if not exists tempo_min integer not null default 0 check (tempo_min >= 0),
  add column if not exists fazendo_desde timestamptz;

-- Cronômetro: entra em "fazendo" marca o início; ao sair, soma o tempo (no máximo 8h por vez)
create or replace function privado.tarefas_antes_de_gravar()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  new.atualizado_em = now();
  if new.status in ('feita', 'nao_feita') then
    if tg_op = 'INSERT' or old.status not in ('feita', 'nao_feita') then
      new.concluida_em = now();
    end if;
  else
    new.concluida_em = null;
  end if;
  if tg_op = 'INSERT' and new.criado_por is null then
    new.criado_por = privado.membro_atual();
  end if;

  if new.status = 'fazendo' then
    if tg_op = 'INSERT' or old.status is distinct from 'fazendo' then
      new.fazendo_desde = now();
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'fazendo' and old.fazendo_desde is not null then
    new.tempo_min = coalesce(new.tempo_min, 0)
      + least(480, greatest(0, round(extract(epoch from (now() - old.fazendo_desde)) / 60)::int));
    new.fazendo_desde = null;
  elsif new.status <> 'fazendo' then
    new.fazendo_desde = null;
  end if;
  return new;
end;
$function$;

-- Comentários copiados de uma rotina não devem disparar menções de novo
create or replace function privado.apos_comentario()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  t record;
  autor text;
begin
  if current_setting('vertente.copiando_rotina', true) = '1' then
    return new;
  end if;
  select ta.titulo, ta.cliente_id, c.nome as cliente into t
  from public.tarefas ta join public.clientes c on c.id = ta.cliente_id where ta.id = new.tarefa_id;
  select nome into autor from public.membros where id = new.autor_id;
  perform privado.notificar_mencoes(new.texto, new.autor_id, t.cliente_id, new.tarefa_id, null,
    coalesce(autor, 'Alguém') || ' mencionou você em "' || t.titulo || '" (' || t.cliente || '): ' || left(new.texto, 140));
  return new;
end;
$function$;

create or replace function privado.rotina_ao_concluir()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  cr record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  prox date;
  nova uuid;
begin
  if new.cliente_rotina_id is null or new.status not in ('feita', 'nao_feita')
     or old.status in ('feita', 'nao_feita') then
    return new;
  end if;

  select r.*, ro.ativa as modelo_ativo, c.status as cliente_status into cr
  from public.cliente_rotinas r
  join public.rotinas ro on ro.id = r.rotina_id
  join public.clientes c on c.id = r.cliente_id
  where r.id = new.cliente_rotina_id;
  if not found or not cr.ativa or not cr.modelo_ativo or cr.cliente_status <> 'ativo' then
    return new;
  end if;

  -- Já existe outra aberta desta rotina? Não duplica
  if exists (select 1 from public.tarefas t
             where t.cliente_rotina_id = cr.id and t.id <> new.id
               and t.status in ('a_fazer', 'fazendo', 'aguardando')) then
    return new;
  end if;

  prox := privado.proxima_data(cr.frequencia, cr.dia_semana, cr.dia_mes, greatest(coalesce(new.prazo, hoje), hoje));

  insert into public.tarefas
    (cliente_id, titulo, descricao, pilar, canal, responsavel_id, prazo, prioridade, cliente_rotina_id, origem, estimativa_min)
  values
    (new.cliente_id, new.titulo, new.descricao, new.pilar, new.canal, coalesce(cr.responsavel_id, new.responsavel_id),
     prox, new.prioridade, cr.id, 'rotina', new.estimativa_min)
  returning id into nova;

  -- Checklist da tarefa concluída, desmarcado
  insert into public.tarefa_checklist (tarefa_id, texto, ordem, feito)
  select nova, texto, ordem, false from public.tarefa_checklist where tarefa_id = new.id;

  -- Todo o histórico de comentários segue para a próxima
  perform set_config('vertente.copiando_rotina', '1', true);
  insert into public.tarefa_comentarios (tarefa_id, autor_id, texto, criado_em)
  select nova, autor_id, texto, criado_em from public.tarefa_comentarios where tarefa_id = new.id order by criado_em;
  perform set_config('vertente.copiando_rotina', '0', true);

  update public.cliente_rotinas set ultima_data = prox where id = cr.id;
  return new;
end;
$function$;

drop trigger if exists rotina_ao_concluir on public.tarefas;
create trigger rotina_ao_concluir after update of status on public.tarefas
  for each row execute function privado.rotina_ao_concluir();
