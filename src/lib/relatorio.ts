// Leitura do relatório ao vivo da Meta (função relatorio-meta) em métricas prontas para o dashboard.

export interface Acao {
  action_type: string;
  value: string;
}
export interface LinhaMeta {
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: Acao[];
  action_values?: Acao[];
  video_thruplay_watched_actions?: Acao[];
  results?: { indicator?: string; values?: { value: string }[] }[];
  objective?: string;
  date_start?: string;
}
export interface CampanhaMeta extends LinhaMeta {
  campaign_id: string;
  campaign_name: string;
  status?: string;
  orcamento_dia?: number | null;
}
export interface AnuncioMeta extends LinhaMeta {
  ad_id: string;
  ad_name: string;
  adset_name?: string;
  campaign_id: string;
  campaign_name: string;
  status?: string | null;
  previa?: string | null;
  miniatura?: string | null;
  tipo_criativo?: string | null;
  titulo?: string | null;
  texto?: string | null;
  link_instagram?: string | null;
}
export interface ContaRelatorio {
  conta: { id: string; conta_id: string; nome: string; status: string | null; saldo?: number | null; pre_paga?: boolean | null };
  erro?: string;
  total?: LinhaMeta | null;
  anterior?: LinhaMeta | null;
  diario?: LinhaMeta[];
  campanhas?: CampanhaMeta[];
  anuncios?: AnuncioMeta[];
}
export interface RelatorioMeta {
  inicio: string;
  fim: string;
  anterior: { since: string; until: string };
  contas: ContaRelatorio[];
}

// ------------------------------------------------------------------
// Métricas
// ------------------------------------------------------------------
const n = (v: unknown) => Number(v ?? 0) || 0;

function acao(lista: Acao[] | undefined, ...tipos: string[]) {
  if (!lista) return 0;
  for (const t of tipos) {
    const a = lista.find((x) => x.action_type === t);
    if (a) return n(a.value);
  }
  return 0;
}

export interface Metricas {
  gasto: number;
  impressoes: number;
  alcance: number;
  frequencia: number;
  cliques: number;
  cliquesLink: number;
  lpViews: number;
  conversas: number;
  respostas: number;
  conversasProfundas: number;
  leads: number;
  carrinho: number;
  checkout: number;
  compras: number;
  valor: number;
  thruplays: number;
  videoViews: number;
  engajamento: number;
}

export function metricas(l: LinhaMeta | null | undefined): Metricas {
  const a = l?.actions;
  const v = l?.action_values;
  return {
    gasto: n(l?.spend),
    impressoes: n(l?.impressions),
    alcance: n(l?.reach),
    frequencia: n(l?.frequency),
    cliques: n(l?.clicks),
    cliquesLink: n(l?.inline_link_clicks),
    lpViews: acao(a, "omni_landing_page_view", "landing_page_view"),
    conversas: acao(a, "onsite_conversion.messaging_conversation_started_7d"),
    respostas: acao(a, "onsite_conversion.messaging_first_reply"),
    conversasProfundas: acao(a, "onsite_conversion.messaging_user_depth_2_message_send"),
    leads: acao(a, "onsite_conversion.lead_grouped") + acao(a, "offsite_conversion.fb_pixel_lead"),
    carrinho: acao(a, "omni_add_to_cart", "offsite_conversion.fb_pixel_add_to_cart", "add_to_cart"),
    checkout: acao(a, "omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout", "initiate_checkout"),
    compras: acao(a, "omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_conversion.purchase"),
    valor: acao(v, "omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_conversion.purchase"),
    thruplays: acao(l?.video_thruplay_watched_actions, "video_view"),
    videoViews: acao(a, "video_view"),
    engajamento: acao(a, "post_engagement"),
  };
}

export function somarMetricas(lista: Metricas[]): Metricas {
  const z = metricas(null);
  for (const m of lista) for (const k of Object.keys(z) as (keyof Metricas)[]) z[k] += m[k];
  // frequência não se soma: recalcula pela média ponderada de impressões/alcance
  z.frequencia = z.alcance ? z.impressoes / z.alcance : 0;
  return z;
}

/** Contatos = conversas iniciadas + leads (sem contar duas vezes a mesma pessoa pelo "lead" genérico). */
export const contatos = (m: Metricas) => m.conversas + m.leads;

// ------------------------------------------------------------------
// Resultado e objetivo
// ------------------------------------------------------------------
export type GrupoObjetivo = "mensagens" | "leads" | "vendas" | "trafego" | "reconhecimento" | "engajamento";

export const GRUPOS: Record<GrupoObjetivo, { nome: string; cor: string; resultado: [string, string]; descricao: string }> = {
  mensagens: { nome: "Mensagens", cor: "#2f9a5d", resultado: ["conversa", "conversas"], descricao: "Campanhas que levam para o WhatsApp, Direct ou Messenger" },
  leads: { nome: "Leads e contatos", cor: "#3b82c4", resultado: ["lead", "leads"], descricao: "Cadastros, formulários e contatos pelo site" },
  vendas: { nome: "Vendas", cor: "#b35bb0", resultado: ["compra", "compras"], descricao: "Compras registradas pelo pixel ou pela loja" },
  trafego: { nome: "Tráfego", cor: "#d0822a", resultado: ["visita", "visitas"], descricao: "Visitas ao perfil, site ou página" },
  reconhecimento: { nome: "Reconhecimento", cor: "#7a8a93", resultado: ["pessoa alcançada", "pessoas alcançadas"], descricao: "Alcance, lembrança e visualização de vídeo" },
  engajamento: { nome: "Engajamento", cor: "#c25b6e", resultado: ["engajamento", "engajamentos"], descricao: "Curtidas, comentários, salvamentos e interações" },
};
export const ORDEM_GRUPOS: GrupoObjetivo[] = ["mensagens", "leads", "vendas", "trafego", "engajamento", "reconhecimento"];

