import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ------------------------------------------------------------------
// Mapa do escritório (unidades do desenho: 1600 x 900)
// ------------------------------------------------------------------
export interface Sala { id: string; nome: string; x: number; y: number; w: number; h: number; cor: string; icone: string; tipo: "mesas" | "reuniao" | "cafe" | "foco" | "recepcao" }
export const SALAS: Sala[] = [
  { id: "comercial", nome: "Comercial", x: 40, y: 40, w: 500, h: 280, cor: "#2f9e6e", icone: "💼", tipo: "mesas" },
  { id: "trafego", nome: "Tráfego", x: 570, y: 40, w: 480, h: 280, cor: "#3b6fe0", icone: "📈", tipo: "mesas" },
  { id: "criacao", nome: "Criação e Social", x: 1080, y: 40, w: 480, h: 280, cor: "#c2508a", icone: "🎨", tipo: "mesas" },
  { id: "operacional", nome: "Operacional · CS", x: 40, y: 360, w: 500, h: 290, cor: "#e07a3b", icone: "🧩", tipo: "mesas" },
  { id: "reuniao", nome: "Sala de reunião", x: 570, y: 360, w: 480, h: 290, cor: "#8a63d2", icone: "🗣️", tipo: "reuniao" },
  { id: "foco", nome: "Foco · silêncio", x: 1080, y: 360, w: 480, h: 290, cor: "#0d9488", icone: "🎧", tipo: "foco" },
  { id: "diretoria", nome: "Diretoria", x: 40, y: 690, w: 500, h: 180, cor: "#b45309", icone: "🧭", tipo: "mesas" },
  { id: "recepcao", nome: "Recepção", x: 570, y: 690, w: 480, h: 180, cor: "#64748b", icone: "🚪", tipo: "recepcao" },
  { id: "cafe", nome: "Café", x: 1080, y: 690, w: 480, h: 180, cor: "#a16207", icone: "☕", tipo: "cafe" },
];
export const SALA_FORA = { id: "corredor", nome: "Corredor" };

export interface Cadeira { id: string; sala: string; x: number; y: number }
export interface Movel { tipo: "mesa" | "mesa_redonda" | "mesa_grande" | "sofa" | "planta"; x: number; y: number; w: number; h: number }

/** Mesas e cadeiras de cada sala (geradas a partir do retângulo). */
export function mobilia(s: Sala): { moveis: Movel[]; cadeiras: Cadeira[] } {
  const moveis: Movel[] = [];
  const cadeiras: Cadeira[] = [];
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2 + 10;
  if (s.tipo === "mesas" || s.tipo === "foco") {
    const cols = s.h > 200 ? 3 : 3, linhas = s.h > 200 ? 2 : 1;
    const mw = s.tipo === "foco" ? 70 : 96, mh = 44;
    for (let l = 0; l < linhas; l++) for (let c = 0; c < cols; c++) {
      const x = s.x + 60 + c * ((s.w - 120 - mw) / Math.max(cols - 1, 1));
      const y = s.y + (linhas === 1 ? s.h / 2 - 10 : 80 + l * 110);
      moveis.push({ tipo: "mesa", x, y, w: mw, h: mh });
      cadeiras.push({ id: `${s.id}-${l}-${c}`, sala: s.id, x: x + mw / 2, y: y + mh + 22 });
    }
  } else if (s.tipo === "reuniao") {
    const w = 260, h = 90;
    moveis.push({ tipo: "mesa_grande", x: cx - w / 2, y: cy - h / 2, w, h });
    for (let i = 0; i < 4; i++) {
      cadeiras.push({ id: `${s.id}-t${i}`, sala: s.id, x: cx - w / 2 + 40 + i * ((w - 80) / 3), y: cy - h / 2 - 22 });
      cadeiras.push({ id: `${s.id}-b${i}`, sala: s.id, x: cx - w / 2 + 40 + i * ((w - 80) / 3), y: cy + h / 2 + 22 });
    }
    cadeiras.push({ id: `${s.id}-e`, sala: s.id, x: cx - w / 2 - 24, y: cy }, { id: `${s.id}-d`, sala: s.id, x: cx + w / 2 + 24, y: cy });
  } else if (s.tipo === "cafe") {
    for (let i = 0; i < 3; i++) {
      const x = s.x + 90 + i * 150, y = cy - 10;
      moveis.push({ tipo: "mesa_redonda", x: x - 28, y: y - 28, w: 56, h: 56 });
      cadeiras.push({ id: `${s.id}-${i}a`, sala: s.id, x: x - 46, y }, { id: `${s.id}-${i}b`, sala: s.id, x: x + 46, y });
    }
  } else {
    moveis.push({ tipo: "sofa", x: s.x + 40, y: s.y + 60, w: 150, h: 46 }, { tipo: "planta", x: s.x + s.w - 70, y: s.y + 50, w: 34, h: 34 });
    cadeiras.push({ id: `${s.id}-s1`, sala: s.id, x: s.x + 75, y: s.y + 83 }, { id: `${s.id}-s2`, sala: s.id, x: s.x + 155, y: s.y + 83 });
  }
  return { moveis, cadeiras };
}
export const CADEIRAS = SALAS.flatMap((s) => mobilia(s).cadeiras);
export const salaEm = (x: number, y: number) => SALAS.find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) ?? null;
const INICIO = { x: 810, y: 800 };

