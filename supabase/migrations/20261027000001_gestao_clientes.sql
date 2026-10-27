-- Fase 1 · Gestão de Clientes
-- Tarefas, checklists, comentários e rotinas recorrentes (substitui o ClickUp).

-- ---------------------------------------------------------------
-- Time: quem é responsável por tarefas x quem pode entrar no sistema
-- ---------------------------------------------------------------
alter table public.membros add column acesso boolean not null default false;
alter table public.membros add column clickup_id bigint unique;
update public.membros set acesso = true, clickup_id = 84021836 where papel = 'admin';

create or replace function privado.eh_membro()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.ativo and m.acesso
      and (m.user_id = auth.uid()
           or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

create or replace function privado.eh_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.ativo and m.acesso and m.papel = 'admin'
      and (m.user_id = auth.uid()
           or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

-- Membro logado (para registrar autor de tarefas e comentários)
create or replace function privado.membro_atual()
returns uuid language sql stable security definer set search_path = ''
as $$
  select m.id from public.membros m
  where m.ativo and m.acesso
    and (m.user_id = auth.uid()
         or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  limit 1;
$$;
revoke execute on function privado.membro_atual() from public, anon;
grant execute on function privado.membro_atual() to authenticated;

-- ---------------------------------------------------------------
-- Rotinas (modelos) e rotinas de cada cliente
-- ---------------------------------------------------------------
create table public.rotinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  pilar text not null check (pilar in ('trafego', 'social', 'gmn', 'cs', 'interno')),
  frequencia_padrao text not null check (frequencia_padrao in ('diaria', 'semanal', 'quinzenal', 'mensal')),
  prioridade text not null default 'normal' check (prioridade in ('urgente', 'alta', 'normal', 'baixa')),
  checklist text[] not null default '{}',
  mensagem text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.cliente_rotinas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  rotina_id uuid not null references public.rotinas (id) on delete cascade,
  canal text check (canal in ('meta', 'google')),
  responsavel_id uuid references public.membros (id) on delete set null,
  frequencia text not null check (frequencia in ('diaria', 'semanal', 'quinzenal', 'mensal')),
  dia_semana smallint check (dia_semana between 1 and 7),   -- 1 = segunda
  dia_mes smallint check (dia_mes between 1 and 31),
  ativa boolean not null default true,
  ultima_data date,                                          -- data da última tarefa gerada
  criado_em timestamptz not null default now()
);
create unique index cliente_rotinas_unica
  on public.cliente_rotinas (cliente_id, rotina_id, coalesce(canal, ''));
create index cliente_rotinas_rotina_idx on public.cliente_rotinas (rotina_id);
create index cliente_rotinas_responsavel_idx on public.cliente_rotinas (responsavel_id);

-- ---------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------
create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  titulo text not null,
  descricao text,
  pilar text not null default 'trafego' check (pilar in ('trafego', 'social', 'gmn', 'cs', 'interno')),
  canal text check (canal in ('meta', 'google')),
  responsavel_id uuid references public.membros (id) on delete set null,
  prazo date,
  prioridade text not null default 'normal' check (prioridade in ('urgente', 'alta', 'normal', 'baixa')),
  status text not null default 'a_fazer' check (status in ('a_fazer', 'fazendo', 'aguardando', 'feita', 'nao_feita')),
  triagem boolean not null default false,                    -- true = está na caixa de entrada
  cliente_rotina_id uuid references public.cliente_rotinas (id) on delete set null,
  origem text not null default 'manual' check (origem in ('manual', 'rotina', 'clickup')),
  clickup_id text unique,
  criado_por uuid references public.membros (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  concluida_em timestamptz
);
create index tarefas_cliente_idx on public.tarefas (cliente_id);
create index tarefas_responsavel_idx on public.tarefas (responsavel_id);
create index tarefas_rotina_idx on public.tarefas (cliente_rotina_id);
create index tarefas_criado_por_idx on public.tarefas (criado_por);
create index tarefas_abertas_prazo_idx on public.tarefas (prazo)
  where status in ('a_fazer', 'fazendo', 'aguardando');
-- Uma rotina nunca tem duas tarefas abertas ao mesmo tempo
create unique index tarefas_rotina_aberta_unica on public.tarefas (cliente_rotina_id)
  where status in ('a_fazer', 'fazendo', 'aguardando');

create or replace function privado.tarefas_antes_de_gravar()
returns trigger language plpgsql set search_path = ''
as $$
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
  return new;
end;
$$;
create trigger tarefas_antes_de_gravar
  before insert or update on public.tarefas
  for each row execute function privado.tarefas_antes_de_gravar();

create table public.tarefa_checklist (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas (id) on delete cascade,
  texto text not null,
  feito boolean not null default false,
  ordem integer not null default 0
);
create index tarefa_checklist_tarefa_idx on public.tarefa_checklist (tarefa_id, ordem);

create table public.tarefa_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas (id) on delete cascade,
  autor_id uuid references public.membros (id) on delete set null default privado.membro_atual(),
  texto text not null,
  criado_em timestamptz not null default now()
);
create index tarefa_comentarios_tarefa_idx on public.tarefa_comentarios (tarefa_id, criado_em);
create index tarefa_comentarios_autor_idx on public.tarefa_comentarios (autor_id);

-- ---------------------------------------------------------------
-- Geração automática das rotinas
-- ---------------------------------------------------------------
create or replace function privado.proxima_data(
  p_frequencia text, p_dia_semana smallint, p_dia_mes smallint, p_depois date)
returns date language plpgsql immutable set search_path = ''
as $$
declare
  d date;
  ultimo_dia int;
begin
  if p_frequencia = 'diaria' then
    d := p_depois + 1;
    while extract(isodow from d) in (6, 7) loop d := d + 1; end loop;
    return d;
  elsif p_frequencia in ('semanal', 'quinzenal') then
    d := p_depois + case when p_frequencia = 'quinzenal' then 8 else 1 end;
    while extract(isodow from d) <> coalesce(p_dia_semana, 1) loop d := d + 1; end loop;
    return d;
  else -- mensal
    d := date_trunc('month', p_depois)::date;
    loop
      ultimo_dia := extract(day from (d + interval '1 month - 1 day'))::int;
      if (d + (least(coalesce(p_dia_mes, 1), ultimo_dia) - 1)) > p_depois then
        return d + (least(coalesce(p_dia_mes, 1), ultimo_dia) - 1);
      end if;
      d := (d + interval '1 month')::date;
    end loop;
  end if;
end;
$$;

create or replace function privado.gerar_rotinas(
  p_hoje date default (now() at time zone 'America/Sao_Paulo')::date)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  cr record;
  prox date;
  seguinte date;
  nova uuid;
  total integer := 0;
begin
  for cr in
    select r.*, ro.nome, ro.pilar, ro.prioridade, ro.checklist, ro.mensagem
    from public.cliente_rotinas r
    join public.rotinas ro on ro.id = r.rotina_id and ro.ativa
    join public.clientes c on c.id = r.cliente_id and c.status = 'ativo'
    where r.ativa
  loop
    if exists (select 1 from public.tarefas t
               where t.cliente_rotina_id = cr.id
                 and t.status in ('a_fazer', 'fazendo', 'aguardando')) then
      continue;  -- a anterior ainda está aberta: não cria outra
    end if;

    prox := privado.proxima_data(cr.frequencia, cr.dia_semana, cr.dia_mes, coalesce(cr.ultima_data, p_hoje - 1));
    if prox > p_hoje then continue; end if;
    loop  -- se perdeu vários períodos, cria só o mais recente
      seguinte := privado.proxima_data(cr.frequencia, cr.dia_semana, cr.dia_mes, prox);
      exit when seguinte > p_hoje;
      prox := seguinte;
    end loop;

    insert into public.tarefas
      (cliente_id, titulo, descricao, pilar, canal, responsavel_id, prazo, prioridade, cliente_rotina_id, origem)
    values
      (cr.cliente_id, cr.nome, cr.mensagem, cr.pilar, cr.canal, cr.responsavel_id, prox, cr.prioridade, cr.id, 'rotina')
    returning id into nova;

    insert into public.tarefa_checklist (tarefa_id, texto, ordem)
    select nova, item, ord::int - 1 from unnest(cr.checklist) with ordinality as x(item, ord);

    update public.cliente_rotinas set ultima_data = prox where id = cr.id;
    total := total + 1;
  end loop;
  return total;
end;
$$;
revoke execute on function privado.gerar_rotinas(date) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Regras de acesso
-- ---------------------------------------------------------------
alter table public.rotinas enable row level security;
alter table public.cliente_rotinas enable row level security;
alter table public.tarefas enable row level security;
alter table public.tarefa_checklist enable row level security;
alter table public.tarefa_comentarios enable row level security;

create policy "rotinas: time" on public.rotinas
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
create policy "cliente_rotinas: time" on public.cliente_rotinas
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
create policy "tarefas: time" on public.tarefas
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
create policy "tarefa_checklist: time" on public.tarefa_checklist
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
create policy "tarefa_comentarios: time lê" on public.tarefa_comentarios
  for select to authenticated using ((select privado.eh_membro()));
create policy "tarefa_comentarios: time comenta" on public.tarefa_comentarios
  for insert to authenticated with check ((select privado.eh_membro()));
create policy "tarefa_comentarios: autor apaga" on public.tarefa_comentarios
  for delete to authenticated using (autor_id = (select privado.membro_atual()));

-- ---------------------------------------------------------------
-- Rotinas padrão (checklists vindos do ClickUp)
-- ---------------------------------------------------------------
insert into public.rotinas (nome, pilar, frequencia_padrao, prioridade, checklist, mensagem) values
  ('Revisão diária', 'trafego', 'diaria', 'normal', array[
    'Saúde da conta: ativa, sem restrições ou violações',
    'Campanhas importantes ativas',
    'Métricas principais: custo por resultado, volume e comparação com ontem e 7 dias',
    'Gastos dentro do orçamento (conta pré-paga: conferir saldo)',
    'Anúncios: ativos, criativos novos e criativos com desempenho baixo'], null),
  ('Otimização semanal', 'trafego', 'semanal', 'alta', array[
    'Lances e orçamentos',
    'Palavras-chave e termos de pesquisa (Google)',
    'Anúncios e criativos',
    'Grupos e conjuntos de anúncios'], null),
  ('Contato semanal e relatório', 'cs', 'semanal', 'alta', array[
    'Solicitar feedback de resultados',
    'Sugerir melhorias',
    'Enviar pequeno relatório com as conquistas'],
   E'Ei gente, boa tarde, tudo bem? 😁\n\nPoderiam nos dar um feedback sobre o volume e a qualidade dos leads dos últimos dias? Qualquer detalhe pode nos ajudar a melhorar as campanhas.\n\nPrecisamos saber também se temos algum direcionamento específico para as nossas campanhas:\n\n- Novos criativos (imagens, vídeos etc.) (IMPORTANTE)\n- Campanhas de promoções ou ofertas específicas\n- Algum anúncio que gostariam de desativar\n\nObrigado e qualquer dúvida, estamos à disposição!\n\nDesejo uma excelente semana a todos! 🔥🚀'),
  ('Acompanhar plano de ação', 'cs', 'semanal', 'alta', array[
    'Revisar o andamento de cada item do plano',
    'Registrar pendências e próximos passos'], null),
  ('Reunião com o cliente', 'cs', 'quinzenal', 'alta', array[
    'Preparar pauta e números do período',
    'Realizar a reunião',
    'Registrar decisões e próximos passos'], null),
  ('Verificar oportunidades de up-sell', 'cs', 'mensal', 'normal', array[
    'Avaliar resultados e serviços atuais',
    'Listar oportunidades',
    'Combinar a abordagem com o time'], null),
  ('Relatório mensal', 'trafego', 'mensal', 'normal', array[
    'Montar o relatório do mês',
    'Revisar números e conclusões'], null),
  ('Enviar relatório mensal', 'cs', 'mensal', 'normal', array[
    'Enviar o relatório ao cliente',
    'Registrar o retorno do cliente'], null);

-- Time como responsáveis (sem acesso ao sistema até ser liberado)
insert into public.membros (email, nome, papel, acesso, clickup_id) values
  ('silviospjr@gmail.com', 'Silvio', 'gestor', false, 84028984),
  ('carolinet230193@gmail.com', 'Caroline', 'cs', false, 88366682),
  ('joaopaulo.vertente@gmail.com', 'João Paulo', 'gestor', false, 112292592);

-- ---------------------------------------------------------------
-- Agendamento diário (06:00 em Brasília = 09:00 UTC)
-- ---------------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule('gerar-rotinas', '0 9 * * *', $$select privado.gerar_rotinas()$$);
