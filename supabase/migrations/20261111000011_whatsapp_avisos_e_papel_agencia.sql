-- WhatsApp: mensagens do número da agência (papel 'agencia') e controle de avisos já enviados ao grupo do time.
-- Aplicada em produção em 11/11/2026 (versão 20261111210128 no Supabase).
alter table public.whatsapp_mensagens drop constraint whatsapp_mensagens_papel_check;
alter table public.whatsapp_mensagens add constraint whatsapp_mensagens_papel_check check (papel = any (array['user','assistant','ignorada','grupo','agencia']));

create table if not exists public.whatsapp_avisos (
  chave text primary key,
  tipo text not null,
  texto text,
  enviado_em timestamptz not null default now()
);
-- Só as funções de servidor (service role) leem e gravam; por isso não há policy.
alter table public.whatsapp_avisos enable row level security;

create index if not exists whatsapp_mensagens_grupo_criado on public.whatsapp_mensagens (grupo, criado_em desc);

-- Agendamentos da função rotina-time (horários em UTC: 11:02 = 08:02 em Brasília).
-- Criados direto no banco em 11/11/2026; registrados aqui para o repositório refletir a produção.
select cron.schedule('resumo-manha-whatsapp', '2 11 * * 1-5', $c$
  select net.http_post(
    url := 'https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/rotina-time',
    headers := jsonb_build_object('Content-Type','application/json','x-chave-cron',(select decrypted_secret from vault.decrypted_secrets where name = 'chave_cron_meta')),
    body := '{"acao":"resumo"}'::jsonb,
    timeout_milliseconds := 120000)
$c$);

select cron.schedule('alertas-whatsapp', '*/15 11-22 * * 1-6', $c$
  select net.http_post(
    url := 'https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/rotina-time',
    headers := jsonb_build_object('Content-Type','application/json','x-chave-cron',(select decrypted_secret from vault.decrypted_secrets where name = 'chave_cron_meta')),
    body := '{"acao":"alertas"}'::jsonb,
    timeout_milliseconds := 60000)
$c$);
