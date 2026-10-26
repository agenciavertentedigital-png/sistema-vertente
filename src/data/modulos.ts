import type { LucideIcon } from "lucide-react";
import {
  Users,
  TrendingUp,
  MapPin,
  CalendarDays,
  Wallet,
  Activity,
  IdCard,
  FileSignature,
  Handshake,
  MessagesSquare,
  Bot,
  Building2,
} from "lucide-react";

export type Grupo = "operacional" | "gerencial" | "futuro";

export interface Tela {
  nome: string;
  descricao: string;
}

export interface Integracao {
  nome: string;
  papel: string;
}

export interface Modulo {
  id: string; // usado na URL (#token)
  nome: string;
  grupo: Grupo;
  fase: number | null;
  icone: LucideIcon;
  resumo: string;
  telas: Tela[];
  integracoes: Integracao[];
  entregas: string[];
}

/** Fase atual de construção. Fase 0 = fundação (layout + base de clientes). */
export const FASE_ATUAL = 0;

export const FASES: { numero: number; nome: string }[] = [
  { numero: 0, nome: "Fundação" },
  { numero: 1, nome: "Gestão de Clientes" },
  { numero: 2, nome: "Gestão de Tráfego" },
  { numero: 3, nome: "Google Meu Negócio" },
  { numero: 4, nome: "Social Media" },
  { numero: 5, nome: "Financeiro" },
  { numero: 6, nome: "Gestor de Projetos" },
  { numero: 7, nome: "Cadastro e Contratos" },
];

