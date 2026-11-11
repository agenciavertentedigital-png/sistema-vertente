import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Building2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { SALAS, SALA_FORA, useEscritorio, type Pessoa } from "../lib/escritorio";
import { ASSENTOS, COLS, MAPA, ROWS, SALAS_MAPA, TILE, caminho, salaNoTile, type Lado } from "../lib/escritorioMapa";
import { MOVEIS_CENA, boneco, desenharFundo, desenharMovel, visualDe } from "../lib/escritorioDesenho";
import { supabase } from "../lib/supabase";
import { useDados } from "../lib/dados";

const LARG = COLS * TILE, ALT = ROWS * TILE;
const nomeSala = (id: string) => SALAS.find((s) => s.id === id)?.nome ?? SALA_FORA.nome;
const tempoTxt = (ms: number) => { const m = Math.floor(ms / 60000); return m < 1 ? "agora" : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; };
const PASSO_MS = 150;

interface Ator { x: number; y: number; dir: Lado; andando: boolean; quadro: number; alvo: { x: number; y: number } }

/** Escritório virtual em pixel art: clique para andar, clique numa cadeira para sentar. */
export function Escritorio({ admin }: { admin: boolean }) {
  const { eu, pessoas, conectado, mover } = useEscritorio();
  const [relatorio, setRelatorio] = useState(false);
  const [zoom, setZoom] = useState<number>(() => { try { return Number(localStorage.getItem("vertente.escritorio.zoom")) || 3; } catch { return 3; } });
  const mudarZoom = (z: number) => { setZoom(z); try { localStorage.setItem("vertente.escritorio.zoom", String(z)); } catch { /* */ } };
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const camera = useRef<{ x: number; y: number } | null>(null);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t); }, []);

  // Prévia sem banco: colegas de exemplo sentados
  const todos = useMemo<Pessoa[]>(() => {
    if (supabase) return pessoas;
    const a = (id: string) => ASSENTOS.find((s) => s.id === id)!;
    const s1 = a("trafego-36-5"), s2 = a("operacional-40-18") ?? ASSENTOS.find((s) => s.sala === "operacional")!, s3 = ASSENTOS.find((s) => s.sala === "lounge")!;
    const s4 = ASSENTOS.find((s) => s.sala === "reuniao")!;
    return [
      ...pessoas,
      { id: "d1", nome: "Sílvio Junior", x: s1?.x ?? 36, y: s1?.y ?? 5, dir: "cima", cadeira: s1?.id ?? null, sala: "trafego", ausente: false, desde: Date.now() - 42 * 60000 },
      { id: "d2", nome: "Carol", x: s2.x, y: s2.y, dir: s2.olha, cadeira: s2.id, sala: "operacional", ausente: false, desde: Date.now() - 95 * 60000 },
      { id: "d3", nome: "Caroline Tereza", x: s3.x, y: s3.y, dir: s3.olha, cadeira: s3.id, sala: "cafe", ausente: true, desde: Date.now() - 12 * 60000 },
      { id: "d4", nome: "Marcone", x: s4.x, y: s4.y, dir: s4.olha, cadeira: s4.id, sala: "reuniao", ausente: false, desde: Date.now() - 20 * 60000 },
    ];
  }, [pessoas]);

  // ---------- Canvas ----------
  const caixa = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const fundo = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = LARG; c.height = ALT;
    desenharFundo(c.getContext("2d")!);
    return c;
  }, []);
  const atores = useRef(new Map<string, Ator>());
  const rota = useRef<{ x: number; y: number }[]>([]);
  const destinoCadeira = useRef<string | null>(null);
  const ultimoPasso = useRef(0);
  const passosDesdeAnuncio = useRef(0);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const escala = useRef(1);
  const camRef = useRef({ x: 0, y: 0 });
  const estado = useRef({ todos, eu });
  estado.current = { todos, eu };

  const ocupadas = useMemo(() => new Set(todos.filter((p) => p.id !== eu?.id && p.cadeira).map((p) => p.cadeira)), [todos, eu?.id]);
  const ocupadasRef = useRef(ocupadas);
  ocupadasRef.current = ocupadas;

  // Andar até um tile (e sentar se for cadeira)
  const irPara = (x: number, y: number) => {
    const me = estado.current.eu;
    if (!me) return;
    const assento = ASSENTOS.find((s) => s.x === x && s.y === y);
    if (assento && ocupadasRef.current.has(assento.id)) return;
    if (!assento && MAPA.bloqueado[y]?.[x] !== false) return;
    const a = atores.current.get(me.id);
    const de = { x: Math.round(a?.alvo.x ?? me.x), y: Math.round(a?.alvo.y ?? me.y) };
    const c = caminho(de, { x, y });
    if (!c.length && !(de.x === x && de.y === y)) return;
    rota.current = c;
    destinoCadeira.current = assento?.id ?? null;
    if (!c.length && assento) mover(x, y, assento.olha, assento.id);
  };
  const irParaSala = (salaId: string) => {
    const ids = salaId === "cafe" ? ["cafe", "lounge"] : [salaId];
    const livre = ASSENTOS.find((s) => ids.includes(s.sala) && !ocupadas.has(s.id));
    if (livre) irPara(livre.x, livre.y);
  };

  // Teclado
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const me = estado.current.eu;
      if (!me || (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]")) return;
      const d: Record<string, [number, number, Lado]> = { ArrowUp: [0, -1, "cima"], w: [0, -1, "cima"], ArrowDown: [0, 1, "baixo"], s: [0, 1, "baixo"], ArrowLeft: [-1, 0, "esquerda"], a: [-1, 0, "esquerda"], ArrowRight: [1, 0, "direita"], d: [1, 0, "direita"] };
      const v = d[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!v) return;
      e.preventDefault();
      const a = atores.current.get(me.id);
      const bx = Math.round(a?.alvo.x ?? me.x), by = Math.round(a?.alvo.y ?? me.y);
      const nx = bx + v[0], ny = by + v[1];
      const assento = ASSENTOS.find((s) => s.x === nx && s.y === ny);
      if (assento ? ocupadasRef.current.has(assento.id) : MAPA.bloqueado[ny]?.[nx] !== false) { mover(bx, by, v[2], null); return; }
      rota.current = [{ x: nx, y: ny }];
      destinoCadeira.current = assento?.id ?? null;
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [mover]);

  // Laço de desenho
  useEffect(() => {
    let raf = 0;
    const c = tela.current!.getContext("2d")!;
    const desenhar = (t: number) => {
      raf = requestAnimationFrame(desenhar);
      const box = caixa.current, cv = tela.current;
      if (!box || !cv) return;
      const dpr = window.devicePixelRatio || 1;
      const largura = box.clientWidth;
      const ajuste = largura / LARG;
      const esc = zoomRef.current === 0 ? ajuste : Math.max(ajuste, zoomRef.current);
      escala.current = esc;
      const altura = zoomRef.current === 0 ? Math.round(ALT * esc) : Math.min(Math.round(ALT * esc), Math.max(420, Math.round(window.innerHeight - 230)));
      if (cv.width !== Math.round(largura * dpr) || cv.height !== Math.round(altura * dpr)) { cv.width = Math.round(largura * dpr); cv.height = Math.round(altura * dpr); cv.style.height = `${altura}px`; }
      const { todos: gente, eu: me } = estado.current;

      // Passo do meu boneco
      if (me) {
        const a = atores.current.get(me.id) ?? { x: me.x, y: me.y, dir: me.dir, andando: false, quadro: 0, alvo: { x: me.x, y: me.y } };
        atores.current.set(me.id, a);
        if (rota.current.length && t - ultimoPasso.current > PASSO_MS && Math.abs(a.x - a.alvo.x) + Math.abs(a.y - a.alvo.y) < 0.15) {
          const prox = rota.current.shift()!;
          const dir: Lado = prox.x > a.alvo.x ? "direita" : prox.x < a.alvo.x ? "esquerda" : prox.y > a.alvo.y ? "baixo" : "cima";
          a.alvo = prox; a.dir = dir; ultimoPasso.current = t;
          const fim = rota.current.length === 0;
          const assento = fim && destinoCadeira.current ? ASSENTOS.find((s) => s.id === destinoCadeira.current) : null;
          passosDesdeAnuncio.current++;
          const anunciar = fim || passosDesdeAnuncio.current >= 3;
          if (anunciar) passosDesdeAnuncio.current = 0;
          mover(prox.x, prox.y, assento ? assento.olha : dir, assento?.id ?? null, anunciar);
        }
      }
      // Interpolação de todos
      for (const p of gente) {
        let a = atores.current.get(p.id);
        if (!a) { a = { x: p.x, y: p.y, dir: p.dir, andando: false, quadro: 0, alvo: { x: p.x, y: p.y } }; atores.current.set(p.id, a); }
        if (p.id !== me?.id) { if (a.alvo.x !== p.x || a.alvo.y !== p.y) { a.dir = p.x > a.x ? "direita" : p.x < a.x ? "esquerda" : p.y > a.y ? "baixo" : "cima"; a.alvo = { x: p.x, y: p.y }; } }
        const dx = a.alvo.x - a.x, dy = a.alvo.y - a.y, dist = Math.hypot(dx, dy);
        const vel = (p.id === me?.id ? 1000 / PASSO_MS : 7) / 60;
        if (dist > 0.01) { const k = Math.min(1, vel / dist); a.x += dx * k; a.y += dy * k; a.andando = true; a.quadro = Math.floor(t / 110); }
        else { a.x = a.alvo.x; a.y = a.alvo.y; a.andando = false; if (p.cadeira || p.id !== me?.id) a.dir = p.dir; }
      }
      for (const id of [...atores.current.keys()]) if (!gente.some((p) => p.id === id)) atores.current.delete(id);

      // Câmera: segue o seu boneco
      const vw = largura / esc, vh = altura / esc;
      const foco = me ? atores.current.get(me.id) : null;
      const alvoCam = { x: Math.max(0, Math.min(LARG - vw, (foco ? foco.x * TILE + 8 : LARG / 2) - vw / 2)), y: Math.max(0, Math.min(ALT - vh, (foco ? foco.y * TILE + 8 : ALT / 2) - vh / 2)) };
      if (!camera.current) camera.current = { ...alvoCam };
      camera.current.x += (alvoCam.x - camera.current.x) * 0.12;
      camera.current.y += (alvoCam.y - camera.current.y) * 0.12;
      const cam = { x: Math.round(camera.current.x * esc) / esc, y: Math.round(camera.current.y * esc) / esc };
      camRef.current = cam;

      // Mundo
      c.setTransform(dpr * esc, 0, 0, dpr * esc, -cam.x * esc * dpr, -cam.y * esc * dpr);
      c.imageSmoothingEnabled = false;
      c.clearRect(cam.x, cam.y, vw, vh);
      c.drawImage(fundo, 0, 0);
      // destaque do tile sob o mouse
      if (mouse.current) {
        const { x, y } = mouse.current;
        const assento = ASSENTOS.find((s) => s.x === x && s.y === y);
        const livre = assento ? !ocupadas.has(assento.id) : MAPA.bloqueado[y]?.[x] === false;
        if (livre) { c.strokeStyle = assento ? "rgba(255,210,60,0.95)" : "rgba(255,255,255,0.8)"; c.lineWidth = 1; c.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1); }
      }
      type Item = { k: number; f: () => void };
      const itens: Item[] = MOVEIS_CENA.map((m, i) => ({ k: m.y + m.h - (m.t === "cadeira" || m.t === "pufe" || m.t === "poltrona" || m.t === "sofa" ? 0.5 : 0) + i * 1e-5, f: () => desenharMovel(c, m) }));
      for (const p of gente) {
        const a = atores.current.get(p.id)!;
        const sentado = !!p.cadeira && !a.andando;
        itens.push({ k: a.y + 0.98, f: () => boneco(c, a.x * TILE + TILE / 2, a.y * TILE + TILE - 1, visualDe(p.id + p.nome), a.dir, a.andando ? a.quadro : 0, sentado, p.ausente) });
      }
      itens.sort((x, y) => x.k - y.k).forEach((i) => i.f());

      // Rótulos (em pixels de tela, texto nítido)
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.textBaseline = "middle";
      for (const s of SALAS_MAPA) {
        const tx = ((s.x + 1.3) * TILE - cam.x) * esc, ty = ((s.y + 1.45) * TILE - cam.y) * esc;
        const fs = Math.min(14, Math.max(10, Math.round(5 * esc)));
        c.font = `600 ${fs}px Inter, system-ui, sans-serif`;
        const txt = `${s.icone} ${s.nome}`, w = c.measureText(txt).width + 16, hh = fs + 10;
        c.fillStyle = "rgba(255,255,255,0.85)"; pill(c, tx, ty - hh / 2, w, hh);
        c.fillStyle = "#3b4256"; c.fillText(txt, tx + 7, ty);
      }
      for (const p of gente) {
        const a = atores.current.get(p.id)!;
        const sx = (a.x * TILE + TILE / 2 - cam.x) * esc, sy = (a.y * TILE - 10 - cam.y) * esc;
        const nome = p.id === me?.id ? "Você" : p.nome.split(" ")[0];
        const fn = Math.min(14, Math.max(11, Math.round(4.5 * esc)));
        c.font = `600 ${fn}px Inter, system-ui, sans-serif`;
        const w = c.measureText(nome).width + 26, h = fn + 10;
        c.fillStyle = "rgba(24,26,34,0.88)"; pill(c, sx - w / 2, sy - h, w, h);
        c.fillStyle = p.ausente ? "#f2b33d" : "#22c55e"; c.beginPath(); c.arc(sx - w / 2 + 10, sy - h / 2, 4, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#fff"; c.fillText(nome, sx - w / 2 + 18, sy - h / 2 + 0.5);
      }
    };
    raf = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(raf);
  }, [fundo, mover, ocupadas]);

  const tileDoEvento = (e: React.MouseEvent) => {
    const r = tela.current!.getBoundingClientRect();
    const esc = escala.current;
    return { x: Math.floor(((e.clientX - r.left) / esc + camRef.current.x) / TILE), y: Math.floor(((e.clientY - r.top) / esc + camRef.current.y) / TILE) };
  };

  const porSala = SALAS.map((s) => ({ s, gente: todos.filter((p) => p.sala === s.id) }));
  const minhaSala = eu ? salaNoTile(eu.x, eu.y) : null;
  const salaAtual = SALAS_MAPA.find((s) => s.id === minhaSala);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[22px] font-semibold"><Building2 size={20} className="text-accent" /> Escritório virtual</h1>
          <p className="text-[13px] text-muted">Clique no chão para andar e numa cadeira para sentar. Setas ou W A S D também andam. Sente na sala do que está fazendo agora.</p>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-muted"><span className={`h-2 w-2 rounded-full ${conectado || !supabase ? "bg-ok" : "bg-warn"}`} />{conectado || !supabase ? `${todos.filter((p) => !p.ausente).length} online` : "Conectando…"}</span>
        {admin && <button onClick={() => setRelatorio(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium hover:border-line-forte"><BarChart3 size={14} /> Relatório de tempo</button>}
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div ref={caixa} className="relative overflow-hidden rounded-2xl border border-line bg-[#8fd18a] shadow-sm">
          <div className="absolute right-3 top-3 z-10 flex overflow-hidden rounded-xl border border-black/10 bg-white/90 text-[13px] font-semibold text-[#3b4256] shadow-sm backdrop-blur">
            <button onClick={() => mudarZoom(Math.min(5, (zoom || 2) + 0.5))} className="h-8 w-8 hover:bg-black/5" aria-label="Aproximar">+</button>
            <button onClick={() => mudarZoom(Math.max(1.5, (zoom || 2) - 0.5))} className="h-8 w-8 border-l border-black/10 hover:bg-black/5" aria-label="Afastar">−</button>
            <button onClick={() => mudarZoom(zoom === 0 ? 3 : 0)} className="h-8 border-l border-black/10 px-2.5 text-[12px] hover:bg-black/5">{zoom === 0 ? "Aproximar" : "Mapa inteiro"}</button>
          </div>
          <canvas ref={tela} className="block w-full cursor-pointer [image-rendering:pixelated]"
            onClick={(e) => { const t = tileDoEvento(e); irPara(t.x, t.y); }}
            onMouseMove={(e) => { mouse.current = tileDoEvento(e); }}
            onMouseLeave={() => { mouse.current = null; }} />
        </div>

        <aside className="flex flex-col gap-3">
          {eu && (
            <div className="rounded-2xl border border-line bg-surface p-3">
              <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">Você está em</div>
              <div className="mt-0.5 text-[16px] font-semibold">{salaAtual ? `${salaAtual.icone} ${salaAtual.nome}` : SALA_FORA.nome}</div>
              <div className="text-[12px] text-muted">{eu.cadeira ? "Sentado" : "Em pé"} · há {tempoTxt(agora - eu.desde)}</div>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-surface p-2">
            <div className="px-2 pb-1 pt-1 text-[12.5px] font-semibold text-muted">Ir para a sala</div>
            {porSala.map(({ s, gente }) => (
              <button key={s.id} onClick={() => irParaSala(s.id)} className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] hover:bg-raised ${eu?.sala === s.id ? "bg-raised" : ""}`}>
                <span className="grid h-7 w-7 place-items-center rounded-lg text-[14px]" style={{ background: `${s.cor}22` }}>{s.icone}</span>
                <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                {gente.length > 0 && <span className="num rounded-full bg-raised px-1.5 text-[11px] text-muted">{gente.length}</span>}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-3">
            <div className="pb-1 text-[12.5px] font-semibold text-muted">Online agora</div>
            {todos.length === 0 && <p className="text-[12.5px] text-muted">Ninguém por aqui.</p>}
            {todos.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1 text-[13px]">
                <span className={`h-2 w-2 rounded-full ${p.ausente ? "bg-[#f2b33d]" : "bg-ok"}`} />
                <span className="min-w-0 flex-1 truncate">{p.nome}{p.id === eu?.id ? " (você)" : ""}</span>
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

function pill(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = h / 2;
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
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
  const nome = (id: string) => d.membros.find((m) => m.id === id)?.nome ?? (supabase ? "Ex-membro" : id === "x" ? "Sílvio" : "Rener");
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
