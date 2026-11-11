-- Itens do Diário de Bordo escondidos da versão do cliente (vale no sistema e no Painel do cliente)
create table if not exists public.diario_ocultos (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  item_id text not null,
  criado_em timestamptz not null default now(),
  primary key (cliente_id, item_id)
);
alter table public.diario_ocultos enable row level security;
drop policy if exists "diario_ocultos: time" on public.diario_ocultos;
create policy "diario_ocultos: time" on public.diario_ocultos for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
