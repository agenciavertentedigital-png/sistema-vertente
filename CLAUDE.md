# Sistema Vertente — guia para o Claude

Sistema interno da Vertente Digital, uma agência de tráfego pago. O objetivo é que o time trabalhe 100% nele e que o ClickUp e o GBP Check sejam desligados.
Roadmap e plano de execução: documento "Sistema Vertente · Roadmap de melhorias" no claude.ai. Antes de começar algo novo, leia o documento e atualize o que mudar.

## Stack

- **Front:** Vite, React, TypeScript e Tailwind, com a fonte Poppins. O deploy é feito pela Vercel a cada push na `main`.
- **Back:** Supabase, projeto `sistema-vertente` (ref `phtbhawdzewrzaiegheo`, us-east-1, Postgres 17).
  - **Banco:** tem RLS em todas as tabelas de `public`. As funções auxiliares ficam no schema `privado` (`eh_membro()`, `eh_admin()`, `membro_atual()`, `gerar_rotinas()`).
  - **Edge Functions:** ficam em `supabase/functions/`, são escritas em Deno e todas usam `verify_jwt=false`. Cada função faz a própria autenticação, com o JWT do usuário ou com o cabeçalho `x-chave-cron`.
  - **Segredos:** ficam no Supabase Vault e são lidos pela RPC `ler_segredo(nome)`. Nunca vão para o código, para o front ou para o chat.
  - **Agendamentos:** usam `pg_cron` com `pg_net`, em horário UTC. Eles chamam as funções com `x-chave-cron` igual ao segredo `chave_cron_meta`.
- **IA:** usa a OpenAI Responses API. A chave fica em `openai_api_key` e o modelo vem de `ASSISTENTE_MODELO_OPENAI` (padrão `gpt-5.5`).
- **WhatsApp:** Evolution API numa VPS própria na Hostinger, com Docker e Traefik, em `evo.agenciavertente.com.br`, instância `vertente`. A Z-API ficou só como reserva no código da função `whatsapp`.
- **Arquivos dos clientes** (contratos, planilhas, roteiros): ficam no Google Drive. O sistema só mostra e organiza.

## Regras de trabalho

1. **O repositório é a fonte da verdade.** Toda função publicada no Supabase e toda migration aplicada entram no GitHub no mesmo dia.
   - Migrations ficam em `supabase/migrations/AAAAMMDDNNNNNN_nome.sql`.
   - Antes de publicar uma função, compare com a versão em produção (`get_edge_function`). Em 12/11/2026 as funções `whatsapp` e `rotina-time` estavam só no Supabase.
2. **Produção é uma só:** não existe ambiente de teste.
   - Mudança no banco usa `apply_migration` e precisa da aprovação do Rener antes.
   - Para testar funções de rotina, use `{"dry":true}`: a `rotina-time` devolve o texto sem enviar.
3. **Um item por vez:** publicar, testar e só então seguir para o próximo.
4. **Escrita:** toda a interface e todos os textos ficam em português do Brasil. O visual deve ser bonito, prático e premium.

## Regras de negócio (vêm do Rener e valem para tudo que for novo)

- **Demanda:** toda demanda tem responsável e prazo. Toda pendência do cliente tem alguém da Vertente que acompanha e cobra.
- **Tarefas:** `tarefas.lado` vale `vertente` ou `cliente`. A Caixa de entrada é `triagem=true`, e a triagem é feita pela Carol e pelo Rener no início de cada dia.
- **Otimizações:** são registros com `tipo='otimizacao'`, revisados 7 dias depois (`dados.revisar_em`, `dados.resultado`).
- **Pequenas conquistas:** são enviadas toda semana pela Carol.
- **Acompanhamento:** usa só Vertente deve, Cliente deve, otimizações e pequenas conquistas. Não usar "Combinados" nem "Retorno do cliente", e não acompanhar status de roteiros.
- **Central Vertente:** é a página inicial só de ferramentas, sem métricas e sem saudação, e cabe numa dobra. Os números ficam no Dashboard Vertente.
- **Financeiro:**
  - É visível só para os sócios.
  - Sincroniza com a planilha "Controle Financeiro" só pelo botão Sincronizar, sem agendamento.
  - A planilha substitui o mês inteiro.
- **Assistente de IA:**
  - Responde só no grupo do time ("SISTEMA VERTENTE"), nunca em grupos de clientes.
  - Mensagens que começam com `//` são ignoradas.
  - Pode excluir ou arquivar tarefas só com confirmação clara e com a lista do que será afetado.
  - Nunca faz alterações estruturais.
- **Resumo da manhã e alertas:** vão para o grupo do time. Cada alerta é enviado uma vez só, com a chave registrada em `whatsapp_avisos`.
- **Contas Meta:** pausar, ativar ou subir criativo entra sozinho no Diário de Bordo do cliente.
- **Diagnóstico Digital:** o lead preenche os links e recebe na hora, sem revisão. O corte de qualificação é R$ 1.500/mês em anúncios e R$ 30 mil/mês de faturamento.

## Cuidados

- **Evolution API:** usa o WhatsApp Web, que não é oficial. Há risco de banimento do número, então nunca usar para disparo em massa.
- **Imagens da VPS:** as de `evolution-api` e `traefik` estão em `latest`. Fixe a versão antes de atualizar.
- **Subdomínio novo:** crie o DNS antes de subir o app, para o Traefik conseguir emitir o certificado.
- **`guardar_segredo_servidor`:** só aceita `google_ads_refresh_token` e `google_agenda_<uuid>`. Para os outros segredos use `vault.create_secret` ou `vault.update_secret`.
- **Google Business Profile API:** foi pedida em 29/10/2026. Não abra outro pedido para o mesmo projeto.

## Comandos

```bash
npm install
npm run dev
npm run build   # tsc --noEmit + vite build
```
