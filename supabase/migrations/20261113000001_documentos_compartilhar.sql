-- Documentos (editor formatado) e compartilhamento por link próprio /d/<código> (aplicado em 13/11/2026)
alter table public.notas
  add column if not exists conteudo text,
  add column if not exists compartilhado boolean not null default false,
  add column if not exists codigo text unique,
  add column if not exists senha_hash text,
  add column if not exists compartilhado_em timestamptz;
alter table public.notas add column if not exists com_senha boolean generated always as (senha_hash is not null) stored;

create or replace function public.compartilhar_nota(p_nota uuid, p_ativo boolean, p_senha text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_codigo text;
begin
  if not privado.eh_membro() then raise exception 'Sem acesso'; end if;
  select codigo into v_codigo from public.notas where id = p_nota;
  if not found then raise exception 'Anotação não encontrada'; end if;
  if v_codigo is null then
    v_codigo := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/=', '-_');
  end if;
  update public.notas set
    codigo = v_codigo,
    compartilhado = p_ativo,
    compartilhado_em = case when p_ativo then coalesce(compartilhado_em, now()) else compartilhado_em end,
    senha_hash = case when p_senha is null then senha_hash when p_senha = '' then null else extensions.crypt(p_senha, extensions.gen_salt('bf')) end
  where id = p_nota;
  return jsonb_build_object('codigo', v_codigo, 'compartilhado', p_ativo, 'com_senha', (select senha_hash is not null from public.notas where id = p_nota));
end $$;
revoke all on function public.compartilhar_nota(uuid, boolean, text) from public, anon;
grant execute on function public.compartilhar_nota(uuid, boolean, text) to authenticated;

create or replace function public.nota_publica(p_codigo text, p_senha text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n record;
begin
  select x.titulo, x.conteudo, x.texto, x.atualizado_em, x.senha_hash, c.nome as cliente, m.nome as autor
    into n
    from public.notas x
    left join public.clientes c on c.id = x.cliente_id
    left join public.membros m on m.id = x.autor_id
   where x.codigo = p_codigo and x.compartilhado;
  if not found then return jsonb_build_object('erro', 'nao_encontrado'); end if;
  if n.senha_hash is not null and (p_senha is null or extensions.crypt(p_senha, n.senha_hash) <> n.senha_hash) then
    if p_senha is not null then perform pg_sleep(0.6); end if;
    return jsonb_build_object('precisa_senha', true, 'senha_errada', p_senha is not null);
  end if;
  return jsonb_build_object('titulo', n.titulo, 'conteudo', n.conteudo, 'texto', n.texto, 'atualizado_em', n.atualizado_em, 'cliente', n.cliente, 'autor', n.autor);
end $$;
revoke all on function public.nota_publica(text, text) from public;
grant execute on function public.nota_publica(text, text) to anon, authenticated;
