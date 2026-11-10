import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, BarChart3, Check, Pencil, Plus, X } from "lucide-react";
import { formatar, type Formato } from "../../../lib/painel";

export interface Serie { nome: string; cor: string; valores: (number | null)[] }

/** Gráfico de linhas ou barras (empilhadas ou lado a lado) em SVG, com leitura ao passar o mouse. */
export function GraficoSeries({ rotulos, series, tipo = "linha", fmt = "int", altura = 220 }: { rotulos: string[]; series: Serie[]; tipo?: "linha" | "barras" | "empilhado"; fmt?: Formato; altura?: number }) {
  const [foco, setFoco] = useState<number | null>(null);
  // O desenho usa a largura real do cartão: as letras ficam sempre do mesmo tamanho
  const caixa = useRef<HTMLDivElement>(null);
  const [L, setL] = useState(680);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setL(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!rotulos.length || !series.length) return <p className="py-6 text-center text-[12.5px] text-muted">Sem dados no período.</p>;
  const M = { t: 12, r: 12, b: 28, l: fmt === "brl" ? 78 : 52 };
  const w = L - M.l - M.r;
  const h = altura - M.t - M.b;
  const n = rotulos.length;
  const max = Math.max(
    1e-9,
    ...(tipo === "empilhado" ? rotulos.map((_, i) => series.reduce((s, x) => s + (x.valores[i] ?? 0), 0)) : series.flatMap((s) => s.valores.map((v) => v ?? 0))),
  );
  const y = (v: number) => M.t + h - (v / max) * h;
  const bw = w / n;
  const xC = (i: number) => M.l + bw * i + bw / 2;
  const passo = Math.ceil(n / Math.max(4, Math.floor(w / 64)));
  return (
    <div ref={caixa} className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${L} ${altura}`} className="h-auto w-full" onMouseLeave={() => setFoco(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line x1={M.l} x2={L - M.r} y1={M.t + h * (1 - p)} y2={M.t + h * (1 - p)} stroke="var(--line)" strokeDasharray={p ? "3 4" : undefined} />
            <text x={M.l - 6} y={M.t + h * (1 - p) + 3} textAnchor="end" fontSize="11" fill="var(--muted)">{formatar(max * p, fmt === "pct" ? "pct" : fmt === "brl" ? "brl" : "int")}</text>
          </g>
        ))}
        {rotulos.map((r, i) => (i % passo === 0 ? <text key={i} x={xC(i)} y={altura - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{r}</text> : null))}
        {tipo === "linha" &&
          series.map((s) => {
            const pts = s.valores.map((v, i) => (v === null ? null : `${xC(i)},${y(v)}`));
            const segs: string[][] = [[]];
            pts.forEach((p) => (p ? segs[segs.length - 1].push(p) : segs.push([])));
            return (
              <g key={s.nome}>
                {segs.filter((sg) => sg.length).map((sg, k) => <polyline key={k} points={sg.join(" ")} fill="none" stroke={s.cor} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />)}
                {n <= 40 && s.valores.map((v, i) => (v === null ? null : <circle key={i} cx={xC(i)} cy={y(v)} r={foco === i ? 4 : 2.6} fill={s.cor} />))}
              </g>
            );
          })}
        {tipo !== "linha" &&
          rotulos.map((_, i) => {
            let base = 0;
            const larg = tipo === "empilhado" ? bw * 0.62 : (bw * 0.75) / series.length;
            return (
              <g key={i}>
                {series.map((s, k) => {
                  const v = s.valores[i] ?? 0;
                  if (tipo === "empilhado") {
                    const r = <rect key={k} x={xC(i) - larg / 2} y={y(base + v)} width={larg} height={Math.max(0, y(base) - y(base + v))} fill={s.cor} rx={k === series.length - 1 ? 2 : 0} opacity={foco === null || foco === i ? 0.9 : 0.55} />;
                    base += v;
                    return r;
                  }
                  return <rect key={k} x={M.l + bw * i + bw * 0.125 + larg * k} y={y(v)} width={larg - 1} height={Math.max(0, M.t + h - y(v))} fill={s.cor} rx={2} opacity={foco === null || foco === i ? 0.9 : 0.55} />;
                })}
              </g>
            );
          })}
        {foco !== null && <line x1={xC(foco)} x2={xC(foco)} y1={M.t} y2={M.t + h} stroke="var(--muted)" strokeDasharray="2 3" />}
        {rotulos.map((_, i) => <rect key={i} x={M.l + bw * i} y={M.t} width={bw} height={h} fill="transparent" onMouseEnter={() => setFoco(i)} />)}
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        {series.map((s) => (
          <span key={s.nome} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} /> {s.nome}
            {foco !== null && <b className="num">{formatar(s.valores[foco], fmt)}</b>}
          </span>
        ))}
        {foco !== null && <span className="ml-auto text-muted">{rotulos[foco]}</span>}
      </div>
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
