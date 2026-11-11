import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Network, Plus, X } from "lucide-react";
import { useDados } from "../lib/dados";
import { abrirTarefaGlobal } from "../lib/favoritos";
import { comparador } from "../lib/ordenacao";
import { corDoNome } from "../lib/logos";
import { PILAR, STATUS_ABERTOS, atrasada, dataCurta, hoje, somarDias, type Pilar, type Tarefa } from "../lib/tipos";
import { COR_PILAR } from "./ui";

type Filtro = "todas" | "atrasadas" | "hoje" | "semana";
type Agrupar = "cliente" | "pilar";
interface Grupo { id: string; nome: string; cor: string; tarefas: Tarefa[]; atrasadas: number }

const LIMITE = 7; // tarefas visíveis por ramo antes do "+N"
const LINHA = 30;
const GX = 230; // distância do centro até o ramo
const TX = 420; // distância do centro até as tarefas
const TW = 250; // largura da tarefa

/** Botão no cantinho inferior direito + mapa mental das pendências (só para o Rener). */
export function MapaPendencias() {
  const d = useDados();
  const [aberto, setAberto] = useState(false);
  const atrasadasTotal = d.tarefas.filter((t) => !t.triagem && STATUS_ABERTOS.includes(t.status) && atrasada(t)).length;

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[data-painel-aberto]")) setAberto(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        title="Mapa de pendências"
        aria-label="Abrir mapa de pendências"
        className="fixed bottom-[max(14px,env(safe-area-inset-bottom,0px))] right-[max(14px,env(safe-area-inset-right,0px))] z-40 grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#0e1a52,#2747d6)] text-white shadow-[0_8px_24px_-8px_rgba(39,71,214,0.7)] transition hover:scale-105"
      >
        <Network size={19} />
        {atrasadasTotal > 0 && <span className="num absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[10.5px] font-semibold text-white">{atrasadasTotal > 99 ? "99+" : atrasadasTotal}</span>}
      </button>
      {aberto && <Mapa fechar={() => setAberto(false)} />}
    </>
  );
}

