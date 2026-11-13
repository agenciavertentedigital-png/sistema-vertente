import type { DiaPlataformas } from "./config";

type P = DiaPlataformas["meta"];
const soma = (d: DiaPlataformas): P => ({ gasto: d.meta.gasto + d.google.gasto, impressoes: d.meta.impressoes + d.google.impressoes, cliques: d.meta.cliques + d.google.cliques, contatos: d.meta.contatos + d.google.contatos });
const div = (a: number, b: number) => (b ? a / b : null);

/** Como cada métrica se calcula num dia (para o minigráfico de tendência dos cartões). */
const POR_DIA: Record<string, (d: DiaPlataformas) => number | null> = {
  investimento: (d) => soma(d).gasto,
  impressoes: (d) => soma(d).impressoes,
  cliques: (d) => soma(d).cliques,
  contatos: (d) => soma(d).contatos,
  custo_contato: (d) => div(soma(d).gasto, soma(d).contatos),
  ctr: (d) => div(soma(d).cliques, soma(d).impressoes),
  cpc: (d) => div(soma(d).gasto, soma(d).cliques),
  cpm: (d) => div(soma(d).gasto * 1000, soma(d).impressoes),
  tx_clique_contato: (d) => div(soma(d).contatos, soma(d).cliques),
  parte_meta: (d) => div(d.meta.gasto, soma(d).gasto),
  parte_google: (d) => div(d.google.gasto, soma(d).gasto),
  meta_gasto: (d) => d.meta.gasto,
  meta_contatos: (d) => d.meta.contatos,
  meta_custo_contato: (d) => div(d.meta.gasto, d.meta.contatos),
  meta_impressoes: (d) => d.meta.impressoes,
  meta_cliques: (d) => d.meta.cliques,
  meta_ctr: (d) => div(d.meta.cliques, d.meta.impressoes),
  meta_cpc: (d) => div(d.meta.gasto, d.meta.cliques),
  meta_cpm: (d) => div(d.meta.gasto * 1000, d.meta.impressoes),
  google_gasto: (d) => d.google.gasto,
  google_conversoes: (d) => d.google.contatos,
  google_cpa: (d) => div(d.google.gasto, d.google.contatos),
  google_cliques: (d) => d.google.cliques,
  google_impressoes: (d) => d.google.impressoes,
  google_ctr: (d) => div(d.google.cliques, d.google.impressoes),
  google_cpc: (d) => div(d.google.gasto, d.google.cliques),
  google_taxa: (d) => div(d.google.contatos, d.google.cliques),
  f_custo_contato: (d) => div(soma(d).gasto, soma(d).contatos),
};

/** Série diária de uma métrica, ou null quando não dá para calcular por dia (ex.: alcance, funil manual). */
export function tendenciaDe(dias: DiaPlataformas[]) {
  return (id: string): (number | null)[] | null => {
    const f = POR_DIA[id];
    if (!f || dias.length < 2) return null;
    return dias.map(f);
  };
}
