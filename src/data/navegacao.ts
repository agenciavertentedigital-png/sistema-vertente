// Organização dos menus: usada no menu lateral e nos tópicos da Central.
import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  CalendarDays,
  FileSignature,
  HeartPulse,
  MapPin,
  MessagesSquare,
  NotebookPen,
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
}
export interface Secao { id: string; nome: string; topicos: Topico[] }

export const SECOES: Secao[] = [
  {
    id: "clientes",
    nome: "Clientes",
    topicos: [
      {
        id: "clientes", nome: "Clientes", icone: Users, rota: "clientes", prefixos: ["clientes", "cliente-"], cor: "#2f54eb",
        descricao: "Tarefas, carteira, onboarding e rotinas",
        atalhos: [{ nome: "Tarefas", rota: "clientes" }, { nome: "Carteira", rota: "clientes-carteira" }, { nome: "Caixa de entrada", rota: "clientes-entrada" }, { nome: "Onboarding", rota: "clientes-onboarding" }],
      },
      {
        id: "anotacoes", nome: "Briefings e notas", icone: NotebookPen, rota: "anotacoes", prefixos: ["anotacoes"], cor: "#7c3aed",
        descricao: "Briefing estratégico e anotações",
        atalhos: [{ nome: "Anotações", rota: "anotacoes" }, { nome: "Briefings", rota: "anotacoes-briefings" }],
      },
      {
        id: "cadastro", nome: "Cadastro e contratos", icone: FileSignature, rota: "cadastro", prefixos: ["cadastro", "contratos", "base"], cor: "#0891b2",
        descricao: "Fichas, link de cadastro e contratos",
        atalhos: [{ nome: "Fichas", rota: "cadastro" }, { nome: "Contratos", rota: "contratos" }, { nome: "Modelos", rota: "contratos-modelos" }],
      },
    ],
  },
  {
    id: "marketing",
    nome: "Marketing",
    topicos: [
      {
        id: "trafego", nome: "Tráfego", icone: TrendingUp, rota: "trafego", prefixos: ["trafego"], cor: "#1d4ed8",
        descricao: "Meta Ads: contas, dashboards e saúde",
        atalhos: [{ nome: "Visão geral", rota: "trafego" }, { nome: "Dashboards", rota: "trafego-dashboards" }, { nome: "Saúde das contas", rota: "trafego-saude" }, { nome: "Alterações", rota: "trafego-alteracoes" }],
      },
      {
        id: "gmn", nome: "Google Meu Negócio", icone: MapPin, rota: "gmn", prefixos: ["gmn"], cor: "#16a34a",
        descricao: "Análise da ficha, nota e ranking",
        atalhos: [{ nome: "Perfis dos clientes", rota: "gmn" }, { nome: "Prospecção", rota: "gmn-prospeccao" }],
      },
      {
        id: "social", nome: "Social Media", icone: CalendarDays, rota: "social", prefixos: ["social"], cor: "#db2777",
        descricao: "Calendário, produção e aprovações",
        atalhos: [{ nome: "Calendário", rota: "social" }, { nome: "Produção", rota: "social-quadro" }, { nome: "Aprovações", rota: "social-aprovacao" }],
      },
      {
        id: "crm", nome: "CRM", icone: MessagesSquare, rota: "crm", prefixos: ["crm"], cor: "#0f766e",
        descricao: "Atendimento e funil dos clientes",
        atalhos: [],
      },
    ],
  },
  {
    id: "gestao",
    nome: "Gestão",
    topicos: [
      {
        id: "financeiro", nome: "Financeiro", icone: Wallet, rota: "financeiro", prefixos: ["financeiro"], cor: "#b45309",
        descricao: "Mês, recebimentos e histórico",
        atalhos: [{ nome: "Visão do mês", rota: "financeiro" }, { nome: "Recebimentos", rota: "financeiro-receber" }, { nome: "Mensalidades", rota: "financeiro-mensalidades" }, { nome: "Histórico", rota: "financeiro-historico" }],
      },
      {
        id: "projetos", nome: "Saúde e CS", icone: HeartPulse, rota: "projetos", prefixos: ["projetos"], cor: "#dc2626",
        descricao: "Saúde dos clientes e fluxo de CS",
        atalhos: [{ nome: "Saúde dos clientes", rota: "projetos" }, { nome: "Por pilar", rota: "projetos-pilares" }, { nome: "Fluxo de CS", rota: "projetos-cs" }],
      },
      {
        id: "reuniao", nome: "Daily e Weekly", icone: CalendarCheck, rota: "reuniao-daily", prefixos: ["reuniao"], cor: "#4f46e5",
        descricao: "Reuniões do time com pauta pronta",
        atalhos: [{ nome: "Daily", rota: "reuniao-daily" }, { nome: "Weekly", rota: "reuniao-weekly" }],
      },
    ],
  },
];

export const ASSISTENTE: Topico = {
  id: "assistente", nome: "Assistente IA", icone: Sparkles, rota: "assistente", prefixos: ["assistente"], cor: "#1d34a0",
  descricao: "Pergunte qualquer coisa sobre clientes, tarefas e números", atalhos: [],
};

export const ativo = (t: Topico, rota: string) => t.prefixos.some((p) => rota === p || rota.startsWith(p.endsWith("-") ? p : `${p}-`));
