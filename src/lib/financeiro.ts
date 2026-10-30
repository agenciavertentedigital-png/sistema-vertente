// Financeiro da agência: mensalidades, lançamentos e indicadores.
import { hoje } from "./tipos";

export interface Lancamento {
  id: string;
  tipo: "receita" | "despesa";
  cliente_id: string | null;
  descricao: string;
  categoria: string;
  valor: number;
  competencia: string; // AAAA-MM-01
  vencimento: string;
  pago_em: string | null;
  forma: string | null;
  observacoes: string | null;
}

export interface ServicoCliente {
  id: string; // cliente|servico (chave composta)
  cliente_id: string;
  servico_codigo: string;
  valor_mensal: number | null;
  inicio: string | null;
}

export const SERVICOS: Record<string, string> = {
  trafego_meta: "Tráfego Meta Ads",
  trafego_google: "Tráfego Google Ads",
  gmn: "Google Meu Negócio",
  social_media: "Social Media",
  consultoria: "Assessoria Estratégica",
  crm: "CRM Vertente",
};

// Mesmas categorias da planilha "Controle Financeiro" da agência
export const CATEGORIAS_DESPESA = ["Escritório", "Pró-labore", "Mão de obra", "Recursos humanos", "Educação", "Ferramentas", "Jurídico e contábil", "Eventos", "Parcerias", "Publicidade e vendas", "Outros"];
export const CATEGORIAS_RECEITA = ["Mensalidade", "Recebimento", "CRM", "Consultoria", "Projeto avulso", "Outros"];

/** Nome do cliente para agrupar receitas sem cliente ligado ("Nobre Fio (Tráfego Pago)" → "Nobre Fio"). */
export function origemReceita(descricao: string) {
  return descricao.replace(/\s*\(.*$/, "").replace(/\s+-\s+.*$/, "").replace(/\s+(Fixo|Variável)$/i, "").trim() || descricao;
}
export const FORMAS = ["pix", "boleto", "cartão", "transferência", "dinheiro"];

export type Situacao = "pago" | "atrasado" | "aberto";
export function situacao(l: Pick<Lancamento, "pago_em" | "vencimento">): Situacao {
  if (l.pago_em) return "pago";
  return l.vencimento < hoje() ? "atrasado" : "aberto";
}
export const CAMPOS_LANCAMENTO = "id, tipo, cliente_id, descricao, categoria, valor, competencia, vencimento, pago_em, forma, observacoes";
