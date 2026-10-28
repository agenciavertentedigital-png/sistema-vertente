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
};

export const CATEGORIAS_DESPESA = ["Pessoal", "Ferramentas", "Estrutura", "Impostos", "Terceiros", "Marketing", "Outros"];
export const CATEGORIAS_RECEITA = ["Mensalidade", "Projeto avulso", "Consultoria", "Outros"];
export const FORMAS = ["pix", "boleto", "cartão", "transferência", "dinheiro"];

export type Situacao = "pago" | "atrasado" | "aberto";
export function situacao(l: Pick<Lancamento, "pago_em" | "vencimento">): Situacao {
  if (l.pago_em) return "pago";
  return l.vencimento < hoje() ? "atrasado" : "aberto";
}
export const CAMPOS_LANCAMENTO = "id, tipo, cliente_id, descricao, categoria, valor, competencia, vencimento, pago_em, forma, observacoes";
