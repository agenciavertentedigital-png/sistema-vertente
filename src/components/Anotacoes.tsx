import { useMemo, useRef, useState } from "react";
import { Building, ChevronRight, FileText, Folder, FolderOpen, FolderPlus, Globe, Lock, Pencil, Pin, PinOff, Plus, Search, Share2, StickyNote, Trash2 } from "lucide-react";
import { useDados } from "../lib/dados";
import { ETIQUETAS, PASTAS_SUGERIDAS, useNotas, usePastas, type Etiqueta, type Nota, type Pasta } from "../lib/briefing";
import { TextoComMencoes } from "./LinhaDoTempo";
import { EditorDoc } from "./doc/EditorDoc";
import { CompartilharDoc } from "./doc/CompartilharDoc";
import { htmlDoDocumento } from "../lib/doc";
import { Botao, Painel, campo } from "./ui";

const quando = (iso: string) => {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};
const AGENCIA = "agencia";
type Sel = { escopo: string; pasta: string | "todas" | "sem" };

/**
 * Anotações em pastas e subpastas. Com clienteId mostra só o cliente;
 * sem clienteId mostra a agência e todos os clientes, cada um com as suas pastas.
 */
export function Anotacoes({ clienteId }: { clienteId?: string }) {
  const d = useDados();
  const tn = useNotas();
  const tp = usePastas();
  const [sel, setSel] = useState<Sel>({ escopo: clienteId ?? AGENCIA, pasta: "todas" });
  const [busca, setBusca] = useState("");
  const [filtroArvore, setFiltroArvore] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set([clienteId ?? AGENCIA]));
  const [aberta, setAberta] = useState<Nota | null>(null);
  const [nova, setNova] = useState(false);
  const [nomeando, setNomeando] = useState<{ pai: string | null; id?: string; nome: string } | null>(null);

  const doEscopo = (esc: string) => (n: { cliente_id: string | null }) => (esc === AGENCIA ? !n.cliente_id : n.cliente_id === esc);
  const pastasDe = (esc: string) => tp.linhas.filter(doEscopo(esc));
  const filhas = (esc: string, pai: string | null) => pastasDe(esc).filter((p) => p.pai_id === pai).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const descendentes = (id: string): string[] => { const f = tp.linhas.filter((p) => p.pai_id === id).map((p) => p.id); return [id, ...f.flatMap(descendentes)]; };
  const notasDe = (esc: string) => tn.linhas.filter(doEscopo(esc));
  const contar = (esc: string, pasta: string) => { const ids = new Set(descendentes(pasta)); return notasDe(esc).filter((n) => n.pasta_id && ids.has(n.pasta_id)).length; };

  const escopos = clienteId ? [clienteId] : [AGENCIA, ...d.clientes.map((c) => c.id)];
  const nomeEscopo = (esc: string) => (esc === AGENCIA ? "Agência (internas)" : d.cliente(esc)?.nome ?? "Cliente");
  const escoposVisiveis = escopos.filter((e) => !filtroArvore || nomeEscopo(e).toLowerCase().includes(filtroArvore.toLowerCase()));

  const pastaAtual = sel.pasta !== "todas" && sel.pasta !== "sem" ? tp.linhas.find((p) => p.id === sel.pasta) ?? null : null;
  const caminhoAtual = useMemo(() => { const r: Pasta[] = []; let p = pastaAtual; while (p) { r.unshift(p); p = tp.linhas.find((x) => x.id === p!.pai_id) ?? null; } return r; }, [pastaAtual, tp.linhas]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const ids = pastaAtual ? new Set(descendentes(pastaAtual.id)) : null;
    return notasDe(sel.escopo)
      .filter((n) => (sel.pasta === "todas" ? true : sel.pasta === "sem" ? !n.pasta_id : n.pasta_id && ids!.has(n.pasta_id)))
      .filter((n) => !q || `${n.titulo ?? ""} ${n.texto}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.fixada) - Number(a.fixada) || b.atualizado_em.localeCompare(a.atualizado_em));
  }, [tn.linhas, tp.linhas, sel, busca]); // eslint-disable-line react-hooks/exhaustive-deps

  const subpastas = sel.pasta === "sem" ? [] : filhas(sel.escopo, pastaAtual?.id ?? null);
  const alternar = (k: string) => setAbertos((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const cliente_id = (esc: string) => (esc === AGENCIA ? null : esc);

  async function salvarPasta() {
    if (!nomeando?.nome.trim()) return setNomeando(null);
    try {
      if (nomeando.id) await tp.salvar(nomeando.id, { nome: nomeando.nome.trim() });
      else {
        const id = await tp.salvar(null, { nome: nomeando.nome.trim(), pai_id: nomeando.pai, cliente_id: cliente_id(sel.escopo) });
        setSel({ escopo: sel.escopo, pasta: id });
        if (nomeando.pai) setAbertos((s) => new Set([...s, nomeando.pai!]));
      }
      setNomeando(null);
    } catch (e) { d.avisar((e as Error).message); }
  }
  async function excluirPasta(p: Pasta) {
    if (tp.linhas.some((x) => x.pai_id === p.id) || tn.linhas.some((n) => n.pasta_id === p.id)) return d.avisar("Só dá para excluir pasta vazia. Mova as anotações e subpastas antes.");
    await tp.excluir(p.id);
    setSel({ escopo: sel.escopo, pasta: p.pai_id ?? "todas" });
  }
  async function criarSugeridas() {
    for (const nome of PASTAS_SUGERIDAS) await tp.salvar(null, { nome, pai_id: null, cliente_id: cliente_id(sel.escopo) });
    d.avisar("Pastas criadas");
  }

  const Arvore = ({ esc, pai, nivel }: { esc: string; pai: string | null; nivel: number }) => (
    <>
      {filhas(esc, pai).map((p) => {
        const temFilhas = tp.linhas.some((x) => x.pai_id === p.id);
        const ativo = sel.escopo === esc && sel.pasta === p.id;
        return (
          <div key={p.id}>
            <div className={`group flex items-center gap-1 rounded-lg pr-1 text-[13px] ${ativo ? "bg-accent-soft text-accent" : "hover:bg-raised"}`} style={{ paddingLeft: 6 + nivel * 14 }}>
              <button onClick={() => alternar(p.id)} className={`grid h-6 w-4 place-items-center text-muted ${temFilhas ? "" : "invisible"}`} aria-label="Abrir pasta"><ChevronRight size={12} className={abertos.has(p.id) ? "rotate-90" : ""} /></button>
              <button onClick={() => { setSel({ escopo: esc, pasta: p.id }); if (temFilhas) setAbertos((s) => new Set([...s, p.id])); }} className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left">
                {ativo ? <FolderOpen size={14} className="shrink-0" /> : <Folder size={14} className="shrink-0 text-[#d4a72c]" />}
                <span className="truncate">{p.nome}</span>
              </button>
              <span className="num text-[11px] text-muted">{contar(esc, p.id) || ""}</span>
            </div>
            {abertos.has(p.id) && <Arvore esc={esc} pai={p.id} nivel={nivel + 1} />}
          </div>
        );
      })}
    </>
  );

  return (
    <div className="grid min-h-[480px] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Árvore de pastas */}
      <aside className="flex max-h-[calc(100dvh-180px)] flex-col gap-1 overflow-y-auto rounded-2xl border border-line bg-surface p-2 lg:sticky lg:top-2">
        {!clienteId && (
          <label className="mb-1 flex items-center gap-2 rounded-lg border border-line bg-bg px-2 text-[12.5px] focus-within:border-accent">
            <Search size={13} className="text-muted" /><input value={filtroArvore} onChange={(e) => setFiltroArvore(e.target.value)} placeholder="Filtrar clientes" className="h-8 min-w-0 flex-1 bg-transparent outline-none" />
          </label>
        )}
        {escoposVisiveis.map((esc) => {
          const aberto = abertos.has(esc) || Boolean(clienteId);
          const total = notasDe(esc).length;
          return (
            <div key={esc}>
              {!clienteId && (
                <button onClick={() => { alternar(esc); setSel({ escopo: esc, pasta: "todas" }); }} className={`flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-[13px] font-semibold ${sel.escopo === esc && sel.pasta === "todas" ? "bg-raised" : "hover:bg-raised"}`}>
                  <ChevronRight size={12} className={`shrink-0 text-muted ${aberto ? "rotate-90" : ""}`} />
                  {esc === AGENCIA ? <Building size={14} className="shrink-0 text-accent" /> : <Folder size={14} className="shrink-0 text-accent" />}
                  <span className="min-w-0 flex-1 truncate">{nomeEscopo(esc)}</span>
                  {total > 0 && <span className="num text-[11px] font-normal text-muted">{total}</span>}
                </button>
              )}
              {aberto && (
                <div className={clienteId ? "" : "ml-2 border-l border-line pl-1"}>
                  <button onClick={() => setSel({ escopo: esc, pasta: "todas" })} className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13px] ${sel.escopo === esc && sel.pasta === "todas" ? "bg-accent-soft text-accent" : "hover:bg-raised"}`}>
                    <StickyNote size={14} className="shrink-0" /> <span className="flex-1">Todas as anotações</span><span className="num text-[11px] text-muted">{total || ""}</span>
                  </button>
                  <Arvore esc={esc} pai={null} nivel={0} />
                  {notasDe(esc).some((n) => !n.pasta_id) && (
                    <button onClick={() => setSel({ escopo: esc, pasta: "sem" })} className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13px] ${sel.escopo === esc && sel.pasta === "sem" ? "bg-accent-soft text-accent" : "text-muted hover:bg-raised"}`}>
                      <FileText size={14} className="shrink-0" /> <span className="flex-1">Sem pasta</span><span className="num text-[11px]">{notasDe(esc).filter((n) => !n.pasta_id).length}</span>
                    </button>
                  )}
                  <button onClick={() => { setSel({ escopo: esc, pasta: sel.escopo === esc ? sel.pasta : "todas" }); setNomeando({ pai: null, nome: "" }); }} className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-muted hover:bg-raised hover:text-fg">
                    <FolderPlus size={14} /> Nova pasta
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </aside>

      {/* Conteúdo da pasta */}
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-[14px]">
            <button onClick={() => setSel({ escopo: sel.escopo, pasta: "todas" })} className="font-semibold hover:underline">{clienteId ? "Anotações" : nomeEscopo(sel.escopo)}</button>
            {sel.pasta === "sem" && <><ChevronRight size={13} className="text-muted" /><span className="font-semibold">Sem pasta</span></>}
            {caminhoAtual.map((p) => <span key={p.id} className="flex items-center gap-1"><ChevronRight size={13} className="text-muted" /><button onClick={() => setSel({ escopo: sel.escopo, pasta: p.id })} className="font-semibold hover:underline">{p.nome}</button></span>)}
            {pastaAtual && (
              <span className="ml-1 flex gap-0.5">
                <button onClick={() => setNomeando({ pai: pastaAtual.pai_id, id: pastaAtual.id, nome: pastaAtual.nome })} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg" title="Renomear pasta"><Pencil size={13} /></button>
                <button onClick={() => excluirPasta(pastaAtual)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-raised hover:text-bad" title="Excluir pasta (só vazia)"><Trash2 size={13} /></button>
              </span>
            )}
          </nav>
          <label className="flex h-9 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] focus-within:border-accent sm:w-[220px]">
            <Search size={14} className="text-muted" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          {sel.pasta !== "sem" && <Botao onClick={() => setNomeando({ pai: pastaAtual?.id ?? null, nome: "" })}><FolderPlus size={14} /> {pastaAtual ? "Subpasta" : "Pasta"}</Botao>}
          <Botao variante="primario" onClick={() => setNova(true)}><Plus size={14} /> Anotação</Botao>
        </div>

        {nomeando && (
          <form onSubmit={(e) => { e.preventDefault(); salvarPasta(); }} className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft/40 p-2">
            <Folder size={16} className="text-[#d4a72c]" />
            <input autoFocus value={nomeando.nome} onChange={(e) => setNomeando({ ...nomeando, nome: e.target.value })} placeholder={nomeando.id ? "Novo nome da pasta" : nomeando.pai ? "Nome da subpasta" : "Nome da pasta"} className={`${campo} min-w-0 flex-1`} maxLength={80} />
            <Botao type="submit" variante="primario">{nomeando.id ? "Renomear" : "Criar"}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setNomeando(null)}>Cancelar</Botao>
          </form>
        )}

        {sel.pasta === "todas" && pastasDe(sel.escopo).length === 0 && !nomeando && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-muted">
            <span className="flex-1">Organize em pastas: {PASTAS_SUGERIDAS.join(", ")}.</span>
            <Botao onClick={criarSugeridas}><FolderPlus size={14} /> Criar essas pastas</Botao>
          </div>
        )}

        {subpastas.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {subpastas.map((p) => (
              <button key={p.id} onClick={() => { setSel({ escopo: sel.escopo, pasta: p.id }); setAbertos((s) => new Set([...s, sel.escopo, ...(pastaAtual ? [pastaAtual.id] : [])])); }} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left hover:border-line-forte">
                <Folder size={20} className="shrink-0 fill-[#f2d27a] text-[#d4a72c]" />
                <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{p.nome}</span><span className="text-[11.5px] text-muted">{contar(sel.escopo, p.id)} anotações</span></span>
              </button>
            ))}
          </div>
        )}

        {lista.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center text-[13px] text-muted">
            <StickyNote size={22} />
            {busca ? "Nada encontrado." : "Nenhuma anotação aqui ainda."}
            <Botao onClick={() => setNova(true)}><Plus size={14} /> Nova anotação</Botao>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {lista.map((n) => <LinhaNota key={n.id} n={n} pasta={tp.linhas.find((p) => p.id === n.pasta_id)?.nome} mostrarPasta={sel.pasta === "todas" || (pastaAtual ? n.pasta_id !== pastaAtual.id : false)} abrir={() => setAberta(n)} fixar={() => tn.salvar(n.id, { fixada: !n.fixada })} />)}
          </div>
        )}
      </section>

      <Painel aberto={Boolean(aberta) || nova} fechar={() => { setAberta(null); setNova(false); }} titulo={nova ? "Novo documento" : "Documento"} largura={920}>
        {(aberta || nova) && (
          <EditarNota
            key={aberta?.id ?? "nova"}
            n={aberta}
            pastas={pastasDe(sel.escopo)}
            pastaInicial={aberta ? aberta.pasta_id ?? null : pastaAtual?.id ?? null}
            salvar={async (campos, manterAberto) => {
              if (aberta) {
                await tn.salvar(aberta.id, campos);
                if (manterAberto) setAberta({ ...aberta, ...campos } as Nota);
                else setAberta(null);
              } else {
                const novo = { ...campos, cliente_id: cliente_id(sel.escopo), autor_id: d.eu, fixada: false } as Partial<Nota>;
                const id = await tn.salvar(null, novo);
                setNova(false);
                setAberta(manterAberto ? ({ ...novo, id, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() } as Nota) : null);
              }
              d.avisar("Documento salvo");
            }}
            recarregar={() => tn.recarregar()}
            excluir={aberta ? async () => { await tn.excluir(aberta.id); setAberta(null); } : undefined}
          />
        )}
      </Painel>
    </div>
  );
}

function LinhaNota({ n, pasta, mostrarPasta, abrir, fixar }: { n: Nota; pasta?: string; mostrarPasta: boolean; abrir: () => void; fixar: () => void }) {
  const d = useDados();
  const e = ETIQUETAS[n.etiqueta] ?? ETIQUETAS.geral;
  const autor = d.membros.find((m) => m.id === n.autor_id)?.nome.split(" ")[0];
  const titulo = n.titulo || n.texto.split("\n")[0].slice(0, 90);
  const corpo = n.titulo ? n.texto : n.texto.split("\n").slice(1).join(" ");
  return (
    <div onClick={abrir} className="group flex cursor-pointer items-start gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-raised/50">
      <FileText size={16} className="mt-0.5 shrink-0" style={{ color: e.cor }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><span className="truncate text-[14px] font-medium">{titulo}</span>{n.fixada && <Pin size={12} className="shrink-0 fill-current text-accent" />}{n.compartilhado && <span title={n.com_senha ? "Compartilhado por link, com senha" : "Compartilhado por link"} className="flex shrink-0 items-center gap-0.5 rounded-full bg-ok-soft px-1.5 text-[10.5px] font-medium text-ok">{n.com_senha ? <Lock size={10} /> : <Globe size={10} />} link</span>}</div>
        {corpo.trim() && <p className="line-clamp-2 text-[12.5px] text-muted"><TextoComMencoes texto={corpo} /></p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
          {mostrarPasta && pasta && <span className="flex items-center gap-1"><Folder size={11} className="text-[#d4a72c]" />{pasta}</span>}
          {n.etiqueta !== "geral" && <span style={{ color: e.cor }}>{e.nome}</span>}
          <span>{autor ? `${autor} · ` : ""}{quando(n.atualizado_em)}</span>
        </div>
      </div>
      <button onClick={(ev) => { ev.stopPropagation(); fixar(); }} className={`rounded-md p-1 ${n.fixada ? "text-accent" : "text-muted opacity-0 group-hover:opacity-100"} hover:bg-raised`} title={n.fixada ? "Desafixar" : "Fixar no topo"}>
        {n.fixada ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
    </div>
  );
}

function EditarNota({ n, pastas, pastaInicial, salvar, excluir, recarregar }: { n: Nota | null; pastas: Pasta[]; pastaInicial: string | null; salvar: (c: Partial<Nota>, manterAberto?: boolean) => Promise<void>; excluir?: () => Promise<void>; recarregar: () => void }) {
  const [titulo, setTitulo] = useState(n?.titulo ?? "");
  const [conteudo, setConteudo] = useState(() => htmlDoDocumento(n?.conteudo, n?.texto));
  const [texto, setTexto] = useState(n?.texto ?? "");
  const [etiqueta, setEtiqueta] = useState<Etiqueta>(n?.etiqueta ?? "geral");
  const [pasta, setPasta] = useState<string>(pastaInicial ?? "");
  const [confirmar, setConfirmar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mudou, setMudou] = useState(false);
  const [compartilhar, setCompartilhar] = useState(false);
  const iniciou = useRef(false);
  const nomeCompleto = (p: Pasta): string => { const pai = pastas.find((x) => x.id === p.pai_id); return pai ? `${nomeCompleto(pai)} / ${p.nome}` : p.nome; };
  const opcoes = pastas.map((p) => ({ id: p.id, nome: nomeCompleto(p) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const vazio = !texto.trim() && !titulo.trim();
  async function gravar(manterAberto: boolean) {
    if (vazio || salvando) return;
    setSalvando(true);
    try {
      await salvar({ titulo: titulo.trim() || null, texto: texto.trim() || titulo.trim(), conteudo, etiqueta, pasta_id: pasta || null }, manterAberto);
      setMudou(false);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <input value={titulo} onChange={(e) => { setTitulo(e.target.value); setMudou(true); }} placeholder="Título do documento" className="w-full bg-transparent font-display text-[24px] font-bold tracking-tight outline-none placeholder:text-muted/70" autoFocus={!n} />
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <label className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1">
          <Folder size={13} className="text-[#d4a72c]" />
          <select value={pasta} onChange={(e) => { setPasta(e.target.value); setMudou(true); }} className="bg-transparent outline-none">
            <option value="">Sem pasta</option>
            {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        {(Object.keys(ETIQUETAS) as Etiqueta[]).map((e) => (
          <button key={e} onClick={() => { setEtiqueta(e); setMudou(true); }} className={`rounded-full px-2 py-0.5 text-[11.5px] ${etiqueta === e ? "text-white" : "bg-raised text-muted hover:text-fg"}`} style={etiqueta === e ? { background: ETIQUETAS[e].cor } : undefined}>{ETIQUETAS[e].nome}</button>
        ))}
        {n && (
          <button onClick={() => setCompartilhar((v) => !v)} className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium ${n.compartilhado ? "border-ok/40 bg-ok-soft text-ok" : "border-line hover:bg-raised"}`}>
            {n.compartilhado ? <Globe size={13} /> : <Share2 size={13} />} {n.compartilhado ? "Compartilhado" : "Compartilhar"}
          </button>
        )}
      </div>
      {n && compartilhar && (
        <div className="rounded-2xl border border-line bg-surface p-3">
          <CompartilharDoc notaId={n.id} inicial={{ compartilhado: Boolean(n.compartilhado), codigo: n.codigo ?? null, com_senha: Boolean(n.com_senha) }} mudou={recarregar} />
        </div>
      )}
      <EditorDoc
        conteudo={conteudo}
        autoFoco={Boolean(n)}
        salvar={() => gravar(true)}
        mudar={(html, t) => {
          setConteudo(html);
          setTexto(t);
          if (iniciou.current) setMudou(true);
          iniciou.current = true;
        }}
      />
      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-2 bg-surface/95 px-1 py-2 backdrop-blur">
        {excluir ? (
          <Botao variante="fantasma" onClick={() => (confirmar ? excluir() : setConfirmar(true))} className="text-bad"><Trash2 size={14} /> {confirmar ? "Clique de novo para excluir" : "Excluir"}</Botao>
        ) : <span />}
        <div className="flex items-center gap-2">
          {mudou && <span className="hidden text-[12px] text-muted sm:inline">Alterações não salvas · Ctrl+S salva</span>}
          {n && <Botao onClick={() => salvar({ fixada: !n.fixada }, true)}>{n.fixada ? <><PinOff size={14} /> Desafixar</> : <><Pin size={14} /> Fixar</>}</Botao>}
          <Botao onClick={() => gravar(true)} disabled={vazio || salvando}>Salvar</Botao>
          <Botao variante="primario" disabled={vazio || salvando} onClick={() => gravar(false)}>{salvando ? "Salvando…" : "Salvar e fechar"}</Botao>
        </div>
      </div>
    </div>
  );
}
