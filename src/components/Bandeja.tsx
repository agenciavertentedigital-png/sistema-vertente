import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, CheckSquare, Inbox, Search, Settings2, Sparkles, StickyNote, Wand2, X } from "lucide-react";
import { CaixaUniversal } from "./CaixaUniversal";
import type { LucideIcon } from "lucide-react";
import { repo } from "../lib/repo";
import { useDados } from "../lib/dados";
import { ETIQUETAS, useNotas, type Etiqueta, type Nota } from "../lib/briefing";
import { PILAR, PILARES, PRIORIDADE, type Pilar, type Prioridade } from "../lib/tipos";
import { CampoMencao } from "./LinhaDoTempo";
import { Botao, Entrada, Rotulo, Selecao, campo } from "./ui";

type IdAtalho = "despejar" | "demanda" | "anotacao" | "tarefa" | "ia" | "busca";
type Popup = "despejar" | "demanda" | "anotacao" | "tarefa" | null;

const ATALHOS: Record<IdAtalho, { nome: string; icone: LucideIcon; dica: string }> = {
  despejar: { nome: "Despejar", icone: Wand2, dica: "Cole qualquer texto e a IA organiza em demandas, anotações e registros (Alt+C)" },
  demanda: { nome: "Demanda", icone: Inbox, dica: "Descarregar uma demanda na caixa de entrada" },
  anotacao: { nome: "Anotação", icone: StickyNote, dica: "Anotar algo rápido" },
  tarefa: { nome: "Tarefa", icone: CheckSquare, dica: "Criar uma tarefa com responsável e prazo" },
  ia: { nome: "IA", icone: Sparkles, dica: "Perguntar à IA" },
  busca: { nome: "Buscar", icone: Search, dica: "Buscar no sistema (Ctrl K)" },
};
const PADRAO: IdAtalho[] = ["despejar", "demanda", "anotacao", "tarefa", "ia"];
const CHAVE = "vertente.bandeja";

function lerEscolha(): IdAtalho[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as IdAtalho[] | null;
    if (Array.isArray(v)) {
      const lista = v.filter((x) => x in ATALHOS);
      // atalho novo: entra uma vez para quem já tinha personalizado a bandeja
      if (!lista.includes("despejar") && !localStorage.getItem(`${CHAVE}.despejar`)) {
        localStorage.setItem(`${CHAVE}.despejar`, "1");
        return ["despejar", ...lista];
      }
      return lista;
    }
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return PADRAO;
}

/**
 * Bandeja de atalhos fixa no rodapé: abre Demanda, Anotação e Tarefa em pop-up,
 * sem sair da página. O cliente da página aberta já vem selecionado.
 */
