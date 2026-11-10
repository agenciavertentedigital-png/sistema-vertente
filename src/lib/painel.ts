// Motor dos dashboards personalizáveis: catálogo de métricas (Meta, Google, Geral, Funil e fórmulas),
// cálculo com período atual e anterior e um avaliador de fórmulas seguro (sem eval).
import type { Metricas } from "./relatorio";

export type Formato = "brl" | "int" | "dec" | "pct" | "x";
export interface MetGoogle { gasto: number; impressoes: number; cliques: number; conversoes: number; valor: number }

/** Tudo que um período tem: Meta, Google e os números lançados à mão (chaves das etapas e valores do funil). */
export interface Fonte {
  meta: Metricas | null;
  metaContatos: number;
  google: MetGoogle | null;
  manual: Record<string, number>;
  temManual: boolean;
}
export interface Contexto { atual: Fonte; anterior: Fonte }

export interface DefMetrica {
  id: string;
  nome: string;
  grupo: "Geral" | "Meta Ads" | "Google Ads" | "Funil" | "Fórmulas";
  fmt: Formato;
  inverso?: boolean;
  dica?: string;
  calc: (f: Fonte) => number | null;
}

const div = (a: number | null, b: number | null) => (a === null || b === null || !b ? null : a / b);
const m = (f: Fonte) => f.meta;
const g = (f: Fonte) => f.google;
const soma = (...xs: (number | null | undefined)[]) => (xs.every((x) => x === null || x === undefined) ? null : xs.reduce<number>((s, x) => s + (x ?? 0), 0));

// ------------------------------------------------------------------
// Valores-base (também são as variáveis das fórmulas)
// ------------------------------------------------------------------
export const BASE: Record<string, { nome: string; v: (f: Fonte) => number | null }> = {
  investimento: { nome: "Investimento total", v: (f) => soma(m(f)?.gasto, g(f)?.gasto) },
  impressoes: { nome: "Impressões totais", v: (f) => soma(m(f)?.impressoes, g(f)?.impressoes) },
  cliques: { nome: "Cliques totais (link Meta + Google)", v: (f) => soma(m(f)?.cliquesLink, g(f)?.cliques) },
  contatos: { nome: "Contatos/conversões totais", v: (f) => soma(f.meta ? f.metaContatos : null, g(f)?.conversoes) },
  meta_gasto: { nome: "Investimento Meta", v: (f) => m(f)?.gasto ?? null },
  meta_impressoes: { nome: "Impressões Meta", v: (f) => m(f)?.impressoes ?? null },
  meta_alcance: { nome: "Alcance Meta", v: (f) => m(f)?.alcance ?? null },
  meta_cliques: { nome: "Cliques no link Meta", v: (f) => m(f)?.cliquesLink ?? null },
  meta_lpviews: { nome: "Visualizações de página Meta", v: (f) => m(f)?.lpViews ?? null },
  meta_contatos: { nome: "Contatos Meta (conversas + leads)", v: (f) => (f.meta ? f.metaContatos : null) },
  meta_conversas: { nome: "Conversas iniciadas Meta", v: (f) => m(f)?.conversas ?? null },
  meta_leads: { nome: "Leads de formulário Meta", v: (f) => m(f)?.leads ?? null },
  meta_compras: { nome: "Compras Meta", v: (f) => m(f)?.compras ?? null },
  meta_valor: { nome: "Valor de compras Meta", v: (f) => m(f)?.valor ?? null },
  meta_thruplays: { nome: "ThruPlays Meta", v: (f) => m(f)?.thruplays ?? null },
  meta_engajamento: { nome: "Engajamento Meta", v: (f) => m(f)?.engajamento ?? null },
  google_gasto: { nome: "Investimento Google", v: (f) => g(f)?.gasto ?? null },
  google_impressoes: { nome: "Impressões Google", v: (f) => g(f)?.impressoes ?? null },
  google_cliques: { nome: "Cliques Google", v: (f) => g(f)?.cliques ?? null },
  google_conversoes: { nome: "Conversões Google", v: (f) => g(f)?.conversoes ?? null },
  google_valor: { nome: "Valor de conversão Google", v: (f) => g(f)?.valor ?? null },
};

