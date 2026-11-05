-- 1) Histórico de atividades das contas Meta (o que foi feito no Gerenciador) para o Diário de Bordo
create table if not exists public.meta_atividades (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas_anuncio(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  quando timestamptz not null,
  evento text not null,
  evento_texto text,
  objeto_tipo text,
  objeto_id text not null default '',
  objeto_nome text,
  autor text,
  app text,
  antes text,
  depois text,
  dados jsonb,
  automatico boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (conta_id, quando, evento, objeto_id)
);
create index if not exists meta_atividades_cliente on public.meta_atividades (cliente_id, quando desc);
alter table public.meta_atividades enable row level security;
drop policy if exists "meta_atividades: time lê" on public.meta_atividades;
create policy "meta_atividades: time lê" on public.meta_atividades for select to authenticated using ((select privado.eh_membro()));
alter table public.contas_anuncio add column if not exists atividades_ate timestamptz;

-- 2) Acessos e links de cada cliente. Senhas ficam criptografadas no Vault, nunca na tabela.
create table if not exists public.cliente_acessos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null default 'acesso' check (tipo in ('acesso', 'link')),
  titulo text not null check (length(titulo) between 1 and 120),
  url text,
  usuario text,
  observacao text,
  senha_secret uuid,
  tem_senha boolean not null default false,
  autor_id uuid default privado.membro_atual() references public.membros(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists cliente_acessos_cliente on public.cliente_acessos (cliente_id, tipo, titulo);
alter table public.cliente_acessos enable row level security;
drop policy if exists "cliente_acessos: time" on public.cliente_acessos;
create policy "cliente_acessos: time" on public.cliente_acessos for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));
-- a referência da senha só muda pelas funções abaixo (que rodam como dono do banco)
create or replace function privado.acesso_proteger_senha()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.senha_secret := null; new.tem_senha := false;
    else
      new.senha_secret := old.senha_secret; new.tem_senha := old.tem_senha;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists acesso_proteger_senha on public.cliente_acessos;
create trigger acesso_proteger_senha before insert or update on public.cliente_acessos for each row execute function privado.acesso_proteger_senha();

create table if not exists public.cliente_acessos_log (
  id uuid primary key default gen_random_uuid(),
  acesso_id uuid references public.cliente_acessos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete cascade,
  membro_id uuid references public.membros(id) on delete set null,
  acao text not null check (acao in ('viu', 'copiou', 'alterou', 'removeu')),
  criado_em timestamptz not null default now()
);
alter table public.cliente_acessos_log enable row level security;
drop policy if exists "cliente_acessos_log: time lê" on public.cliente_acessos_log;
create policy "cliente_acessos_log: time lê" on public.cliente_acessos_log for select to authenticated using ((select privado.eh_membro()));

create or replace function public.acesso_definir_senha(p_acesso uuid, p_senha text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_secret uuid; v_cliente uuid;
begin
  if not privado.eh_membro() then raise exception 'Sem acesso.'; end if;
  select senha_secret, cliente_id into v_secret, v_cliente from public.cliente_acessos where id = p_acesso;
  if v_cliente is null then raise exception 'Acesso não encontrado.'; end if;
  if coalesce(p_senha, '') = '' then
    if v_secret is not null then delete from vault.secrets where id = v_secret; end if;
    update public.cliente_acessos set senha_secret = null, tem_senha = false, atualizado_em = now() where id = p_acesso;
    insert into public.cliente_acessos_log (acesso_id, cliente_id, membro_id, acao) values (p_acesso, v_cliente, privado.membro_atual(), 'removeu');
    return;
  end if;
  if v_secret is null then
    v_secret := vault.create_secret(p_senha, 'cliente_acesso_' || p_acesso::text, 'Senha de acesso de cliente (Sistema Vertente)');
    update public.cliente_acessos set senha_secret = v_secret, tem_senha = true, atualizado_em = now() where id = p_acesso;
  else
    perform vault.update_secret(v_secret, p_senha);
    update public.cliente_acessos set atualizado_em = now() where id = p_acesso;
  end if;
  insert into public.cliente_acessos_log (acesso_id, cliente_id, membro_id, acao) values (p_acesso, v_cliente, privado.membro_atual(), 'alterou');
end $$;

create or replace function public.acesso_ver_senha(p_acesso uuid, p_acao text default 'viu')
returns text language plpgsql security definer set search_path = '' as $$
declare v_secret uuid; v_cliente uuid; v_senha text;
begin
  if not privado.eh_membro() then raise exception 'Sem acesso.'; end if;
  select senha_secret, cliente_id into v_secret, v_cliente from public.cliente_acessos where id = p_acesso;
  if v_secret is null then return null; end if;
  select decrypted_secret into v_senha from vault.decrypted_secrets where id = v_secret;
  insert into public.cliente_acessos_log (acesso_id, cliente_id, membro_id, acao)
    values (p_acesso, v_cliente, privado.membro_atual(), case when p_acao = 'copiou' then 'copiou' else 'viu' end);
  return v_senha;
end $$;

-- ao apagar um acesso (ou o cliente), a senha sai do Vault junto
create or replace function privado.acesso_apagar_senha()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.senha_secret is not null then delete from vault.secrets where id = old.senha_secret; end if;
  return old;
end $$;
drop trigger if exists acesso_apagar_senha on public.cliente_acessos;
create trigger acesso_apagar_senha after delete on public.cliente_acessos for each row execute function privado.acesso_apagar_senha();

revoke all on function public.acesso_definir_senha(uuid, text) from public, anon;
revoke all on function public.acesso_ver_senha(uuid, text) from public, anon;
grant execute on function public.acesso_definir_senha(uuid, text) to authenticated;
grant execute on function public.acesso_ver_senha(uuid, text) to authenticated;