export function Bandeja({ rota, ir, abrirComando }: { rota: string; ir: (r: string) => void; abrirComando: () => void }) {
  const [escolha, setEscolha] = useState<IdAtalho[]>(lerEscolha);
  const [popup, setPopup] = useState<Popup>(null);
  const [config, setConfig] = useState(false);
  const clienteDaPagina = rota.startsWith("cliente-") ? rota.slice(8).split("-").slice(0, 5).join("-") : "";

  // atalhos de teclado: Alt+D demanda, Alt+N anotação, Alt+T tarefa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      const alvo: Popup = k === "c" ? "despejar" : k === "d" ? "demanda" : k === "n" ? "anotacao" : k === "t" ? "tarefa" : null;
      if (alvo) {
        e.preventDefault();
        setPopup(alvo);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function alternar(id: IdAtalho) {
    const nova = escolha.includes(id) ? escolha.filter((x) => x !== id) : (Object.keys(ATALHOS) as IdAtalho[]).filter((x) => x === id || escolha.includes(x));
    setEscolha(nova);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(nova));
    } catch {
      /* segue só nesta sessão */
    }
  }
  function usar(id: IdAtalho) {
    if (id === "ia") return ir("assistente");
    if (id === "busca") return abrirComando();
    setPopup(id);
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4" style={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <nav aria-label="Atalhos" className="bandeja pointer-events-auto relative flex items-center gap-0.5 rounded-2xl border border-line bg-surface/85 p-1 backdrop-blur-xl" style={{ boxShadow: "var(--sombra-flutuante)" }}>
          {escolha.map((id) => {
            const A = ATALHOS[id];
            const I = A.icone;
            return (
              <button key={id} onClick={() => usar(id)} title={A.dica} className="group flex h-10 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-medium text-muted transition-colors hover:bg-raised hover:text-fg active:scale-[0.97]">
                <I size={16} strokeWidth={1.9} className={`transition-transform group-hover:-translate-y-px ${id === "ia" ? "text-accent" : ""}`} />
                <span className="hidden sm:inline">{A.nome}</span>
              </button>
            );
          })}
          <span className="mx-0.5 h-6 w-px bg-line" />
          <button onClick={() => setConfig((x) => !x)} className={`grid h-10 w-9 place-items-center rounded-xl text-muted hover:bg-raised hover:text-fg ${config ? "bg-raised text-fg" : ""}`} aria-label="Escolher atalhos" title="Escolher atalhos">
            <Settings2 size={15} />
          </button>
          {config && (
            <div className="anim-entrar absolute bottom-full right-0 mb-2 w-[230px] rounded-xl border border-line bg-surface p-1.5" style={{ boxShadow: "var(--sombra-flutuante)" }}>
              <div className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Atalhos da bandeja</div>
              {(Object.keys(ATALHOS) as IdAtalho[]).map((id) => {
                const A = ATALHOS[id];
                const I = A.icone;
                const on = escolha.includes(id);
                return (
                  <button key={id} onClick={() => alternar(id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-raised">
                    <I size={14} className="text-muted" />
                    <span className="flex-1">{A.nome}</span>
                    <span className={`grid h-4 w-4 place-items-center rounded border ${on ? "border-accent bg-accent text-accent-fg" : "border-line"}`}>{on && <Check size={11} strokeWidth={3} />}</span>
                  </button>
                );
              })}
              <p className="px-2 pt-1 text-[11px] text-muted">Alt+C despejar · Alt+D demanda · Alt+N anotação · Alt+T tarefa</p>
            </div>
          )}
        </nav>
      </div>

      {popup === "despejar" && (
        <Popup titulo="Despejar e organizar" icone={Wand2} fechar={() => setPopup(null)}>
          <CaixaUniversal clienteInicial={clienteDaPagina} fechar={() => setPopup(null)} />
        </Popup>
      )}
      {popup === "demanda" && <PopupTarefa demanda clienteInicial={clienteDaPagina} fechar={() => setPopup(null)} />}
      {popup === "tarefa" && <PopupTarefa clienteInicial={clienteDaPagina} fechar={() => setPopup(null)} />}
      {popup === "anotacao" && <PopupAnotacao clienteInicial={clienteDaPagina} fechar={() => setPopup(null)} />}
    </>
  );
}

/** Janela pequena no centro da tela, por cima da página atual. */
function Popup({ titulo, icone: I, fechar, children }: { titulo: string; icone: LucideIcon; fechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4 text-fg">
      <div className="anim-entrar absolute inset-0 bg-[rgb(12_14_20/0.35)] backdrop-blur-[2px]" onClick={fechar} />
      <section role="dialog" aria-modal="true" aria-label={titulo} className="popup-rapido relative flex max-h-[90dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ boxShadow: "var(--sombra-flutuante)" }}>
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent"><I size={15} /></span>
          <h2 className="text-[15px] font-semibold">{titulo}</h2>
          <button onClick={fechar} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg" aria-label="Fechar"><X size={16} /></button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

function SeletorCliente({ valor, mudar, interna }: { valor: string; mudar: (v: string) => void; interna?: boolean }) {
  const d = useDados();
  return (
    <Selecao value={valor} onChange={(e) => mudar(e.target.value)}>
      <option value="">{interna ? "Interna da agência" : "Escolha o cliente…"}</option>
      {[...d.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </Selecao>
  );
}

function PopupTarefa({ demanda = false, clienteInicial, fechar }: { demanda?: boolean; clienteInicial: string; fechar: () => void }) {
  const d = useDados();
  const [cliente, setCliente] = useState(clienteInicial);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pilar, setPilar] = useState<Pilar>("trafego");
  const [prioridade, setPrioridade] = useState<Prioridade>("normal");
  const [responsavel, setResponsavel] = useState(d.eu ?? "");
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [continuar, setContinuar] = useState(false);
  const campoTitulo = useRef<HTMLInputElement>(null);
  useEffect(() => campoTitulo.current?.focus(), []);

  async function salvar() {
    if (!titulo.trim()) return d.avisar("Escreva a demanda.");
    if (!cliente) return d.avisar("Escolha o cliente (para assuntos internos, use Agência Vertente Digital).");
    setSalvando(true);
    try {
      await repo.salvarTarefa(null, {
        titulo: titulo.trim(),
        cliente_id: cliente,
        pilar,
        prioridade,
        descricao: descricao.trim() || null,
        responsavel_id: demanda ? null : responsavel || null,
        prazo: demanda ? null : prazo || null,
        triagem: demanda,
      });
      d.recarregar().catch(() => null);
      d.avisar(demanda ? "Demanda na caixa de entrada" : "Tarefa criada");
      if (continuar) {
        setTitulo("");
        setDescricao("");
        campoTitulo.current?.focus();
      } else fechar();
    } catch (e) {
      d.avisar(`Não foi possível salvar: ${(e as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Popup titulo={demanda ? "Nova demanda" : "Nova tarefa"} icone={demanda ? Inbox : CheckSquare} fechar={fechar}>
      <div className="flex flex-col gap-3" onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) salvar(); }}>
        <input ref={campoTitulo} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={demanda ? "O que precisa ser feito?" : "Título da tarefa"} className={`${campo} !py-2 !text-[14.5px]`} onKeyDown={(e) => { if (e.key === "Enter" && !e.ctrlKey) { e.preventDefault(); salvar(); } }} />
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Detalhes (opcional)" className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Rotulo texto="Cliente"><SeletorCliente valor={cliente} mudar={setCliente} /></Rotulo>
          <Rotulo texto="Pilar">
            <Selecao value={pilar} onChange={(e) => setPilar(e.target.value as Pilar)}>{PILARES.map((p) => <option key={p} value={p}>{PILAR[p]}</option>)}</Selecao>
          </Rotulo>
          <Rotulo texto="Prioridade">
            <Selecao value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>{(Object.keys(PRIORIDADE) as Prioridade[]).map((p) => <option key={p} value={p}>{PRIORIDADE[p]}</option>)}</Selecao>
          </Rotulo>
          {!demanda && (
            <>
              <Rotulo texto="Responsável">
                <Selecao value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
                  <option value="">Sem responsável</option>
                  {d.membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </Selecao>
              </Rotulo>
              <Rotulo texto="Prazo"><Entrada type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Rotulo>
            </>
          )}
        </div>
        {demanda && <p className="text-[12px] text-muted">Entra na caixa de entrada sem responsável e sem prazo; na triagem você define os dois.</p>}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            <input type="checkbox" checked={continuar} onChange={(e) => setContinuar(e.target.checked)} className="accent-[rgb(var(--accent-c))]" /> Lançar outra em seguida
          </label>
          <div className="ml-auto flex gap-2">
            <Botao onClick={fechar}>Cancelar</Botao>
            <Botao variante="primario" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : demanda ? "Descarregar demanda" : "Criar tarefa"}</Botao>
          </div>
        </div>
      </div>
    </Popup>
  );
}

function PopupAnotacao({ clienteInicial, fechar }: { clienteInicial: string; fechar: () => void }) {
  const d = useDados();
  const notas = useNotas();
  const [cliente, setCliente] = useState(clienteInicial);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [etiqueta, setEtiqueta] = useState<Etiqueta>("geral");
  const [fixada, setFixada] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!texto.trim()) return d.avisar("Escreva a anotação.");
    setSalvando(true);
    try {
      await notas.salvar(null, { titulo: titulo.trim() || null, texto: texto.trim(), etiqueta, cliente_id: cliente || null, fixada, autor_id: d.eu } as Partial<Nota>);
      d.avisar("Anotação salva");
      fechar();
    } catch (e) {
      d.avisar(`Não foi possível salvar: ${(e as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Popup titulo="Nova anotação" icone={StickyNote} fechar={fechar}>
      <div className="flex flex-col gap-3" onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) salvar(); }}>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" className="w-full bg-transparent text-[15px] font-semibold outline-none placeholder:text-muted/70" />
        <CampoMencao valor={texto} mudar={setTexto} rows={5} placeholder="Decisões, combinados, ideias, aprendizados… Use @ para marcar alguém." className="text-[13.5px]" autoFocus />
        <div className="flex flex-wrap gap-1">
          {(Object.keys(ETIQUETAS) as Etiqueta[]).map((e) => (
            <button key={e} onClick={() => setEtiqueta(e)} className={`rounded-full px-2.5 py-1 text-[11.5px] ${etiqueta === e ? "text-white" : "bg-raised text-muted hover:text-fg"}`} style={etiqueta === e ? { background: ETIQUETAS[e].cor } : undefined}>
              {ETIQUETAS[e].nome}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto]">
          <Rotulo texto="Cliente"><SeletorCliente valor={cliente} mudar={setCliente} interna /></Rotulo>
          <label className="flex h-[34px] items-center gap-2 text-[12.5px] text-muted">
            <input type="checkbox" checked={fixada} onChange={(e) => setFixada(e.target.checked)} className="accent-[rgb(var(--accent-c))]" /> Fixar como importante
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Botao onClick={fechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={salvar} disabled={salvando || !texto.trim()}>{salvando ? "Salvando…" : "Salvar anotação"}</Botao>
        </div>
      </div>
    </Popup>
  );
}
