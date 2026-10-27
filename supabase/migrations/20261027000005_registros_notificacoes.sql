-- Registros (revisões, otimizações, notas, decisões, reuniões, daily e weekly) e notificações.

create table public.registros (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  tarefa_id uuid references public.tarefas (id) on delete set null,
  tipo text not null check (tipo in ('revisao', 'otimizacao', 'reuniao', 'nota', 'decisao', 'daily', 'weekly')),
  canal text check (canal in ('meta', 'google')),
  situacao text check (situacao in ('ok', 'atencao', 'problema')),
  acoes text[] not null default '{}',
  nota text,
  alteracoes jsonb not null default '[]',   -- [{tipo, descricao, antes, depois}]
  dados jsonb not null default '{}',        -- daily/weekly: focos, bloqueios, decisoes
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  autor_id uuid references public.membros (id) on delete set null default privado.membro_atual(),
  criado_em timestamptz not null default now()
);
create index registros_cliente_data_idx on public.registros (cliente_id, data desc);
create index registros_data_idx on public.registros (data desc);
create index registros_tarefa_idx on public.registros (tarefa_id);
create index registros_autor_idx on public.registros (autor_id);

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade,
  tipo text not null check (tipo in ('mencao', 'atribuicao', 'alerta')),
  texto text not null,
  cliente_id uuid references public.clientes (id) on delete cascade,
  tarefa_id uuid references public.tarefas (id) on delete cascade,
  registro_id uuid references public.registros (id) on delete cascade,
  autor_id uuid references public.membros (id) on delete set null,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);
create index notificacoes_membro_idx on public.notificacoes (membro_id, lida, criado_em desc);
create index notificacoes_cliente_idx on public.notificacoes (cliente_id);
create index notificacoes_tarefa_idx on public.notificacoes (tarefa_id);
create index notificacoes_registro_idx on public.notificacoes (registro_id);
create index notificacoes_autor_idx on public.notificacoes (autor_id);

-- ---------------------------------------------------------------
-- Menções: "@Silvio" avisa quem tem esse primeiro nome
-- ---------------------------------------------------------------
create or replace function privado.notificar_mencoes(
  p_texto text, p_autor uuid, p_cliente uuid, p_tarefa uuid, p_registro uuid, p_resumo text)
returns void language sql security definer set search_path = ''
as $$
  insert into public.notificacoes (membro_id, tipo, texto, cliente_id, tarefa_id, registro_id, autor_id)
  select m.id, 'mencao', p_resumo, p_cliente, p_tarefa, p_registro, p_autor
  from public.membros m
  where m.ativo
    and m.id is distinct from p_autor
    and p_texto ~* ('@' || split_part(m.nome, ' ', 1) || '([^[:alnum:]]|$)');
$$;

create or replace function privado.apos_comentario()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  t record;
  autor text;
begin
  select ta.titulo, ta.cliente_id, c.nome as cliente into t
  from public.tarefas ta join public.clientes c on c.id = ta.cliente_id where ta.id = new.tarefa_id;
  select nome into autor from public.membros where id = new.autor_id;
  perform privado.notificar_mencoes(new.texto, new.autor_id, t.cliente_id, new.tarefa_id, null,
    coalesce(autor, 'Alguém') || ' mencionou você em "' || t.titulo || '" (' || t.cliente || '): ' || left(new.texto, 140));
  return new;
end;
$$;
create trigger apos_comentario after insert on public.tarefa_comentarios
  for each row execute function privado.apos_comentario();

create or replace function privado.apos_registro()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  cliente text;
  autor text;
begin
  select nome into cliente from public.clientes where id = new.cliente_id;
  select nome into autor from public.membros where id = new.autor_id;
  if new.nota is not null then
    perform privado.notificar_mencoes(new.nota, new.autor_id, new.cliente_id, new.tarefa_id, new.id,
      coalesce(autor, 'Alguém') || ' mencionou você em ' || cliente || ': ' || left(new.nota, 140));
  end if;
  if new.situacao = 'problema' then
    insert into public.notificacoes (membro_id, tipo, texto, cliente_id, tarefa_id, registro_id, autor_id)
    select m.id, 'alerta',
      cliente || coalesce(' · ' || case new.canal when 'meta' then 'Meta' when 'google' then 'Google' end, '')
        || ' em vermelho' || coalesce(': ' || left(new.nota, 140), ''),
      new.cliente_id, new.tarefa_id, new.id, new.autor_id
    from public.membros m
    where m.ativo and m.acesso and m.id is distinct from new.autor_id;
  end if;
  return new;
end;
$$;
create trigger apos_registro after insert on public.registros
  for each row execute function privado.apos_registro();

-- Tarefa atribuída a outra pessoa (rotinas automáticas não avisam)
create or replace function privado.apos_atribuicao()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  cliente text;
  quem uuid := privado.membro_atual();
begin
  if new.responsavel_id is null or new.origem = 'rotina' or new.responsavel_id is not distinct from quem then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.responsavel_id is not distinct from new.responsavel_id then
    return new;
  end if;
  select nome into cliente from public.clientes where id = new.cliente_id;
  insert into public.notificacoes (membro_id, tipo, texto, cliente_id, tarefa_id, autor_id)
  values (new.responsavel_id, 'atribuicao', 'Nova tarefa para você: "' || new.titulo || '" (' || cliente || ')',
          new.cliente_id, new.id, quem);
  return new;
end;
$$;
create trigger apos_atribuicao after insert or update of responsavel_id on public.tarefas
  for each row execute function privado.apos_atribuicao();

revoke execute on function privado.notificar_mencoes(text, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function privado.apos_comentario() from public, anon, authenticated;
revoke execute on function privado.apos_registro() from public, anon, authenticated;
revoke execute on function privado.apos_atribuicao() from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Regras de acesso
-- ---------------------------------------------------------------
alter table public.registros enable row level security;
alter table public.notificacoes enable row level security;

create policy "registros: time lê" on public.registros
  for select to authenticated using ((select privado.eh_membro()));
create policy "registros: time registra" on public.registros
  for insert to authenticated with check ((select privado.eh_membro()));
create policy "registros: autor ou admin edita" on public.registros
  for update to authenticated
  using (autor_id = (select privado.membro_atual()) or (select privado.eh_admin()))
  with check ((select privado.eh_membro()));
create policy "registros: autor ou admin apaga" on public.registros
  for delete to authenticated
  using (autor_id = (select privado.membro_atual()) or (select privado.eh_admin()));

create policy "notificacoes: só as minhas" on public.notificacoes
  for select to authenticated using (membro_id = (select privado.membro_atual()));
create policy "notificacoes: marcar as minhas" on public.notificacoes
  for update to authenticated
  using (membro_id = (select privado.membro_atual()))
  with check (membro_id = (select privado.membro_atual()));
