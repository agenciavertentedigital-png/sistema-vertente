import { DEMO_IDS } from "../lib/repo";
import { hoje, somarDias } from "../lib/tipos";
import type { ContaAnuncio, DiaConta, LinhaCampanha } from "../lib/trafego";

const CONVERSA = "onsite_conversion.messaging_conversation_started_7d";

interface Modelo {
  cliente: string;
  nome: string;
  status?: string;
  saldo?: number;
  zerouOntem?: boolean;
  campanhas: { nome: string; objetivo: string; tipo: string; gasto: number; custo: number; status?: string }[];
}

const MODELOS: Modelo[] = [
  { cliente: "Madalena Brandão", nome: "CA01 - Madalena Brandão", saldo: 84.5, campanhas: [
    { nome: "[VD] [C03] [F] [ENGAJ.] [MENSG] - WhatsApp", objetivo: "OUTCOME_ENGAGEMENT", tipo: CONVERSA, gasto: 45, custo: 13 },
    { nome: "[VD] [C02] [Q] [ENGAJ.] [MENSG] - WhatsApp", objetivo: "OUTCOME_ENGAGEMENT", tipo: CONVERSA, gasto: 13, custo: 9 },
    { nome: "[VD] [C01] [TRÁFEGO] [Visita Perfil IG]", objetivo: "OUTCOME_TRAFFIC", tipo: "profile_visit_view", gasto: 16, custo: 0.38 },
  ] },
  { cliente: "Clínica Nobre Fio", nome: "CA01 - Clínica Nobre Fio", campanhas: [
    { nome: "[VD] Mensagens - Implante capilar", objetivo: "OUTCOME_ENGAGEMENT", tipo: CONVERSA, gasto: 60, custo: 11 },
    { nome: "[VD] Cadastro - Avaliação gratuita", objetivo: "OUTCOME_LEADS", tipo: "lead", gasto: 35, custo: 18 },
  ] },
  { cliente: "Espaço Larissa Lemos", nome: "CA - Larissa Lemos", saldo: 420, campanhas: [
    { nome: "[VD] Mensagens - Design de sobrancelha", objetivo: "OUTCOME_ENGAGEMENT", tipo: CONVERSA, gasto: 25, custo: 6 },
  ] },
  { cliente: "Óticas Carol SVA", nome: "CA - Óticas Carol Ipatinga SVA", zerouOntem: true, campanhas: [
    { nome: "[VD] Mensagens - Exame de vista", objetivo: "OUTCOME_ENGAGEMENT", tipo: CONVERSA, gasto: 30, custo: 8 },
  ] },
  { cliente: "Terapia de Oração", nome: "CA01 - Terapia de Oração", campanhas: [
    { nome: "[VD] Mensagens - Noite Oracional", objetivo: "OUTCOME_ENGAGEMENT", tipo: CONVERSA, gasto: 20, custo: 4 },
  ] },
  { cliente: "Essenza Planejados", nome: "CA - Essenza Planejados", campanhas: [
    { nome: "[VD] Cadastro - Orçamento cozinha", objetivo: "OUTCOME_LEADS", tipo: "lead", gasto: 38, custo: 31 },
  ] },
  { cliente: "CDT Porto Seguro", nome: "CA - CDT Porto Seguro", status: "desativada", campanhas: [
    { nome: "[VD] Mensagens - Cartão de Todos", objetivo: "OUTCOME_ENGAGEMENT", tipo: CONVERSA, gasto: 0, custo: 5 },
  ] },
  { cliente: "Cecy Lessa", nome: "Cecy Lessa Homewear", status: "pagamento_pendente", campanhas: [
    { nome: "[VD] Vendas - Catálogo", objetivo: "OUTCOME_SALES", tipo: "purchase", gasto: 0, custo: 40 },
  ] },
];

/** Gera 60 dias de números plausíveis (determinísticos) para o modo demonstração. */
export function CLIENTES_DEMO_TRAFEGO() {
  let semente = 7;
  const acaso = () => {
    semente = (semente * 9301 + 49297) % 233280;
    return semente / 233280;
  };
  const contas: ContaAnuncio[] = [];
  const dias: DiaConta[] = [];
  const campanhas: (LinhaCampanha & { conta_id: string })[] = [];
  const h = hoje();
  MODELOS.forEach((m, i) => {
    const id = `cx-${i + 1}`;
    const status = m.status ?? "ativa";
    contas.push({
      id, cliente_id: DEMO_IDS.get(m.cliente) ?? "", plataforma: "meta", conta_id: String(100000 + i), nome: m.nome, moeda: "BRL", ativa: true, status,
      motivo_bloqueio: null, pre_paga: m.saldo !== undefined, saldo: m.saldo ?? null, saldo_texto: m.saldo !== undefined ? `Saldo disponível (R$${m.saldo.toFixed(2).replace(".", ",")} BRL)` : null,
      limite_gasto: null, gasto_total: null, ultimo_sync: new Date().toISOString(), erro_sync: null,
    });
    for (let k = 60; k >= 0; k--) {
      const data = somarDias(h, -k);
      const porTipo = new Map<string, DiaConta>();
      m.campanhas.forEach((c, j) => {
        const parado = status !== "ativa" && k < 12;
        const zerado = (m.zerouOntem && k <= 1) || (c.status === "PAUSED" && k < 20) || parado;
        const tendencia = 1 + (30 - k) / 120; // leve alta nos dias recentes
        const gastoBase = c.gasto || 35;
        const gasto = zerado ? 0 : Math.round(gastoBase * tendencia * (0.7 + acaso() * 0.6) * 100) / 100;
        const resultados = gasto ? Math.max(0, Math.round(gasto / (c.custo * (0.75 + acaso() * 0.6)))) : 0;
        const impressoes = Math.round(gasto * (45 + acaso() * 40));
        const cliques = Math.round(impressoes * (0.008 + acaso() * 0.01));
        campanhas.push({ conta_id: id, campanha_id: `${id}-c${j}`, campanha: c.nome, objetivo: c.objetivo, status_campanha: zerado ? "PAUSED" : "ACTIVE", data, gasto, impressoes, alcance: Math.round(impressoes * 0.7), cliques, resultados, tipo_resultado: c.tipo });
        const d = porTipo.get(c.tipo) ?? { conta_id: id, data, tipo_resultado: c.tipo, gasto: 0, impressoes: 0, cliques: 0, resultados: 0, leads: 0, conversas: 0 };
        d.gasto = Math.round((d.gasto + gasto) * 100) / 100;
        d.impressoes += impressoes;
        d.cliques += cliques;
        d.resultados += resultados;
        if (c.tipo === "lead") d.leads += resultados;
        if (c.tipo === CONVERSA) d.conversas += resultados;
        porTipo.set(c.tipo, d);
      });
      dias.push(...porTipo.values());
    }
  });
  return { contas, dias, campanhas };
}
