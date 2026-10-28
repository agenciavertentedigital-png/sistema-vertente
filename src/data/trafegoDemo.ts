import { DEMO_IDS } from "../lib/repo";
import { hoje, somarDias } from "../lib/tipos";
import type { ContaAnuncio, DiaConta, LinhaCampanha } from "../lib/trafego";
import type { Acao, AnuncioMeta, CampanhaMeta, LinhaMeta, RelatorioMeta } from "../lib/relatorio";

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

// ------------------------------------------------------------------
// Relatório "ao vivo" de exemplo (mesmo formato da função relatorio-meta)
// ------------------------------------------------------------------

type Base = { gasto: number; impressoes: number; cliques: number; resultados: number; tipo: string };

function linha(b: Base, extra: Partial<LinhaMeta> = {}): LinhaMeta {
  const acoes: Acao[] = [{ action_type: "link_click", value: String(b.cliques) }];
  const valores: Acao[] = [];
  const add = (t: string, v: number) => v > 0 && acoes.push({ action_type: t, value: String(Math.round(v)) });
  if (b.tipo === CONVERSA) {
    add(CONVERSA, b.resultados);
    add("onsite_conversion.messaging_first_reply", b.resultados * 0.78);
    add("onsite_conversion.messaging_user_depth_2_message_send", b.resultados * 0.55);
  } else if (b.tipo === "lead") {
    add("onsite_conversion.lead_grouped", b.resultados);
    add("landing_page_view", b.cliques * 0.72);
  } else if (b.tipo === "purchase") {
    add("landing_page_view", b.cliques * 0.7);
    add("omni_add_to_cart", b.resultados * 4);
    add("omni_initiated_checkout", b.resultados * 2.2);
    add("omni_purchase", b.resultados);
    if (b.resultados) valores.push({ action_type: "omni_purchase", value: String(Math.round(b.resultados * 189)) });
  }
  add("post_engagement", b.impressoes * 0.04);
  add("video_view", b.impressoes * 0.12);
  const alcance = Math.round(b.impressoes * 0.62);
  return {
    spend: b.gasto.toFixed(2),
    impressions: String(b.impressoes),
    reach: String(alcance),
    frequency: alcance ? (b.impressoes / alcance).toFixed(4) : "0",
    clicks: String(Math.round(b.cliques * 1.6)),
    inline_link_clicks: String(b.cliques),
    actions: acoes,
    action_values: valores,
    video_thruplay_watched_actions: [{ action_type: "video_view", value: String(Math.round(b.impressoes * 0.05)) }],
    results: b.tipo ? [{ indicator: b.tipo === CONVERSA ? `actions:${CONVERSA}` : b.tipo, values: [{ value: String(b.resultados) }] }] : undefined,
    ...extra,
  };
}

const soma = (xs: Base[], tipo = ""): Base =>
  xs.reduce((s, x) => ({ gasto: s.gasto + x.gasto, impressoes: s.impressoes + x.impressoes, cliques: s.cliques + x.cliques, resultados: s.resultados + x.resultados, tipo: tipo || x.tipo }), {
    gasto: 0, impressoes: 0, cliques: 0, resultados: 0, tipo,
  });


/** Soma linhas já montadas (cada uma com suas ações), como a Meta faz no nível da conta. */
function juntar(ls: LinhaMeta[], extra: Partial<LinhaMeta> = {}): LinhaMeta {
  const num = (k: keyof LinhaMeta) => ls.reduce((s, l) => s + Number((l[k] as string) ?? 0), 0);
  const acoes = (k: "actions" | "action_values" | "video_thruplay_watched_actions") => {
    const m = new Map<string, number>();
    for (const l of ls) for (const a of l[k] ?? []) m.set(a.action_type, (m.get(a.action_type) ?? 0) + Number(a.value));
    return [...m.entries()].map(([action_type, v]) => ({ action_type, value: String(Math.round(v)) }));
  };
  const impressions = num("impressions");
  const reach = Math.round(num("reach") * 0.85);
  return {
    spend: num("spend").toFixed(2),
    impressions: String(impressions),
    reach: String(reach),
    frequency: reach ? (impressions / reach).toFixed(4) : "0",
    clicks: String(num("clicks")),
    inline_link_clicks: String(num("inline_link_clicks")),
    actions: acoes("actions"),
    action_values: acoes("action_values"),
    video_thruplay_watched_actions: acoes("video_thruplay_watched_actions"),
    ...extra,
  };
}

