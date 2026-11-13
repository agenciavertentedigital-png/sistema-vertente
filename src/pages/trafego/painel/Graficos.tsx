import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, BarChart3, Check, Pencil, Plus, X } from "lucide-react";
import { formatar, type Formato } from "../../../lib/painel";

export interface Serie { nome: string; cor: string; valores: (number | null)[]; /** só no tipo "combo": esta série vira linha no eixo da direita */ linha?: boolean; fmt?: Formato }

/** Caminho suave (curva monotônica): não passa do valor real entre dois pontos. */
export function caminhoSuave(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  const n = pts.length;
  const dx = (i: number) => pts[i + 1][0] - pts[i][0];
  const m = pts.slice(0, -1).map((p, i) => (pts[i + 1][1] - p[1]) / (dx(i) || 1));
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx(i) / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/** Máximo "redondo" para o eixo (1, 2, 2,5 ou 5 × 10ⁿ). */
function tetoBonito(v: number) {
  if (!(v > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}

function useLargura(inicial = 680) {
  const caixa = useRef<HTMLDivElement>(null);
  const [L, setL] = useState(inicial);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setL(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [caixa, L] as const;
}

let seq = 0;

/**
 * Gráfico de séries no tempo (SVG): linha suave, área com degradê, barras (lado a lado ou empilhadas)
 * ou combinação barras + linha com dois eixos. Ao passar o mouse mostra um cartão com os valores do dia.
 */
export function GraficoSeries({ rotulos, series, tipo = "area", fmt = "int", altura = 230 }: { rotulos: string[]; series: Serie[]; tipo?: "linha" | "area" | "barras" | "empilhado" | "combo"; fmt?: Formato; altura?: number }) {
  const [foco, setFoco] = useState<number | null>(null);
  const [caixa, L] = useLargura();
  const [uid] = useState(() => `g${++seq}`);
  if (!rotulos.length || !series.length || series.every((s) => s.valores.every((v) => !v))) return <div ref={caixa} className="grid h-[160px] place-items-center rounded-xl bg-raised/50 text-[12.5px] text-muted">Sem dados no período.</div>;
  const combo = tipo === "combo";
  const barrasS = combo ? series.filter((s) => !s.linha) : tipo === "barras" || tipo === "empilhado" ? series : [];
  const linhasS = combo ? series.filter((s) => s.linha) : tipo === "linha" || tipo === "area" ? series : [];
  const fmtDir = linhasS[0]?.fmt ?? "int";
  const M = { t: 14, r: combo ? 48 : 14, b: 28, l: fmt === "brl" ? 66 : 44 };
  const w = L - M.l - M.r;
  const h = altura - M.t - M.b;
  const n = rotulos.length;
  const somaDia = (i: number, ss: Serie[]) => ss.reduce((a, x) => a + (x.valores[i] ?? 0), 0);
  const empilhaBarras = tipo === "empilhado" || (combo && barrasS.length > 1);
  const maxEsq = tetoBonito(Math.max(1e-9, ...(empilhaBarras ? rotulos.map((_, i) => somaDia(i, barrasS)) : (combo ? barrasS : series).flatMap((s) => s.valores.map((v) => v ?? 0)))));
  const maxDir = combo ? tetoBonito(Math.max(1e-9, ...linhasS.flatMap((s) => s.valores.map((v) => v ?? 0)))) : maxEsq;
  const yE = (v: number) => M.t + h - (v / maxEsq) * h;
  const yD = (v: number) => M.t + h - (v / maxDir) * h;
  const bw = w / n;
  const xC = (i: number) => M.l + bw * i + bw / 2;
  const passo = Math.ceil(n / Math.max(3, Math.floor(w / 70)));
  const curto = (v: number, f: Formato) => (f === "brl" && v >= 1000 ? `R$${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : f === "brl" ? `R$${Math.round(v)}` : formatar(v, f === "pct" ? "pct" : "int"));
  const larguraCartao = 224;
  const xCartao = foco === null ? 0 : Math.min(Math.max(xC(foco) + 14, M.l), L - larguraCartao - 4) - (xC(foco) + 14 + larguraCartao > L ? larguraCartao + 28 : 0);
  return (
    <div ref={caixa} className="relative flex select-none flex-col gap-2" onMouseLeave={() => setFoco(null)}>
      <svg viewBox={`0 0 ${L} ${altura}`} className="h-auto w-full">
        <defs>
          {series.map((s, k) => (
            <linearGradient key={k} id={`${uid}-a${k}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.cor} stopOpacity={tipo === "area" ? 0.28 : 0.9} />
              <stop offset="100%" stopColor={s.cor} stopOpacity={tipo === "area" ? 0.01 : 0.55} />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((p) => (
          <g key={p}>
            <line x1={M.l} x2={L - M.r} y1={M.t + h * (1 - p)} y2={M.t + h * (1 - p)} stroke="var(--line)" strokeDasharray={p ? "2 5" : undefined} />
            <text x={M.l - 8} y={M.t + h * (1 - p) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--muted)">{curto(maxEsq * p, combo ? barrasS[0]?.fmt ?? fmt : fmt)}</text>
            {combo && <text x={L - M.r + 8} y={M.t + h * (1 - p) + 3.5} fontSize="10.5" fill={linhasS[0]?.cor ?? "var(--muted)"}>{curto(maxDir * p, fmtDir)}</text>}
          </g>
        ))}
        {rotulos.map((r, i) => (i % passo === 0 ? <text key={i} x={xC(i)} y={altura - 8} textAnchor="middle" fontSize="10.5" fill="var(--muted)">{r}</text> : null))}

        {/* barras */}
        {barrasS.length > 0 &&
          rotulos.map((_, i) => {
            let base = 0;
            const empilha = tipo === "empilhado" || (combo && barrasS.length > 1);
            const larg = Math.min(28, empilha ? bw * 0.62 : (bw * 0.72) / barrasS.length);
            const x0 = xC(i) - (empilha ? larg / 2 : (larg * barrasS.length) / 2);
            return (
              <g key={i} opacity={foco === null || foco === i ? 1 : 0.45}>
                {barrasS.map((s, k) => {
                  const v = s.valores[i] ?? 0;
                  const kk = series.indexOf(s);
                  if (empilha) {
                    const topo = k === barrasS.length - 1;
                    const r = <rect key={k} x={x0} y={yE(base + v)} width={larg} height={Math.max(0, yE(base) - yE(base + v))} fill={`url(#${uid}-a${kk})`} rx={topo ? 3 : 0} />;
                    base += v;
                    return r;
                  }
                  return <rect key={k} x={x0 + larg * k} y={yE(v)} width={Math.max(1, larg - 2)} height={Math.max(0, M.t + h - yE(v))} fill={`url(#${uid}-a${kk})`} rx={3} />;
                })}
              </g>
            );
          })}

        {/* linhas e áreas */}
        {linhasS.map((s) => {
          const kk = series.indexOf(s);
          const y = combo ? yD : yE;
          const segs: [number, number][][] = [[]];
          s.valores.forEach((v, i) => (v === null ? segs.push([]) : segs[segs.length - 1].push([xC(i), y(v)])));
          return (
            <g key={s.nome}>
              {segs.filter((sg) => sg.length).map((sg, k) => (
                <g key={k}>
                  {tipo === "area" && sg.length > 1 && <path d={`${caminhoSuave(sg)} L${sg[sg.length - 1][0]},${M.t + h} L${sg[0][0]},${M.t + h} Z`} fill={`url(#${uid}-a${kk})`} />}
                  <path d={caminhoSuave(sg)} fill="none" stroke={s.cor} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              ))}
              {foco !== null && s.valores[foco] !== null && (
                <g>
                  <circle cx={xC(foco)} cy={y(s.valores[foco]!)} r={8} fill={s.cor} opacity={0.18} />
                  <circle cx={xC(foco)} cy={y(s.valores[foco]!)} r={4} fill="var(--surface)" stroke={s.cor} strokeWidth={2.4} />
                </g>
              )}
            </g>
          );
        })}
        {foco !== null && <line x1={xC(foco)} x2={xC(foco)} y1={M.t} y2={M.t + h} stroke="var(--line-forte)" />}
        {rotulos.map((_, i) => <rect key={i} x={M.l + bw * i} y={0} width={bw} height={M.t + h} fill="transparent" onMouseEnter={() => setFoco(i)} onTouchStart={() => setFoco(i)} />)}
      </svg>
      {foco !== null && (
        <div className="pointer-events-none absolute top-1 z-10 rounded-xl border border-line bg-surface/95 px-3 py-2 text-[12px] shadow-[var(--sombra-flutuante)] backdrop-blur" style={{ left: xCartao, width: larguraCartao }}>
          <div className="mb-1 font-semibold">{rotulos[foco]}</div>
          {series.map((s) => (
            <div key={s.nome} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.cor }} />
              <span className="min-w-0 flex-1 truncate text-muted">{s.nome}</span>
              <b className="num">{formatar(s.valores[foco], s.fmt ?? (s.linha ? fmtDir : fmt))}</b>
            </div>
          ))}
          {tipo === "empilhado" && series.length > 1 && <div className="mt-1 flex justify-between border-t border-line pt-1"><span className="text-muted">Total</span><b className="num">{formatar(somaDia(foco, series), fmt)}</b></div>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
        {series.map((s) => (
          <span key={s.nome} className="inline-flex items-center gap-1.5">
            <span className={s.linha || tipo === "linha" || tipo === "area" ? "h-[3px] w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"} style={{ background: s.cor }} /> {s.nome}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Minigráfico da tendência (para os cartões de métrica). */
export function Sparkline({ valores, cor = "var(--accent)", altura = 34, inverso }: { valores: (number | null)[]; cor?: string; altura?: number; inverso?: boolean }) {
  const [uid] = useState(() => `s${++seq}`);
  const v = valores.map((x) => (x === null || !isFinite(x) ? null : x));
  const nums = v.filter((x): x is number => x !== null);
  if (nums.length < 2) return <div style={{ height: altura }} />;
  const W = 120, pad = 2;
  const min = Math.min(...nums), max = Math.max(...nums);
  const amp = max - min || 1;
  const pts: [number, number][] = [];
  v.forEach((x, i) => { if (x !== null) pts.push([(i / (v.length - 1)) * W, pad + (altura - 2 * pad) * (1 - (x - min) / amp)]); });
  const inicio = nums.slice(0, Math.max(1, Math.floor(nums.length / 3))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(nums.length / 3));
  const fim = nums.slice(-Math.max(1, Math.floor(nums.length / 3))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(nums.length / 3));
  const subiu = fim >= inicio;
  const c = cor === "auto" ? ((inverso ? !subiu : subiu) ? "var(--ok)" : "var(--bad)") : cor;
  const d = caminhoSuave(pts);
  return (
    <svg viewBox={`0 0 ${W} ${altura}`} preserveAspectRatio="none" className="w-full" style={{ height: altura }} aria-hidden>
      <defs>
        <linearGradient id={uid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity={0.25} /><stop offset="100%" stopColor={c} stopOpacity={0} /></linearGradient>
      </defs>
      <path d={`${d} L${pts[pts.length - 1][0]},${altura} L${pts[0][0]},${altura} Z`} fill={`url(#${uid})`} />
      <path d={d} fill="none" stroke={c} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

/** Rosca com o total no meio (ex.: divisão do investimento entre Meta e Google). */
export function Rosca({ partes, rotuloCentro, valorCentro, tamanho = 150 }: { partes: { nome: string; valor: number; cor: string }[]; rotuloCentro?: string; valorCentro?: string; tamanho?: number }) {
  const total = partes.reduce((a, p) => a + Math.max(0, p.valor), 0);
  const r = 42, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" style={{ width: tamanho, height: tamanho }} className="shrink-0">
        <g transform="rotate(-90 50 50)">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--raised)" strokeWidth="12" />
        {total > 0 && partes.map((p) => {
          const f = Math.max(0, p.valor) / total;
          const el = <circle key={p.nome} cx="50" cy="50" r={r} fill="none" stroke={p.cor} strokeWidth="12" strokeDasharray={`${Math.max(0, f * C - (partes.length > 1 ? 1.2 : 0))} ${C}`} strokeDashoffset={-acc * C} strokeLinecap="butt" />;
          acc += f;
          return el;
        })}
        </g>
        <g>
          {valorCentro && <text x="50" y={rotuloCentro ? 49 : 54} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--fg)">{valorCentro}</text>}
          {rotuloCentro && <text x="50" y="61" textAnchor="middle" fontSize="7.5" fill="var(--muted)">{rotuloCentro}</text>}
        </g>
      </svg>
      <ul className="flex min-w-0 flex-col gap-1.5 text-[12.5px]">
        {partes.map((p) => (
          <li key={p.nome} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.cor }} />
            <span className="min-w-0 flex-1 truncate">{p.nome}</span>
            <b className="num">{total ? `${Math.round((Math.max(0, p.valor) / total) * 100)}%` : "—"}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface DefGrafico { id: string; nome: string; descricao: string; largo?: boolean; render: () => ReactNode }

/** Área de gráficos personalizável: escolher quais aparecem e em que ordem. */
export function PainelGraficos({ titulo, catalogo, ids, salvar }: { titulo: string; catalogo: DefGrafico[]; ids: string[]; salvar: (ids: string[]) => Promise<void> }) {
  const [editando, setEditando] = useState(false);
  const porId = new Map(catalogo.map((g) => [g.id, g]));
  const ativos = ids.filter((id) => porId.has(id));
  const fora = catalogo.filter((g) => !ativos.includes(g.id));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= ativos.length) return;
    const nova = [...ativos];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    salvar(nova);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><BarChart3 size={16} className="text-muted" /> {titulo}</h2>
        <button onClick={() => setEditando(!editando)} className={`ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] ${editando ? "bg-accent font-medium text-accent-fg" : "border border-line text-muted hover:text-fg"}`}>
          {editando ? <><Check size={14} /> Pronto</> : <><Pencil size={13} /> Gráficos</>}
        </button>
      </div>
      {editando && fora.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-dashed border-accent/40 p-2">
          <span className="self-center px-1 text-[12px] text-muted">Adicionar:</span>
          {fora.map((g) => (
            <button key={g.id} onClick={() => salvar([...ativos, g.id])} title={g.descricao} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12px] hover:border-accent hover:text-accent"><Plus size={12} /> {g.nome}</button>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {ativos.map((id, i) => {
          const g = porId.get(id)!;
          return (
            <section key={id} className={`flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 ${g.largo ? "lg:col-span-2" : ""}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold">{g.nome}</h3>
                  <p className="text-[12px] text-muted">{g.descricao}</p>
                </div>
                {editando && (
                  <div className="flex gap-0.5">
                    <button onClick={() => mover(i, -1)} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-raised" aria-label="Subir"><ArrowUp size={13} /></button>
                    <button onClick={() => mover(i, 1)} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-raised" aria-label="Descer"><ArrowDown size={13} /></button>
                    <button onClick={() => salvar(ativos.filter((x) => x !== id))} className="grid h-7 w-7 place-items-center rounded-lg text-bad hover:bg-bad-soft" aria-label="Remover gráfico"><X size={13} /></button>
                  </div>
                )}
              </div>
              {g.render()}
            </section>
          );
        })}
      </div>
      {ativos.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">Nenhum gráfico. Clique em "Gráficos" para escolher.</p>}
    </div>
  );
}
