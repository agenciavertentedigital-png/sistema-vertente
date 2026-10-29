import { useMemo, useState } from "react";
import { Pin, PinOff, Search, StickyNote, Trash2 } from "lucide-react";
import { useDados } from "../lib/dados";
import { ETIQUETAS, useNotas, type Etiqueta, type Nota } from "../lib/briefing";
import { CampoMencao, TextoComMencoes } from "./LinhaDoTempo";
import { Botao, Painel, Selecao, campo } from "./ui";

const quando = (iso: string) => {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

/**
 * Anotações vivas (editáveis, fixáveis, com etiqueta). Com clienteId mostra só as do cliente;
 * sem clienteId é a visão geral, com filtro por cliente e notas internas da agência.
 */
export function Anotacoes({ clienteId }: { clienteId?: string }) {
  const d = useDados();
  const tn = useNotas();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Etiqueta | "">("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [aberta, setAberta] = useState<Nota | null>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tn.linhas
      .filter((n) => (clienteId ? n.cliente_id === clienteId : !filtroCliente || (filtroCliente === "interna" ? !n.cliente_id : n.cliente_id === filtroCliente)))
      .filter((n) => !filtro || n.etiqueta === filtro)
      .filter((n) => !q || `${n.titulo ?? ""} ${n.texto}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.fixada) - Number(a.fixada) || b.atualizado_em.localeCompare(a.atualizado_em));
  }, [tn.linhas, clienteId, filtroCliente, filtro, busca]);

  const contagem = (e: Etiqueta) => tn.linhas.filter((n) => (clienteId ? n.cliente_id === clienteId : true) && n.etiqueta === e).length;

  return (
    <div className="flex flex-col gap-4">
      <NovaNota clienteId={clienteId} salvar={(n) => tn.salvar(null, { ...n, autor_id: d.eu } as Partial<Nota>)} />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <Chip ativo={!filtro} onClick={() => setFiltro("")}>Todas</Chip>
          {(Object.keys(ETIQUETAS) as Etiqueta[]).map((e) => (
            <Chip key={e} ativo={filtro === e} cor={ETIQUETAS[e].cor} onClick={() => setFiltro(filtro === e ? "" : e)}>
              {ETIQUETAS[e].nome} <span className="num opacity-60">{contagem(e)}</span>
            </Chip>
          ))}
        </div>
        <div className="flex gap-2">
          {!clienteId && (
            <Selecao value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} className="w-[190px]">
              <option value="">Todos os clientes</option>
              <option value="interna">Internas da agência</option>
              {d.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Selecao>
          )}
          <div className="relative w-full lg:w-[220px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nas anotações" className={`${campo} pl-8`} />
          </div>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center text-[13px] text-muted">
          <StickyNote size={24} />
          {tn.linhas.length ? "Nenhuma anotação com esse filtro." : "Nenhuma anotação ainda. Escreva acima o que não pode ser esquecido."}
        </div>
      ) : (
        <div className="columns-1 gap-3 md:columns-2 2xl:columns-3">
          {lista.map((n) => (
            <CartaoNota key={n.id} n={n} mostrarCliente={!clienteId} abrir={() => setAberta(n)} fixar={() => tn.salvar(n.id, { fixada: !n.fixada })} />
          ))}
        </div>
      )}

      <Painel aberto={Boolean(aberta)} fechar={() => setAberta(null)} titulo="Anotação">
        {aberta && (
          <EditarNota
            n={aberta}
            salvar={async (campos) => { await tn.salvar(aberta.id, campos); setAberta(null); }}
            excluir={async () => { await tn.excluir(aberta.id); setAberta(null); }}
          />
        )}
      </Painel>
    </div>
  );
}

function Chip({ ativo, cor, children, onClick }: { ativo: boolean; cor?: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${ativo ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface hover:bg-raised"}`}>
      {cor && <span className="h-2 w-2 rounded-full" style={{ background: cor }} />}
      {children}
    </button>
  );
}

function NovaNota({ clienteId, salvar }: { clienteId?: string; salvar: (n: Partial<Nota>) => Promise<unknown> }) {
  const d = useDados();
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [etiqueta, setEtiqueta] = useState<Etiqueta>("geral");
  const [cliente, setCliente] = useState(clienteId ?? "");
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState(false);

  async function enviar() {
    if (!texto.trim()) return;
    try {
      await salvar({ titulo: titulo.trim() || null, texto: texto.trim(), etiqueta, cliente_id: cliente || null, fixada: false });
      setTitulo(""); setTexto(""); setEtiqueta("geral"); setErro(""); setAberta(false);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="rounded-2xl bg-surface p-3" style={{ boxShadow: "var(--sombra)" }}>
      {aberta && <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" className="mb-1 w-full bg-transparent px-1 text-[14px] font-semibold outline-none" />}
      <CampoMencao
        valor={texto}
        mudar={setTexto}
        onFocus={() => setAberta(true)}
        rows={aberta ? 3 : 1}
        placeholder="Anotar algo… (decisões, combinados, ideias, aprendizados). Use @ para marcar alguém."
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar(); }}
        className="border-0 bg-transparent px-1 text-[13.5px] focus:border-0"
      />
      {aberta && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(ETIQUETAS) as Etiqueta[]).map((e) => (
              <button key={e} onClick={() => setEtiqueta(e)} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] ${etiqueta === e ? "text-white" : "bg-raised text-muted hover:text-fg"}`} style={etiqueta === e ? { background: ETIQUETAS[e].cor } : undefined}>
                {ETIQUETAS[e].nome}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!clienteId && (
              <Selecao value={cliente} onChange={(e) => setCliente(e.target.value)} className="w-[180px]">
                <option value="">Interna da agência</option>
                {d.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Selecao>
            )}
            <Botao variante="fantasma" onClick={() => setAberta(false)}>Fechar</Botao>
            <Botao variante="primario" disabled={!texto.trim()} onClick={enviar}>Salvar nota</Botao>
          </div>
          {erro && <p className="w-full text-[12px] text-bad">{erro}</p>}
        </div>
      )}
    </div>
  );
}

function CartaoNota({ n, mostrarCliente, abrir, fixar }: { n: Nota; mostrarCliente: boolean; abrir: () => void; fixar: () => void }) {
  const d = useDados();
  const e = ETIQUETAS[n.etiqueta] ?? ETIQUETAS.geral;
  const autor = d.membros.find((m) => m.id === n.autor_id)?.nome.split(" ")[0];
  const cliente = n.cliente_id ? d.cliente(n.cliente_id)?.nome : "Interna";
  return (
    <article onClick={abrir} className="group mb-3 cursor-pointer break-inside-avoid rounded-2xl border-l-4 bg-surface p-3.5 hover:ring-1 hover:ring-accent/30" style={{ boxShadow: "var(--sombra)", borderLeftColor: e.cor }}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <span className="font-medium" style={{ color: e.cor }}>{e.nome}</span>
          {mostrarCliente && <span className="rounded-full bg-raised px-2 py-0.5 text-muted">{cliente}</span>}
        </div>
        <button onClick={(ev) => { ev.stopPropagation(); fixar(); }} className={`rounded-md p-1 ${n.fixada ? "text-accent" : "text-muted opacity-0 group-hover:opacity-100"} hover:bg-raised`} title={n.fixada ? "Desafixar" : "Fixar no topo"}>
          {n.fixada ? <Pin size={14} className="fill-current" /> : <Pin size={14} />}
        </button>
      </div>
      {n.titulo && <h4 className="mb-1 text-[14px] font-semibold leading-snug">{n.titulo}</h4>}
      <p className="line-clamp-[8] whitespace-pre-wrap text-[13px] leading-relaxed text-fg/90"><TextoComMencoes texto={n.texto} /></p>
      <div className="mt-2 text-[11.5px] text-muted">{autor ? `${autor} · ` : ""}{quando(n.atualizado_em)}</div>
    </article>
  );
}

function EditarNota({ n, salvar, excluir }: { n: Nota; salvar: (c: Partial<Nota>) => Promise<void>; excluir: () => Promise<void> }) {
  const [titulo, setTitulo] = useState(n.titulo ?? "");
  const [texto, setTexto] = useState(n.texto);
  const [etiqueta, setEtiqueta] = useState<Etiqueta>(n.etiqueta);
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" className={`${campo} text-[15px] font-semibold`} />
      <CampoMencao valor={texto} mudar={setTexto} rows={10} />
      <div className="flex flex-wrap gap-1">
        {(Object.keys(ETIQUETAS) as Etiqueta[]).map((e) => (
          <button key={e} onClick={() => setEtiqueta(e)} className={`rounded-full px-2.5 py-1 text-[12px] ${etiqueta === e ? "text-white" : "bg-raised text-muted"}`} style={etiqueta === e ? { background: ETIQUETAS[e].cor } : undefined}>
            {ETIQUETAS[e].nome}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 pt-2">
        <Botao variante="fantasma" onClick={() => (confirmar ? excluir() : setConfirmar(true))} className="text-bad">
          <Trash2 size={14} /> {confirmar ? "Clique de novo para excluir" : "Excluir"}
        </Botao>
        <div className="flex gap-2">
          <Botao onClick={() => salvar({ fixada: !n.fixada })}>{n.fixada ? <><PinOff size={14} /> Desafixar</> : <><Pin size={14} /> Fixar</>}</Botao>
          <Botao variante="primario" disabled={!texto.trim()} onClick={() => salvar({ titulo: titulo.trim() || null, texto: texto.trim(), etiqueta })}>Salvar</Botao>
        </div>
      </div>
    </div>
  );
}
