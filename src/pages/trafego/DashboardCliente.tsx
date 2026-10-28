import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Image as ImagemIcone, PlayCircle, RefreshCw, Wallet } from "lucide-react";
import { useDados } from "../../lib/dados";
import { hoje, somarDias } from "../../lib/tipos";
import { STATUS_CONTA, repoTrafego } from "../../lib/trafego";
import {
  GRUPOS,
  divisao,
  resumirRelatorio,
  variacao,
  type AnuncioResumo,
  type CampanhaResumo,
  type GrupoResumo,
  type Metricas,
  type RelatorioMeta,
} from "../../lib/relatorio";
import { Botao, Entrada, Vazio } from "../../components/ui";

// ------------------------------------------------------------------
// Formatação
// ------------------------------------------------------------------
const brl = (v: number | null, casas = 2) =>
  v === null || !isFinite(v) ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v >= 1000 ? 0 : casas, maximumFractionDigits: v >= 1000 ? 0 : casas });
const int = (v: number | null) => (v === null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("pt-BR"));
const pct = (v: number | null, casas = 2) => (v === null || !isFinite(v) ? "—" : `${(v * 100).toFixed(casas).replace(".", ",")}%`);
const dec = (v: number | null, casas = 2) => (v === null || !isFinite(v) ? "—" : v.toFixed(casas).replace(".", ","));
const dataBR = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

// ------------------------------------------------------------------
// Período
// ------------------------------------------------------------------
type Atalho = "ontem" | "7" | "14" | "30" | "mes" | "mes_passado" | "custom";
function intervalo(a: Atalho, custom: { ini: string; fim: string }) {
  const h = hoje();
  const ontem = somarDias(h, -1);
  switch (a) {
    case "ontem":
      return { ini: ontem, fim: ontem };
    case "7":
      return { ini: somarDias(h, -7), fim: ontem };
    case "14":
      return { ini: somarDias(h, -14), fim: ontem };
    case "30":
      return { ini: somarDias(h, -30), fim: ontem };
    case "mes":
      return { ini: `${h.slice(0, 8)}01`, fim: h };
    case "mes_passado": {
      const ultimo = somarDias(`${h.slice(0, 8)}01`, -1);
      return { ini: `${ultimo.slice(0, 8)}01`, fim: ultimo };
    }
    default:
      return custom;
  }
}
const ATALHOS: { id: Atalho; nome: string }[] = [
  { id: "ontem", nome: "Ontem" },
  { id: "7", nome: "7 dias" },
  { id: "14", nome: "14 dias" },
  { id: "30", nome: "30 dias" },
  { id: "mes", nome: "Este mês" },
  { id: "mes_passado", nome: "Mês passado" },
  { id: "custom", nome: "Escolher datas" },
];

