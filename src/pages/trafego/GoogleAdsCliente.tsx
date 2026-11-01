import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Monitor, Smartphone, Tablet } from "lucide-react";
import { chamarFuncao } from "../../lib/tabela";
import { supabase } from "../../lib/supabase";
import { divisao, variacao } from "../../lib/relatorio";
import { Vazio } from "../../components/ui";
import { Cartao, Funil, GraficoDiario, Kpi, brl, dec, int, pct } from "./DashboardCliente";

interface Met { gasto: number; impressoes: number; cliques: number; conversoes: number; valor: number }
interface Campanha extends Met { id: string; nome: string; status: string; tipo: string; orcamento_dia: number; parcela: number | null; perdida_orcamento: number | null; perdida_ranking: number | null }
interface Termo extends Met { termo: string; campanha: string }
interface Palavra extends Met { palavra: string; correspondencia: string; qualidade: number | null }
export interface RelatorioGoogle {
  periodo: { inicio: string; fim: string; anterior_inicio: string; anterior_fim: string };
  contas: { id: string; conta_id: string; nome: string; status: string | null }[];
  total: Met;
  anterior: Met;
  parcela_impressoes: number | null;
  dias: (Met & { data: string })[];
  campanhas: Campanha[];
  acoes: { nome: string; categoria: string; conversoes: number }[];
  termos: Termo[];
  palavras: Palavra[];
  dispositivos: (Met & { dispositivo: string })[];
  avisos: string[];
}

const CORRESP: Record<string, string> = { exact: "Exata", phrase: "Frase", broad: "Ampla" };
const DISPOSITIVO: Record<string, { nome: string; icone: typeof Smartphone }> = {
  MOBILE: { nome: "Celular", icone: Smartphone },
  DESKTOP: { nome: "Computador", icone: Monitor },
  TABLET: { nome: "Tablet", icone: Tablet },
};
const CATEGORIA: Record<string, string> = { CONTACT: "Contato", PHONE_CALL_LEAD: "Ligação", SUBMIT_LEAD_FORM: "Formulário", PURCHASE: "Compra", GET_DIRECTIONS: "Rotas", BOOK_APPOINTMENT: "Agendamento", REQUEST_QUOTE: "Orçamento", PAGE_VIEW: "Visualização", UNKNOWN: "" };
const formatarConta = (id: string) => id.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");

