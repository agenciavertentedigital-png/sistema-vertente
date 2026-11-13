import { BASE, CATALOGO, formatar, variacaoRel, type Contexto, type DefMetrica } from "../../../lib/painel";
import { GraficoSeries, Rosca, type DefGrafico } from "./Graficos";
import type { DiaPlataformas } from "./config";

const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const META = "#2747d6";
const GOOGLE = "#e2701c";

/** Gráficos da visão Geral (Meta + Google) a partir da série diária guardada. */
export function useGraficosGeral(dias: DiaPlataformas[], ctx: Contexto): DefGrafico[] {
  const rot = dias.map((d) => dia(d.data));
  const div = (a: number, b: number) => (b ? a / b : null);
  return [
    {
      id: "evolucao",
      nome: "Evolução do período",
      descricao: "Investimento por dia (barras) e contatos gerados (linha)",
      largo: true,
      render: () => (
        <GraficoSeries
          rotulos={rot}
          tipo="combo"
          fmt="brl"
          altura={260}
          series={[
            { nome: "Investimento Meta", cor: META, fmt: "brl", valores: dias.map((d) => d.meta.gasto) },
            { nome: "Investimento Google", cor: GOOGLE, fmt: "brl", valores: dias.map((d) => d.google.gasto) },
            { nome: "Contatos", cor: "#16a34a", fmt: "int", linha: true, valores: dias.map((d) => d.meta.contatos + d.google.contatos) },
          ]}
        />
      ),
    },
    { id: "comparativo", nome: "Meta x Google", descricao: "As mesmas métricas lado a lado, com o total", largo: true, render: () => <Comparativo ctx={ctx} /> },
    {
      id: "invest_dia",
      nome: "Investimento por dia",
      descricao: "Quanto foi para cada plataforma",
      render: () => <GraficoSeries rotulos={rot} tipo="empilhado" fmt="brl" series={[{ nome: "Meta", cor: META, valores: dias.map((d) => d.meta.gasto) }, { nome: "Google", cor: GOOGLE, valores: dias.map((d) => d.google.gasto) }]} />,
    },
    {
      id: "contatos_dia",
      nome: "Contatos por dia",
      descricao: "Conversas e leads da Meta + conversões do Google",
      render: () => <GraficoSeries rotulos={rot} tipo="area" series={[{ nome: "Meta", cor: META, valores: dias.map((d) => d.meta.contatos) }, { nome: "Google", cor: GOOGLE, valores: dias.map((d) => d.google.contatos) }]} />,
    },
    {
      id: "custo_dia",
      nome: "Custo por contato por dia",
      descricao: "Geral e por plataforma (menor é melhor)",
      render: () => (
        <GraficoSeries
          rotulos={rot}
          fmt="brl"
          tipo="linha"
          series={[
            { nome: "Geral", cor: "#16a34a", valores: dias.map((d) => div(d.meta.gasto + d.google.gasto, d.meta.contatos + d.google.contatos)) },
            { nome: "Meta", cor: META, valores: dias.map((d) => div(d.meta.gasto, d.meta.contatos)) },
            { nome: "Google", cor: GOOGLE, valores: dias.map((d) => div(d.google.gasto, d.google.contatos)) },
          ]}
        />
      ),
    },
    {
      id: "cliques_dia",
      nome: "Cliques por dia",
      descricao: "Cliques na Meta e no Google",
      render: () => <GraficoSeries rotulos={rot} tipo="barras" series={[{ nome: "Meta", cor: META, valores: dias.map((d) => d.meta.cliques) }, { nome: "Google", cor: GOOGLE, valores: dias.map((d) => d.google.cliques) }]} />,
    },
    {
      id: "ctr_dia",
      nome: "CTR por dia",
      descricao: "Cliques ÷ impressões em cada plataforma",
      render: () => <GraficoSeries rotulos={rot} tipo="linha" fmt="pct" series={[{ nome: "Meta", cor: META, valores: dias.map((d) => div(d.meta.cliques, d.meta.impressoes)) }, { nome: "Google", cor: GOOGLE, valores: dias.map((d) => div(d.google.cliques, d.google.impressoes)) }]} />,
    },
  ];
}