// ------------------------------------------------------------------
// Catálogo
// ------------------------------------------------------------------
const b = (id: string) => (f: Fonte) => BASE[id].v(f);
export const CATALOGO: DefMetrica[] = [
  // Geral: Meta + Google juntos
  { id: "investimento", nome: "Investimento total", grupo: "Geral", fmt: "brl", calc: b("investimento") },
  { id: "impressoes", nome: "Impressões totais", grupo: "Geral", fmt: "int", calc: b("impressoes") },
  { id: "cliques", nome: "Cliques totais", grupo: "Geral", fmt: "int", dica: "Cliques no link da Meta + cliques do Google", calc: b("cliques") },
  { id: "contatos", nome: "Contatos e conversões", grupo: "Geral", fmt: "int", dica: "Conversas + leads da Meta e conversões do Google", calc: b("contatos") },
  { id: "custo_contato", nome: "Custo por contato (geral)", grupo: "Geral", fmt: "brl", inverso: true, calc: (f) => div(BASE.investimento.v(f), BASE.contatos.v(f)) },
  { id: "ctr", nome: "CTR geral", grupo: "Geral", fmt: "pct", calc: (f) => div(BASE.cliques.v(f), BASE.impressoes.v(f)) },
  { id: "cpc", nome: "CPC geral", grupo: "Geral", fmt: "brl", inverso: true, calc: (f) => div(BASE.investimento.v(f), BASE.cliques.v(f)) },
  { id: "cpm", nome: "CPM geral", grupo: "Geral", fmt: "brl", inverso: true, calc: (f) => div((BASE.investimento.v(f) ?? 0) * 1000, BASE.impressoes.v(f)) },
  { id: "tx_clique_contato", nome: "Clique → contato", grupo: "Geral", fmt: "pct", dica: "Contatos ÷ cliques", calc: (f) => div(BASE.contatos.v(f), BASE.cliques.v(f)) },
  { id: "parte_meta", nome: "% do investimento na Meta", grupo: "Geral", fmt: "pct", calc: (f) => div(m(f)?.gasto ?? null, BASE.investimento.v(f)) },
  { id: "parte_google", nome: "% do investimento no Google", grupo: "Geral", fmt: "pct", calc: (f) => div(g(f)?.gasto ?? null, BASE.investimento.v(f)) },
  // Meta Ads
  { id: "meta_gasto", nome: "Investimento Meta", grupo: "Meta Ads", fmt: "brl", calc: b("meta_gasto") },
  { id: "meta_contatos", nome: "Contatos Meta", grupo: "Meta Ads", fmt: "int", dica: "Conversas iniciadas + leads de cadastro/formulário", calc: b("meta_contatos") },
  { id: "meta_custo_contato", nome: "Custo por contato Meta", grupo: "Meta Ads", fmt: "brl", inverso: true, calc: (f) => div(m(f)?.gasto ?? null, f.meta ? f.metaContatos : null) },
  { id: "meta_conversas", nome: "Conversas iniciadas", grupo: "Meta Ads", fmt: "int", calc: b("meta_conversas") },
  { id: "meta_leads", nome: "Leads de formulário", grupo: "Meta Ads", fmt: "int", calc: b("meta_leads") },
  { id: "meta_alcance", nome: "Alcance", grupo: "Meta Ads", fmt: "int", calc: b("meta_alcance") },
  { id: "meta_impressoes", nome: "Impressões Meta", grupo: "Meta Ads", fmt: "int", calc: b("meta_impressoes") },
  { id: "meta_frequencia", nome: "Frequência", grupo: "Meta Ads", fmt: "dec", calc: (f) => m(f)?.frequencia ?? null },
  { id: "meta_cliques", nome: "Cliques no link", grupo: "Meta Ads", fmt: "int", calc: b("meta_cliques") },
  { id: "meta_ctr", nome: "CTR do link", grupo: "Meta Ads", fmt: "pct", calc: (f) => div(m(f)?.cliquesLink ?? null, m(f)?.impressoes ?? null) },
  { id: "meta_cpc", nome: "CPC do link", grupo: "Meta Ads", fmt: "brl", inverso: true, calc: (f) => div(m(f)?.gasto ?? null, m(f)?.cliquesLink ?? null) },
  { id: "meta_cpm", nome: "CPM Meta", grupo: "Meta Ads", fmt: "brl", inverso: true, calc: (f) => div((m(f)?.gasto ?? 0) * 1000, m(f)?.impressoes ?? null) },
  { id: "meta_lpviews", nome: "Visualizações da página", grupo: "Meta Ads", fmt: "int", calc: b("meta_lpviews") },
  { id: "meta_thruplays", nome: "ThruPlays (vídeo)", grupo: "Meta Ads", fmt: "int", calc: b("meta_thruplays") },
  { id: "meta_engajamento", nome: "Engajamento", grupo: "Meta Ads", fmt: "int", calc: b("meta_engajamento") },
  { id: "meta_compras", nome: "Compras (pixel)", grupo: "Meta Ads", fmt: "int", calc: b("meta_compras") },
  { id: "meta_valor", nome: "Valor de compras (pixel)", grupo: "Meta Ads", fmt: "brl", calc: b("meta_valor") },
  { id: "meta_roas", nome: "ROAS Meta (pixel)", grupo: "Meta Ads", fmt: "x", calc: (f) => div(m(f)?.valor ?? null, m(f)?.gasto ?? null) },
  // Google Ads
  { id: "google_gasto", nome: "Investimento Google", grupo: "Google Ads", fmt: "brl", calc: b("google_gasto") },
  { id: "google_conversoes", nome: "Conversões Google", grupo: "Google Ads", fmt: "dec", calc: b("google_conversoes") },
  { id: "google_cpa", nome: "Custo por conversão Google", grupo: "Google Ads", fmt: "brl", inverso: true, calc: (f) => div(g(f)?.gasto ?? null, g(f)?.conversoes ?? null) },
  { id: "google_taxa", nome: "Taxa de conversão Google", grupo: "Google Ads", fmt: "pct", calc: (f) => div(g(f)?.conversoes ?? null, g(f)?.cliques ?? null) },
  { id: "google_cliques", nome: "Cliques Google", grupo: "Google Ads", fmt: "int", calc: b("google_cliques") },
  { id: "google_impressoes", nome: "Impressões Google", grupo: "Google Ads", fmt: "int", calc: b("google_impressoes") },
  { id: "google_ctr", nome: "CTR Google", grupo: "Google Ads", fmt: "pct", calc: (f) => div(g(f)?.cliques ?? null, g(f)?.impressoes ?? null) },
  { id: "google_cpc", nome: "CPC médio Google", grupo: "Google Ads", fmt: "brl", inverso: true, calc: (f) => div(g(f)?.gasto ?? null, g(f)?.cliques ?? null) },
  { id: "google_valor", nome: "Valor de conversão Google", grupo: "Google Ads", fmt: "brl", calc: b("google_valor") },
  { id: "google_roas", nome: "ROAS Google", grupo: "Google Ads", fmt: "x", calc: (f) => div(g(f)?.valor ?? null, g(f)?.gasto ?? null) },
];

