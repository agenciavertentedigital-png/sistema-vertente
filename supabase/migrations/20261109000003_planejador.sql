-- Planejador: o bloco planejado de cada tarefa (quando a pessoa vai fazer). A duração vem da estimativa.
alter table public.tarefas add column if not exists planejado_inicio timestamptz;
create index if not exists tarefas_planejado on public.tarefas (responsavel_id, planejado_inicio) where planejado_inicio is not null;
