-- Painel do cliente: link próprio + senha. O cliente não tem conta no sistema;
-- a função "portal" confere a senha e entrega só o que é dele (diário, conquistas e tráfego).
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.portal_clientes (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  senha_hash text not null,
  ativo boolean not null default true,
  mostrar jsonb not null default '{"trafego": true, "diario": true, "conquistas": true}'::jsonb,
  ultimo_acesso timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.portal_clientes enable row level security;
drop policy if exists "portal_clientes: time lê" on public.portal_clientes;
create policy "portal_clientes: time lê" on public.portal_clientes for select to authenticated using ((select privado.eh_membro()));
drop policy if exists "portal_clientes: time altera" on public.portal_clientes;
create policy "portal_clientes: time altera" on public.portal_clientes for update to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
-- O time vê tudo, menos o hash da senha
revoke all on public.portal_clientes from anon, authenticated;
grant select (cliente_id, slug, ativo, mostrar, ultimo_acesso, criado_em, atualizado_em) on public.portal_clientes to authenticated;
grant update (ativo, mostrar) on public.portal_clientes to authenticated;

-- Tentativas de senha (trava após muitos erros)
create table if not exists public.portal_tentativas (
  id bigint generated always as identity primary key,
  slug text not null,
  ok boolean not null,
  quando timestamptz not null default now()
);
create index if not exists portal_tentativas_slug on public.portal_tentativas (slug, quando desc);
alter table public.portal_tentativas enable row level security;
revoke all on public.portal_tentativas from anon, authenticated;

-- Criar ou trocar link e senha (time). Senha nunca fica legível.
create or replace function public.definir_portal(p_cliente uuid, p_slug text, p_senha text default null)
returns void language plpgsql security definer set search_path = '' as $function$
begin
  if not (select privado.eh_membro()) then raise exception 'Sem acesso'; end if;
  p_slug := lower(trim(p_slug));
  if p_slug !~ '^[a-z0-9][a-z0-9-]{2,60}$' then raise exception 'Link inválido: use letras, números e hífen'; end if;
  if exists (select 1 from public.portal_clientes where slug = p_slug and cliente_id <> p_cliente) then raise exception 'Esse link já é de outro cliente'; end if;
  if p_senha is not null and length(p_senha) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres'; end if;
  if exists (select 1 from public.portal_clientes where cliente_id = p_cliente) then
    update public.portal_clientes set slug = p_slug,
      senha_hash = coalesce(case when p_senha is null then null else extensions.crypt(p_senha, extensions.gen_salt('bf', 10)) end, senha_hash),
      atualizado_em = now()
    where cliente_id = p_cliente;
  else
    if p_senha is null then raise exception 'Defina uma senha'; end if;
    insert into public.portal_clientes (cliente_id, slug, senha_hash) values (p_cliente, p_slug, extensions.crypt(p_senha, extensions.gen_salt('bf', 10)));
  end if;
end; $function$;
revoke all on function public.definir_portal(uuid, text, text) from public, anon;
grant execute on function public.definir_portal(uuid, text, text) to authenticated;

-- Conferência da senha (só o servidor chama)
create or replace function public.portal_entrar(p_slug text, p_senha text)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_cliente uuid; v_hash text; erros int;
begin
  select count(*) into erros from public.portal_tentativas where slug = lower(p_slug) and not ok and quando > now() - interval '15 minutes';
  if erros >= 8 then raise exception 'bloqueado'; end if;
  select cliente_id, senha_hash into v_cliente, v_hash from public.portal_clientes where slug = lower(p_slug) and ativo;
  if v_cliente is null or extensions.crypt(p_senha, v_hash) <> v_hash then
    insert into public.portal_tentativas (slug, ok) values (lower(p_slug), false);
    return null;
  end if;
  insert into public.portal_tentativas (slug, ok) values (lower(p_slug), true);
  update public.portal_clientes set ultimo_acesso = now() where cliente_id = v_cliente;
  return v_cliente;
end; $function$;
revoke all on function public.portal_entrar(text, text) from public, anon, authenticated;
grant execute on function public.portal_entrar(text, text) to service_role;
