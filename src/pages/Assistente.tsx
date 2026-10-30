import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Database, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { chamarFuncao, useTabela } from "../lib/tabela";
import { supabase } from "../lib/supabase";
import { useDados } from "../lib/dados";

interface Consulta {
  ferramenta: string;
  tabela?: string;
  ok: boolean;
}
interface Mensagem {
  role: "user" | "assistant";
  content: string;
  consultas?: Consulta[];
  erro?: boolean;
}
interface Conversa {
  id: string;
  titulo: string;
  mensagens: Mensagem[];
  atualizado_em?: string;
}

const SUGESTOES = [
  "Quais tarefas estão atrasadas e com quem?",
  "Resuma o tráfego dos últimos 7 dias por cliente: investimento, contatos e custo por contato.",
  "Como foi o financeiro da agência neste ano? Mostre mês a mês e a margem.",
  "Quais clientes merecem mais atenção agora e por quê?",
  "O que foi registrado nas revisões e otimizações desta semana?",
  "Quais posts estão aguardando aprovação do cliente?",
];

const NOME_TABELA: Record<string, string> = {
  clientes: "clientes",
  cliente_servicos: "serviços",
  membros: "time",
  tarefas: "tarefas",
  tarefa_checklist: "checklists",
  tarefa_comentarios: "comentários",
  rotinas: "rotinas",
  cliente_rotinas: "rotinas dos clientes",
  registros: "linha do tempo",
  notificacoes: "avisos",
  contas_anuncio: "contas de anúncio",
  metricas_diarias: "métricas de tráfego",
  metricas_conta_dia: "métricas de tráfego",
  gmn_perfis: "perfis GMN",
  gmn_analises: "análises GMN",
  posts: "social media",
  lancamentos: "financeiro",
  contratos: "contratos",
  contrato_modelos: "modelos de contrato",
  servicos: "serviços",
  Meta: "Meta ao vivo",
};

