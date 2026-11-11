import { useEffect, useMemo, useRef, useState, type MouseEvent as ME } from "react";
import { BarChart3, Building2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { CADEIRAS, SALAS, SALA_FORA, mobilia, salaEm, useEscritorio, type Pessoa } from "../lib/escritorio";
import { supabase } from "../lib/supabase";
import { useDados } from "../lib/dados";
import { corDoNome } from "../lib/logos";

const W = 1600, H = 900;
const iniciais = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const nomeSala = (id: string) => SALAS.find((s) => s.id === id)?.nome ?? SALA_FORA.nome;
const tempoTxt = (ms: number) => { const m = Math.floor(ms / 60000); return m < 1 ? "agora" : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; };

/** Escritório virtual: mapa da agência, cada pessoa online como avatar; clique para andar, clique numa cadeira para sentar. */
export function Escritorio({ admin }: { admin: boolean }) {
  const { eu, pessoas, conectado, mover } = useEscritorio();
  const [relatorio, setRelatorio] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t); }, []);

  // Prévia sem banco: colegas de exemplo
  const todos = useMemo<Pessoa[]>(() => {
    if (supabase) return pessoas;
    const c1 = CADEIRAS.filter((c) => c.sala === "trafego")[1], c2 = CADEIRAS.filter((c) => c.sala === "operacional")[4];
    return [
    ...pessoas,
    { id: "d1", nome: "Sílvio Junior", x: c1.x, y: c1.y, cadeira: c1.id, sala: "trafego", ausente: false, desde: Date.now() - 42 * 60000 },
    { id: "d2", nome: "Carol", x: c2.x, y: c2.y, cadeira: c2.id, sala: "operacional", ausente: false, desde: Date.now() - 95 * 60000 },
    { id: "d3", nome: "Caroline Tereza", x: 1290, y: 790, cadeira: null, sala: "cafe", ausente: true, desde: Date.now() - 12 * 60000 },
    ];
  }, [pessoas]);
  const ocupadas = new Set(todos.filter((p) => p.id !== eu?.id && p.cadeira).map((p) => p.cadeira));

  const ponto = (e: ME) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  // Teclado: setas / WASD andam
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!eu || (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]")) return;
      const d: Record<string, [number, number]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
      const v = d[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!v) return;
      e.preventDefault();
      mover(Math.max(20, Math.min(W - 20, eu.x + v[0] * 30)), Math.max(20, Math.min(H - 20, eu.y + v[1] * 30)), null);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [eu, mover]);

  const irPara = (salaId: string) => {
    const livre = CADEIRAS.find((c) => c.sala === salaId && !ocupadas.has(c.id));
    const s = SALAS.find((x) => x.id === salaId)!;
    if (livre) mover(livre.x, livre.y, livre.id); else mover(s.x + s.w / 2, s.y + s.h - 30, null);
  };

  const porSala = SALAS.map((s) => ({ s, gente: todos.filter((p) => p.sala === s.id) }));
  const minhaSala = eu ? salaEm(eu.x, eu.y) : null;

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[22px] font-semibold"><Building2 size={20} className="text-accent" /> Escritório virtual</h1>
          <p className="text-[13px] text-muted">Clique no chão para andar ou numa cadeira para sentar. Setas ou W A S D também andam. Sente na sala do que está fazendo agora.</p>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-muted"><span className={`h-2 w-2 rounded-full ${conectado || !supabase ? "bg-ok" : "bg-warn"}`} />{conectado || !supabase ? `${todos.filter((p) => !p.ausente).length} online` : "Conectando…"}</span>
        {admin && <button onClick={() => setRelatorio(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium hover:border-line-forte"><BarChart3 size={14} /> Relatório de tempo</button>}
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-hidden rounded-3xl border border-line bg-[var(--raised)] p-2 sm:p-3">
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" role="img" aria-label="Mapa do escritório" onClick={(e) => { const p = ponto(e); mover(p.x, p.y, null); }}>
            <defs>
              <pattern id="piso" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="var(--surface)" /><path d="M40 0H0V40" fill="none" stroke="var(--line)" strokeWidth="1" opacity="0.6" /></pattern>
              <filter id="sombra" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" /></filter>
            </defs>
            <rect width={W} height={H} rx="24" fill="url(#piso)" />
            {SALAS.map((s) => {
              const { moveis } = mobilia(s);
              const aqui = minhaSala?.id === s.id;
              return (
                <g key={s.id}>
                  <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="18" fill={s.cor} opacity={aqui ? 0.2 : 0.11} />
                  <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="18" fill="none" stroke={s.cor} strokeOpacity={aqui ? 0.9 : 0.45} strokeWidth={aqui ? 3 : 2} />
                  {/* porta */}
                  <rect x={s.x + s.w / 2 - 34} y={s.y > 600 ? s.y - 2 : s.y + s.h - 2} width="68" height="4" rx="2" fill="var(--surface)" />
                  <text x={s.x + 18} y={s.y + 34} fontSize="22" fontWeight="600" fill="var(--fg)">{s.icone} {s.nome}</text>
                  {moveis.map((m, i) =>
                    m.tipo === "planta" ? <text key={i} x={m.x} y={m.y + 28} fontSize="30">🪴</text> :
                    <rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} rx={m.tipo === "mesa_redonda" ? m.w / 2 : m.tipo === "sofa" ? 16 : 8} fill="var(--surface)" stroke={s.cor} strokeOpacity="0.45" strokeWidth="2" filter="url(#sombra)" />,
                  )}
                  {mobilia(s).moveis.filter((m) => m.tipo === "mesa").map((m, i) => <rect key={`pc${i}`} x={m.x + m.w / 2 - 14} y={m.y + 8} width="28" height="18" rx="3" fill={s.cor} opacity="0.35" />)}
                </g>
              );
            })}
            {CADEIRAS.map((c) => {
              const ocup = ocupadas.has(c.id), minha = eu?.cadeira === c.id;
              const cor = SALAS.find((s) => s.id === c.sala)!.cor;
              return (
                <g key={c.id} className={ocup ? "" : "cursor-pointer"} onClick={(e) => { e.stopPropagation(); if (!ocup) mover(c.x, c.y, c.id); }}>
                  <circle cx={c.x} cy={c.y} r="17" fill={minha ? cor : "var(--surface)"} fillOpacity={minha ? 0.25 : 1} stroke={cor} strokeOpacity="0.6" strokeWidth="2" strokeDasharray={ocup ? "0" : "4 3"} />
                  <title>{ocup ? "Ocupada" : `Sentar · ${nomeSala(c.sala)}`}</title>
                </g>
              );
            })}
            {todos.map((p) => {
              const euMesmo = p.id === eu?.id;
              const cor = corDoNome(p.nome);
              return (
                <g key={p.id} style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: "transform 0.7s cubic-bezier(.3,.7,.3,1)" }} opacity={p.ausente ? 0.55 : 1} pointerEvents="none">
                  {euMesmo && <circle r="30" fill="none" stroke="var(--accent)" strokeWidth="3" opacity="0.5"><animate attributeName="r" values="26;34;26" dur="2.4s" repeatCount="indefinite" /></circle>}
                  <circle r="22" fill={cor} stroke="var(--surface)" strokeWidth="4" filter="url(#sombra)" />
                  <text y="7" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">{iniciais(p.nome)}</text>
                  <circle cx="16" cy="-16" r="6" fill={p.ausente ? "#d4a72c" : "#22c55e"} stroke="var(--surface)" strokeWidth="2.5" />
                  <g transform="translate(0, 44)">
                    <rect x={-(p.nome.split(" ")[0].length * 6.6 + 14)} y="-14" width={p.nome.split(" ")[0].length * 13.2 + 28} height="24" rx="12" fill="var(--fg)" opacity="0.85" />
                    <text y="3" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--bg)">{p.nome.split(" ")[0]}{euMesmo ? " (você)" : ""}</text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        <aside className="flex flex-col gap-3">
          {eu && (
            <div className="rounded-2xl border border-line bg-surface p-3">
              <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">Você está em</div>
              <div className="mt-0.5 text-[16px] font-semibold">{minhaSala ? `${minhaSala.icone} ${minhaSala.nome}` : SALA_FORA.nome}</div>
              <div className="text-[12px] text-muted">{eu.cadeira ? "Sentado" : "Em pé"} · há {tempoTxt(agora - eu.desde)}</div>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-surface p-2">
            <div className="px-2 pb-1 pt-1 text-[12.5px] font-semibold text-muted">Salas</div>
            {porSala.map(({ s, gente }) => (
              <button key={s.id} onClick={() => irPara(s.id)} className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] hover:bg-raised ${minhaSala?.id === s.id ? "bg-raised" : ""}`} title={`Ir para ${s.nome}`}>
                <span className="grid h-7 w-7 place-items-center rounded-lg text-[14px]" style={{ background: `${s.cor}22` }}>{s.icone}</span>
                <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                <span className="flex -space-x-1.5">
                  {gente.slice(0, 4).map((p) => <span key={p.id} title={p.nome} className="grid h-5 w-5 place-items-center rounded-full border-2 border-surface text-[8px] font-bold text-white" style={{ background: corDoNome(p.nome), opacity: p.ausente ? 0.55 : 1 }}>{iniciais(p.nome)}</span>)}
                </span>
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-3">
            <div className="pb-1 text-[12.5px] font-semibold text-muted">Online agora</div>
            {todos.length === 0 && <p className="text-[12.5px] text-muted">Ninguém por aqui.</p>}
            {todos.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1 text-[13px]">
                <span className={`h-2 w-2 rounded-full ${p.ausente ? "bg-[#d4a72c]" : "bg-ok"}`} />
                <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                <span className="shrink-0 text-[11.5px] text-muted">{p.ausente ? "ausente" : nomeSala(p.sala)}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
      {relatorio && <Relatorio fechar={() => setRelatorio(false)} />}
    </div>
  );
}

function Relatorio({ fechar }: { fechar: () => void }) {
  const d = useDados();
  const [dias, setDias] = useState(7);
  const [linhas, setLinhas] = useState<{ membro_id: string; dia: string; sala: string; segundos: number }[] | null>(null);
  useEffect(() => {
    const hoje = new Date(Date.now() - 3 * 3600_000);
    const de = new Date(hoje.getTime() - (dias - 1) * 86400000).toISOString().slice(0, 10);
    if (!supabase) return setLinhas([{ membro_id: "x", dia: de, sala: "trafego", segundos: 14400 }, { membro_id: "x", dia: de, sala: "reuniao", segundos: 5400 }, { membro_id: "y", dia: de, sala: "comercial", segundos: 9000 }]);
    supabase.from("escritorio_tempo").select("membro_id, dia, sala, segundos").gte("dia", de).then(({ data }) => setLinhas((data ?? []) as NonNullable<typeof linhas>));
  }, [dias]);
  const pessoas = [...new Set((linhas ?? []).map((l) => l.membro_id))];
  const salas = SALAS.map((s) => s.id).concat(SALA_FORA.id).filter((s) => (linhas ?? []).some((l) => l.sala === s));
  const soma = (m: string, s?: string) => (linhas ?? []).filter((l) => l.membro_id === m && (!s || l.sala === s)).reduce((x, l) => x + l.segundos, 0);
  const h = (seg: number) => (seg ? `${Math.floor(seg / 3600)}h${String(Math.round((seg % 3600) / 60)).padStart(2, "0")}` : "—");
  const nome = (id: string) => d.membro?.(id)?.nome ?? d.membros.find((m) => m.id === id)?.nome ?? (supabase ? "Ex-membro" : id === "x" ? "Sílvio" : "Rener");
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4 text-fg">
      <div className="absolute inset-0 bg-[rgb(12_14_20/0.35)] backdrop-blur-[2px]" onClick={fechar} />
      <section role="dialog" aria-modal="true" aria-label="Relatório de tempo" className="relative flex max-h-[90dvh] w-full max-w-[860px] flex-col gap-3 overflow-auto rounded-2xl border border-line bg-surface p-5" style={{ boxShadow: "var(--sombra-flutuante)" }}>
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-semibold">Tempo por sala</h2>
          <div role="tablist" className="ml-auto flex">
            {[[1, "Hoje"], [7, "7 dias"], [30, "30 dias"]].map(([n, t]) => <button key={n} role="tab" aria-selected={dias === n} onClick={() => setDias(n as number)} className="rounded-md px-2.5 py-1 text-[12.5px]">{t}</button>)}
          </div>
          <button onClick={fechar} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised" aria-label="Fechar"><X size={16} /></button>
        </div>
        <p className="text-[12px] text-muted">Conta o tempo com o sistema aberto em cada sala. Depois de 10 minutos sem mexer, a pessoa fica ausente e o tempo para de contar. Só os sócios veem este relatório.</p>
        {linhas === null ? <p className="text-[13px] text-muted">Carregando…</p> : pessoas.length === 0 ? <p className="text-[13px] text-muted">Ainda sem tempo registrado no período.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr><th className="py-2 pr-3 text-left">Pessoa</th>{salas.map((s) => <th key={s} className="px-2 py-2 text-right">{nomeSala(s)}</th>)}<th className="py-2 pl-2 text-right">Total</th></tr></thead>
              <tbody>
                {pessoas.sort((a, b) => soma(b) - soma(a)).map((m) => (
                  <tr key={m} className="border-t border-line">
                    <td className="py-2 pr-3 font-medium">{nome(m)}</td>
                    {salas.map((s) => <td key={s} className="num px-2 py-2 text-right">{h(soma(m, s))}</td>)}
                    <td className="num py-2 pl-2 text-right font-semibold">{h(soma(m))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