/** Dashboard do Google Ads do cliente, buscado ao vivo na API (pesquisa local: termos, palavras, parcela de impressões). */
export function GoogleAdsCliente({ clienteId, ini, fim }: { clienteId: string; ini: string; fim: string }) {
  const [r, setR] = useState<RelatorioGoogle | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const buscar = useCallback(async () => {
    if (!ini || !fim || ini > fim) return;
    setCarregando(true);
    setErro("");
    try {
      setR(supabase ? await chamarFuncao<RelatorioGoogle>("google-ads", { acao: "relatorio", cliente_id: clienteId, inicio: ini, fim }) : demo(ini, fim));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [clienteId, ini, fim]);
  useEffect(() => void buscar(), [buscar]);

  if (erro) return <div className="rounded-xl border border-bad bg-bad-soft px-4 py-3 text-[13px] text-bad">Não foi possível buscar no Google Ads: {erro}</div>;
  if (!r) return <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <div key={i} className="esqueleto h-28 rounded-2xl" />)}</div>;
  if (r.contas.length === 0) return <Vazio>Este cliente não tem conta do Google Ads vinculada. Vincule em Tráfego → Contas.</Vazio>;

  const t = r.total;
  const a = r.anterior;
  const ctr = divisao(t.cliques, t.impressoes);
  const cpc = divisao(t.gasto, t.cliques);
  const cpa = divisao(t.gasto, t.conversoes);
  const tx = divisao(t.conversoes, t.cliques);
  const temValor = t.valor > 0 && t.valor > t.conversoes * 2; // valor real (não só "1 por conversão")
  const totalConv = r.acoes.reduce((s, x) => s + x.conversoes, 0);
  const pesquisa = r.campanhas.filter((c) => c.parcela !== null);
  const perdaOrc = pesquisa.reduce((s, c) => s + (c.perdida_orcamento ?? 0) * c.impressoes, 0) / Math.max(1, pesquisa.reduce((s, c) => s + c.impressoes, 0));
  const perdaRank = pesquisa.reduce((s, c) => s + (c.perdida_ranking ?? 0) * c.impressoes, 0) / Math.max(1, pesquisa.reduce((s, c) => s + c.impressoes, 0));
  const termosSemConv = r.termos.filter((x) => x.conversoes === 0 && x.gasto >= Math.max(20, (cpa ?? 50) * 0.6));

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${carregando ? "opacity-50" : ""}`}>
      <div className="flex flex-wrap gap-2">
        {r.contas.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px]">
            <span className={`h-2 w-2 rounded-full ${c.status === "ativa" ? "bg-ok" : "bg-bad"}`} /> {c.nome} <span className="num text-muted">{formatarConta(c.conta_id)}</span>
          </span>
        ))}
      </div>
      {r.avisos.length > 0 && <div className="rounded-xl border border-warn bg-warn-soft px-4 py-2.5 text-[12.5px] text-warn">Parte dos dados não veio: {r.avisos.join(" · ")}</div>}

      {/* Visão geral */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Visão geral</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi rotulo="Investimento" valor={brl(t.gasto)} v={variacao(t.gasto, a.gasto)} destaque />
          <Kpi rotulo="Conversões" valor={dec(t.conversoes, t.conversoes % 1 ? 1 : 0)} v={variacao(t.conversoes, a.conversoes)} destaque dica="Contatos no WhatsApp, ligações, formulários e outras ações marcadas como conversão" />
          <Kpi rotulo="Custo por conversão" valor={brl(cpa)} v={variacao(cpa, divisao(a.gasto, a.conversoes))} inverso destaque />
          {temValor ? (
            <Kpi rotulo="Retorno (ROAS)" valor={`${dec(divisao(t.valor, t.gasto))}x`} v={variacao(divisao(t.valor, t.gasto), divisao(a.valor, a.gasto))} destaque />
          ) : (
            <Kpi rotulo="Taxa de conversão" valor={pct(tx)} v={variacao(tx, divisao(a.conversoes, a.cliques))} destaque dica="Conversões ÷ cliques" />
          )}
          <Kpi rotulo="Cliques" valor={int(t.cliques)} v={variacao(t.cliques, a.cliques)} />
          <Kpi rotulo="Impressões" valor={int(t.impressoes)} v={variacao(t.impressoes, a.impressoes)} />
          <Kpi rotulo="CTR" valor={pct(ctr)} v={variacao(ctr, divisao(a.cliques, a.impressoes))} dica="Cliques ÷ impressões" />
          <Kpi rotulo="CPC médio" valor={brl(cpc)} v={variacao(cpc, divisao(a.gasto, a.cliques))} inverso />
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Cartao titulo="Funil do Google" subtitulo="Da busca ao contato">
          <Funil
            cor="#e2701c"
            etapas={[
              { nome: "Impressões", valor: t.impressoes, custo: null },
              { nome: "Cliques", valor: t.cliques, custo: cpc },
              { nome: "Conversões", valor: Math.round(t.conversoes), custo: cpa },
            ]}
          />
          {r.parcela_impressoes !== null && (
            <div className="mt-2 rounded-xl bg-raised p-3 text-[12.5px]">
              <div className="flex items-baseline justify-between"><span className="font-medium">Parcela de impressões na pesquisa</span><b className="num text-[16px]">{pct(r.parcela_impressoes, 0)}</b></div>
              <Barra partes={[{ v: r.parcela_impressoes, cor: "#e2701c", nome: "Apareceu" }, { v: perdaOrc, cor: "#c8382e", nome: "Perdeu por orçamento" }, { v: perdaRank, cor: "rgb(var(--muted-c))", nome: "Perdeu por classificação" }]} />
              <p className="mt-1.5 text-muted">
                {perdaOrc > 0.15 ? `Perdendo ${pct(perdaOrc, 0)} das buscas por falta de orçamento: aumentar a verba traz mais contatos.` : perdaRank > 0.4 ? `Perdendo ${pct(perdaRank, 0)} por classificação: melhorar anúncios, palavras e lances.` : "Boa presença nas buscas do público."}
              </p>
            </div>
          )}
        </Cartao>
        <Cartao titulo="Dia a dia" subtitulo="Investimento (barras) e conversões (linha)">
          <GraficoDiario dias={r.dias.map((d) => ({ data: d.data, gasto: d.gasto, contatos: d.conversoes }))} rotulo="Conversões" />
        </Cartao>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Conversões por ação" subtitulo="O que as pessoas fizeram depois de clicar">
          {r.acoes.length === 0 ? (
            <p className="text-[12.5px] text-muted">Nenhuma conversão no período.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {r.acoes.map((x) => (
                <li key={x.nome} className="flex flex-col gap-1 text-[13px]">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate" title={x.nome}>{x.nome}</span>
                    {CATEGORIA[x.categoria] && <span className="rounded bg-raised px-1.5 text-[11px] text-muted">{CATEGORIA[x.categoria]}</span>}
                    <b className="num">{dec(x.conversoes, x.conversoes % 1 ? 1 : 0)}</b>
                  </div>
                  <div className="h-1.5 rounded-full bg-raised"><div className="h-full rounded-full" style={{ width: `${(x.conversoes / Math.max(1, totalConv)) * 100}%`, background: "#e2701c" }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Dispositivos" subtitulo="Onde as pessoas pesquisam">
          <ul className="flex flex-col gap-3">
            {r.dispositivos.filter((d) => d.impressoes > 0).map((d) => {
              const info = DISPOSITIVO[d.dispositivo] ?? { nome: "Outros", icone: Monitor };
              return (
                <li key={d.dispositivo} className="flex items-center gap-3 text-[13px]">
                  <info.icone size={18} className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between"><span className="font-medium">{info.nome}</span><span className="num text-muted">{pct(divisao(d.gasto, t.gasto), 0)} da verba</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-raised"><div className="h-full rounded-full bg-accent" style={{ width: `${(d.gasto / Math.max(1, t.gasto)) * 100}%` }} /></div>
                    <div className="num mt-0.5 text-[12px] text-muted">{int(d.cliques)} cliques · {dec(d.conversoes, 0)} conversões · {brl(divisao(d.gasto, d.conversoes))} por conversão</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Cartao>
      </section>

      <Cartao titulo="Campanhas" subtitulo="Por investimento no período">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 pr-3 font-medium">Campanha</th>
                <th className="px-2 text-right font-medium">Orçamento/dia</th>
                <th className="px-2 text-right font-medium">Investido</th>
                <th className="px-2 text-right font-medium">Cliques</th>
                <th className="px-2 text-right font-medium">CTR</th>
                <th className="px-2 text-right font-medium">CPC</th>
                <th className="px-2 text-right font-medium">Conv.</th>
                <th className="px-2 text-right font-medium">Custo/conv.</th>
                <th className="px-2 text-right font-medium" title="Parcela de impressões · perdida por orçamento">Parcela</th>
              </tr>
            </thead>
            <tbody>
              {r.campanhas.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="max-w-[320px] py-2 pr-3">
                    <div className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.status === "enabled" ? "bg-ok" : "bg-line-forte"}`} /><span className="truncate font-medium" title={c.nome}>{c.nome}</span></div>
                    <div className="pl-3 text-[11.5px] text-muted">{c.tipo}</div>
                  </td>
                  <td className="num px-2 text-right text-muted">{c.orcamento_dia ? brl(c.orcamento_dia, 0) : "—"}</td>
                  <td className="num px-2 text-right">{brl(c.gasto)}</td>
                  <td className="num px-2 text-right">{int(c.cliques)}</td>
                  <td className="num px-2 text-right">{pct(divisao(c.cliques, c.impressoes), 1)}</td>
                  <td className="num px-2 text-right">{brl(divisao(c.gasto, c.cliques))}</td>
                  <td className="num px-2 text-right font-semibold">{dec(c.conversoes, c.conversoes % 1 ? 1 : 0)}</td>
                  <td className="num px-2 text-right">{brl(divisao(c.gasto, c.conversoes))}</td>
                  <td className="num px-2 text-right">
                    {c.parcela !== null ? (
                      <>
                        {pct(c.parcela, 0)}
                        {(c.perdida_orcamento ?? 0) > 0.15 && <span className="block text-[11px] text-bad">−{pct(c.perdida_orcamento, 0)} orçamento</span>}
                      </>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <section className="grid gap-4 xl:grid-cols-2">
        <Cartao titulo="Termos de pesquisa" subtitulo="O que as pessoas digitaram no Google antes de clicar">
          {termosSemConv.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {termosSemConv.length} termo{termosSemConv.length > 1 ? "s" : ""} gastando sem converter. Avaliar como palavra negativa.
            </p>
          )}
          <Tabela
            cab={["Termo", "Cliques", "Investido", "Conv."]}
            linhas={r.termos.slice(0, 15).map((x) => [
              <span className={termosSemConv.includes(x) ? "text-warn" : ""} title={x.campanha}>{x.termo}</span>,
              int(x.cliques),
              brl(x.gasto),
              dec(x.conversoes, x.conversoes % 1 ? 1 : 0),
            ])}
          />
        </Cartao>
        <Cartao titulo="Palavras-chave" subtitulo="As que mais investiram, com o índice de qualidade (1 a 10)">
          <Tabela
            cab={["Palavra", "Tipo", "Qualidade", "Investido", "Conv."]}
            linhas={r.palavras.slice(0, 15).map((x) => [
              x.palavra,
              <span className="text-muted">{CORRESP[x.correspondencia] ?? x.correspondencia}</span>,
              x.qualidade ? <b className={x.qualidade >= 7 ? "text-ok" : x.qualidade >= 5 ? "text-warn" : "text-bad"}>{x.qualidade}</b> : <span className="text-muted">—</span>,
              brl(x.gasto),
              dec(x.conversoes, x.conversoes % 1 ? 1 : 0),
            ])}
          />
        </Cartao>
      </section>
    </div>
  );
}

