-- Temperatura do cliente: registro rápido de como está a relação (1 crítico … 5 encantado)
create table public.temperaturas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nivel smallint not null check (nivel between 1 and 5),
  motivo text,
  tarefa_id uuid references public.tarefas (id) on delete set null,
  autor_id uuid references public.membros (id) on delete set null default privado.membro_atual(),
  criado_em timestamptz not null default now()
);
create index temperaturas_cliente_idx on public.temperaturas (cliente_id, criado_em desc);
alter table public.temperaturas enable row level security;
create policy "temperaturas: time" on public.temperaturas
  for all to authenticated using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

-- Avisa o time em "Para mim" quando a temperatura cai ou fica crítica
create or replace function privado.avisar_temperatura()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  anterior smallint;
  nome text;
  rotulo text;
begin
  select nivel into anterior from public.temperaturas
   where cliente_id = new.cliente_id and id <> new.id
   order by criado_em desc limit 1;
  if not (new.nivel <= 2 or (anterior is not null and new.nivel < anterior)) then
    return new;
  end if;
  select c.nome into nome from public.clientes c where c.id = new.cliente_id;
  rotulo := case new.nivel when 1 then 'crítica' when 2 then 'fria' when 3 then 'morna' when 4 then 'boa' else 'ótima' end;
  insert into public.notificacoes (membro_id, tipo, texto, cliente_id, tarefa_id, autor_id)
  select m.id, 'alerta',
         'Temperatura de ' || nome || ' ' || case when anterior is not null and new.nivel < anterior then 'caiu para ' else 'está ' end || rotulo
           || coalesce(': ' || nullif(new.motivo, ''), ''),
         new.cliente_id, new.tarefa_id, new.autor_id
    from public.membros m
   where m.ativo and m.acesso and m.id is distinct from new.autor_id;
  return new;
end;
$$;
create trigger temperaturas_aviso after insert on public.temperaturas
  for each row execute function privado.avisar_temperatura();