const NOMES_AD = ["[IMG] Antes e depois", "[VÍDEO] Depoimento", "[CARROSSEL] Serviços", "[IMG] Oferta da semana"];

export function relatorioDemo(clienteId: string, inicio: string, fim: string): RelatorioMeta {
  const { contas, campanhas } = CLIENTES_DEMO_TRAFEGO();
  const n = Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86400000) + 1;
  const antIni = somarDias(inicio, -n);
  const antFim = somarDias(inicio, -1);
  return {
    inicio,
    fim,
    anterior: { since: antIni, until: antFim },
    contas: contas
      .filter((c) => c.cliente_id === clienteId)
      .map((c) => {
        const daConta = campanhas.filter((x) => x.conta_id === c.id);
        const base = (de: string, ate: string) =>
          daConta.filter((x) => x.data >= de && x.data <= ate).map((x) => ({ gasto: x.gasto, impressoes: x.impressoes, cliques: x.cliques, resultados: x.resultados, tipo: x.tipo_resultado ?? "", data: x.data, id: x.campanha_id, nome: x.campanha, obj: x.objetivo, st: x.status_campanha }));
        const periodo = base(inicio, fim);
        const ids = [...new Set(periodo.map((x) => x.id))];
        const camps: CampanhaMeta[] = ids.map((id) => {
          const xs = periodo.filter((x) => x.id === id);
          return { ...linha(soma(xs, xs[0].tipo), { objective: xs[0].obj ?? undefined }), campaign_id: id, campaign_name: xs[0].nome, status: xs[xs.length - 1].st ?? "ACTIVE", orcamento_dia: Math.round(soma(xs).gasto / n) };
        });
        const anuncios: AnuncioMeta[] = camps.flatMap((cp, i) => {
          const b = soma(periodo.filter((x) => x.id === cp.campaign_id));
          return [0.55, 0.3, 0.15].map((p, j) => ({
            ...linha({ gasto: b.gasto * p, impressoes: Math.round(b.impressoes * p), cliques: Math.round(b.cliques * p * (1.2 - j * 0.25)), resultados: Math.round(b.resultados * p * (1.25 - j * 0.3)), tipo: b.tipo }, { objective: cp.objective }),
            ad_id: `${cp.campaign_id}-ad${j}`,
            ad_name: `AD0${i + 1}${j} ${NOMES_AD[(i + j) % NOMES_AD.length]}`,
            adset_name: "Público aberto · 10 km",
            campaign_id: cp.campaign_id,
            campaign_name: cp.campaign_name,
            status: j === 2 ? "PAUSED" : "ACTIVE",
            previa: null,
            miniatura: null,
            tipo_criativo: j === 1 ? "VIDEO" : "SHARE",
          }));
        });
        const porCampanha = (xs: typeof periodo) =>
          [...new Set(xs.map((x) => x.id))].map((id) => {
            const ys = xs.filter((x) => x.id === id);
            return linha(soma(ys, ys[0].tipo));
          });
        const diario: LinhaMeta[] = [];
        for (let k = 0; k < n; k++) {
          const dia = somarDias(inicio, k);
          diario.push(juntar(porCampanha(periodo.filter((x) => x.data === dia)), { date_start: dia }));
        }
        return {
          conta: { id: c.id, conta_id: c.conta_id, nome: c.nome, status: c.status, saldo: c.saldo, pre_paga: c.pre_paga },
          total: juntar(porCampanha(periodo)),
          anterior: juntar(porCampanha(base(antIni, antFim))),
          diario,
          campanhas: camps,
          anuncios,
        };
      }),
  };
}
