import { AnaliseCampanhas, BotaoGestorOtimizador, ProgressoOtimizador, useGestorOtimizador } from "./painel/GestorOtimizador";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, Image as ImagemIcone, PlayCircle, RefreshCw, Wallet } from "lucide-react";
import { useDados } from "../../lib/dados";
import { hoje, somarDias } from "../../lib/tipos";
import { STATUS_CONTA, repoTrafego } from "../../lib/trafego";
import {
  GRUPOS,
  divisao,
  resumirRelatorio,
  type AnuncioResumo,
  type CampanhaResumo,
  type GrupoResumo,
  type Metricas,
  type RelatorioMeta,
} from "../../lib/relatorio";
import { Entrada, Vazio } from "../../components/ui";
import { GoogleAdsCliente, useRelatorioGoogle } from "./GoogleAdsCliente";
import { CATALOGO, FUNIL_PADRAO, PADRAO, defFormula, metricasDoFunil, valorEtapa, variaveis, type ConfigFunil, type Contexto } from "../../lib/painel";
import { PainelMetricas, type ConfigPainel } from "./painel/PainelMetricas";
import { PainelGraficos } from "./painel/Graficos";
import { useConfigDashboard, useDiarioPlataformas } from "./painel/config";
import { FunilVendas, somarLancamentos, useLancamentosFunil } from "./painel/FunilVendas";
import { GRAFICOS_GERAL_PADRAO, useGraficosGeral } from "./painel/AbaGeral";
import { tendenciaDe } from "./painel/tendencias";
import { GraficoSeries } from "./painel/Graficos";
import { AnaliseFunil } from "./painel/AnaliseFunil";
import { AbaInstagram, useRelatorioIG } from "./painel/AbaInstagram";
import { supabase } from "../../lib/supabase";
import { useLogos } from "../../lib/logos";
import { LogoCliente } from "../../components/LogoCliente";
import { CompartilharPainel } from "../../components/CompartilharPainel";

// ------------------------------------------------------------------
// Formatação
// ------------------------------------------------------------------
export const brl = (v: number | null, casas = 2) =>
  v === null || !isFinite(v) ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v >= 1000 ? 0 : casas, maximumFractionDigits: v >= 1000 ? 0 : casas });
export const int = (v: number | null) => (v === null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("pt-BR"));
export const pct = (v: number | null, casas = 2) => (v === null || !isFinite(v) ? "—" : `${(v * 100).toFixed(casas).replace(".", ",")}%`);
export const dec = (v: number | null, casas = 2) => (v === null || !isFinite(v) ? "—" : v.toFixed(casas).replace(".", ","));
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
type AbaDash = "geral" | "meta" | "google" | "instagram" | "funil";
const ABAS_DASH: { id: AbaDash; nome: string }[] = [
  { id: "geral", nome: "Geral" },
  { id: "meta", nome: "Meta Ads" },
  { id: "google", nome: "Google Ads" },
  { id: "instagram", nome: "Instagram" },
  { id: "funil", nome: "Funil de Vendas" },
];
type CfgAba = ConfigPainel;
type CfgFunilAba = ConfigFunil & ConfigPainel;

