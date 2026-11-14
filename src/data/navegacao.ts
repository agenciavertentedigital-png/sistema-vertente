// Organização dos menus: usada no menu lateral, na Central Vertente e no Dashboard Vertente.
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarCheck,
  CalendarRange,
  CalendarDays,
  FileSignature,
  Gauge,
  Plug,
  HeartPulse,
  MapPin,
  MessagesSquare,
  NotebookPen,
  ClipboardCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

export interface Atalho { nome: string; rota: string }
export interface Topico {
  id: string;
  nome: string;
  icone: LucideIcon;
  /** Rota principal ao clicar */
  rota: string;
  /** Rotas que deixam o item marcado como ativo */
  prefixos: string[];
  descricao: string;
  atalhos: Atalho[];
  cor: string;
  /** Submenus do módulo (barra lateral contextual). Sem submenus: o módulo é uma tela só. */
  submenus?: Atalho[];
}
export interface Secao { id: string; nome: string; topicos: Topico[] }

export const SECOES: Secao[] = [
  {
    id: "clientes",
    nome: "Clientes",
    topicos: [
      {
        id: "clientes", nome: "Gestão do Cliente", icone: Users, rota: "clientes", prefixos: ["clientes", "cliente-"], cor: "#2f54eb",
        descricao: "Tarefas, carteira, onboarding e rotinas",
        submenus: [{ nome: "Tarefas", rota: "clientes" }, { nome: "Carteira", rota: "clientes-carteira" }, { nome: "Caixa de entrada", rota: "clientes-entrada" }, { nome: "Rotinas", rota: "clientes-rotinas" }, { nome: "Onboarding", rota: "clientes-onboarding" }],
        atalhos: [{ nome: "Tarefas", rota: "clientes" }, { nome: "Carteira", rota: "clientes-carteira" }, { nome: "Caixa de entrada", rota: "clientes-entrada" }, { nome: "Onboarding", rota: "clientes-onboarding" }],
      },
      {
        id: "planejador", nome: "Planejador", icone: CalendarRange, rota: "planejador", prefixos: ["planejador"], cor: "#0d9488",
        descricao: "A semana de cada pessoa em grade, com capacidade do dia",
        atalhos: [],
      },
      {
        id: "anotacoes", nome: "Briefings e notas", icone: NotebookPen, rota: "anotacoes", prefixos: ["anotacoes"], cor: "#7c3aed",
        descricao: "Briefing estratégico e anotações",
        submenus: [{ nome: "Anotações", rota: "anotacoes" }, { nome: "Briefings dos clientes", rota: "anotacoes-briefings" }],
        atalhos: [{ nome: "Anotações", rota: "anotacoes" }, { nome: "Briefings", rota: "anotacoes-briefings" }],
      },
      {
        id: "cadastro", nome: "Cadastro e contratos", icone: FileSignature, rota: "cadastro", prefixos: ["cadastro", "contratos", "base"], cor: "#0891b2",
        descricao: "Informações cadastrais, fichas e contratos",
        submenus: [{ nome: "Informações cadastrais", rota: "cadastro-informacoes" }, { nome: "Fichas dos clientes", rota: "cadastro" }, { nome: "Contratos", rota: "contratos" }, { nome: "Modelos de contrato", rota: "contratos-modelos" }, { nome: "Base de clientes", rota: "base" }],
        atalhos: [{ nome: "Fichas", rota: "cadastro" }, { nome: "Informações cadastrais", rota: "cadastro-informacoes" }, { nome: "Contratos", rota: "contratos" }, { nome: "Modelos", rota: "contratos-modelos" }],
      },
    ],
  },
  {
    id: "marketing",
    nome: "Marketing",
    topicos: [
      {
        id: "trafego", nome: "Gestão de Tráfego", icone: TrendingUp, rota: "trafego", prefixos: ["trafego"], cor: "#1d4ed8",
        descricao: "Meta e Google Ads: contas, dashboards e saúde",
        submenus: [{ nome: "Visão geral", rota: "trafego" }, { nome: "Dashboards dos clientes", rota: "trafego-dashboards" }, { nome: "Saúde das contas", rota: "trafego-saude" }, { nome: "Histórico de alterações", rota: "trafego-alteracoes" }, { nome: "Rastreamento", rota: "trafego-rastreamento" }, { nome: "Contas", rota: "trafego-contas" }],
        atalhos: [{ nome: "Visão geral", rota: "trafego" }, { nome: "Dashboards", rota: "trafego-dashboards" }, { nome: "Saúde das contas", rota: "trafego-saude" }, { nome: "Alterações", rota: "trafego-alteracoes" }, { nome: "Rastreamento", rota: "trafego-rastreamento" }],
      },
      {
        id: "gmn", nome: "Google Meu Negócio", icone: MapPin, rota: "gmn", prefixos: ["gmn"], cor: "#16a34a",
        descricao: "Análise da ficha, avaliações, postagens e ranking",
        submenus: [{ nome: "Perfis dos clientes", rota: "gmn" }, { nome: "Monitoramento", rota: "gmn-fichas" }, { nome: "Central de avaliações", rota: "gmn-avaliacoes" }, { nome: "Postagens", rota: "gmn-postagens" }, { nome: "Prospecção", rota: "gmn-prospeccao" }, { nome: "Ferramentas", rota: "gmn-ferramentas" }],
        atalhos: [{ nome: "Perfis dos clientes", rota: "gmn" }, { nome: "Monitoramento", rota: "gmn-fichas" }, { nome: "Avaliações", rota: "gmn-avaliacoes" }, { nome: "Postagens", rota: "gmn-postagens" }, { nome: "Prospecção", rota: "gmn-prospeccao" }],
      },
      {
        id: "social", nome: "Social Media", icone: CalendarDays, rota: "social", prefixos: ["social"], cor: "#db2777",
        descricao: "Calendário, produção e aprovações",
        submenus: [{ nome: "Calendário", rota: "social" }, { nome: "Quadro de produção", rota: "social-quadro" }, { nome: "Aprovações", rota: "social-aprovacao" }],
        atalhos: [{ nome: "Calendário", rota: "social" }, { nome: "Produção", rota: "social-quadro" }, { nome: "Aprovações", rota: "social-aprovacao" }],
      },
      {
        id: "crm", nome: "CRM", icone: MessagesSquare, rota: "crm", prefixos: ["crm"], cor: "#0f766e",
        descricao: "Atendimento e funil dos clientes",
        atalhos: [],
      },
      {
        id: "diagnosticos", nome: "Diagnóstico Digital", icone: ClipboardCheck, rota: "diagnosticos", prefixos: ["diagnosticos"], cor: "#0e1a52",
        descricao: "Leads da página pública de diagnóstico",
        atalhos: [],
      },
    ],
  },
  {
    id: "gestao",
    nome: "Gestão",
    topicos: [
      {
        id: "escritorio", nome: "Escritório virtual", icone: Building2, rota: "escritorio", prefixos: ["escritorio"], cor: "#0f766e",
        descricao: "Quem está online e em qual sala",
        atalhos: [],
      },
      {
        id: "financeiro", nome: "Financeiro", icone: Wallet, rota: "financeiro", prefixos: ["financeiro"], cor: "#b45309",
        descricao: "Mês, recebimentos e histórico",
        submenus: [{ nome: "Visão do mês", rota: "financeiro" }, { nome: "Histórico completo", rota: "financeiro-historico" }, { nome: "Recebimentos", rota: "financeiro-receber" }, { nome: "Despesas", rota: "financeiro-despesas" }, { nome: "Mensalidades por cliente", rota: "financeiro-mensalidades" }],
        atalhos: [{ nome: "Visão do mês", rota: "financeiro" }, { nome: "Recebimentos", rota: "financeiro-receber" }, { nome: "Mensalidades", rota: "financeiro-mensalidades" }, { nome: "Histórico", rota: "financeiro-historico" }],
      },
      {
        id: "projetos", nome: "Saúde e CS", icone: HeartPulse, rota: "projetos", prefixos: ["projetos"], cor: "#dc2626",
        descricao: "Acompanhamentos, saúde dos clientes e fluxo de CS",
        submenus: [{ nome: "Central de Acompanhamentos", rota: "projetos-acompanhamentos" }, { nome: "Saúde dos clientes", rota: "projetos" }, { nome: "Visão por pilar", rota: "projetos-pilares" }, { nome: "Fluxo de CS", rota: "projetos-cs" }, { nome: "Horas e rentabilidade", rota: "projetos-horas" }],
        atalhos: [{ nome: "Acompanhamentos", rota: "projetos-acompanhamentos" }, { nome: "Saúde dos clientes", rota: "projetos" }, { nome: "Por pilar", rota: "projetos-pilares" }, { nome: "Fluxo de CS", rota: "projetos-cs" }],
      },
      {
        id: "reuniao", nome: "Daily e Weekly", icone: CalendarCheck, rota: "reuniao-daily", prefixos: ["reuniao"], cor: "#4f46e5",
        descricao: "Reuniões do time com pauta pronta",
        submenus: [{ nome: "Daily", rota: "reuniao-daily" }, { nome: "Weekly", rota: "reuniao-weekly" }],
        atalhos: [{ nome: "Daily", rota: "reuniao-daily" }, { nome: "Weekly", rota: "reuniao-weekly" }],
      },
    ],
  },
];

