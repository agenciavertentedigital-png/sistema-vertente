-- Escritório virtual: tempo de cada pessoa por sala, somado por dia (Brasília).
-- O time só grava pela função; quem lê o relatório são os administradores (sócios).
create table if not exists public.escritorio_tempo (
  membro_id uuid not null references public.membros(id) on delete cascade,
  dia date not null,
  sala text not null check (sala ~ '^[a-z_]{2,30}$'),
  segundos integer not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (membro_id, dia, sala)
);
alter table public.escritorio_tempo enable row level security;
drop policy if exists "escritorio_tempo: sócios leem" on public.escritorio_tempo;
create policy "escritorio_tempo: sócios leem" on public.escritorio_tempo for select to authenticated using ((select privado.eh_admin()));
revoke insert, update, delete on public.escritorio_tempo from anon, authenticated;

create or replace function public.registrar_tempo_escritorio(p_sala text, p_segundos integer)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_membro uuid := privado.membro_atual();
begin
  if v_membro is null or not (select privado.eh_membro()) then return; end if;
  if p_sala !~ '^[a-z_]{2,30}$' or p_segundos is null or p_segundos <= 0 then return; end if;
  insert into public.escritorio_tempo (membro_id, dia, sala, segundos)
  values (v_membro, (now() at time zone 'America/Sao_Paulo')::date, p_sala, least(p_segundos, 180))
  on conflict (membro_id, dia, sala) do update set segundos = public.escritorio_tempo.segundos + least(excluded.segundos, 180), atualizado_em = now();
end; $function$;
revoke all on function public.registrar_tempo_escritorio(text, integer) from public, anon;
grant execute on function public.registrar_tempo_escritorio(text, integer) to authenticated;
