-- Instagram Business por cliente + foto diária dos seguidores
create table if not exists public.instagram_contas (
  ig_id text primary key,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  username text not null,
  nome text,
  foto_url text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists instagram_contas_cliente on public.instagram_contas (cliente_id);
alter table public.instagram_contas enable row level security;
drop policy if exists "instagram_contas: time" on public.instagram_contas;
create policy "instagram_contas: time" on public.instagram_contas for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

create table if not exists public.instagram_seguidores (
  ig_id text not null references public.instagram_contas(ig_id) on delete cascade,
  data date not null,
  seguidores integer not null,
  publicacoes integer,
  primary key (ig_id, data)
);
alter table public.instagram_seguidores enable row level security;
drop policy if exists "instagram_seguidores: time lê" on public.instagram_seguidores;
create policy "instagram_seguidores: time lê" on public.instagram_seguidores for select to authenticated using ((select privado.eh_membro()));

-- Foto diária às 23h50 (Brasília)
select cron.unschedule('instagram-seguidores') where exists (select 1 from cron.job where jobname = 'instagram-seguidores');
select cron.schedule('instagram-seguidores', '50 2 * * *', $$
  select net.http_post(
    url := 'https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/instagram',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-chave-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'chave_cron_meta')),
    body := '{"acao":"snapshot"}'::jsonb, timeout_milliseconds := 120000);
$$);
