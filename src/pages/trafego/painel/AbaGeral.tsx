import { BASE, CATALOGO, formatar, variacaoRel, type Contexto, type DefMetrica } from "../../../lib/painel";
import { GraficoSeries, type DefGrafico } from "./Graficos";
import { useDiarioPlataformas } from "./config";

const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const META = "#2747d6";
const GOOGLE = "#e2701c";

/** Gráficos da visão Geral (Meta + Google) a partir da série diária guardada. */
export function useGraficosGeral(clienteId: string, ini: string, fim: string, ctx: Contexto): DefGrafico[] {
  const dias = useDiarioPlataformas(clienteId, ini, fim);
  const rot = dias.map((d) => dia(d.data));
  const div = (a: number, b: number) => (b ? a / b : null);
  return [
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
      render: () => <GraficoSeries rotulos={rot} tipo="empilhado" series={[{ nome: "Meta", cor: META, valores: dias.map((d) => d.meta.contatos) }, { nome: "Google", cor: GOOGLE, valores: dias.map((d) => d.google.contatos) }]} />,
    },
    {
      id: "custo_dia",
      nome: "Custo por contato por dia",
      descricao: "Geral e por plataforma (menor é melhor)",
      render: () => (
        <GraficoSeries
          rotulos={rot}
          fmt="brl"
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
      render: () => <GraficoSeries rotulos={rot} fmt="pct" series={[{ nome: "Meta", cor: META, valores: dias.map((d) => div(d.meta.cliques, d.meta.impressoes)) }, { nome: "Google", cor: GOOGLE, valores: dias.map((d) => div(d.google.cliques, d.google.impressoes)) }]} />,
    },
  ];
}

export const GRAFICOS_GERAL_PADRAO = ["comparativo", "invest_dia", "contatos_dia", "custo_dia"];

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
  const pm = gasto ? (ctx.atual.meta?.gasto ?? 0) / gasto : 0;
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
        <div>
          <div className="flex h-3 overflow-hidden rounded-full">
            <div style={{ width: `${pm * 100}%`, background: META }} />
            <div style={{ width: `${(1 - pm) * 100}%`, background: GOOGLE }} />
          </div>
          <div className="mt-1 flex justify-between text-[11.5px] text-muted"><span>Meta {formatar(pm, "pct")}</span><span>Google {formatar(1 - pm, "pct")}</span></div>
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
