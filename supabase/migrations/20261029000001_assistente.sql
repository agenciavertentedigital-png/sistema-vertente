-- Conversas do Assistente de IA (cada pessoa vê só as suas)
create table public.assistente_conversas (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null default privado.membro_atual() references public.membros (id) on delete cascade,
  titulo text not null default 'Nova conversa',
  mensagens jsonb not null default '[]',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index assistente_conversas_membro_idx on public.assistente_conversas (membro_id, atualizado_em desc);
create trigger assistente_conversas_atualizado_em before update on public.assistente_conversas
  for each row execute function privado.tocar_atualizado_em();
alter table public.assistente_conversas enable row level security;
create policy "assistente_conversas: só as minhas" on public.assistente_conversas
  for all to authenticated
  using (membro_id = (select privado.membro_atual()))
  with check (membro_id = (select privado.membro_atual()));
