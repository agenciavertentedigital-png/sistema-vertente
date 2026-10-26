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
