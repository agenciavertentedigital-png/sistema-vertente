import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { ENTRADA, SALAS_MAPA, SALA_RELATORIO, salaNoTile, type Lado } from "./escritorioMapa";

// Salas para o relatório e a lista lateral (o lounge soma como Café)
export const SALAS = SALAS_MAPA.filter((s) => s.id !== "lounge").map((s) => ({ id: s.id, nome: s.id === "cafe" ? "Copa e lounge" : s.nome, icone: s.icone, cor: s.cor }));
export const SALA_FORA = { id: "corredor", nome: "Corredor" };
export const salaRelatorio = (tileSala: string | null) => (tileSala ? SALA_RELATORIO[tileSala] ?? tileSala : SALA_FORA.id);

// ------------------------------------------------------------------
// Presença (Supabase Realtime) + soma silenciosa do tempo por sala
// Posições em tiles do mapa.
// ------------------------------------------------------------------
export interface Pessoa { id: string; nome: string; x: number; y: number; dir: Lado; sala: string; cadeira: string | null; ausente: boolean; desde: number }
interface Ctx {
  eu: Pessoa | null;
  pessoas: Pessoa[];
  conectado: boolean;
  /** Atualiza a posição (anuncia aos outros). */
  mover: (x: number, y: number, dir: Lado, cadeira?: string | null, anunciar?: boolean) => void;
}
const Contexto = createContext<Ctx>({ eu: null, pessoas: [], conectado: false, mover: () => undefined });
export const useEscritorio = () => useContext(Contexto);

const CHAVE = "vertente.escritorio.v2";
const OCIOSO_MS = 10 * 60_000;

export function ProvedorEscritorio({ membro, children }: { membro: { id: string; nome: string } | null; children: ReactNode }) {
  const [eu, setEu] = useState<Pessoa | null>(() => {
    if (!membro) return null;
    let p: { x: number; y: number; cadeira: string | null; dir: Lado } = { ...ENTRADA, cadeira: null, dir: "cima" };
    try { p = { ...p, ...(JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as Partial<typeof p>) }; } catch { /* */ }
    return { id: membro.id, nome: membro.nome, x: p.x, y: p.y, dir: p.dir, cadeira: p.cadeira, sala: salaRelatorio(salaNoTile(p.x, p.y)), ausente: false, desde: Date.now() };
  });
  const [outros, setOutros] = useState<Pessoa[]>([]);
  const [conectado, setConectado] = useState(false);
  const canal = useRef<RealtimeChannel | null>(null);
  const atual = useRef(eu);
  atual.current = eu;
  const ultimaAcao = useRef(Date.now());
  const ultimoBatimento = useRef(Date.now());

  const registrar = useCallback(() => {
    const agora = Date.now();
    const seg = Math.round((agora - ultimoBatimento.current) / 1000);
    ultimoBatimento.current = agora;
    const p = atual.current;
    if (!supabase || !p || p.ausente || seg < 5) return;
    supabase.rpc("registrar_tempo_escritorio", { p_sala: p.sala, p_segundos: Math.min(seg, 180) }).then(() => null);
  }, []);

  const anunciar = useCallback((p: Pessoa) => { canal.current?.track(p).catch(() => null); }, []);

  const mover = useCallback((x: number, y: number, dir: Lado, cadeira: string | null = null, anunciarAgora = true) => {
    const p = atual.current;
    if (!p) return;
    ultimaAcao.current = Date.now();
    const sala = salaRelatorio(salaNoTile(x, y));
    if (sala !== p.sala) registrar();
    const novo: Pessoa = { ...p, x, y, dir, cadeira, sala, ausente: false, desde: sala !== p.sala ? Date.now() : p.desde };
    atual.current = novo;
    setEu(novo);
    if (anunciarAgora) anunciar(novo);
    try { localStorage.setItem(CHAVE, JSON.stringify({ x, y, cadeira, dir })); } catch { /* */ }
  }, [anunciar, registrar]);

  useEffect(() => {
    if (!supabase || !membro) return;
    const ch = supabase.channel("escritorio-vertente", { config: { presence: { key: membro.id } } });
    canal.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const estado = ch.presenceState<Pessoa>();
      const lista: Pessoa[] = [];
      for (const [k, v] of Object.entries(estado)) if (k !== membro.id && v.length) lista.push(v[v.length - 1] as unknown as Pessoa);
      setOutros(lista.filter((p) => typeof p.x === "number" && p.x < 80));
    });
    ch.subscribe((s) => {
      setConectado(s === "SUBSCRIBED");
      if (s === "SUBSCRIBED" && atual.current) ch.track(atual.current).catch(() => null);
    });
    return () => { ch.unsubscribe(); canal.current = null; };
  }, [membro?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  return <Contexto.Provider value={{ eu, pessoas, conectado, mover }}>{children}</Contexto.Provider>;
}