// ------------------------------------------------------------------
// Página
// ------------------------------------------------------------------
export function DashboardCliente({ clienteId, ir }: { clienteId: string; ir: (r: string) => void }) {
  const d = useDados();
  const cliente = d.cliente(clienteId);
  const [atalho, setAtalho] = useState<Atalho>("7");
  const [custom, setCustom] = useState({ ini: somarDias(hoje(), -7), fim: somarDias(hoje(), -1) });
  const per = intervalo(atalho, custom);
  const [rel, setRel] = useState<RelatorioMeta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const buscar = useCallback(async () => {
    if (!per.ini || !per.fim || per.ini > per.fim) return;
    setCarregando(true);
    setErro("");
    try {
      setRel(await repoTrafego.relatorio(clienteId, per.ini, per.fim));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [clienteId, per.ini, per.fim]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const r = useMemo(() => (rel ? resumirRelatorio(rel) : null), [rel]);

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <button onClick={() => ir("trafego-dashboards")} className="flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> Dashboards
      </button>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">Dashboard de tráfego · Meta Ads</div>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight">{cliente?.nome ?? "Cliente"}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {dataBR(per.ini)} a {dataBR(per.fim)}
            {rel && <> · comparado com {dataBR(rel.anterior.since)} a {dataBR(rel.anterior.until)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Botao variante="fantasma" onClick={() => ir(`cliente-${clienteId}`)}>Tarefas do cliente</Botao>
          <Botao onClick={buscar} disabled={carregando}>
            <RefreshCw size={14} className={carregando ? "animate-spin" : ""} /> {carregando ? "Buscando na Meta…" : "Atualizar"}
          </Botao>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Período" className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
          {ATALHOS.map((a) => (
            <button key={a.id} role="tab" aria-selected={atalho === a.id} onClick={() => setAtalho(a.id)} className={`rounded-lg px-3 py-1 text-[12.5px] ${atalho === a.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
              {a.nome}
            </button>
          ))}
        </div>
        {atalho === "custom" && (
          <div className="flex items-center gap-2">
            <Entrada id="dash-ini" type="date" aria-label="De" value={custom.ini} max={custom.fim} onChange={(e) => setCustom((c) => ({ ...c, ini: e.target.value }))} className="!w-auto" />
            <span className="text-muted">a</span>
            <Entrada id="dash-fim" type="date" aria-label="Até" value={custom.fim} min={custom.ini} max={hoje()} onChange={(e) => setCustom((c) => ({ ...c, fim: e.target.value }))} className="!w-auto" />
          </div>
        )}
      </div>

      {erro && <div className="rounded-xl border border-bad bg-bad-soft px-4 py-3 text-[13px] text-bad">Não foi possível buscar na Meta: {erro}</div>}

      {!r && carregando ? (
        <Esqueleto />
      ) : !r || !rel ? null : rel.contas.length === 0 ? (
        <Vazio>Este cliente não tem conta de anúncio acompanhada. Vincule na aba Contas da Gestão de Tráfego.</Vazio>
      ) : (
        <div className={`flex flex-col gap-6 transition-opacity ${carregando ? "opacity-50" : ""}`}>
          <Contas rel={rel} />
          {r.contasComErro.map((c) => (
            <div key={c.conta.id} className="rounded-xl border border-warn bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
              {c.conta.nome}: {c.erro}
            </div>
          ))}
          <VisaoGeral r={r} />
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <Cartao titulo="Funil geral" subtitulo="Do anúncio visto ao contato e à venda">
              <FunilGeral r={r} />
            </Cartao>
            <Cartao titulo="Dia a dia" subtitulo="Investimento (barras) e contatos (linha)">
              <GraficoDiario dias={r.dias} />
            </Cartao>
          </section>
          <PorObjetivo grupos={r.grupos} total={r.total.gasto} />
          <Criativos anuncios={r.anuncios} />
          <Campanhas grupos={r.grupos} />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Blocos
// ------------------------------------------------------------------
function Cartao({ titulo, subtitulo, children, direita }: { titulo: string; subtitulo?: string; children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold">{titulo}</h2>
          {subtitulo && <p className="text-[12.5px] text-muted">{subtitulo}</p>}
        </div>
        {direita}
      </div>
      {children}
    </section>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-raised" />
        ))}
      </div>
      <div className="h-[280px] animate-pulse rounded-2xl bg-raised" />
      <p className="text-center text-[12.5px] text-muted">Buscando os números direto na Meta…</p>
    </div>
  );
}

function Contas({ rel }: { rel: RelatorioMeta }) {
  return (
    <div className="flex flex-wrap gap-2">
      {rel.contas.map((c) => (
        <span key={c.conta.id} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px]">
          <span className="h-2 w-2 rounded-full" style={{ background: c.conta.status === "ativa" ? "var(--ok)" : "var(--bad)" }} />
          {c.conta.nome}
          {c.conta.status && c.conta.status !== "ativa" && <span className="font-medium text-bad">{STATUS_CONTA[c.conta.status] ?? c.conta.status}</span>}
          {c.conta.saldo != null && (
            <span className="flex items-center gap-1 text-muted">
              <Wallet size={12} /> {brl(c.conta.saldo)}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

type Resumo = ReturnType<typeof resumirRelatorio>;

/** Contatos do relatório: conversas + resultados das campanhas de leads/contato (sem duplicar). */
function contatosDe(r: Resumo) {
  const leadsGrupo = r.grupos.find((g) => g.id === "leads")?.resultados ?? 0;
  return r.total.conversas + Math.max(leadsGrupo, r.total.leads);
}

function Kpi({ rotulo, valor, v, inverso, destaque, dica }: { rotulo: string; valor: string; v: number | null; inverso?: boolean; destaque?: boolean; dica?: string }) {
  const bom = v === null ? null : inverso ? v < 0 : v > 0;
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border p-4 ${destaque ? "border-accent bg-accent-soft" : "border-line bg-surface"}`} title={dica}>
      <div className="text-[12px] text-muted">{rotulo}</div>
      <div className="num text-[22px] font-semibold leading-tight">{valor}</div>
      {v === null || !isFinite(v) || Math.abs(v) < 0.005 ? (
        <div className="text-[11.5px] text-muted">sem comparação</div>
      ) : (
        <div className={`num text-[11.5px] font-medium ${bom ? "text-ok" : "text-bad"}`}>
          {v > 0 ? "▲" : "▼"} {Math.abs(Math.round(v * 100))}% <span className="font-normal text-muted">vs período anterior</span>
        </div>
      )}
    </div>
  );
}

function VisaoGeral({ r }: { r: Resumo }) {
  const t = r.total;
  const a = r.anterior;
  const ct = contatosDe(r);
  const ctAnt = a.conversas + a.leads;
  const temVendas = t.compras > 0 || t.valor > 0;
  const cpc = divisao(t.gasto, t.cliquesLink);
  const cpcAnt = divisao(a.gasto, a.cliquesLink);
  const ctr = divisao(t.cliquesLink, t.impressoes);
  const ctrAnt = divisao(a.cliquesLink, a.impressoes);
  const cpm = divisao(t.gasto * 1000, t.impressoes);
  const cpmAnt = divisao(a.gasto * 1000, a.impressoes);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold">Visão geral</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Investimento" valor={brl(t.gasto)} v={variacao(t.gasto, a.gasto)} destaque />
        <Kpi rotulo="Contatos (conversas + leads)" valor={int(ct)} v={variacao(ct, ctAnt)} destaque dica="Conversas iniciadas no WhatsApp/Direct + leads de formulário, site ou pixel" />
        <Kpi rotulo="Custo por contato" valor={brl(divisao(t.gasto, ct))} v={variacao(divisao(t.gasto, ct), divisao(a.gasto, ctAnt))} inverso destaque />
        {temVendas ? (
          <Kpi rotulo="Retorno (ROAS)" valor={`${dec(divisao(t.valor, t.gasto))}x`} v={variacao(divisao(t.valor, t.gasto), divisao(a.valor, a.gasto))} destaque dica="Valor das compras ÷ investimento" />
        ) : (
          <Kpi rotulo="Cliques no link" valor={int(t.cliquesLink)} v={variacao(t.cliquesLink, a.cliquesLink)} destaque />
        )}
        <Kpi rotulo="Alcance (pessoas)" valor={int(t.alcance)} v={variacao(t.alcance, a.alcance)} />
        <Kpi rotulo="Impressões" valor={int(t.impressoes)} v={variacao(t.impressoes, a.impressoes)} />
        <Kpi rotulo="Frequência" valor={dec(t.frequencia)} v={null} dica="Quantas vezes, em média, cada pessoa viu os anúncios" />
        <Kpi rotulo="CTR do link" valor={pct(ctr)} v={variacao(ctr, ctrAnt)} />
        <Kpi rotulo="CPC do link" valor={brl(cpc)} v={variacao(cpc, cpcAnt)} inverso />
        <Kpi rotulo="CPM" valor={brl(cpm)} v={variacao(cpm, cpmAnt)} inverso dica="Custo por mil impressões" />
        {temVendas && <Kpi rotulo="Compras" valor={int(t.compras)} v={variacao(t.compras, a.compras)} />}
        {temVendas && <Kpi rotulo="Valor em vendas" valor={brl(t.valor)} v={variacao(t.valor, a.valor)} />}
        {!temVendas && <Kpi rotulo="Visualizações da página" valor={int(t.lpViews)} v={variacao(t.lpViews, a.lpViews)} />}
        {!temVendas && <Kpi rotulo="ThruPlays (vídeo)" valor={int(t.thruplays)} v={variacao(t.thruplays, a.thruplays)} dica="Vídeos assistidos até o fim ou por pelo menos 15 segundos" />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Funil
// ------------------------------------------------------------------
interface Etapa {
  nome: string;
  valor: number;
  custo?: number | null;
}

function Funil({ etapas, cor = "var(--accent)" }: { etapas: Etapa[]; cor?: string }) {
  const visiveis = etapas.filter((e, i) => i === 0 || e.valor > 0);
  if (visiveis.length === 0 || visiveis[0].valor === 0) return <p className="text-[12.5px] text-muted">Sem entrega no período.</p>;
  const passo = visiveis.length > 1 ? 48 / (visiveis.length - 1) : 0;
  return (
    <ol className="flex flex-col gap-1.5">
      {visiveis.map((e, i) => {
        const largura = Math.max(100 - passo * i, 56);
        const taxa = i > 0 ? divisao(e.valor, visiveis[i - 1].valor) : null;
        return (
          <li key={e.nome} className="flex flex-col items-center">
            {taxa !== null && (
              <span className="num mb-0.5 text-[11px] text-muted">
                ↓ {pct(taxa, taxa < 0.01 ? 2 : 1)}
              </span>
            )}
            <div
              className="flex min-h-[40px] items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[12.5px]"
              style={{ width: `${largura}%`, background: `color-mix(in srgb, ${cor} ${88 - i * 13}%, transparent)`, color: i < 3 ? "#fff" : "var(--fg)" }}
            >
              <span className="min-w-0 font-medium leading-tight">{e.nome}</span>
              <span className="num shrink-0 text-right leading-tight">
                <span className="font-semibold">{int(e.valor)}</span>
                {e.custo != null && isFinite(e.custo) && <span className="block text-[10.5px] opacity-85">{brl(e.custo)} cada</span>}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function FunilGeral({ r }: { r: Resumo }) {
  const t = r.total;
  const ct = contatosDe(r);
  return (
    <Funil
      etapas={[
        { nome: "Impressões", valor: t.impressoes, custo: null },
        { nome: "Pessoas alcançadas", valor: t.alcance },
        { nome: "Cliques no link", valor: t.cliquesLink, custo: divisao(t.gasto, t.cliquesLink) },
        { nome: "Contatos (conversas + leads)", valor: ct, custo: divisao(t.gasto, ct) },
        { nome: "Conversas com 2+ mensagens", valor: t.conversasProfundas, custo: divisao(t.gasto, t.conversasProfundas) },
        { nome: "Compras", valor: t.compras, custo: divisao(t.gasto, t.compras) },
      ]}
    />
  );
}

function etapasDoGrupo(g: GrupoResumo): Etapa[] {
  const m = g.m;
  const custo = (v: number) => divisao(m.gasto, v);
  switch (g.id) {
    case "mensagens":
      return [
        { nome: "Impressões", valor: m.impressoes },
        { nome: "Cliques", valor: m.cliquesLink, custo: custo(m.cliquesLink) },
        { nome: "Conversas iniciadas", valor: g.resultados, custo: custo(g.resultados) },
        { nome: "Com 2+ mensagens", valor: m.conversasProfundas, custo: custo(m.conversasProfundas) },
      ];
    case "leads":
      return [
        { nome: "Impressões", valor: m.impressoes },
        { nome: "Cliques no link", valor: m.cliquesLink, custo: custo(m.cliquesLink) },
        { nome: "Visualizações da página", valor: m.lpViews, custo: custo(m.lpViews) },
        { nome: "Leads e contatos", valor: g.resultados, custo: custo(g.resultados) },
      ];
    case "vendas":
      return [
        { nome: "Impressões", valor: m.impressoes },
        { nome: "Cliques no link", valor: m.cliquesLink, custo: custo(m.cliquesLink) },
        { nome: "Visualizações da página", valor: m.lpViews },
        { nome: "Adicionou ao carrinho", valor: m.carrinho },
        { nome: "Iniciou a compra", valor: m.checkout },
        { nome: "Compras", valor: Math.max(g.resultados, m.compras), custo: custo(Math.max(g.resultados, m.compras)) },
      ];
    case "trafego":
      return [
        { nome: "Impressões", valor: m.impressoes },
        { nome: "Cliques no link", valor: m.cliquesLink, custo: custo(m.cliquesLink) },
        { nome: "Visitas (perfil, site ou página)", valor: g.resultados, custo: custo(g.resultados) },
      ];
    case "reconhecimento":
      return [
        { nome: "Impressões", valor: m.impressoes },
        { nome: "Pessoas alcançadas", valor: g.resultados || m.alcance },
        { nome: "ThruPlays", valor: m.thruplays, custo: custo(m.thruplays) },
      ];
    default:
      return [
        { nome: "Impressões", valor: m.impressoes },
        { nome: "Engajamentos", valor: g.resultados || m.engajamento, custo: custo(g.resultados || m.engajamento) },
      ];
  }
}

// ------------------------------------------------------------------
// Gráfico diário
// ------------------------------------------------------------------
function GraficoDiario({ dias }: { dias: { data: string; gasto: number; contatos: number }[] }) {
  if (dias.length === 0) return <p className="text-[12.5px] text-muted">Sem dados no período.</p>;
  const L = 640;
  const A = 200;
  const M = { t: 12, r: 34, b: 26, l: 44 };
  const w = L - M.l - M.r;
  const hgt = A - M.t - M.b;
  const maxG = Math.max(...dias.map((x) => x.gasto), 1);
  const maxC = Math.max(...dias.map((x) => x.contatos), 1);
  const bw = w / dias.length;
  const xC = (i: number) => M.l + bw * i + bw / 2;
  const yG = (v: number) => M.t + hgt - (v / maxG) * hgt;
  const yC = (v: number) => M.t + hgt - (v / maxC) * hgt;
  const passoRotulo = Math.ceil(dias.length / 8);
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${L} ${A}`} className="h-auto w-full" role="img" aria-label="Investimento e contatos por dia">
        {[0, 0.5, 1].map((p) => (
          <g key={p}>
            <line x1={M.l} x2={L - M.r} y1={M.t + hgt * (1 - p)} y2={M.t + hgt * (1 - p)} stroke="var(--line)" strokeDasharray={p ? "3 3" : undefined} />
            <text x={M.l - 6} y={M.t + hgt * (1 - p) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
              {Math.round(maxG * p)}
            </text>
            <text x={L - M.r + 6} y={M.t + hgt * (1 - p) + 3} fontSize="10" fill="var(--ok)">
              {Math.round(maxC * p)}
            </text>
          </g>
        ))}
        {dias.map((x, i) => (
          <g key={x.data}>
            <rect x={M.l + bw * i + bw * 0.18} y={yG(x.gasto)} width={bw * 0.64} height={Math.max(0, M.t + hgt - yG(x.gasto))} rx={2} fill="var(--accent)" opacity={0.75}>
              <title>{`${dataBR(x.data)}: ${brl(x.gasto)} · ${x.contatos} contatos`}</title>
            </rect>
            {i % passoRotulo === 0 && (
              <text x={xC(i)} y={A - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {dataBR(x.data).slice(0, 5)}
              </text>
            )}
          </g>
        ))}
        <polyline points={dias.map((x, i) => `${xC(i)},${yC(x.contatos)}`).join(" ")} fill="none" stroke="var(--ok)" strokeWidth={2.2} strokeLinejoin="round" />
        {dias.map((x, i) => (
          <circle key={x.data} cx={xC(i)} cy={yC(x.contatos)} r={2.8} fill="var(--ok)">
            <title>{`${dataBR(x.data)}: ${x.contatos} contatos`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex gap-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent opacity-75" /> Investimento (R$)</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-ok" /> Contatos</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Por objetivo
// ------------------------------------------------------------------
function PorObjetivo({ grupos, total }: { grupos: GrupoResumo[]; total: number }) {
  if (grupos.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold">Por objetivo das campanhas</h2>
        <p className="text-[12.5px] text-muted">Cada bloco junta as campanhas pelo resultado que elas buscam, com o funil próprio daquele objetivo.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {grupos.map((g) => {
          const info = GRUPOS[g.id];
          const custo = divisao(g.m.gasto, g.resultados);
          const vendas = g.id === "vendas" && g.m.valor > 0;
          return (
            <article key={g.id} className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5" style={{ borderTop: `4px solid ${info.cor}` }}>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold" style={{ color: info.cor }}>{info.nome}</h3>
                  <p className="text-[12px] text-muted">{info.descricao}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num text-[15px] font-semibold">{brl(g.m.gasto)}</div>
                  <div className="text-[11.5px] text-muted">{pct(divisao(g.m.gasto, total), 0)} do investimento</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 sm:px-5">
                <Mini rotulo={info.resultado[1].replace(/^./, (c) => c.toUpperCase())} valor={int(g.resultados)} cor={info.cor} />
                <Mini rotulo={`Custo por ${info.resultado[0]}`} valor={g.id === "reconhecimento" ? brl(divisao(g.m.gasto * 1000, g.m.impressoes)) + " CPM" : brl(custo)} />
                {vendas ? (
                  <Mini rotulo="ROAS" valor={`${dec(divisao(g.m.valor, g.m.gasto))}x`} />
                ) : (
                  <Mini rotulo="CTR do link" valor={pct(divisao(g.m.cliquesLink, g.m.impressoes))} />
                )}
              </div>
              <div className="px-4 sm:px-5">
                <Funil etapas={etapasDoGrupo(g)} cor={info.cor} />
              </div>
              <div className="border-t border-line px-4 py-3 sm:px-5">
                <div className="eyebrow mb-1.5">Campanhas</div>
                <ul className="flex flex-col gap-1">
                  {g.campanhas.slice(0, 4).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <PontoStatus status={c.status} />
                        <span className="truncate">{c.nome}</span>
                      </span>
                      <span className="num shrink-0 text-muted">
                        {brl(c.m.gasto)} · <span className="text-fg">{int(c.resultados)}</span> · {brl(divisao(c.m.gasto, c.resultados))}
                      </span>
                    </li>
                  ))}
                  {g.campanhas.length > 4 && <li className="text-[12px] text-muted">+ {g.campanhas.length - 4} campanha(s) na tabela abaixo</li>}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Mini({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-xl bg-raised px-3 py-2">
      <div className="num text-[17px] font-semibold leading-tight" style={cor ? { color: cor } : undefined}>{valor}</div>
      <div className="truncate text-[11.5px] text-muted">{rotulo}</div>
    </div>
  );
}

function PontoStatus({ status }: { status: string | null }) {
  const ativo = status === "ACTIVE";
  return <span title={ativo ? "Ativa" : status ?? ""} className="h-2 w-2 shrink-0 rounded-full" style={{ background: ativo ? "var(--ok)" : "var(--line)" }} />;
}

// ------------------------------------------------------------------
// Criativos
// ------------------------------------------------------------------
type Ordem = "custo" | "resultados" | "investimento" | "ctr";

function Criativos({ anuncios }: { anuncios: AnuncioResumo[] }) {
  const [ordem, setOrdem] = useState<Ordem>("custo");
  const [grupo, setGrupo] = useState<string>("todos");
  const gruposPresentes = [...new Set(anuncios.map((a) => a.grupo))];
  const base = anuncios.filter((a) => grupo === "todos" || a.grupo === grupo);
  const minimo = Math.max(1, (base.reduce((s, a) => s + a.m.gasto, 0) / Math.max(base.length, 1)) * 0.25);
  const lista = [...base]
    .filter((a) => (ordem === "custo" ? a.resultados > 0 && a.m.gasto >= minimo : ordem === "ctr" ? a.m.impressoes >= 500 : true))
    .sort((a, b) => {
      if (ordem === "custo") return (divisao(a.m.gasto, a.resultados) ?? 1e9) - (divisao(b.m.gasto, b.resultados) ?? 1e9);
      if (ordem === "resultados") return b.resultados - a.resultados;
      if (ordem === "ctr") return (divisao(b.m.cliquesLink, b.m.impressoes) ?? 0) - (divisao(a.m.cliquesLink, a.m.impressoes) ?? 0);
      return b.m.gasto - a.m.gasto;
    })
    .slice(0, 8);

  return (
    <Cartao
      titulo="Melhores criativos"
      subtitulo="Anúncios que rodaram no período, com o resultado de cada um"
      direita={
        <div className="flex flex-wrap gap-2">
          <select aria-label="Objetivo" value={grupo} onChange={(e) => setGrupo(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-[12.5px]">
            <option value="todos">Todos os objetivos</option>
            {gruposPresentes.map((g) => (
              <option key={g} value={g}>{GRUPOS[g].nome}</option>
            ))}
          </select>
          <div role="tablist" className="flex rounded-lg border border-line p-0.5">
            {([["custo", "Menor custo"], ["resultados", "Mais resultados"], ["ctr", "Maior CTR"], ["investimento", "Mais investimento"]] as const).map(([v, nome]) => (
              <button key={v} role="tab" aria-selected={ordem === v} onClick={() => setOrdem(v)} className={`rounded-md px-2.5 py-1 text-[12px] ${ordem === v ? "bg-raised font-medium" : "text-muted"}`}>
                {nome}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {lista.length === 0 ? (
        <p className="text-[12.5px] text-muted">Nenhum anúncio com resultado suficiente nesse filtro.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {lista.map((a, i) => (
            <CartaoCriativo key={a.id} a={a} posicao={i + 1} />
          ))}
        </div>
      )}
    </Cartao>
  );
}

function CartaoCriativo({ a, posicao }: { a: AnuncioResumo; posicao: number }) {
  const info = GRUPOS[a.grupo];
  const [falhou, setFalhou] = useState(false);
  const video = a.tipoCriativo === "VIDEO" || /v[ií]deo/i.test(a.nome);
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="relative aspect-square bg-raised">
        {a.miniatura && !falhou ? (
          <img src={a.miniatura} alt={a.nome} loading="lazy" referrerPolicy="no-referrer" onError={() => setFalhou(true)} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${info.cor} 35%, var(--raised)), var(--raised))` }}>
            {video ? <PlayCircle size={34} className="text-muted" /> : <ImagemIcone size={34} className="text-muted" />}
          </div>
        )}
        <span className="num absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-fg text-[11px] font-semibold text-bg">{posicao}</span>
        <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10.5px] font-medium text-white" style={{ background: info.cor }}>{info.nome}</span>
        {video && a.miniatura && !falhou && <PlayCircle size={28} className="absolute bottom-2 right-2 text-white drop-shadow" />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <PontoStatus status={a.status} />
            <span className="truncate text-[12.5px] font-medium" title={a.nome}>{a.nome}</span>
          </div>
          <div className="truncate text-[11px] text-muted" title={a.campanha}>{a.campanha}</div>
        </div>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11.5px]">
          <dt className="text-muted">Resultados</dt>
          <dd className="num text-right font-semibold">{int(a.resultados)}</dd>
          <dt className="text-muted">Custo/result.</dt>
          <dd className="num text-right font-semibold" style={{ color: info.cor }}>{brl(divisao(a.m.gasto, a.resultados))}</dd>
          <dt className="text-muted">Investido</dt>
          <dd className="num text-right">{brl(a.m.gasto)}</dd>
          <dt className="text-muted">CTR</dt>
          <dd className="num text-right">{pct(divisao(a.m.cliquesLink, a.m.impressoes))}</dd>
        </dl>
        {a.previa && (
          <a href={a.previa} target="_blank" rel="noreferrer" className="mt-auto flex items-center gap-1 text-[12px] font-medium text-accent">
            <ExternalLink size={12} /> Ver anúncio
          </a>
        )}
      </div>
    </article>
  );
}

// ------------------------------------------------------------------
// Campanhas
// ------------------------------------------------------------------
function Campanhas({ grupos }: { grupos: GrupoResumo[] }) {
  const linhas: CampanhaResumo[] = grupos.flatMap((g) => g.campanhas);
  if (linhas.length === 0) return null;
  return (
    <Cartao titulo="Campanhas" subtitulo="Todas as campanhas com entrega no período, por objetivo">
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full min-w-[900px] text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-muted">
              {["Campanha", "Objetivo", "Investimento", "Resultados", "Custo/result.", "CTR link", "CPM", "Frequência", "Orçamento/dia"].map((h, i) => (
                <th key={h} className={`eyebrow px-3 py-2 font-normal ${i >= 2 ? "text-right" : ""} ${i === 0 ? "pl-4 sm:pl-5" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((c) => {
              const info = GRUPOS[c.grupo];
              const m: Metricas = c.m;
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="max-w-[340px] py-2 pl-4 pr-3 sm:pl-5">
                    <div className="flex items-center gap-1.5">
                      <PontoStatus status={c.status} />
                      <span className="truncate font-medium" title={c.nome}>{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-3">
                    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: info.cor, background: `color-mix(in srgb, ${info.cor} 14%, transparent)` }}>{info.nome}</span>
                  </td>
                  <td className="num px-3 text-right">{brl(m.gasto)}</td>
                  <td className="num px-3 text-right font-medium">{int(c.resultados)}</td>
                  <td className="num px-3 text-right font-medium">{brl(divisao(m.gasto, c.resultados))}</td>
                  <td className="num px-3 text-right">{pct(divisao(m.cliquesLink, m.impressoes))}</td>
                  <td className="num px-3 text-right">{brl(divisao(m.gasto * 1000, m.impressoes))}</td>
                  <td className="num px-3 text-right">{dec(m.frequencia)}</td>
                  <td className="num px-3 pr-4 text-right text-muted sm:pr-5">{c.orcamentoDia ? brl(c.orcamentoDia) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}