export const GRAFICOS_GERAL_PADRAO = ["evolucao", "comparativo", "custo_dia", "contatos_dia"];

function Comparativo({ ctx }: { ctx: Contexto }) {
  const linhas: { nome: string; meta: DefMetrica | null; google: DefMetrica | null; total: DefMetrica | null }[] = [
    { nome: "Investimento", meta: d("meta_gasto"), google: d("google_gasto"), total: d("investimento") },
    { nome: "Impressões", meta: d("meta_impressoes"), google: d("google_impressoes"), total: d("impressoes") },
    { nome: "Cliques", meta: d("meta_cliques"), google: d("google_cliques"), total: d("cliques") },
    { nome: "CTR", meta: d("meta_ctr"), google: d("google_ctr"), total: d("ctr") },
    { nome: "CPC", meta: d("meta_cpc"), google: d("google_cpc"), total: d("cpc") },
    { nome: "Contatos / conversões", meta: d("meta_contatos"), google: d("google_conversoes"), total: d("contatos") },
    { nome: "Custo por contato", meta: d("meta_custo_contato"), google: d("google_cpa"), total: d("custo_contato") },
  ];
  const gasto = BASE.investimento.v(ctx.atual) ?? 0;
  const contMeta = d("meta_contatos")?.calc(ctx.atual) ?? 0;
  const contGoogle = d("google_conversoes")?.calc(ctx.atual) ?? 0;
  const cel = (def: DefMetrica | null, forte?: boolean) => {
    if (!def) return <td />;
    const v = def.calc(ctx.atual);
    const vr = variacaoRel(v, def.calc(ctx.anterior));
    const bom = vr === null ? null : def.inverso ? vr < 0 : vr > 0;
    return (
      <td className="py-2 pl-3 text-right">
        <span className={`num ${forte ? "font-semibold" : ""}`}>{formatar(v, def.fmt)}</span>
        {vr !== null && Math.abs(vr) >= 0.005 && <span className={`num ml-1.5 text-[11px] ${bom ? "text-ok" : "text-bad"}`}>{vr > 0 ? "▲" : "▼"}{Math.abs(Math.round(vr * 100))}%</span>}
      </td>
    );
  };
  return (
    <div className="flex flex-col gap-3">
      {gasto > 0 && (
        <div className="grid gap-4 border-b border-line pb-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">Onde foi o investimento</div>
            <Rosca tamanho={128} valorCentro={formatar(gasto, "brl").replace(/,\d\d$/, "")} rotuloCentro="investido" partes={[{ nome: "Meta Ads", valor: ctx.atual.meta?.gasto ?? 0, cor: META }, { nome: "Google Ads", valor: ctx.atual.google?.gasto ?? 0, cor: GOOGLE }]} />
          </div>
          <div>
            <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">De onde vieram os contatos</div>
            <Rosca tamanho={128} valorCentro={formatar(contMeta + contGoogle, "int")} rotuloCentro="contatos" partes={[{ nome: "Meta Ads", valor: contMeta, cor: META }, { nome: "Google Ads", valor: contGoogle, cor: GOOGLE }]} />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11.5px] text-muted">
              <th className="py-2 text-left font-medium" />
              <th className="py-2 pl-3 text-right font-medium" style={{ color: META }}>Meta Ads</th>
              <th className="py-2 pl-3 text-right font-medium" style={{ color: GOOGLE }}>Google Ads</th>
              <th className="py-2 pl-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome} className="border-b border-line/60 last:border-0">
                <td className="py-2 text-muted">{l.nome}</td>
                {cel(l.meta)}
                {cel(l.google)}
                {cel(l.total, true)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const d = (id: string) => CATALOGO.find((x) => x.id === id) ?? null;