function Mapa({ fechar }: { fechar: () => void }) {
  const d = useDados();
  const h = hoje();
  const [filtro, setFiltro] = useState<Filtro>("atrasadas");
  const [agrupar, setAgrupar] = useState<Agrupar>("cliente");
  const [resp, setResp] = useState<string>("todos");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState<number | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [larg, setLarg] = useState(1200);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLarg(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const abertas = d.tarefas.filter((t) => !t.triagem && STATUS_ABERTOS.includes(t.status) && (resp === "todos" || (resp === "sem" ? !t.responsavel_id : t.responsavel_id === resp)));
  const passa = (t: Tarefa) => filtro === "todas" ? true : filtro === "atrasadas" ? atrasada(t) : filtro === "hoje" ? t.prazo === h || atrasada(t) : Boolean(t.prazo && t.prazo <= somarDias(h, 6));
  const lista = abertas.filter(passa).sort(comparador("data"));
  const conta = (f: Filtro) => abertas.filter((t) => (f === "todas" ? true : f === "atrasadas" ? atrasada(t) : f === "hoje" ? t.prazo === h || atrasada(t) : Boolean(t.prazo && t.prazo <= somarDias(h, 6)))).length;

  const grupos: Grupo[] = useMemo(() => {
    const m = new Map<string, Grupo>();
    for (const t of lista) {
      const id = agrupar === "cliente" ? t.cliente_id : t.pilar;
      const nome = agrupar === "cliente" ? d.cliente(t.cliente_id)?.nome ?? "Sem cliente" : PILAR[t.pilar as Pilar];
      const cor = agrupar === "cliente" ? corDoNome(nome) : COR_PILAR[t.pilar as Pilar];
      const g = m.get(id) ?? { id, nome, cor, tarefas: [], atrasadas: 0 };
      g.tarefas.push(t);
      if (atrasada(t)) g.atrasadas++;
      m.set(id, g);
    }
    return [...m.values()].sort((a, b) => b.atrasadas - a.atrasadas || b.tarefas.length - a.tarefas.length);
  }, [lista, agrupar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Layout: ramos divididos entre direita e esquerda, equilibrando a altura
  const lay = useMemo(() => {
    const alt = (g: Grupo) => {
      const n = expandidos.has(g.id) ? g.tarefas.length : Math.min(g.tarefas.length, LIMITE) + (g.tarefas.length > LIMITE ? 1 : 0);
      return Math.max(1, n) * LINHA + 22;
    };
    const lados: { g: Grupo; h: number }[][] = [[], []];
    const soma = [0, 0];
    for (const g of grupos) { const i = soma[0] <= soma[1] ? 0 : 1; lados[i].push({ g, h: alt(g) }); soma[i] += alt(g); }
    const H = Math.max(360, ...soma) + 60;
    const W = 2 * (TX + TW) + 40;
    const cx = W / 2, cy = H / 2;
    const ramos = lados.flatMap((lado, li) => {
      let y = (H - soma[li]) / 2;
      const s = li === 0 ? 1 : -1;
      return lado.map(({ g, h: hh }) => {
        const gy = y + hh / 2;
        const vis = expandidos.has(g.id) ? g.tarefas : g.tarefas.slice(0, LIMITE);
        const extra = g.tarefas.length - vis.length;
        const n = vis.length + (extra > 0 ? 1 : 0);
        const t0 = gy - ((n - 1) * LINHA) / 2;
        const itens = vis.map((t, k) => ({ t, x: cx + s * TX, y: t0 + k * LINHA }));
        const mais = extra > 0 ? { n: extra, x: cx + s * TX, y: t0 + vis.length * LINHA } : null;
        y += hh;
        return { g, s, gx: cx + s * GX, gy, itens, mais };
      });
    });
    return { W, H, cx, cy, ramos };
  }, [grupos, expandidos]);

  const escala = zoom ?? Math.min(1, Math.max(0.45, (larg - 24) / lay.W));
  const curva = (x1: number, y1: number, x2: number, y2: number) => { const mx = (x1 + x2) / 2; return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; };
  const membros = d.membros;

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-[#060b24] text-white anim-entrar" role="dialog" aria-label="Mapa de pendências">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "radial-gradient(rgba(120,150,255,0.25) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 50%, rgba(39,71,214,0.22), transparent 70%)" }} />

      <header className="relative flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10"><Network size={16} /></span>
        <div className="mr-2">
          <h2 className="text-[15px] font-semibold leading-tight">Mapa de pendências</h2>
          <p className="text-[11.5px] text-white/50">{lista.length} tarefa{lista.length === 1 ? "" : "s"} · {grupos.length} {agrupar === "cliente" ? "clientes" : "categorias"}</p>
        </div>
        <Seg valor={filtro} mudar={setFiltro} opcoes={[["atrasadas", `Atrasadas ${conta("atrasadas")}`], ["hoje", `Até hoje ${conta("hoje")}`], ["semana", `7 dias ${conta("semana")}`], ["todas", `Todas ${conta("todas")}`]]} />
        <Seg valor={agrupar} mudar={setAgrupar} opcoes={[["cliente", "Clientes"], ["pilar", "Categorias"]]} />
        <select value={resp} onChange={(e) => setResp(e.target.value)} className="h-8 rounded-lg border border-white/15 bg-white/5 px-2 text-[12px] text-white outline-none [&>option]:text-black">
          <option value="todos">Todo o time</option>
          {d.eu && <option value={d.eu}>Só as minhas</option>}
          {membros.filter((m) => m.id !== d.eu).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          <option value="sem">Sem responsável</option>
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom(Math.max(0.35, escala - 0.1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Diminuir"><Minus size={14} /></button>
          <button onClick={() => setZoom(null)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Ajustar à tela" title="Ajustar à tela"><Maximize2 size={14} /></button>
          <button onClick={() => setZoom(Math.min(1.6, escala + 0.1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Aumentar"><Plus size={14} /></button>
          <button onClick={fechar} className="ml-1 grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Fechar"><X size={16} /></button>
        </div>
      </header>

      <div ref={caixa} className="relative min-h-0 flex-1 overflow-auto">
        {lista.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-white/60">
            <div><div className="text-[40px]">✨</div><p className="mt-2 text-[14px]">Nada pendente com esse filtro.</p></div>
          </div>
        ) : (
          <div className="flex min-h-full items-center justify-center"><div style={{ width: lay.W * escala, height: lay.H * escala }}>
            <div className="relative origin-top-left" style={{ width: lay.W, height: lay.H, transform: `scale(${escala})` }}>
              <svg className="absolute inset-0" width={lay.W} height={lay.H} aria-hidden>
                <defs>
                  <filter id="brilho" filterUnits="userSpaceOnUse" x={0} y={0} width={lay.W} height={lay.H}><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                {lay.ramos.map((r) => (
                  <g key={r.g.id} stroke={r.g.cor} fill="none">
                    <path d={curva(lay.cx + r.s * 70, lay.cy, r.gx - r.s * 88, r.gy)} strokeWidth={2.2} strokeOpacity={0.85} filter="url(#brilho)" />
                    {[...r.itens, ...(r.mais ? [r.mais] : [])].map((it, k) => (
                      <path key={k} d={curva(r.gx + r.s * 88, r.gy, r.s > 0 ? it.x : it.x, it.y)} strokeWidth={1.2} strokeOpacity={0.45} />
                    ))}
                  </g>
                ))}
              </svg>

              {/* Centro */}
              <div className="absolute grid h-[76px] w-[140px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-white/20 bg-[linear-gradient(135deg,#0e1a52,#2747d6)] text-center shadow-[0_0_40px_-6px_rgba(39,71,214,0.9)]" style={{ left: lay.cx, top: lay.cy }}>
                <div>
                  <div className="num text-[24px] font-semibold leading-none">{lista.length}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/70">{filtro === "atrasadas" ? "atrasadas" : "pendências"}</div>
                </div>
              </div>

              {lay.ramos.map((r) => (
                <div key={r.g.id}>
                  <div className="absolute flex h-9 w-[176px] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border bg-[#0b1440]/90 px-2.5 backdrop-blur" style={{ left: r.gx, top: r.gy, borderColor: `${r.g.cor}aa`, boxShadow: `0 0 18px -6px ${r.g.cor}` }} title={r.g.nome}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.g.cor }} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{r.g.nome}</span>
                    <span className="num shrink-0 text-[11px] text-white/60">{r.g.tarefas.length}</span>
                    {r.g.atrasadas > 0 && filtro !== "atrasadas" && <span className="num shrink-0 rounded bg-bad/80 px-1 text-[10px]">{r.g.atrasadas}</span>}
                  </div>
                  {r.itens.map(({ t, x, y }) => {
                    const atraso = atrasada(t);
                    const responsavel = d.membro(t.responsavel_id)?.nome;
                    return (
                      <button key={t.id} onClick={() => abrirTarefaGlobal(t.id)} title={`${t.titulo}${responsavel ? ` · ${responsavel}` : ""}`}
                        className="absolute flex h-[24px] -translate-y-1/2 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-left text-[11.5px] transition hover:border-white/40 hover:bg-white/10"
                        style={{ left: r.s > 0 ? x : x - TW, top: y, width: TW, flexDirection: r.s > 0 ? "row" : "row-reverse" }}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${atraso ? "bg-[#ff5a6a] shadow-[0_0_8px_#ff5a6a]" : t.prazo === h ? "bg-[#f2b33d]" : "bg-white/40"}`} />
                        <span className={`min-w-0 flex-1 truncate ${r.s > 0 ? "" : "text-right"}`}>{t.titulo}</span>
                        {agrupar === "pilar" && <span className="max-w-[70px] shrink-0 truncate text-[10px] text-white/40">{d.cliente(t.cliente_id)?.nome}</span>}
                        <span className={`num shrink-0 text-[10.5px] ${atraso ? "text-[#ff8a96]" : "text-white/45"}`}>{t.prazo ? dataCurta(t.prazo) : "s/ data"}</span>
                      </button>
                    );
                  })}
                  {r.mais && (
                    <button onClick={() => setExpandidos((s) => new Set(s).add(r.g.id))} className="absolute flex h-[24px] -translate-y-1/2 items-center rounded-lg border border-dashed border-white/20 px-2 text-[11px] text-white/60 hover:border-white/50 hover:text-white"
                      style={{ left: r.s > 0 ? r.mais.x : r.mais.x - 90, top: r.mais.y, width: 90 }}>
                      + {r.mais.n} tarefas
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div></div>
        )}
      </div>
      <footer className="relative flex flex-wrap items-center gap-4 border-t border-white/10 px-4 py-2 text-[11px] text-white/50">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#ff5a6a]" /> atrasada</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#f2b33d]" /> vence hoje</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white/40" /> no prazo</span>
        <span className="ml-auto">Clique numa tarefa para abrir · Esc fecha</span>
      </footer>
    </div>
  );
}

function Seg<T extends string>({ valor, mudar, opcoes }: { valor: T; mudar: (v: T) => void; opcoes: [T, string][] }) {
  return (
    <div className="flex rounded-lg border border-white/15 bg-white/5 p-0.5">
      {opcoes.map(([v, n]) => (
        <button key={v} onClick={() => mudar(v)} className={`rounded-md px-2.5 py-1 text-[12px] transition ${valor === v ? "bg-white text-[#0e1a52] font-semibold" : "text-white/70 hover:text-white"}`}>{n}</button>
      ))}
    </div>
  );
}
