-- Assistente no grupo do WhatsApp: telefone do time e histórico das conversas do grupo
alter table public.membros add column telefone text;

create table public.whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  grupo text not null,
  grupo_nome text,
  membro_id uuid references public.membros (id) on delete set null,
  autor_telefone text,
  autor_nome text,
  papel text not null check (papel in ('user', 'assistant', 'ignorada')),
  texto text not null,
  criado_em timestamptz not null default now()
);
create index whatsapp_mensagens_grupo_idx on public.whatsapp_mensagens (grupo, criado_em desc);
alter table public.whatsapp_mensagens enable row level security;
create policy "whatsapp_mensagens: admin lê" on public.whatsapp_mensagens
  for select to authenticated using ((select privado.eh_admin()));
