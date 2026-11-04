-- Postagens do Perfil da Empresa no Google: publicar agora ou agendar (o agendamento roda pelo cron a cada 15 min)
create table if not exists public.gmn_postagens (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references public.gmn_perfis(id) on delete cascade,
  place_id text not null,
  tipo text not null default 'STANDARD' check (tipo in ('STANDARD', 'OFFER', 'EVENT')),
  texto text not null check (length(texto) between 1 and 1500),
  cta_tipo text check (cta_tipo in ('BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL')),
  cta_url text,
  foto_url text,
  evento jsonb,
  oferta jsonb,
  quando timestamptz not null default now(),
  status text not null default 'agendada' check (status in ('rascunho', 'agendada', 'publicando', 'publicada', 'falhou')),
  tentativas integer not null default 0,
  erro text,
  google_nome text,
  google_url text,
  publicada_em timestamptz,
  autor_id uuid default privado.membro_atual() references public.membros(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists gmn_postagens_fila on public.gmn_postagens (status, quando);
create index if not exists gmn_postagens_perfil on public.gmn_postagens (place_id, quando desc);
alter table public.gmn_postagens enable row level security;
drop policy if exists "gmn_postagens: time" on public.gmn_postagens;
create policy "gmn_postagens: time" on public.gmn_postagens for all to authenticated
  using ((select privado.eh_membro())) with check ((select privado.eh_membro()));

-- Fotos das postagens: o Google exige um link público para baixar a imagem
insert into storage.buckets (id, name, public) values ('gmn-midia', 'gmn-midia', true) on conflict (id) do nothing;
drop policy if exists "gmn-midia: time envia" on storage.objects;
create policy "gmn-midia: time envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'gmn-midia' and (select privado.eh_membro()));

select cron.unschedule('publicar-postagens-gmn') where exists (select 1 from cron.job where jobname = 'publicar-postagens-gmn');
select cron.schedule('publicar-postagens-gmn', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/gbp',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-chave-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'chave_cron_meta')),
    body := '{"acao":"gbp_publicar_fila"}'::jsonb, timeout_milliseconds := 120000)
  where exists (select 1 from public.gmn_postagens where status = 'agendada' and quando <= now());
$$);