export const DASHBOARD: Topico = {
  id: "dashboard", nome: "Dashboard Vertente", icone: Gauge, rota: "dashboard", prefixos: ["dashboard"], cor: "#2747d6",
  descricao: "Alertas, saúde dos clientes, tarefas e indicadores do dia", atalhos: [],
};

export const INTEGRACOES: Topico = {
  id: "integracoes", nome: "Integrações", icone: Plug, rota: "integracoes", prefixos: ["integracoes"], cor: "#475569",
  descricao: "Meta, Google, IA, WhatsApp e conexões do sistema", atalhos: [],
};

export const ASSISTENTE: Topico = {
  id: "assistente", nome: "Assistente IA", icone: Sparkles, rota: "assistente", prefixos: ["assistente"], cor: "#1d34a0",
  descricao: "Pergunte qualquer coisa sobre clientes, tarefas e números", atalhos: [],
};

export const ativo = (t: Topico, rota: string) => t.prefixos.some((p) => rota === p || rota.startsWith(p.endsWith("-") ? p : `${p}-`));

/** Módulos que ficam fora das seções (acesso pela Central). */
export const AVULSOS: Topico[] = [DASHBOARD, ASSISTENTE, INTEGRACOES];

/** O módulo (e a seção) da rota atual. */
export function moduloDe(rota: string): { topico: Topico; secao: Secao | null } | null {
  for (const s of SECOES) for (const t of s.topicos) if (ativo(t, rota)) return { topico: t, secao: s };
  const t = AVULSOS.find((x) => ativo(x, rota));
  return t ? { topico: t, secao: null } : null;
}

/** O submenu ativo: o de rota igual, senão o de prefixo mais longo (ex.: gmn-perfil-x → Perfis dos clientes). */
export function submenuAtivo(t: Topico, rota: string): string | null {
  const subs = t.submenus ?? [];
  if (subs.some((a) => a.rota === rota)) return rota;
  const pref = subs.filter((a) => rota.startsWith(`${a.rota}-`)).sort((a, b) => b.rota.length - a.rota.length)[0];
  return pref?.rota ?? null;
}
