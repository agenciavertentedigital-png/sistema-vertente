export type Status = "a_fazer" | "fazendo" | "aguardando" | "feita" | "nao_feita";
export type Prioridade = "urgente" | "alta" | "normal" | "baixa";
export type Pilar = "trafego" | "social" | "gmn" | "cs" | "interno";
export type Canal = "meta" | "google";
export type Frequencia = "diaria" | "semanal" | "quinzenal" | "mensal";

export const STATUS: Record<Status, string> = {
  a_fazer: "A fazer",
  fazendo: "Fazendo",
  aguardando: "Aguardando",
  feita: "Feita",
  nao_feita: "Não feita",
};
export const STATUS_ABERTOS: Status[] = ["a_fazer", "fazendo", "aguardando"];

export const PRIORIDADE: Record<Prioridade, string> = {
  urgente: "Urgente",
  alta: "Alta",
  normal: "Normal",
  baixa: "Baixa",
};
export const ORDEM_PRIORIDADE: Record<Prioridade, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

export const PILAR: Record<Pilar, string> = {
  trafego: "Tráfego",
  social: "Social Media",
  gmn: "Google Meu Negócio",
  cs: "Customer Success",
  interno: "Interno",
};
export const PILARES: Pilar[] = ["trafego", "social", "gmn", "cs", "interno"];

export const CANAL: Record<Canal, string> = { meta: "Meta", google: "Google" };

export const FREQUENCIA: Record<Frequencia, string> = {
  diaria: "Diária (dias úteis)",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};
export const DIAS_SEMANA = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export interface Cliente {
  id: string;
  nome: string;
  origem: "vertente" | "parceria_marcone";
  marca: string | null;
}

export interface Membro {
  id: string;
  nome: string;
  acesso: boolean;
}

export interface Tarefa {
  id: string;
  cliente_id: string;
  titulo: string;
  descricao: string | null;
  pilar: Pilar;
  canal: Canal | null;
  responsavel_id: string | null;
  prazo: string | null; // AAAA-MM-DD
  prioridade: Prioridade;
  status: Status;
  triagem: boolean;
  cliente_rotina_id: string | null;
  origem: "manual" | "rotina" | "clickup";
  clickup_id: string | null;
  processo_aplicado_id?: string | null;
  concluida_em: string | null;
  checklist_total: number;
  checklist_feitos: number;
}

export interface ItemChecklist {
  id: string;
  texto: string;
  feito: boolean;
  ordem: number;
}

export interface Comentario {
  id: string;
  texto: string;
  autor: string | null;
  criado_em: string;
}

export interface Rotina {
  id: string;
  nome: string;
  pilar: Pilar;
  frequencia_padrao: Frequencia;
  prioridade: Prioridade;
  checklist: string[];
  mensagem: string | null;
  ativa: boolean;
}

export interface ClienteRotina {
  id: string;
  cliente_id: string;
  rotina_id: string;
  canal: Canal | null;
  responsavel_id: string | null;
  frequencia: Frequencia;
  dia_semana: number | null;
  dia_mes: number | null;
  ativa: boolean;
  ultima_data: string | null;
  criado_em?: string;
}

export type CamposTarefa = Partial<
  Pick<
    Tarefa,
    "cliente_id" | "titulo" | "descricao" | "pilar" | "canal" | "responsavel_id" | "prazo" | "prioridade" | "status" | "triagem"
  >
>;

/** Data de hoje em Brasília (AAAA-MM-DD). */
export function hoje(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function dataCurta(data: string | null): string {
  if (!data) return "Sem prazo";
  const h = hoje();
  if (data === h) return "Hoje";
  if (data === somarDias(h, 1)) return "Amanhã";
  if (data === somarDias(h, -1)) return "Ontem";
  return `${Number(data.slice(8, 10))} ${MESES[Number(data.slice(5, 7)) - 1]}`;
}

export function atrasada(t: Pick<Tarefa, "prazo" | "status">): boolean {
  return Boolean(t.prazo && t.prazo < hoje() && STATUS_ABERTOS.includes(t.status));
}

// ------------------------------------------------------------------
// Registros e notificações
// ------------------------------------------------------------------
export type TipoRegistro = "revisao" | "otimizacao" | "reuniao" | "nota" | "decisao" | "daily" | "weekly";
export type Situacao = "ok" | "atencao" | "problema";

export const SITUACAO: Record<Situacao, string> = { ok: "Tudo certo", atencao: "Atenção", problema: "Problema" };
export const TIPO_REGISTRO: Record<TipoRegistro, string> = {
  revisao: "Revisão",
  otimizacao: "Otimização",
  reuniao: "Reunião",
  nota: "Nota",
  decisao: "Decisão",
  daily: "Daily",
  weekly: "Weekly",
};

export const ACOES_REVISAO = [
  "Nenhuma ação",
  "Pausei anúncio",
  "Ativei anúncio",
  "Subi criativo",
  "Ajustei orçamento",
  "Conta sem saldo",
  "Pedi material ao cliente",
  "Avisei o cliente",
];

export const TIPOS_ALTERACAO = ["Orçamento", "Lance", "Público", "Criativo / anúncio", "Palavra-chave", "Campanha", "Outro"];

export interface Alteracao {
  tipo: string;
  descricao: string;
  antes?: string;
  depois?: string;
}

export interface Registro {
  id: string;
  cliente_id: string;
  tarefa_id: string | null;
  tipo: TipoRegistro;
  canal: Canal | null;
  situacao: Situacao | null;
  acoes: string[];
  nota: string | null;
  alteracoes: Alteracao[];
  dados: { focos?: string[]; bloqueios?: string; decisoes?: string };
  data: string;
  autor_id: string | null;
  criado_em: string;
}

export type NovoRegistro = Pick<Registro, "cliente_id" | "tipo"> &
  Partial<Pick<Registro, "tarefa_id" | "canal" | "situacao" | "acoes" | "nota" | "alteracoes" | "dados">>;

export interface Notificacao {
  id: string;
  tipo: "mencao" | "atribuicao" | "alerta";
  texto: string;
  cliente_id: string | null;
  tarefa_id: string | null;
  lida: boolean;
  criado_em: string;
}

export interface ItemLinha {
  id: string;
  quando: string; // ISO
  tipo: "registro" | "comentario" | "concluida";
  registro?: Registro;
  texto?: string;
  tarefa?: string;
  autor?: string | null;
}

/** Últimos n dias úteis (seg–sex) terminando hoje, do mais antigo para o mais novo. */
export function diasUteis(n: number): string[] {
  const out: string[] = [];
  let d = hoje();
  while (out.length < n) {
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) out.unshift(d);
    d = somarDias(d, -1);
  }
  return out;
}