export const PADRAO: Record<"geral" | "meta" | "google", string[]> = {
  geral: ["investimento", "contatos", "custo_contato", "cliques", "impressoes", "ctr", "cpc", "tx_clique_contato"],
  meta: ["meta_gasto", "meta_contatos", "meta_custo_contato", "meta_cliques", "meta_alcance", "meta_impressoes", "meta_frequencia", "meta_ctr", "meta_cpc", "meta_cpm"],
  google: ["google_gasto", "google_conversoes", "google_cpa", "google_taxa", "google_cliques", "google_impressoes", "google_ctr", "google_cpc"],
};

// ------------------------------------------------------------------
// Funil de vendas: etapas automáticas (das plataformas) e manuais (lançadas)
// ------------------------------------------------------------------
export interface EtapaFunil { id: string; nome: string; fonte: "auto" | "manual"; auto?: string }
export interface ValorFunil { id: string; nome: string }
export interface ConfigFunil { etapas: EtapaFunil[]; valores: ValorFunil[] }

/** Fontes automáticas que podem virar etapa */
export const AUTO: Record<string, string> = {
  impressoes: "Impressões (Meta + Google)",
  meta_alcance: "Alcance (Meta)",
  cliques: "Cliques (Meta + Google)",
  meta_lpviews: "Visualizações da página (Meta)",
  contatos: "Contatos e conversões (Meta + Google)",
  meta_conversas: "Conversas iniciadas (Meta)",
  meta_leads: "Leads de formulário (Meta)",
  google_conversoes: "Conversões (Google)",
  meta_compras: "Compras pelo pixel (Meta)",
};

