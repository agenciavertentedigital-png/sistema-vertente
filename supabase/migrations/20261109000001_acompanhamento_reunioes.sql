-- Central do cliente (P1): acompanhamento, reuniões com IA e otimizações estruturadas

-- 1) Novos tipos de registro: retorno do cliente, combinado vigente e pequena conquista
alter table public.registros drop constraint if exists registros_tipo_check;
alter table public.registros add constraint registros_tipo_check check (tipo in ('revisao', 'otimizacao', 'reuniao', 'nota', 'decisao', 'daily', 'weekly', 'retorno', 'combinado', 'conquista'));

-- 2) Reuniões com cliente: transcrição, resumo pronto para o WhatsApp e itens de ação
create table if not exists public.reunioes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  titulo text,
  transcricao text,
  link_transcricao text,
  resumo text,
  itens jsonb not null default '[]'::jsonb,
  pauta text,
  enviado_em timestamptz,
  autor_id uuid default privado.membro_atual() references public.membros(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists reunioes_cliente on public.reunioes (cliente_id, data desc);
alter table public.reunioes enable row level security;
drop policy if exists "reunioes: time" on public.reunioes;
create policy "reunioes: time" on public.reunioes for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

-- 3) Demandas: de que lado está (Vertente ou cliente), por que está aguardando, quem do cliente e de onde nasceu
alter table public.tarefas add column if not exists lado text not null default 'vertente';
alter table public.tarefas drop constraint if exists tarefas_lado_check;
alter table public.tarefas add constraint tarefas_lado_check check (lado in ('vertente', 'cliente'));
alter table public.tarefas add column if not exists aguardando_motivo text;
alter table public.tarefas drop constraint if exists tarefas_aguardando_motivo_check;
alter table public.tarefas add constraint tarefas_aguardando_motivo_check check (aguardando_motivo is null or aguardando_motivo in ('material', 'aprovacao', 'resposta', 'bloqueio'));
alter table public.tarefas add column if not exists contato_cliente text;
alter table public.tarefas add column if not exists reuniao_id uuid references public.reunioes(id) on delete set null;
alter table public.tarefas add column if not exists registro_id uuid references public.registros(id) on delete set null;
create index if not exists tarefas_reuniao on public.tarefas (reuniao_id) where reuniao_id is not null;
create index if not exists tarefas_cliente_lado on public.tarefas (cliente_id, lado, status);

-- 4) Lembrete das otimizações: no dia de revisar (padrão 7 dias), avisa quem registrou para anotar o resultado
create or replace function privado.lembrar_otimizacoes()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select g.id, g.cliente_id, g.autor_id, left(coalesce(g.dados->>'motivo', g.nota, 'otimização'), 120) as resumo, c.nome
    from public.registros g join public.clientes c on c.id = g.cliente_id
    where g.tipo = 'otimizacao'
      and (g.dados->>'revisar_em') is not null
      and (g.dados->>'revisar_em')::date <= (now() at time zone 'America/Sao_Paulo')::date
      and coalesce(g.dados->>'resultado', '') = ''
      and coalesce(g.dados->>'lembrado_em', '') = ''
  loop
    insert into public.notificacoes (membro_id, tipo, texto, cliente_id, registro_id)
    select coalesce(r.autor_id, m.id), 'alerta', r.nome || ' · hora de anotar o resultado da otimização: ' || r.resumo, r.cliente_id, r.id
    from public.membros m
    where (r.autor_id is not null and m.id = r.autor_id) or (r.autor_id is null and m.ativo and m.acesso and m.papel = 'admin');
    update public.registros set dados = dados || jsonb_build_object('lembrado_em', (now() at time zone 'America/Sao_Paulo')::date) where id = r.id;
  end loop;
end $$;

select cron.unschedule('lembrar-otimizacoes') where exists (select 1 from cron.job where jobname = 'lembrar-otimizacoes');
select cron.schedule('lembrar-otimizacoes', '7 11 * * *', $$select privado.lembrar_otimizacoes()$$);