export const MODULOS: Modulo[] = [
  {
    id: "clientes",
    nome: "Gestão de Clientes",
    grupo: "operacional",
    fase: 1,
    icone: Users,
    resumo:
      "Tarefas, demandas e recorrências de cada cliente, organizadas por pilar. Substitui o ClickUp por completo.",
    telas: [
      { nome: "Carteira", descricao: "Todos os clientes com tarefas abertas, atrasadas e concluídas e os serviços contratados." },
      { nome: "Cliente", descricao: "Cabeçalho do cliente + kanban com uma coluna por pilar (Tráfego, Social, GMN, CS) e notas importantes." },
      { nome: "Minhas tarefas", descricao: "O dia de cada pessoa do time: atrasadas, hoje e próximas." },
      { nome: "Diário de Demandas", descricao: "Entrada única de pedidos dos clientes, com triagem e responsável." },
      { nome: "Recorrências", descricao: "Tarefas que se repetem (semanal, quinzenal, mensal) e são criadas sozinhas." },
      { nome: "Documentos", descricao: "Reuniões, Estratégia, Conteúdo e Recursos de cada cliente." },
    ],
    integracoes: [
      { nome: "Supabase", papel: "Tarefas, recorrências, comentários e documentos" },
      { nome: "ClickUp API", papel: "Migração única dos dados atuais" },
      { nome: "Z-API", papel: "Avisos no WhatsApp e, depois, monitor dos grupos de clientes" },
    ],
    entregas: [
      "Tarefas com subtarefas, status, prazo, responsável e prioridade",
      "Kanban por pilar dentro de cada cliente",
      "Recorrências geradas automaticamente",
      "Comentários e histórico de cada tarefa",
      "Notificações para o responsável",
      "Migração do ClickUp e 2–3 semanas rodando em paralelo",
    ],
  },
  {
    id: "trafego",
    nome: "Gestão de Tráfego",
    grupo: "operacional",
    fase: 2,
    icone: TrendingUp,
    resumo:
      "Campanhas, resultados e históricos de cada conta de anúncio, com ações de pausar, ativar e subir criativos.",
    telas: [
      { nome: "Visão geral", descricao: "Todas as contas com investimento, resultado, custo por resultado e alertas." },
      { nome: "Campanhas", descricao: "Campanhas, conjuntos e anúncios do cliente, com pausar, ativar e alterar orçamento." },
      { nome: "Resultados", descricao: "Comparativo de períodos e ranking de criativos." },
      { nome: "Relatórios e insights", descricao: "Relatório do período e leitura gerada por IA." },
      { nome: "Histórico", descricao: "Alterações, otimizações e resultados ao longo do tempo." },
      { nome: "Saldo das contas", descricao: "Alerta de conta sem saldo antes da campanha parar." },
    ],
    integracoes: [
      { nome: "Meta Marketing API", papel: "Leitura de métricas, log de atividades e ações nas campanhas" },
      { nome: "Claude API", papel: "Insights e assistente de campanhas" },
      { nome: "Google Ads API", papel: "Segunda etapa, após aprovação do token" },
    ],
    entregas: [
      "Vínculo de cada conta de anúncio a um cliente",
      "Sincronização diária de métricas para o banco",
      "Histórico de alterações a partir do log da Meta",
      "Pausar, ativar, alterar orçamento e subir criativo",
      "Campanha nova sempre criada pausada",
    ],
  },
  {
    id: "gmn",
    nome: "Google Meu Negócio",
    grupo: "operacional",
    fase: 3,
    icone: MapPin,
    resumo: "GBP Check próprio: análise de saúde do perfil, grade de ranking no Maps e histórico mensal.",
    telas: [
      { nome: "Painel", descricao: "Notas de todos os perfis e quem caiu no mês." },
      { nome: "Gerar análise", descricao: "Nota do perfil, critérios Fraco / Razoável / Bom e PDF." },
      { nome: "Grade de ranking", descricao: "Posição da empresa em 25 pontos ao redor dela para uma palavra." },
      { nome: "Avaliações", descricao: "Novas avaliações e respostas." },
    ],
    integracoes: [
      { nome: "Business Profile API", papel: "Dados e operação dos perfis dos clientes" },
      { nome: "Places API", papel: "Dados públicos de qualquer empresa" },
      { nome: "DataForce", papel: "Grade de ranking (custo por consulta)" },
    ],
    entregas: ["Análise com nota e PDF", "Histórico mensal por cliente", "Grade 5×5 de ranking", "Modo prospecção (ocultar recomendações)"],
  },
  {
    id: "social",
    nome: "Social Media",
    grupo: "operacional",
    fase: 4,
    icone: CalendarDays,
    resumo: "Cronograma de conteúdo e materiais enviados pelos clientes, com aprovação.",
    telas: [
      { nome: "Cronograma", descricao: "Calendário de postagens por cliente." },
      { nome: "Materiais", descricao: "Artes, vídeos e links de posts enviados pelos clientes." },
      { nome: "Aprovações", descricao: "O que está aguardando o cliente." },
    ],
    integracoes: [
      { nome: "Supabase Storage / Google Drive", papel: "Arquivos dos clientes" },
      { nome: "Instagram Graph API", papel: "Posts publicados e seus códigos" },
    ],
    entregas: ["Calendário por cliente", "Upload de materiais", "Fluxo de aprovação"],
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    grupo: "gerencial",
    fase: 5,
    icone: Wallet,
    resumo: "MRR, recebimentos, inadimplência, despesas e margem real de cada cliente.",
    telas: [
      { nome: "Receitas", descricao: "MRR por cliente e por serviço, ticket médio, LTV e churn." },
      { nome: "Cobranças", descricao: "Recebidos, a receber e em atraso." },
      { nome: "Despesas", descricao: "Lançamentos por importação de planilha." },
      { nome: "Custo de atender", descricao: "Custo rateado e margem por cliente e por pacote." },
    ],
    integracoes: [{ nome: "Asaas", papel: "Cobranças e recebimentos" }],
    entregas: ["MRR e ticket médio", "Inadimplência", "Margem por cliente e por pacote"],
  },
  {
    id: "projetos",
    nome: "Gestor de Projetos",
    grupo: "gerencial",
    fase: 6,
    icone: Activity,
    resumo: "Visão geral da agência: saúde de cada cliente, CS e acompanhamentos.",
    telas: [
      { nome: "Visão geral", descricao: "Saúde da carteira inteira e por pilar." },
      { nome: "Saúde dos clientes", descricao: "Ranking do pior para o melhor, com o indicador que mais derruba a nota." },
      { nome: "Fluxo de CS", descricao: "Reuniões, NPS, vitórias e acompanhamentos." },
    ],
    integracoes: [{ nome: "Dados internos", papel: "Usa o que as fases 1 a 5 já registram" }],
    entregas: ["Nota de saúde com pesos definidos pela Vertente", "Ranking de prioridade", "Painel por pilar"],
  },
  {
    id: "cadastro",
    nome: "Informações Cadastrais",
    grupo: "gerencial",
    fase: 7,
    icone: IdCard,
    resumo: "Ficha de cada cliente, preenchida por ele num link de cadastro.",
    telas: [
      { nome: "Cadastros", descricao: "Ficha em três abas: dados da empresa, social media e Google Meu Negócio." },
      { nome: "Link de cadastro", descricao: "Formulário público enviado ao cliente novo." },
    ],
    integracoes: [{ nome: "Z-API", papel: "Envio do link pelo WhatsApp" }],
    entregas: ["Formulário público", "Aviso de cadastro preenchido"],
  },
  {
    id: "contratos",
    nome: "Contratos",
    grupo: "gerencial",
    fase: 7,
    icone: FileSignature,
    resumo: "Contrato gerado do modelo com os dados do cadastro, enviado para assinatura.",
    telas: [
      { nome: "Contratos", descricao: "Rascunho, aguardando assinatura e assinado." },
      { nome: "Modelos", descricao: "Modelos por tipo de pacote." },
    ],
    integracoes: [
      { nome: "Autentique", papel: "Assinatura eletrônica" },
      { nome: "Z-API", papel: "Envio do contrato pelo WhatsApp" },
    ],
    entregas: ["Contrato gerado do modelo", "Envio e acompanhamento da assinatura", "Lançamento no financeiro"],
  },
  // Áreas no radar, sem fase definida
  { id: "comercial", nome: "Comercial", grupo: "futuro", fase: null, icone: Handshake, resumo: "Metas com ritmo diário, prospecção e reuniões.", telas: [], integracoes: [], entregas: [] },
  { id: "crm", nome: "CRM", grupo: "futuro", fase: null, icone: MessagesSquare, resumo: "Pipeline e conversas dos leads dos clientes.", telas: [], integracoes: [], entregas: [] },
  { id: "agentes", nome: "Agentes IA", grupo: "futuro", fase: null, icone: Bot, resumo: "Agentes que executam rotinas e pedem autorização.", telas: [], integracoes: [], entregas: [] },
];

export const BASE_CLIENTES = {
  id: "base",
  nome: "Base de clientes",
  icone: Building2,
};

export const GRUPOS: { id: Grupo; nome: string }[] = [
  { id: "operacional", nome: "Operacional" },
  { id: "gerencial", nome: "Gerencial" },
  { id: "futuro", nome: "No radar" },
];
