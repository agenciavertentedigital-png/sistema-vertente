# Sistema Vertente

Sistema interno da Vertente Digital. Substitui o ClickUp e concentra clientes, tráfego, Google Meu Negócio, social media, financeiro, projetos e contratos.

## Ordem de construção

| Fase | Área |
| --- | --- |
| 0 | Fundação: layout, login, base de clientes |
| 1 | Gestão de Clientes |
| 2 | Gestão de Tráfego |
| 3 | Google Meu Negócio |
| 4 | Social Media |
| 5 | Financeiro |
| 6 | Gestor de Projetos |
| 7 | Informações Cadastrais e Contratos |

A fase atual fica em `src/data/modulos.ts` (`FASE_ATUAL`).

## Stack

- Vite + React + TypeScript + Tailwind
- Supabase (banco, login, funções de servidor, rotinas agendadas) — a conectar
- Vercel (hospedagem) — a conectar

## Rodar

```bash
npm install
npm run dev            # desenvolvimento
npm run build          # build para a Vercel (dist/)
npm run build:preview && node scripts/preparar-previa.mjs   # prévia em arquivo único
```

## Estrutura

- `src/data/modulos.ts` — áreas, telas, entregas e integrações de cada módulo
- `src/data/clientes.ts` — base inicial de clientes (vai para a tabela `clientes` do Supabase)
- `src/pages/` — Central, página de módulo, base de clientes
- `src/components/` — menu, marca, selo de fase
- Cores e fontes: tokens em `src/index.css` (tema claro e escuro)

## Banco de dados e login

- Migrações em `supabase/migrations/` (Fase 0: `membros`, `clientes`, `servicos`, `cliente_servicos`, com RLS).
- Só e-mails cadastrados na tabela `membros` (ativos) veem os dados. Para liberar alguém: inserir o e-mail em `membros`; a pessoa cria a senha em "Primeiro acesso".
- Variáveis de ambiente (Vercel e `.env.local`): `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Sem elas o sistema abre em modo demonstração.

## Fase 1 · Gestão de Clientes

- Tabelas: `tarefas`, `tarefa_checklist`, `tarefa_comentarios`, `rotinas` (modelos) e `cliente_rotinas` (quem faz, frequência e dia de cada rotina por cliente).
- Status: A fazer, Fazendo, Aguardando, Feita, Não feita. Caixa de entrada = tarefas com `triagem = true`.
- Rotinas: `privado.gerar_rotinas()` roda todo dia às 06:00 (Brasília) pelo pg_cron. Cria a tarefa do dia previsto só se a anterior já foi fechada.
- `membros.acesso` separa quem pode entrar no sistema de quem só aparece como responsável.
- Telas: `#clientes` (tarefas por prazo), `#clientes-carteira`, `#clientes-entrada`, `#clientes-rotinas`, `#cliente-<id>` (kanban por pilar + rotinas do cliente).

## Registro do dia a dia (outubro/2026)

- **Registro rápido**: tarefas de rotina "Revisão…" e "Otimização…" pedem, ao concluir, a situação da conta (Tudo certo / Atenção / Problema), o que foi feito (revisão) ou as alterações com antes → depois (otimização). Fica na tabela `registros`.
- **Gestão de Tráfego** (`#trafego`): Saúde das contas, um quadrado colorido por dia útil (10 dias) para cada conta com rotina de revisão; o `+` de hoje abre a revisão. `#trafego-alteracoes` lista o histórico de otimizações.
- **Linha do tempo do cliente**: aba na tela do cliente com revisões, otimizações, notas, reuniões, decisões, comentários e tarefas concluídas.
- **@menções e "Para mim"**: `@Nome` em comentários e registros avisa a pessoa (tabela `notificacoes`, via trigger). Conta marcada como Problema avisa o time. Atribuir tarefa a alguém também avisa.
- **Daily e Weekly** (`#reuniao-daily`, `#reuniao-weekly`): contas em atenção, atrasadas, aguardando, números por pessoa e ata rápida (3 focos, bloqueios, decisões). Registrar conclui a tarefa da rotina.

## Fase 2 · Meta Ads (outubro/2026)

- Tabelas `contas_anuncio` (conta ↔ cliente, status, saldo) e `metricas_diarias` (por campanha e dia); visão `metricas_conta_dia`.
- Edge Function `sincronizar-meta`: busca status, saldo e métricas na Graph API (v23.0). Primeira vez traz 30 dias; depois os últimos 3. Avisa no sininho quando a conta muda de status ou o saldo dá para menos de 3 dias.
- Agendamento `sincronizar-meta` (pg_cron + pg_net) às 7h, 12h e 17h de Brasília; a chave do agendamento fica no Vault (`chave_cron_meta`).
- Segredo necessário: `META_ACCESS_TOKEN` (token de Usuário do Sistema da BM da agência, com `ads_read`, com as contas atribuídas).
- Telas: Gestão de Tráfego → Visão geral (investimento, resultado principal, custo, ontem, saldo, alertas, campanhas) e Contas (vincular/acompanhar). Números de ontem também aparecem na tela do cliente e no registro da revisão.