export function DashboardCliente({ clienteId, ir }: { clienteId: string; ir: (r: string) => void }) {
  const d = useDados();
  const cliente = d.cliente(clienteId);
  const [atalho, setAtalho] = useState<Atalho>("30");
  const [custom, setCustom] = useState({ ini: somarDias(hoje(), -30), fim: somarDias(hoje(), -1) });
  const per = intervalo(atalho, custom);
  const nDias = Math.round((Date.parse(`${per.fim}T12:00:00Z`) - Date.parse(`${per.ini}T12:00:00Z`)) / 86400000) + 1;
  const ant = { ini: somarDias(per.ini, -nDias), fim: somarDias(per.ini, -1) };

  // Plataformas do cliente
  const [plats, setPlats] = useState<{ meta: boolean; google: boolean } | null>(supabase ? null : { meta: true, google: true });
  useEffect(() => {
    if (!supabase) return;
    supabase.from("contas_anuncio").select("plataforma").eq("cliente_id", clienteId).eq("ativa", true).then(({ data }) => {
      const ps = new Set((data ?? []).map((x: { plataforma: string }) => x.plataforma));
      setPlats({ meta: ps.has("meta"), google: ps.has("google") });
    });
  }, [clienteId]);
  const [aba, setAba] = useState<AbaDash>(() => {
    try {
      return (localStorage.getItem("vertente.dash-aba") as AbaDash) || "geral";
    } catch {
      return "geral";
    }
  });
  const escolherAba = (a: AbaDash) => {
    setAba(a);
    try {
      localStorage.setItem("vertente.dash-aba", a);
    } catch {
      /* sem armazenamento */
    }
  };

  // Meta (ao vivo)
  const [rel, setRel] = useState<RelatorioMeta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const buscar = useCallback(async () => {
    if (!per.ini || !per.fim || per.ini > per.fim || plats?.meta === false) return setCarregando(false);
    setCarregando(true);
    setErro("");
    try {
      setRel(await repoTrafego.relatorio(clienteId, per.ini, per.fim));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [clienteId, per.ini, per.fim, plats?.meta]);
  useEffect(() => {
    if (plats) buscar();
  }, [buscar, plats]);
  const r = useMemo(() => (rel ? resumirRelatorio(rel) : null), [rel]);

  // Google (ao vivo)
  const g = useRelatorioGoogle(clienteId, per.ini, per.fim, !!plats?.google);
  // Instagram (ao vivo, só quando a aba está aberta)
  const ig = useRelatorioIG(clienteId, per.ini, per.fim, aba === "instagram");

  // Lançamentos e configuração
  const lanc = useLancamentosFunil();
  const doCliente = lanc.linhas.filter((l) => l.cliente_id === clienteId);
  const cGeral = useConfigDashboard<CfgAba>(clienteId, "geral", { cards: PADRAO.geral, formulas: [], graficos: GRAFICOS_GERAL_PADRAO });
  const cMeta = useConfigDashboard<CfgAba>(clienteId, "meta", { cards: PADRAO.meta, formulas: [], graficos: [] });
  const cGoogle = useConfigDashboard<CfgAba>(clienteId, "google", { cards: PADRAO.google, formulas: [], graficos: [] });
  const cFunil = useConfigDashboard<CfgFunilAba>(clienteId, "funil", { ...FUNIL_PADRAO, cards: ["investimento", "contatos", "custo_contato", "f_vendas", "f_custo_final", "f_faturamento", "f_roas", "f_ticket"], formulas: [], graficos: ["evolucao", "taxas", "receita", "custo_final"] });
  const funilCfg: ConfigFunil = { etapas: cFunil.config.etapas, valores: cFunil.config.valores };

  const ctx: Contexto = useMemo(() => {
    const mAtual = somarLancamentos(doCliente, per.ini, per.fim);
    const mAnt = somarLancamentos(doCliente, ant.ini, ant.fim);
    return {
      atual: { meta: r ? r.total : null, metaContatos: r ? contatosDe(r) : 0, google: g.r && g.r.contas.length ? g.r.total : null, manual: mAtual.manual, temManual: mAtual.temManual },
      anterior: { meta: r ? r.anterior : null, metaContatos: r ? r.anterior.conversas + r.anterior.leads : 0, google: g.r && g.r.contas.length ? g.r.anterior : null, manual: mAnt.manual, temManual: mAnt.temManual },
    };
  }, [r, g.r, doCliente, per.ini, per.fim, ant.ini, ant.fim]);

  // Fórmulas criadas em qualquer aba ficam disponíveis em todas
  const todasFormulas = [...cGeral.config.formulas, ...cMeta.config.formulas, ...cGoogle.config.formulas, ...cFunil.config.formulas].filter((f, i, xs) => xs.findIndex((y) => y.id === f.id) === i);
  const catalogoTodo = [...CATALOGO, ...metricasDoFunil(funilCfg), ...todasFormulas.map(defFormula)];
  const catalogo = (_f?: unknown) => catalogoTodo;
  const vars = variaveis(funilCfg);
  const diario = useDiarioPlataformas(clienteId, per.ini, per.fim);
  const graficosGeral = useGraficosGeral(diario, ctx);
  const tendencia = useMemo(() => tendenciaDe(diario), [diario]);

  const painel = (titulo: string, c: ReturnType<typeof useConfigDashboard<CfgAba>>, extra?: React.ReactNode) => (
    <PainelMetricas titulo={titulo} ctx={ctx} catalogo={catalogo(c.config.formulas)} config={c.config} salvar={c.salvar} restaurar={c.restaurar} personalizado={c.personalizado} variaveis={vars} extra={extra} tendencia={tendencia} />
  );

  const montarResumo = () => {
    const etapas = funilCfg.etapas.map((e) => ({ etapa: e.nome, fonte: e.fonte, atual: valorEtapa(e, ctx.atual), anterior: valorEtapa(e, ctx.anterior) }));
    const kpis = Object.fromEntries(catalogo(cFunil.config.formulas).map((m) => [m.nome, { atual: m.calc(ctx.atual), anterior: m.calc(ctx.anterior) }]).filter(([, v]) => (v as { atual: number | null }).atual !== null));
    return {
      periodo: { inicio: per.ini, fim: per.fim, anterior_inicio: ant.ini, anterior_fim: ant.fim },
      funil: etapas,
      valores_lancados: funilCfg.valores.map((v) => ({ nome: v.nome, atual: ctx.atual.temManual ? ctx.atual.manual[v.id] ?? null : null, anterior: ctx.anterior.temManual ? ctx.anterior.manual[v.id] ?? null : null })),
      indicadores: kpis,
      meta: r
        ? {
            por_objetivo: r.grupos.map((x) => ({ objetivo: x.id, gasto: x.m.gasto, resultados: x.resultados, custo: x.resultados ? x.m.gasto / x.resultados : null })),
            campanhas: r.grupos.flatMap((x) => x.campanhas).slice(0, 25).map((c) => ({ nome: c.nome, status: c.status, objetivo: c.grupo, gasto: c.m.gasto, resultados: c.resultados, tipo: c.tipo, ctr_link: c.m.impressoes ? c.m.cliquesLink / c.m.impressoes : null, cpm: c.m.impressoes ? (c.m.gasto * 1000) / c.m.impressoes : null, frequencia: c.m.frequencia })),
            anuncios: [...r.anuncios].sort((a, b) => b.m.gasto - a.m.gasto).slice(0, 25).map((a) => ({ anuncio: a.nome, conjunto: a.conjunto, campanha: a.campanha, formato: a.tipoCriativo, texto: a.texto?.slice(0, 280) ?? null, gasto: a.m.gasto, resultados: a.resultados, tipo: a.tipo, ctr_link: a.m.impressoes ? a.m.cliquesLink / a.m.impressoes : null, custo_resultado: a.resultados ? a.m.gasto / a.resultados : null })),
            diario: r.dias,
          }
        : null,
      google: g.r && g.r.contas.length
        ? {
            campanhas: g.r.campanhas.slice(0, 15).map((c) => ({ nome: c.nome, tipo: c.tipo, gasto: c.gasto, cliques: c.cliques, conversoes: c.conversoes, parcela: c.parcela, perdida_orcamento: c.perdida_orcamento, perdida_ranking: c.perdida_ranking })),
            termos: g.r.termos.slice(0, 30),
            palavras: g.r.palavras.slice(0, 20),
            acoes: g.r.acoes,
            dispositivos: g.r.dispositivos,
            parcela_impressoes: g.r.parcela_impressoes,
          }
        : null,
    };
  };

  const go = useGestorOtimizador(clienteId, per.ini, per.fim, montarResumo);

  const abas = ABAS_DASH.filter((x) => !plats || (x.id === "meta" ? plats.meta : x.id === "google" ? plats.google : true));
  const abaAtual = abas.some((x) => x.id === aba) ? aba : "geral";
  const periodoTexto = `${dataBR(per.ini)} a ${dataBR(per.fim)}, comparado com ${dataBR(ant.ini)} a ${dataBR(ant.fim)}.`;
  const ocupado = carregando || g.carregando;
  const lg = useLogos();

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <header className="relative overflow-hidden rounded-3xl border border-line bg-surface">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ background: "radial-gradient(120% 140% at 0% 0%, var(--accent) 0%, transparent 55%)" }} />
        <div className="relative flex flex-wrap items-center gap-4 px-5 pb-0 pt-5 sm:px-6">
          <button onClick={() => ir("trafego-dashboards")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg" aria-label="Voltar aos dashboards" title="Dashboards">
            <ArrowLeft size={16} />
          </button>
          <LogoCliente nome={cliente?.nome ?? "Cliente"} url={lg.logos[clienteId]} tamanho={52}
            trocar={lg.disponivel ? async (f) => { try { await lg.enviar(clienteId, f); d.avisar("Logo atualizada"); } catch (e) { d.avisar((e as Error).message); } } : undefined} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[24px] font-semibold leading-tight tracking-tight">{cliente?.nome ?? "Cliente"}</h1>
            <p className="mt-0.5 truncate text-[12.5px] text-muted">{dataBR(per.ini)} – {dataBR(per.fim)} <span className="opacity-70">· vs. {dataBR(ant.ini)} – {dataBR(ant.fim)}</span></p>
          </div>
          <div className="flex items-center gap-1.5">
            <BotaoGestorOtimizador g={go} />
            <CompartilharPainel clienteId={clienteId} />
            <select aria-label="Período" value={atalho} onChange={(e) => setAtalho(e.target.value as Atalho)} className="h-9 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium outline-none hover:border-line-forte focus:border-accent">
              {ATALHOS.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <button onClick={() => { buscar(); g.buscar(); if (abaAtual === "instagram") ig.buscar(); }} disabled={ocupado} className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted hover:border-line-forte hover:text-fg disabled:opacity-60" aria-label="Atualizar" title="Atualizar">
              <RefreshCw size={15} className={ocupado ? "animate-spin" : ""} />
            </button>
          </div>
          {atalho === "custom" && (
            <div className="flex w-full items-center justify-end gap-2">
              <Entrada id="dash-ini" type="date" aria-label="De" value={custom.ini} max={custom.fim} onChange={(e) => setCustom((c) => ({ ...c, ini: e.target.value }))} className="!w-auto" />
              <span className="text-muted">a</span>
              <Entrada id="dash-fim" type="date" aria-label="Até" value={custom.fim} min={custom.ini} max={hoje()} onChange={(e) => setCustom((c) => ({ ...c, fim: e.target.value }))} className="!w-auto" />
            </div>
          )}
          <nav role="tablist" aria-label="Visão" className="abas-linha -mb-px flex w-full gap-6 overflow-x-auto pt-2">
            {abas.map((x) => {
              const cor = x.id === "google" ? "#e2701c" : x.id === "funil" ? "var(--ok)" : x.id === "instagram" ? "#c2508a" : "var(--accent)";
              return (
                <button key={x.id} role="tab" aria-selected={abaAtual === x.id} onClick={() => escolherAba(x.id)}
                  className={`whitespace-nowrap border-b-2 pb-3 pt-1 text-[13.5px] font-medium transition-colors ${abaAtual === x.id ? "text-fg" : "border-transparent text-muted hover:text-fg"}`}
                  style={abaAtual === x.id ? { borderColor: cor } : undefined}>
                  {x.nome}
                </button>
              );
            })}
            <button onClick={() => ir(`cliente-${clienteId}`)} className="ml-auto whitespace-nowrap pb-3 pt-1 text-[12.5px] text-muted hover:text-fg">Tarefas do cliente →</button>
          </nav>
        </div>
      </header>

      <ProgressoOtimizador g={go} />

      {erro && abaAtual !== "google" && <div className="rounded-xl border border-bad bg-bad-soft px-4 py-3 text-[13px] text-bad">Não foi possível buscar na Meta: {erro}</div>}

      {abaAtual === "geral" && (
        <div className={`flex flex-col gap-6 transition-opacity ${ocupado ? "opacity-60" : ""}`}>
          {painel("Visão geral · Meta + Google", cGeral)}
          <PainelGraficos titulo="Gráficos" catalogo={graficosGeral} ids={cGeral.config.graficos} salvar={(ids) => cGeral.salvar({ ...cGeral.config, graficos: ids })} />
        </div>
      )}

      {abaAtual === "meta" &&
        (!r && carregando ? (
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
            {painel("Visão geral", cMeta)}
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <Cartao titulo="Funil">
                <FunilGeral r={r} />
              </Cartao>
              <Cartao titulo="Dia a dia" subtitulo="Investimento e contatos">
                <GraficoDiario dias={r.dias} />
              </Cartao>
            </section>
            <Criativos anuncios={r.anuncios} />
            <Recolhivel id="objetivos" titulo="Por objetivo das campanhas" resumo={`${r.grupos.length} ${r.grupos.length === 1 ? "objetivo" : "objetivos"}`}>
              <PorObjetivo grupos={r.grupos} total={r.total.gasto} />
            </Recolhivel>
            <Recolhivel id="campanhas" titulo="Campanhas" resumo={`${r.grupos.reduce((n, x) => n + x.campanhas.length, 0)} com entrega no período`}>
              <Campanhas grupos={r.grupos} />
            </Recolhivel>
          </div>
        ))}

      {abaAtual === "google" && <GoogleAdsCliente clienteId={clienteId} ini={per.ini} fim={per.fim} dados={g} painel={painel("Visão geral", cGoogle)} />}

      {abaAtual === "instagram" && <AbaInstagram clienteId={clienteId} dados={ig} />}

      {abaAtual === "funil" && (
        <div className={`flex flex-col gap-6 transition-opacity ${ocupado ? "opacity-60" : ""}`}>
          {painel("Indicadores do funil", cFunil as unknown as ReturnType<typeof useConfigDashboard<CfgAba>>)}
          <FunilVendas
            clienteId={clienteId}
            ctx={ctx}
            cfg={funilCfg}
            salvarCfg={(c) => cFunil.salvar({ ...cFunil.config, ...c })}
            lanc={lanc}
            graficos={cFunil.config.graficos}
            salvarGraficos={(ids) => cFunil.salvar({ ...cFunil.config, graficos: ids })}
            periodoTexto={periodoTexto}
          />
          <AnaliseFunil clienteId={clienteId} ini={per.ini} fim={per.fim} montarResumo={montarResumo} />
        </div>
      )}

      <AnaliseCampanhas g={go} />
    </div>
  );
}

// ------------------------------------------------------------------
// Blocos
// ------------------------------------------------------------------
/** Seção que abre e fecha (lembra a escolha). Deixa a tela limpa e o detalhe a um clique. */
export function Recolhivel({ id, titulo, resumo, children }: { id: string; titulo: string; resumo?: string; children: React.ReactNode }) {
  const chave = `vertente.dash-abre.${id}`;
  const [aberto, setAberto] = useState(() => { try { return localStorage.getItem(chave) === "1"; } catch { return false; } });
  const mudar = () => { const v = !aberto; setAberto(v); try { localStorage.setItem(chave, v ? "1" : "0"); } catch { /* sem armazenamento */ } };
  return (
    <section className="flex flex-col gap-3">
      <button onClick={mudar} aria-expanded={aberto} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-3.5 text-left hover:border-line-forte">
        <span className="text-[14px] font-semibold">{titulo}</span>
        {resumo && <span className="text-[12.5px] text-muted">{resumo}</span>}
        <ChevronDown size={16} className={`ml-auto text-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && <div className="anim-entrar">{children}</div>}
    </section>
  );
}

export function Cartao({ titulo, subtitulo, children, direita }: { titulo: string; subtitulo?: string; children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      {(titulo || direita) && <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {titulo && <h2 className="text-[15px] font-semibold">{titulo}</h2>}
          {subtitulo && <p className="text-[12.5px] text-muted">{subtitulo}</p>}
        </div>
        {direita}
      </div>}
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

/** Contatos = conversas iniciadas + leads das campanhas de cadastro/contato (ou de formulário). O lead do pixel fica fora porque pode repetir a conversa. */
function contatosDe(r: Resumo) {
  const leadsGrupo = r.grupos.find((g) => g.id === "leads")?.resultados ?? 0;
  return r.total.conversas + Math.max(leadsGrupo, r.total.leads);
}

export function Kpi({ rotulo, valor, v, inverso, destaque, dica }: { rotulo: string; valor: string; v: number | null; inverso?: boolean; destaque?: boolean; dica?: string }) {
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

// ------------------------------------------------------------------
// Funil
// ------------------------------------------------------------------
export interface Etapa {
  nome: string;
  valor: number;
  custo?: number | null;
}

export function Funil({ etapas, cor = "var(--accent)" }: { etapas: Etapa[]; cor?: string }) {
  const visiveis = etapas.filter((e, i) => i === 0 || e.valor > 0);
  if (visiveis.length === 0 || visiveis[0].valor === 0) return <p className="text-[12.5px] text-muted">Sem entrega no período.</p>;
  // Largura pela raiz da proporção: as etapas pequenas continuam visíveis sem esconder a queda
  const topo = visiveis[0].valor;
  const larg = (v: number) => Math.max(14, Math.sqrt(v / topo) * 100);
  return (
    <ol className="flex flex-col">
      {visiveis.map((e, i) => {
        const taxa = i > 0 ? divisao(e.valor, visiveis[i - 1].valor) : null;
        const opac = 1 - (i / Math.max(1, visiveis.length - 1)) * 0.55;
        return (
          <li key={e.nome} className="flex flex-col">
            {taxa !== null && (
              <div className="flex items-center gap-2 py-1 pl-3">
                <span className="h-3 w-px bg-line-forte" />
                <span className={`num rounded-full px-1.5 py-px text-[10.5px] font-semibold ${taxa >= 0.1 ? "bg-ok-soft text-ok" : taxa >= 0.02 ? "bg-warn-soft text-warn" : "bg-raised text-muted"}`}>{pct(taxa, taxa < 0.01 ? 2 : 1)} passam</span>
              </div>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="relative h-10 overflow-hidden rounded-xl bg-raised">
                <div className="absolute inset-y-0 left-0 rounded-xl" style={{ width: `${larg(e.valor)}%`, background: `linear-gradient(90deg, ${cor}, color-mix(in srgb, ${cor} 70%, transparent))`, opacity: opac }} />
                <span className="relative flex h-full items-center px-3 text-[12.5px] font-medium" style={{ color: larg(e.valor) > 45 ? "#fff" : "var(--fg)" }}>{e.nome}</span>
              </div>
              <div className="num min-w-[86px] text-right leading-tight">
                <div className="text-[14px] font-bold">{int(e.valor)}</div>
                {e.custo != null && isFinite(e.custo) && <div className="text-[10.5px] text-muted">{brl(e.custo)} cada</div>}
              </div>
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
export function GraficoDiario({ dias, rotulo = "Contatos" }: { dias: { data: string; gasto: number; contatos: number }[]; rotulo?: string }) {
  return (
    <GraficoSeries
      rotulos={dias.map((x) => dataBR(x.data).slice(0, 5))}
      tipo="combo"
      fmt="brl"
      series={[
        { nome: "Investimento", cor: "var(--accent)", fmt: "brl", valores: dias.map((x) => x.gasto) },
        { nome: rotulo, cor: "#16a34a", fmt: "int", linha: true, valores: dias.map((x) => x.contatos) },
      ]}
    />
  );
}

// ------------------------------------------------------------------
// Por objetivo
// ------------------------------------------------------------------
function PorObjetivo({ grupos, total }: { grupos: GrupoResumo[]; total: number }) {
  if (grupos.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
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
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? lista : lista.slice(0, 4);

  return (
    <Cartao
      titulo="Melhores criativos"
      subtitulo="Os que mais entregaram no período"
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
          {visiveis.map((a, i) => (
            <CartaoCriativo key={a.id} a={a} posicao={i + 1} />
          ))}
        </div>
      )}
      {lista.length > 4 && (
        <button onClick={() => setTodos(!todos)} className="mx-auto flex items-center gap-1 text-[12.5px] text-muted hover:text-fg">
          {todos ? "Mostrar menos" : `Ver mais ${lista.length - 4}`} <ChevronDown size={13} className={`transition-transform ${todos ? "rotate-180" : ""}`} />
        </button>
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
    <Cartao titulo="">
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