export const FUNIL_PADRAO: ConfigFunil = {
  etapas: [
    { id: "impressoes", nome: "Impressões", fonte: "auto", auto: "impressoes" },
    { id: "cliques", nome: "Cliques", fonte: "auto", auto: "cliques" },
    { id: "contatos", nome: "Leads e contatos", fonte: "auto", auto: "contatos" },
    { id: "qualificados", nome: "Qualificados", fonte: "manual" },
    { id: "agendamentos", nome: "Agendamentos", fonte: "manual" },
    { id: "comparecimentos", nome: "Compareceram", fonte: "manual" },
    { id: "vendas", nome: "Vendas", fonte: "manual" },
  ],
  valores: [
    { id: "faturamento", nome: "Valor total de vendas" },
    { id: "faturamento_leads", nome: "Valor de vendas dos leads" },
  ],
};

export function valorEtapa(e: EtapaFunil, f: Fonte): number | null {
  if (e.fonte === "auto") return e.auto && BASE[e.auto] ? BASE[e.auto].v(f) : null;
  return f.temManual && e.id in f.manual ? f.manual[e.id] : null;
}

/** Métricas do funil que entram no catálogo (etapas manuais, valores e indicadores de venda). */
export function metricasDoFunil(cfg: ConfigFunil): DefMetrica[] {
  const manuais = cfg.etapas.filter((e) => e.fonte === "manual");
  const ultima = manuais[manuais.length - 1];
  const fat = cfg.valores[0];
  const lista: DefMetrica[] = [
    ...manuais.map((e) => ({ id: `f_${e.id}`, nome: e.nome, grupo: "Funil" as const, fmt: "int" as Formato, calc: (f: Fonte) => (f.temManual ? f.manual[e.id] ?? null : null) })),
    ...cfg.valores.map((v) => ({ id: `f_${v.id}`, nome: v.nome, grupo: "Funil" as const, fmt: "brl" as Formato, calc: (f: Fonte) => (f.temManual ? f.manual[v.id] ?? null : null) })),
  ];
  if (ultima) {
    lista.push(
      { id: "f_custo_final", nome: `Custo por ${ultima.nome.toLowerCase()} (CAC)`, grupo: "Funil", fmt: "brl", inverso: true, calc: (f) => div(BASE.investimento.v(f), f.temManual ? f.manual[ultima.id] ?? null : null) },
      { id: "f_conv_total", nome: `Contato → ${ultima.nome.toLowerCase()}`, grupo: "Funil", fmt: "pct", calc: (f) => div(f.temManual ? f.manual[ultima.id] ?? null : null, BASE.contatos.v(f)) },
    );
  }
  if (fat) {
    lista.push(
      { id: "f_roas", nome: "ROAS real (vendas ÷ investimento)", grupo: "Funil", fmt: "x", calc: (f) => div(f.temManual ? f.manual[fat.id] ?? null : null, BASE.investimento.v(f)) },
      { id: "f_roi", nome: "ROI", grupo: "Funil", fmt: "pct", dica: "(vendas − investimento) ÷ investimento", calc: (f) => { const v = f.temManual ? f.manual[fat.id] ?? null : null; const i = BASE.investimento.v(f); return v === null || !i ? null : (v - i) / i; } },
    );
    if (ultima) lista.push({ id: "f_ticket", nome: "Ticket médio", grupo: "Funil", fmt: "brl", calc: (f) => div(f.temManual ? f.manual[fat.id] ?? null : null, f.temManual ? f.manual[ultima.id] ?? null : null) });
  }
  return lista;
}

// ------------------------------------------------------------------
// Fórmulas próprias: {variavel} + - * / ( ) e números. Sem eval.
// ------------------------------------------------------------------
export interface Formula { id: string; nome: string; expr: string; fmt: Formato; inverso?: boolean }

