-- Google Agenda no Planejador: cada pessoa conecta a própria agenda (somente leitura).
-- O token de acesso fica no cofre (google_agenda_<membro_id>); aqui fica só quem conectou e com qual conta.

create table if not exists public.agenda_conexoes (
  membro_id uuid primary key references public.membros(id) on delete cascade,
  email text,
  conectado_em timestamptz not null default now()
);
alter table public.agenda_conexoes enable row level security;
drop policy if exists "agenda_conexoes: time lê" on public.agenda_conexoes;
create policy "agenda_conexoes: time lê" on public.agenda_conexoes for select to authenticated using ((select privado.eh_membro()));

-- O servidor pode guardar também o token da agenda de cada pessoa
create or replace function public.guardar_segredo_servidor(nome text, valor text)
returns void language plpgsql security definer set search_path = '' as $function$
declare existente uuid;
begin
  if nome <> 'google_ads_refresh_token' and nome !~ '^google_agenda_[0-9a-f-]{36}$' then raise exception 'Segredo não permitido'; end if;
  select id into existente from vault.secrets where name = nome;
  if existente is null then perform vault.create_secret(valor, nome);
  else perform vault.update_secret(existente, valor); end if;
end; $function$;
revoke all on function public.guardar_segredo_servidor(text, text) from public, anon, authenticated;
