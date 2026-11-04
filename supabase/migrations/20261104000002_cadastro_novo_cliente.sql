-- Link de cadastro para NOVO cliente: o cliente preenche e o cadastro é criado sozinho no sistema
alter table public.cadastro_links alter column cliente_id drop not null;
alter table public.cadastro_links drop constraint if exists cadastro_links_tipo_check;
alter table public.cadastro_links add constraint cadastro_links_tipo_check check (tipo in ('cadastro', 'briefing', 'novo_cliente'));
alter table public.cadastro_links add constraint cadastro_links_cliente_obrigatorio check (cliente_id is not null or tipo = 'novo_cliente');
alter table public.cadastro_links add column if not exists apelido text;
alter table public.cadastro_links add column if not exists criado_por uuid default privado.membro_atual() references public.membros(id) on delete set null;