function Barra({ partes }: { partes: { v: number; cor: string; nome: string }[] }) {
  return (
    <div className="mt-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-raised">
        {partes.map((p) => <div key={p.nome} style={{ width: `${Math.max(0, p.v) * 100}%`, background: p.cor }} title={`${p.nome}: ${pct(p.v, 0)}`} />)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px] text-muted">
        {partes.map((p) => <span key={p.nome} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: p.cor }} />{p.nome} {pct(p.v, 0)}</span>)}
      </div>
    </div>
  );
}

function Tabela({ cab, linhas }: { cab: string[]; linhas: React.ReactNode[][] }) {
  if (!linhas.length) return <p className="text-[12.5px] text-muted">Sem dados no período.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-muted">
            {cab.map((c, i) => <th key={c} className={`py-1.5 font-medium ${i ? "px-2 text-right" : "pr-2"}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, k) => (
            <tr key={k} className="border-b border-line last:border-0">
              {l.map((v, i) => <td key={i} className={`py-1.5 ${i ? "num px-2 text-right" : "max-w-[260px] truncate pr-2"}`}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Dados de exemplo para a prévia (sem banco). */
function demo(ini: string, fim: string): RelatorioGoogle {
  const dias: RelatorioGoogle["dias"] = [];
  for (let d = new Date(`${ini}T12:00:00Z`); d.toISOString().slice(0, 10) <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = dias.length;
    dias.push({ data: d.toISOString().slice(0, 10), gasto: 45 + ((k * 37) % 30), impressoes: 180 + ((k * 53) % 90), cliques: 14 + ((k * 7) % 10), conversoes: 1 + ((k * 3) % 5), valor: 0 });
  }
  const s = (f: keyof Met) => dias.reduce((t, d) => t + d[f], 0);
  const total = { gasto: s("gasto"), impressoes: s("impressoes"), cliques: s("cliques"), conversoes: s("conversoes"), valor: 0 };
  const camp = (nome: string, f: number, parcela: number, orc: number, rank: number, o: number): Campanha => ({ id: nome, nome, status: "enabled", tipo: "Pesquisa", orcamento_dia: o, gasto: total.gasto * f, impressoes: Math.round(total.impressoes * f), cliques: Math.round(total.cliques * f), conversoes: Math.round(total.conversoes * f), valor: 0, parcela, perdida_orcamento: orc, perdida_ranking: rank });
  return {
    periodo: { inicio: ini, fim, anterior_inicio: ini, anterior_fim: fim },
    contas: [{ id: "g1", conta_id: "2015866868", nome: "Conta Google de exemplo", status: "ativa" }],
    total,
    anterior: { gasto: total.gasto * 1.1, impressoes: total.impressoes * 1.2, cliques: total.cliques * 1.02, conversoes: total.conversoes * 1.25, valor: 0 },
    parcela_impressoes: 0.27,
    dias,
    campanhas: [camp("[SEARCH] Serviço principal | Cidade 80km", 0.52, 0.25, 0.21, 0.54, 30), camp("[SEARCH] Serviço secundário | Cidade 100km", 0.3, 0.36, 0.01, 0.63, 15), camp("[SEARCH] Institucional | Marca", 0.18, 0.68, 0.19, 0.13, 8)],
    acoes: [{ nome: "WhatsApp – botão da página", categoria: "CONTACT", conversoes: 27 }, { nome: "Conversa iniciada", categoria: "UNKNOWN", conversoes: 11 }, { nome: "Ligação pelo anúncio", categoria: "PHONE_CALL_LEAD", conversoes: 8 }],
    termos: [
      { termo: "nome da empresa", campanha: "Institucional", gasto: 87, impressoes: 42, cliques: 11, conversoes: 0, valor: 0 },
      { termo: "serviço principal perto de mim", campanha: "Serviço principal", gasto: 37, impressoes: 132, cliques: 9, conversoes: 1, valor: 0 },
      { termo: "serviço principal cidade", campanha: "Serviço principal", gasto: 43, impressoes: 24, cliques: 7, conversoes: 2, valor: 0 },
    ],
    palavras: [
      { palavra: "clínica serviço principal", correspondencia: "phrase", qualidade: 7, gasto: 126, impressoes: 374, cliques: 36, conversoes: 11, valor: 0 },
      { palavra: "serviço principal preço", correspondencia: "exact", qualidade: 4, gasto: 92, impressoes: 210, cliques: 18, conversoes: 3, valor: 0 },
    ],
    dispositivos: [
      { dispositivo: "MOBILE", ...total, gasto: total.gasto * 0.92, cliques: Math.round(total.cliques * 0.93), conversoes: Math.round(total.conversoes * 0.94) },
      { dispositivo: "DESKTOP", ...total, gasto: total.gasto * 0.08, cliques: Math.round(total.cliques * 0.07), conversoes: Math.round(total.conversoes * 0.06) },
    ],
    avisos: [],
  };
}