export function variaveis(cfg: ConfigFunil): { id: string; nome: string }[] {
  return [
    ...Object.entries(BASE).map(([id, x]) => ({ id, nome: x.nome })),
    ...cfg.etapas.filter((e) => e.fonte === "manual").map((e) => ({ id: e.id, nome: `${e.nome} (lançado)` })),
    ...cfg.valores.map((v) => ({ id: v.id, nome: `${v.nome} (lançado)` })),
  ];
}

type Token = { t: "n"; v: number } | { t: "var"; v: string } | { t: "op"; v: string } | { t: "("} | { t: ")" };
function tokens(expr: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "{") {
      const fim = expr.indexOf("}", i);
      if (fim < 0) throw new Error("Falta fechar a chave }");
      out.push({ t: "var", v: expr.slice(i + 1, fim).trim() });
      i = fim + 1;
      continue;
    }
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < expr.length && /[0-9.,]/.test(expr[j])) j++;
      out.push({ t: "n", v: Number(expr.slice(i, j).replace(",", ".")) });
      i = j;
      continue;
    }
    if ("+-*/".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    if (c === "(") { out.push({ t: "(" }); i++; continue; }
    if (c === ")") { out.push({ t: ")" }); i++; continue; }
    throw new Error(`Caractere não permitido: ${c}`);
  }
  return out;
}

/** Avalia a fórmula; variável sem valor deixa o resultado vazio (null). Divisão por zero também. */
export function avaliar(expr: string, valor: (id: string) => number | null): number | null {
  const ts = tokens(expr);
  let p = 0;
  let vazio = false;
  const fator = (): number => {
    const t = ts[p++];
    if (!t) throw new Error("Fórmula incompleta");
    if (t.t === "n") return t.v;
    if (t.t === "var") { const v = valor(t.v); if (v === null) vazio = true; return v ?? 0; }
    if (t.t === "op" && t.v === "-") return -fator();
    if (t.t === "(") { const v = expr2(); if (ts[p++]?.t !== ")") throw new Error("Falta fechar o parêntese"); return v; }
    throw new Error("Fórmula inválida");
  };
  const termo = (): number => {
    let v = fator();
    while (ts[p]?.t === "op" && (ts[p] as { v: string }).v.match(/[*/]/)) {
      const op = (ts[p++] as { v: string }).v;
      const d = fator();
      if (op === "*") v *= d;
      else { if (d === 0) vazio = true; v = d === 0 ? 0 : v / d; }
    }
    return v;
  };
  const expr2 = (): number => {
    let v = termo();
    while (ts[p]?.t === "op" && (ts[p] as { v: string }).v.match(/[+-]/)) {
      const op = (ts[p++] as { v: string }).v;
      const d = termo();
      v = op === "+" ? v + d : v - d;
    }
    return v;
  };
  const r = expr2();
  if (p < ts.length) throw new Error("Sobrou algo no fim da fórmula");
  return vazio || !isFinite(r) ? null : r;
}

export function valorVariavel(id: string, f: Fonte): number | null {
  if (BASE[id]) return BASE[id].v(f);
  return f.temManual && id in f.manual ? f.manual[id] : null;
}

export function defFormula(x: Formula): DefMetrica {
  return { id: x.id, nome: x.nome, grupo: "Fórmulas", fmt: x.fmt, inverso: x.inverso, dica: x.expr, calc: (f) => { try { return avaliar(x.expr, (id) => valorVariavel(id, f)); } catch { return null; } } };
}

// ------------------------------------------------------------------
// Formatação e comparação
// ------------------------------------------------------------------
export function formatar(v: number | null, fmt: Formato): string {
  if (v === null || !isFinite(v)) return "—";
  switch (fmt) {
    case "brl":
      return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2, maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 });
    case "int":
      return Math.round(v).toLocaleString("pt-BR");
    case "dec":
      return v.toLocaleString("pt-BR", { maximumFractionDigits: v % 1 ? 1 : 0 });
    case "pct":
      return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(v) < 0.1 ? 2 : 1 })}%`;
    case "x":
      return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`;
  }
}
export const variacaoRel = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : (a - b) / Math.abs(b));