function Markdown({ texto }: { texto: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(texto, { async: false, breaks: true }) as string), [texto]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Assistente({ rotaAnterior }: { rotaAnterior?: string }) {
  const d = useDados();
  const conversas = useTabela<Conversa>("assistente_conversas", "id, titulo, mensagens, atualizado_em", () => [], { ordem: { coluna: "atualizado_em", asc: false }, limite: 50 });
  const [atualId, setAtualId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, pensando]);

  function abrir(c: Conversa | null) {
    setAtualId(c?.id ?? null);
    setMensagens(c?.mensagens ?? []);
    setTexto("");
    setTimeout(() => campo.current?.focus(), 50);
  }

  // Pergunta feita na Central: já envia ao abrir
  const inicial = useRef(false);
  useEffect(() => {
    if (inicial.current) return;
    inicial.current = true;
    try {
      const q = sessionStorage.getItem("vertente.pergunta");
      if (q) {
        sessionStorage.removeItem("vertente.pergunta");
        enviar(q);
      }
    } catch {
      /* sem armazenamento */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(pergunta?: string) {
    const q = (pergunta ?? texto).trim();
    if (!q || pensando) return;
    const novas: Mensagem[] = [...mensagens, { role: "user", content: q }];
    setMensagens(novas);
    setTexto("");
    setPensando(true);
    let resposta: Mensagem;
    try {
      if (!supabase) {
        await new Promise((r) => setTimeout(r, 700));
        resposta = { role: "assistant", content: "Esta é a prévia, sem banco conectado. No sistema publicado eu consulto tarefas, tráfego, GMN, social media, financeiro, cadastros e contratos para responder." };
      } else {
        const r = await chamarFuncao<{ resposta: string; consultas: Consulta[] }>("assistente", {
          mensagens: novas.filter((m) => !m.erro).map(({ role, content }) => ({ role, content })),
          pagina: rotaAnterior,
        });
        resposta = { role: "assistant", content: r.resposta, consultas: r.consultas };
      }
    } catch (e) {
      resposta = { role: "assistant", content: (e as Error).message, erro: true };
    }
    const todas = [...novas, resposta];
    setMensagens(todas);
    setPensando(false);
    try {
      const id = await conversas.salvar(atualId, atualId ? { mensagens: todas } : { titulo: q.slice(0, 70), mensagens: todas });
      setAtualId(id);
    } catch {
      /* conversa segue na tela mesmo sem salvar */
    }
  }

  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const primeiroNome = d.membro(d.eu)?.nome?.split(" ")[0];

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* Conversas anteriores */}
      <aside className="hidden w-[250px] shrink-0 flex-col gap-2 lg:flex">
        <button onClick={() => abrir(null)} className="flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-[13px] font-medium text-accent-fg hover:opacity-90">
          <MessageSquarePlus size={16} /> Nova conversa
        </button>
        <div className="eyebrow mt-2 px-1">Conversas</div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {conversas.linhas.length === 0 && <li className="px-1 text-[12.5px] text-muted">As conversas ficam salvas aqui. Só você vê as suas.</li>}
          {conversas.linhas.map((c) => (
            <li key={c.id} className="group flex items-center">
              <button
                onClick={() => abrir(c)}
                className={`min-w-0 flex-1 truncate rounded-lg px-2.5 py-2 text-left text-[13px] ${c.id === atualId ? "bg-accent-soft font-medium text-accent" : "hover:bg-raised"}`}
              >
                {c.titulo}
              </button>
              <button
                onClick={async () => {
                  await conversas.excluir(c.id);
                  if (c.id === atualId) abrir(null);
                }}
                className="ml-1 hidden rounded p-1 text-muted hover:text-bad group-hover:block"
                aria-label="Apagar conversa"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Chat */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ boxShadow: "var(--sombra)" }}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-accent">
              <Sparkles size={17} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[16px] font-semibold leading-tight">Assistente Vertente</h1>
              <p className="truncate text-[11.5px] text-muted">Consulta todo o sistema para responder · só leitura</p>
            </div>
          </div>
          <button onClick={() => abrir(null)} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] hover:bg-raised lg:hidden">
            <MessageSquarePlus size={14} /> Nova
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {mensagens.length === 0 ? (
            <div className="mx-auto flex max-w-[680px] flex-col items-center gap-5 pt-6 text-center sm:pt-12">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-accent">
                <Sparkles size={26} />
              </span>
              <div>
                <h2 className="text-[22px] font-semibold">Olá{primeiroNome ? `, ${primeiroNome}` : ""}! Como posso ajudar?</h2>
                <p className="mt-1 text-[13.5px] text-muted">Pergunte sobre clientes, tarefas, tráfego, GMN, social media, financeiro ou contratos. Eu busco os dados e respondo.</p>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGESTOES.map((s) => (
                  <button key={s} onClick={() => enviar(s)} className="rounded-xl border border-line bg-bg px-3.5 py-3 text-left text-[13px] leading-snug transition-colors hover:border-accent">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-[820px] flex-col gap-5">
              {mensagens.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[14px] text-accent-fg">
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                      <Sparkles size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {m.erro ? <p className="rounded-xl bg-bad-soft px-3 py-2 text-[13.5px] text-bad">{m.content}</p> : <Markdown texto={m.content} />}
                      {m.consultas && m.consultas.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                          <Database size={12} /> Consultou:
                          {[...new Set(m.consultas.map((c) => NOME_TABELA[c.tabela ?? ""] ?? c.tabela ?? c.ferramenta))].map((n) => (
                            <span key={n} className="rounded-full bg-raised px-2 py-0.5">{n}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
              {pensando && (
                <div className="flex items-center gap-3 text-[13px] text-muted">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Sparkles size={14} className="animate-pulse" />
                  </span>
                  Consultando o sistema…
                </div>
              )}
              <div ref={fim} />
            </div>
          )}
        </div>

        <div className="border-t border-line p-3 sm:p-4">
          <div className="mx-auto flex max-w-[820px] items-end gap-2 rounded-2xl border border-line bg-bg p-2 focus-within:border-accent">
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={tecla}
              rows={1}
              placeholder="Pergunte qualquer coisa sobre o sistema…"
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] outline-none"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              onClick={() => enviar()}
              disabled={!texto.trim() || pensando}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg disabled:opacity-40"
              aria-label="Enviar"
            >
              <ArrowUp size={18} />
            </button>
          </div>
          <p className="mx-auto mt-1.5 max-w-[820px] text-center text-[11px] text-muted">O assistente só lê os dados e respeita as suas permissões. Confira números importantes antes de enviar a clientes.</p>
        </div>
      </section>
    </div>
  );
}
