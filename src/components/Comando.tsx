import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { CornerDownLeft, LayoutGrid, Moon, Plug, Search, Sparkles, User } from "lucide-react";
import { ASSISTENTE, SECOES } from "../data/navegacao";
import { useDados } from "../lib/dados";

interface Opcao { id: string; grupo: string; titulo: string; sub?: string; icone: LucideIcon; acao: () => void; termos: string }

const normal = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Abre com ⌘K / Ctrl+K em qualquer tela. */
export function useAtalhoComando(abrir: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abrir]);
}

/** Paleta de comandos: ir para qualquer área, aba ou cliente e perguntar à IA, sem tirar a mão do teclado. */
export function Comando({ aberto, fechar, ir, alternarTema }: { aberto: boolean; fechar: () => void; ir: (r: string) => void; alternarTema: () => void }) {
  const d = useDados();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) {
      setQ("");
      setSel(0);
      setTimeout(() => campo.current?.focus(), 10);
    }
  }, [aberto]);

  const todas = useMemo<Opcao[]>(() => {
    const ops: Opcao[] = [{ id: "inicio", grupo: "Ir para", titulo: "Central", icone: LayoutGrid, acao: () => ir("inicio"), termos: "central inicio home" }];
    for (const s of SECOES)
      for (const t of s.topicos) {
        ops.push({ id: t.id, grupo: "Ir para", titulo: t.nome, sub: s.nome, icone: t.icone, acao: () => ir(t.rota), termos: `${t.nome} ${s.nome} ${t.descricao}` });
        for (const a of t.atalhos.slice(1)) ops.push({ id: `${t.id}-${a.rota}`, grupo: "Ir para", titulo: `${t.nome} › ${a.nome}`, icone: t.icone, acao: () => ir(a.rota), termos: `${t.nome} ${a.nome}` });
      }
    for (const c of d.clientes) ops.push({ id: `c-${c.id}`, grupo: "Clientes", titulo: c.nome, sub: "Abrir cliente", icone: User, acao: () => ir(`cliente-${c.id}`), termos: `${c.nome} cliente` });
    ops.push({ id: "tema", grupo: "Ações", titulo: "Alternar tema claro/escuro", icone: Moon, acao: alternarTema, termos: "tema escuro claro dark light" });
    ops.push({ id: "integracoes", grupo: "Ações", titulo: "Integrações", sub: "Chaves, WhatsApp e DataForSEO", icone: Plug, acao: () => ir("integracoes"), termos: "integracoes configuracoes chaves whatsapp dataforseo" });
    return ops;
  }, [d.clientes, ir, alternarTema]);

  const resultado = useMemo(() => {
    const palavras = normal(q).split(/\s+/).filter(Boolean);
    const achadas = palavras.length ? todas.filter((o) => palavras.every((p) => normal(`${o.titulo} ${o.termos}`).includes(p))) : todas.filter((o) => o.grupo !== "Clientes" || false);
    const perguntar: Opcao[] = q.trim()
      ? [{
          id: "ia", grupo: "Assistente", titulo: `Perguntar: “${q.trim()}”`, icone: Sparkles, termos: "",
          acao: () => {
            try { sessionStorage.setItem("vertente.pergunta", q.trim()); } catch { /* sem armazenamento */ }
            ir(ASSISTENTE.rota);
          },
        }]
      : [];
    return [...achadas.slice(0, 40), ...perguntar];
  }, [q, todas, ir]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    lista.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!aberto) return null;

  function escolher(o?: Opcao) {
    if (!o) return;
    fechar();
    o.acao();
  }

  let grupoAnterior = "";
  return createPortal(
    <div className="fixed inset-0 z-[80] text-fg" role="dialog" aria-label="Buscar e ir para">
      <div className="anim-entrar absolute inset-0 bg-[rgb(12_14_20/0.35)]" onClick={fechar} />
      <div className="anim-surgir relative mx-auto mt-[12vh] w-[calc(100%-32px)] max-w-[600px] overflow-hidden rounded-2xl border border-line bg-surface" style={{ boxShadow: "var(--sombra-flutuante)" }}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={17} className="shrink-0 text-muted" />
          <input
            ref={campo}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(resultado.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); escolher(resultado[sel]); }
              else if (e.key === "Escape") fechar();
            }}
            placeholder="Ir para uma área, cliente ou perguntar à IA…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            aria-controls="comando-lista"
          />
          <kbd>esc</kbd>
        </div>
        <div ref={lista} id="comando-lista" role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
          {resultado.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted">Nada encontrado.</p>}
          {resultado.map((o, i) => {
            const cab = o.grupo !== grupoAnterior ? o.grupo : null;
            grupoAnterior = o.grupo;
            const Icone = o.icone;
            return (
              <div key={o.id}>
                {cab && <div className="px-2.5 pb-1 pt-2.5 text-[11.5px] font-medium text-muted">{cab}</div>}
                <button
                  data-i={i}
                  role="option"
                  aria-selected={i === sel}
                  onMouseMove={() => setSel(i)}
                  onClick={() => escolher(o)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] ${i === sel ? "bg-raised" : ""}`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border ${i === sel ? "border-line-forte bg-surface text-accent" : "border-line text-muted"}`}>
                    <Icone size={14} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.titulo}</span>
                  {o.sub && <span className="hidden shrink-0 text-[12px] text-muted sm:inline">{o.sub}</span>}
                  {i === sel && <CornerDownLeft size={14} className="shrink-0 text-muted" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11.5px] text-muted">
          <span className="flex items-center gap-1"><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd>↵</kbd> abrir</span>
          <span className="ml-auto">Digite e pergunte à IA</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