// ------------------------------------------------------------------
// Presença (Supabase Realtime) + soma silenciosa do tempo por sala
// ------------------------------------------------------------------
export interface Pessoa { id: string; nome: string; x: number; y: number; sala: string; cadeira: string | null; ausente: boolean; desde: number }
interface Ctx {
  eu: Pessoa | null;
  pessoas: Pessoa[];
  conectado: boolean;
  mover: (x: number, y: number, cadeira?: string | null) => void;
}
const C = createContext<Ctx>({ eu: null, pessoas: [], conectado: false, mover: () => undefined });
export const useEscritorio = () => useContext(C);

const CHAVE = "vertente.escritorio.posicao";
const OCIOSO_MS = 10 * 60_000;

export function ProvedorEscritorio({ membro, children }: { membro: { id: string; nome: string } | null; children: ReactNode }) {
  const [eu, setEu] = useState<Pessoa | null>(() => {
    if (!membro) return null;
    let p = { ...INICIO, cadeira: null as string | null };
    try { p = { ...p, ...(JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as Partial<typeof p>) }; } catch { /* */ }
    return { id: membro.id, nome: membro.nome, x: p.x, y: p.y, cadeira: p.cadeira, sala: salaEm(p.x, p.y)?.id ?? SALA_FORA.id, ausente: false, desde: Date.now() };
  });
  const [outros, setOutros] = useState<Pessoa[]>([]);
  const [conectado, setConectado] = useState(false);
  const canal = useRef<RealtimeChannel | null>(null);
  const atual = useRef(eu);
  atual.current = eu;
  const ultimaAcao = useRef(Date.now());
  const ultimoBatimento = useRef(Date.now());

  // Soma o tempo da sala onde a pessoa estava desde o último registro (máx. 3 min por vez)
  const registrar = useCallback(() => {
    const agora = Date.now();
    const seg = Math.round((agora - ultimoBatimento.current) / 1000);
    ultimoBatimento.current = agora;
    const p = atual.current;
    if (!supabase || !p || p.ausente || seg < 5) return;
    supabase.rpc("registrar_tempo_escritorio", { p_sala: p.sala, p_segundos: Math.min(seg, 180) }).then(() => null);
  }, []);

  const anunciar = useCallback((p: Pessoa) => { canal.current?.track(p).catch(() => null); }, []);

  const mover = useCallback((x: number, y: number, cadeira: string | null = null) => {
    const p = atual.current;
    if (!p) return;
    ultimaAcao.current = Date.now();
    const sala = salaEm(x, y)?.id ?? SALA_FORA.id;
    if (sala !== p.sala) registrar();
    const novo = { ...p, x, y, cadeira, sala, ausente: false, desde: sala !== p.sala ? Date.now() : p.desde };
    setEu(novo);
    anunciar(novo);
    try { localStorage.setItem(CHAVE, JSON.stringify({ x, y, cadeira })); } catch { /* */ }
  }, [anunciar, registrar]);

  // Canal de presença
  useEffect(() => {
    if (!supabase || !membro) return;
    const ch = supabase.channel("escritorio-vertente", { config: { presence: { key: membro.id } } });
    canal.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const estado = ch.presenceState<Pessoa>();
      const lista: Pessoa[] = [];
      for (const [k, v] of Object.entries(estado)) if (k !== membro.id && v.length) lista.push(v[v.length - 1] as unknown as Pessoa);
      setOutros(lista);
    });
    ch.subscribe((s) => {
      setConectado(s === "SUBSCRIBED");
      if (s === "SUBSCRIBED" && atual.current) ch.track(atual.current).catch(() => null);
    });
    return () => { ch.unsubscribe(); canal.current = null; };
  }, [membro?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Batimento: soma o tempo a cada 30 s e marca ausente depois de 10 min sem mexer no sistema
  useEffect(() => {
    if (!membro) return;
    const acao = () => {
      ultimaAcao.current = Date.now();
      const p = atual.current;
      if (p?.ausente) { ultimoBatimento.current = Date.now(); const novo = { ...p, ausente: false }; setEu(novo); anunciar(novo); }
    };
    const evs = ["pointerdown", "keydown", "mousemove", "wheel", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, acao, { passive: true }));
    const t = window.setInterval(() => {
      registrar();
      const p = atual.current;
      if (p && !p.ausente && Date.now() - ultimaAcao.current > OCIOSO_MS) { const novo = { ...p, ausente: true }; setEu(novo); anunciar(novo); }
    }, 30_000);
    const sair = () => registrar();
    window.addEventListener("pagehide", sair);
    return () => { evs.forEach((e) => window.removeEventListener(e, acao)); window.clearInterval(t); window.removeEventListener("pagehide", sair); };
  }, [membro?.id, registrar, anunciar]); // eslint-disable-line react-hooks/exhaustive-deps

  const pessoas = eu ? [eu, ...outros] : outros;
  return <C.Provider value={{ eu, pessoas, conectado, mover }}>{children}</C.Provider>;
}