export function resultadoDe(l: LinhaMeta): { valor: number; tipo: string } {
  const r = l.results?.[0];
  if (r?.indicator) return { valor: n(r.values?.[0]?.value), tipo: r.indicator.replace(/^[a-z_]+:/, "") };
  return { valor: 0, tipo: "" };
}

export function grupoDe(tipo: string, objetivo?: string): GrupoObjetivo {
  const t = tipo.toLowerCase();
  if (t.includes("messaging_conversation")) return "mensagens";
  if (t.includes("purchase")) return "vendas";
  if (t.includes("lead") || t.includes("contact") || t.includes("complete_registration") || t.includes("submit_application") || t.includes("schedule")) return "leads";
  if (t.includes("link_click") || t.includes("landing_page") || t.includes("profile_visit")) return "trafego";
  if (t === "reach" || t.includes("impressions") || t.includes("thruplay") || t.includes("video") || t.includes("ad_recall")) return "reconhecimento";
  if (t.includes("engagement") || t.includes("like") || t.includes("post")) return "engajamento";
  switch (objetivo) {
    case "OUTCOME_LEADS":
    case "LEAD_GENERATION":
      return "leads";
    case "OUTCOME_SALES":
    case "CONVERSIONS":
      return "vendas";
    case "OUTCOME_TRAFFIC":
    case "LINK_CLICKS":
      return "trafego";
    case "OUTCOME_AWARENESS":
    case "REACH":
      return "reconhecimento";
    default:
      return "engajamento";
  }
}

// ------------------------------------------------------------------
// Agregações do relatório
// ------------------------------------------------------------------
export interface CampanhaResumo {
  id: string;
  nome: string;
  conta: string;
  status: string | null;
  orcamentoDia: number | null;
  grupo: GrupoObjetivo;
  tipo: string;
  resultados: number;
  m: Metricas;
}
export interface AnuncioResumo {
  id: string;
  nome: string;
  campanha: string;
  conjunto: string;
  status: string | null;
  previa: string | null;
  miniatura: string | null;
  tipoCriativo: string | null;
  texto: string | null;
  grupo: GrupoObjetivo;
  tipo: string;
  resultados: number;
  m: Metricas;
}
export interface GrupoResumo {
  id: GrupoObjetivo;
  campanhas: CampanhaResumo[];
  resultados: number;
  m: Metricas;
}
export interface Dia {
  data: string;
  gasto: number;
  contatos: number;
  compras: number;
  cliques: number;
}

export function resumirRelatorio(r: RelatorioMeta) {
  const ok = r.contas.filter((c) => !c.erro);
  const total = somarMetricas(ok.map((c) => metricas(c.total)));
  // alcance somado entre contas diferentes é aproximado; dentro de uma conta é exato
  const anterior = somarMetricas(ok.map((c) => metricas(c.anterior)));

  const campanhas: CampanhaResumo[] = ok.flatMap((c) =>
    (c.campanhas ?? []).map((x) => {
      const res = resultadoDe(x);
      return {
        id: x.campaign_id,
        nome: x.campaign_name,
        conta: c.conta.nome,
        status: x.status ?? null,
        orcamentoDia: x.orcamento_dia ?? null,
        grupo: grupoDe(res.tipo, x.objective),
        tipo: res.tipo,
        resultados: res.valor,
        m: metricas(x),
      };
    }),
  );

  const grupos: GrupoResumo[] = ORDEM_GRUPOS.map((g) => {
    const cs = campanhas.filter((c) => c.grupo === g).sort((a, b) => b.m.gasto - a.m.gasto);
    return { id: g, campanhas: cs, resultados: cs.reduce((s, c) => s + c.resultados, 0), m: somarMetricas(cs.map((c) => c.m)) };
  }).filter((g) => g.m.gasto > 0 || g.resultados > 0);

  const grupoCampanha = new Map(campanhas.map((c) => [c.id, c.grupo]));
  const anuncios: AnuncioResumo[] = ok.flatMap((c) =>
    (c.anuncios ?? []).map((a) => {
      const res = resultadoDe(a);
      return {
        id: a.ad_id,
        nome: a.ad_name,
        campanha: a.campaign_name,
        conjunto: a.adset_name ?? "",
        status: a.status ?? null,
        previa: a.previa ?? null,
        miniatura: a.miniatura ?? null,
        tipoCriativo: a.tipo_criativo ?? null,
        texto: a.texto ?? null,
        grupo: grupoCampanha.get(a.campaign_id) ?? grupoDe(res.tipo, a.objective),
        tipo: res.tipo,
        resultados: res.valor,
        m: metricas(a),
      };
    }),
  );

  const porDia = new Map<string, Dia>();
  for (const c of ok)
    for (const d of c.diario ?? []) {
      const m = metricas(d);
      const dia = porDia.get(d.date_start!) ?? { data: d.date_start!, gasto: 0, contatos: 0, compras: 0, cliques: 0 };
      dia.gasto += m.gasto;
      dia.contatos += contatos(m);
      dia.compras += m.compras;
      dia.cliques += m.cliquesLink;
      porDia.set(dia.data, dia);
    }
  const dias = [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data));

  return { total, anterior, campanhas, grupos, anuncios, dias, contasComErro: r.contas.filter((c) => c.erro) };
}

export const divisao = (a: number, b: number) => (b ? a / b : null);
export function variacao(atual: number | null, antes: number | null) {
  if (atual === null || antes === null || !antes) return null;
  return (atual - antes) / antes;
}
