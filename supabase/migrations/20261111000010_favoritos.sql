-- Favoritos (atalhos da barra de cima), um registro por membro
create table if not exists public.favoritos (
  membro_id uuid primary key references public.membros(id) on delete cascade,
  itens jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.favoritos enable row level security;
drop policy if exists "favoritos: cada um os seus" on public.favoritos;
create policy "favoritos: cada um os seus" on public.favoritos for all to authenticated
  using (membro_id = (select privado.membro_atual())) with check (membro_id = (select privado.membro_atual()));
