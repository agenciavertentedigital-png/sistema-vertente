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

## Tarefas em Kanban (Gestão de Clientes → Tarefas)

- Filtros que valem de verdade e ficam salvos no navegador: período (atrasadas, hoje, esta semana seg–dom, próximos 7 dias, este mês, sem prazo), responsável (minhas, de alguém, sem responsável), pilar, cliente e busca.
- Os cartões de número (Atrasadas, Para hoje, Esta semana, Próximos 7 dias) também filtram ao clicar.
- Quadro por status (arrastar muda o status; revisão/otimização arrastada para "Feita" abre o registro), por responsável (arrastar reatribui) ou por prazo; ou visão em lista.

## Dashboard do cliente (Gestão de Tráfego → Dashboards dos clientes)

- Ao vivo da Meta pela função `relatorio-meta`: totais exatos do período (alcance e frequência não somados por dia), comparação com o período anterior, funil geral, gráfico diário, métricas por objetivo de campanha com funil próprio, melhores criativos com imagem e tabela de campanhas.
- Contato = conversa iniciada + lead de formulário instantâneo (`leadgen_grouped`). Os eventos `lead`, `onsite_conversion.lead(_grouped)` e o lead do pixel repetem as conversas de WhatsApp e não entram na soma.

## Identidade visual

- Logo oficial em `src/assets` (versão azul para fundo claro, prata para fundo escuro), menu lateral em azul-marinho e fonte Poppins.

## Fase 3 · Google Meu Negócio (`#gmn`)

- Perfis por cliente e perfis de prospecção. Análise GBP Check com 15 critérios (Fraco / Razoável / Bom, com pesos), nota de 0 a 100, plano de ação, evolução mensal e relatório em PDF (imprimir).
- Função `gbp-check` (Places API New): busca de empresa, leitura dos dados públicos (nota, avaliações, horário, telefone, site, categorias) e grade de ranking 5×5.
- Precisa da chave `google_places_key` no Vault (`select vault.create_secret('<chave>', 'google_places_key');`).

## Fase 4 · Social Media (`#social`)

- Calendário mensal, quadro de produção (Ideia → Em produção → Com o cliente → Ajuste → Aprovado → Publicado, arrastando) e aprovações com mensagem pronta para o WhatsApp.

## Fase 5 · Financeiro (`#financeiro`, só administradores)

- Mensalidades por cliente (valores por serviço em `cliente_servicos`), `gerar_mensalidades(mês)`, recebimentos, despesas (copiar do mês anterior), MRR, atraso, resultado e margem.

## Fase 6 · Gestor de Projetos (`#projetos`)

- Nota de saúde por cliente: entregas 25%, tráfego 25%, relacionamento 20%, financeiro 15%, GMN 10%, social 5% (`src/lib/saude.ts`).

## Fase 7 · Cadastro e Contratos (`#cadastro`, `#contratos`)

- Ficha completa do cliente e link público de cadastro (`#cadastro-publico-<token>`, função `cadastro-publico`).
- Contratos gerados do modelo com as variáveis da ficha; PDF pela impressão do navegador.

## Assistente de IA (`#assistente`)

- Chat com a função `assistente` (Claude via API da Anthropic, modelo em `ASSISTENTE_MODELO`, padrão `claude-sonnet-5-5`).
- Ferramentas só de leitura: `consultar_tabela`, `agregar` e `relatorio_meta_ao_vivo`. As consultas usam o login de quem pergunta, então as regras de acesso do banco valem (financeiro só para administradores).
- Conversas salvas em `assistente_conversas` (cada pessoa vê só as suas).
- Usa Claude se houver `anthropic_api_key` no Vault; senão usa a OpenAI com `openai_api_key` (modelo em `ASSISTENTE_MODELO_OPENAI`, padrão `gpt-5.5`, API Responses com funções).

## CRM (`/crm`)

- O CRM Vertente (app.agenciavertente.com.br) aparece embutido. O fornecedor não envia X-Frame-Options nem CSP frame-ancestors (verificado em 28/10/2026).
- Para o login do CRM funcionar embutido em todos os navegadores, o sistema deve rodar em `sistema.agenciavertente.com.br` (mesmo site do CRM, sem bloqueio de cookie de terceiros).

- Sistema publicado em https://sistema.agenciavertente.com.br (domínio verificado na Vercel em 29/10/2026). Links de cadastro sempre usam esse endereço.

## Onboarding, Drive e WhatsApp

- **Processos (Gestão de Clientes → Onboarding):** modelos de Pré-onboarding (6 etapas) e Onboarding (9 etapas) com checklists. "Aplicar em um cliente" cria as tarefas com prazo (fim de semana passa para segunda), responsável por pilar e checklist. Progresso aparece na tela do cliente. Modelos editáveis; dá para criar outros (Offboarding, Renovação).
- **Pasta no Drive:** link da pasta do cliente na ficha (`clientes.pasta_drive`). A aba "Pasta no Drive" da tela do cliente mostra os arquivos (visualização incorporada do Google Drive, depende do login Google no navegador).
- **WhatsApp (Z-API):** função `whatsapp` recebe o webhook `?chave=<whatsapp_webhook_chave>`, responde só no grupo configurado e só para membros com `membros.telefone`. Chama o `assistente` em modo interno (`x-chave-cron` + `membro_id`). Mensagens começando com `//` são ignoradas. Configuração em **Integrações** (só admin): credenciais Z-API, webhook, escolha do grupo e telefones do time.

## Briefing estratégico e anotações

- **Briefing** (`briefings`, um por cliente, `campos` jsonb; perguntas em `src/data/briefingCampos.json`): aba "Briefing" na tela do cliente, salva ao sair de cada campo. Seções: negócio, cliente ideal, posicionamento, objetivos e metas, comercial, histórico e "Estratégia da Vertente" (interna). Resumo (objetivo, KPI, verba) aparece no topo da tela do cliente.
- **Link para o cliente responder**: `cadastro_links.tipo = 'briefing'` → `#briefing-publico-<token>`; a função `cadastro-publico` só lê/grava as perguntas marcadas `cliente: true` e avisa o time.
- **Anotações** (`notas`): etiquetas, fixar, busca e @menções; por cliente (aba "Anotações") ou gerais em "Anotações e briefings", que também mostra o preenchimento dos briefings de todos os clientes.
- O Assistente IA lê `briefings` e `notas`.
