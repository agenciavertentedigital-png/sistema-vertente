import { createContext, useCallback, useContext, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { supabase } from "./supabase";

/** Favorito: atalho fixado na barra de cima (menus, páginas, clientes, dashboards ou tarefas). */
export interface Favorito { id: string; tipo: "rota" | "tarefa"; alvo: string; nome: string }

const MIME = "application/x-vertente-favorito";
const CHAVE = (m: string) => `vertente.favoritos.${m}`;

interface Ctx {
  ativo: boolean;
  itens: Favorito[];
  arrastando: boolean;
  adicionar: (f: Omit<Favorito, "id">, antesDe?: string) => void;
  remover: (id: string) => void;
  mover: (id: string, antesDe: string | null) => void;
  tem: (tipo: Favorito["tipo"], alvo: string) => boolean;
}
const Contexto = createContext<Ctx>({ ativo: false, itens: [], arrastando: false, adicionar: () => undefined, remover: () => undefined, mover: () => undefined, tem: () => false });
export const useFavoritos = () => useContext(Contexto);

/** Props para deixar qualquer coisa arrastável até a barra de favoritos. */
export function arrastavelFavorito(f: Omit<Favorito, "id">) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(MIME, JSON.stringify(f));
      e.dataTransfer.setData("text/plain", f.nome);
      e.dataTransfer.effectAllowed = "copyMove";
    },
  };
}
export function lerArrasto(e: DragEvent): Omit<Favorito, "id"> | null {
  try { const v = e.dataTransfer.getData(MIME); return v ? (JSON.parse(v) as Omit<Favorito, "id">) : null; } catch { return null; }
}
export const ehArrastoFavorito = (e: DragEvent | globalThis.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes(MIME);

/** Guarda no navegador na hora e sincroniza com o banco (tabela favoritos), quando existir. */
export function ProvedorFavoritos({ membroId, ativo, children }: { membroId: string | null; ativo: boolean; children: ReactNode }) {
  const m = membroId ?? "demo";
  const [itens, setItens] = useState<Favorito[]>(() => {
    try { return JSON.parse(localStorage.getItem(CHAVE(m)) ?? "[]") as Favorito[]; } catch { return []; }
  });
  const [arrastando, setArrastando] = useState(false);
  const banco = useRef(false);

  useEffect(() => {
    if (!ativo || !supabase || !membroId) return;
    supabase.from("favoritos").select("itens").eq("membro_id", membroId).maybeSingle().then(({ data, error }) => {
      if (error) return; // tabela ainda não existe: fica só no navegador
      banco.current = true;
      const remoto = (data as { itens: Favorito[] } | null)?.itens;
      if (remoto && remoto.length) setItens(remoto);
      else {
        // Primeira vez com o banco: leva para lá o que já estava fixado neste navegador
        let locais: Favorito[] = [];
        try { locais = JSON.parse(localStorage.getItem(CHAVE(m)) ?? "[]") as Favorito[]; } catch { /* */ }
        if (locais.length && supabase) supabase.from("favoritos").upsert({ membro_id: membroId, itens: locais, atualizado_em: new Date().toISOString() }).then(() => null);
      }
    });
  }, [ativo, membroId]);

  const gravar = useCallback((novos: Favorito[]) => {
    setItens(novos);
    try { localStorage.setItem(CHAVE(m), JSON.stringify(novos)); } catch { /* sem armazenamento */ }
    if (banco.current && supabase && membroId) supabase.from("favoritos").upsert({ membro_id: membroId, itens: novos, atualizado_em: new Date().toISOString() }).then(() => null);
  }, [m, membroId]);

  // Mostra a barra "pronta para receber" enquanto algo favoritável é arrastado
  useEffect(() => {
    if (!ativo) return;
    const ini = (e: globalThis.DragEvent) => { if (ehArrastoFavorito(e)) setArrastando(true); };
    const fim = () => setArrastando(false);
    window.addEventListener("dragstart", ini);
    window.addEventListener("dragend", fim);
    window.addEventListener("drop", fim);
    return () => { window.removeEventListener("dragstart", ini); window.removeEventListener("dragend", fim); window.removeEventListener("drop", fim); };
  }, [ativo]);

  const tem = (tipo: Favorito["tipo"], alvo: string) => itens.some((x) => x.tipo === tipo && x.alvo === alvo);
  const adicionar = (f: Omit<Favorito, "id">, antesDe?: string) => {
    if (tem(f.tipo, f.alvo)) return;
    const novo = { ...f, id: `${f.tipo}:${f.alvo}` };
    const i = antesDe ? itens.findIndex((x) => x.id === antesDe) : -1;
    gravar(i >= 0 ? [...itens.slice(0, i), novo, ...itens.slice(i)] : [...itens, novo]);
  };
  const remover = (id: string) => gravar(itens.filter((x) => x.id !== id));
  const mover = (id: string, antesDe: string | null) => {
    const item = itens.find((x) => x.id === id);
    if (!item || id === antesDe) return;
    const resto = itens.filter((x) => x.id !== id);
    const i = antesDe ? resto.findIndex((x) => x.id === antesDe) : -1;
    gravar(i >= 0 ? [...resto.slice(0, i), item, ...resto.slice(i)] : [...resto, item]);
  };

  return <Contexto.Provider value={{ ativo, itens, arrastando, adicionar, remover, mover, tem }}>{children}</Contexto.Provider>;
}

/** Abre uma tarefa em qualquer tela (o painel global no App escuta). */
export const abrirTarefaGlobal = (id: string) => window.dispatchEvent(new CustomEvent("vertente:abrir-tarefa", { detail: id }));
