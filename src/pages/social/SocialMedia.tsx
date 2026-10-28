import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useDados } from "../../lib/dados";
import { useTabela } from "../../lib/tabela";
import { hoje, somarDias } from "../../lib/tipos";
import { CAMPOS_POST, COR_POST, FORMATOS, NOME_FORMATO, NOME_POST, STATUS_POST, type Post, type StatusPost } from "../../lib/social";
import { demoPosts } from "../../data/modulosDemo";
import { Botao, Entrada, Iniciais, Painel, Rotulo, Selecao, Vazio, campo } from "../../components/ui";
import { Abas, Cabecalho, Kpi, MESES_LONGOS, Selo, somarMeses } from "../../components/visual";

type Aba = "social" | "social-quadro" | "social-aprovacao";
const SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function inicioSemana(d: string) {
  const dow = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
  return somarDias(d, -dow);
}

export function SocialMedia({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const d = useDados();
  const aba: Aba = rota === "social-quadro" ? "social-quadro" : rota === "social-aprovacao" ? "social-aprovacao" : "social";
  const posts = useTabela<Post>("posts", CAMPOS_POST, demoPosts, { desde: { coluna: "data", valor: somarDias(hoje(), -120) }, ordem: { coluna: "data" } });
  const [cliente, setCliente] = useState("");
  const [editando, setEditando] = useState<Partial<Post> | null>(null);

  const lista = posts.linhas.filter((p) => !cliente || p.cliente_id === cliente);
  const h = hoje();
  const semana = inicioSemana(h);
  const atrasados = lista.filter((p) => p.data < h && p.status !== "publicado");
  const comCliente = lista.filter((p) => p.status === "aprovacao");
  const ajustes = lista.filter((p) => p.status === "ajuste");
  const daSemana = lista.filter((p) => p.data >= semana && p.data <= somarDias(semana, 6));
  const publicadosMes = lista.filter((p) => p.status === "publicado" && p.data.startsWith(h.slice(0, 7)));

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
      <Cabecalho
        icone={CalendarDays}
        rotulo="Fase 4 · Operacional"
        titulo="Social Media"
        descricao="Cronograma de conteúdo de cada cliente, da ideia ao post publicado, com aprovação do cliente."
        acoes={
          <>
            <Selecao value={cliente} onChange={(e) => setCliente(e.target.value)} className="!w-auto">
              <option value="">Todos os clientes</option>
              {d.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Selecao>
            <Botao variante="primario" onClick={() => setEditando({ data: h, cliente_id: cliente || undefined, status: "ideia", formato: "feed" })}><Plus size={15} /> Novo post</Botao>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi rotulo="Posts desta semana" valor={daSemana.length} detalhe={`${daSemana.filter((p) => p.status === "publicado").length} publicados`} />
        <Kpi rotulo="Com o cliente" valor={comCliente.length} tom={comCliente.length ? "warn" : "neutro"} detalhe="aguardando aprovação" onClick={() => ir("social-aprovacao")} />
        <Kpi rotulo="Ajustes pedidos" valor={ajustes.length} tom={ajustes.length ? "bad" : "neutro"} onClick={() => ir("social-quadro")} />
        <Kpi rotulo="Atrasados" valor={atrasados.length} tom={atrasados.length ? "bad" : "ok"} detalhe="data passou e não publicou" />
        <Kpi rotulo="Publicados no mês" valor={publicadosMes.length} tom="ok" />
      </div>
      <Abas<Aba>
        abas={[
          { id: "social", nome: "Calendário" },
          { id: "social-quadro", nome: "Quadro de produção" },
          { id: "social-aprovacao", nome: "Aprovações", contador: comCliente.length + ajustes.length },
        ]}
        ativa={aba}
        mudar={ir}
      />
      {posts.erro && <Vazio>{posts.erro}</Vazio>}
      {posts.carregando ? (
        <Vazio>Carregando…</Vazio>
      ) : aba === "social" ? (
        <Calendario posts={lista} abrir={setEditando} />
      ) : aba === "social-quadro" ? (
        <Quadro posts={lista.filter((p) => p.data >= somarDias(h, -14))} abrir={setEditando} mover={(p, s) => posts.salvar(p.id, { status: s })} />
      ) : (
        <Aprovacoes posts={lista} abrir={setEditando} />
      )}
      {editando && <EditorPost post={editando} fechar={() => setEditando(null)} posts={posts} />}
    </div>
  );
}

function PilulaPost({ post, abrir, compacta }: { post: Post; abrir: (p: Post) => void; compacta?: boolean }) {
  const d = useDados();
  const nome = d.cliente(post.cliente_id)?.nome ?? "";
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/post", post.id)}
      onClick={(e) => {
        e.stopPropagation();
        abrir(post);
      }}
      title={`${nome} · ${post.tema} · ${NOME_POST[post.status]}`}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11.5px] leading-tight hover:brightness-95"
      style={{ background: `color-mix(in srgb, ${COR_POST[post.status]} 14%, var(--surface))`, borderLeft: `3px solid ${COR_POST[post.status]}` }}
    >
      <span className="min-w-0 flex-1 truncate">
        <b className="font-semibold">{nome.split(" ").slice(0, 2).join(" ")}</b>
        {!compacta && <span className="text-muted"> · {post.tema}</span>}
      </span>
      <span className="shrink-0 text-[10px] text-muted">{NOME_FORMATO[post.formato].slice(0, 4)}</span>
    </button>
  );
}

function Calendario({ posts, abrir }: { posts: Post[]; abrir: (p: Partial<Post>) => void }) {
  const [mes, setMes] = useState(hoje().slice(0, 7) + "-01");
  const inicio = inicioSemana(mes);
  const fimMes = somarDias(somarMeses(mes, 1), -1);
  const semanas = Math.ceil((Date.parse(`${fimMes}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86400000 / 7 + 0.01);
  const porDia = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of posts) m.set(p.data, [...(m.get(p.data) ?? []), p]);
    return m;
  }, [posts]);
  const h = hoje();

  return (
    <section className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Botao variante="fantasma" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior"><ChevronLeft size={16} /></Botao>
          <h2 className="min-w-[170px] text-center text-[16px] font-semibold">{MESES_LONGOS[Number(mes.slice(5, 7)) - 1]} {mes.slice(0, 4)}</h2>
          <Botao variante="fantasma" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês"><ChevronRight size={16} /></Botao>
          <Botao variante="fantasma" onClick={() => setMes(hoje().slice(0, 7) + "-01")}>Hoje</Botao>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_POST.map((s) => (
            <span key={s.id} className="flex items-center gap-1 text-[11.5px] text-muted"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} />{s.nome}</span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
          {SEMANA.map((s) => (
            <div key={s} className="bg-raised px-2 py-1.5 text-[11.5px] font-semibold text-muted">{s}</div>
          ))}
          {Array.from({ length: semanas * 7 }, (_, i) => {
            const dia = somarDias(inicio, i);
            const fora = dia.slice(0, 7) !== mes.slice(0, 7);
            const itens = porDia.get(dia) ?? [];
            return (
              <div
                key={dia}
                onClick={() => abrir({ data: dia, status: "ideia", formato: "feed" })}
                className={`group flex min-h-[112px] cursor-pointer flex-col gap-1 p-1.5 ${fora ? "bg-bg" : "bg-surface"} hover:bg-raised`}
              >
                <div className="flex items-center justify-between">
                  <span className={`num grid h-6 w-6 place-items-center rounded-full text-[12px] ${dia === h ? "bg-accent font-semibold text-accent-fg" : fora ? "text-muted" : ""}`}>{Number(dia.slice(8, 10))}</span>
                  <Plus size={13} className="text-muted opacity-0 group-hover:opacity-100" />
                </div>
                {itens.slice(0, 4).map((p) => <PilulaPost key={p.id} post={p} abrir={abrir} compacta />)}
                {itens.length > 4 && <span className="px-1 text-[11px] text-muted">+{itens.length - 4} posts</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Quadro({ posts, abrir, mover }: { posts: Post[]; abrir: (p: Partial<Post>) => void; mover: (p: Post, s: StatusPost) => Promise<unknown> }) {
  const [sobre, setSobre] = useState<StatusPost | null>(null);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1100px] grid-cols-6 gap-3">
        {STATUS_POST.map((s) => {
          const itens = posts.filter((p) => p.status === s.id).sort((a, b) => a.data.localeCompare(b.data));
          return (
            <div
              key={s.id}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(s.id);
              }}
              onDragLeave={() => setSobre(null)}
              onDrop={(e) => {
                setSobre(null);
                const p = posts.find((x) => x.id === e.dataTransfer.getData("text/post"));
                if (p && p.status !== s.id) mover(p, s.id);
              }}
              className={`flex min-h-[300px] flex-col gap-2 rounded-2xl p-2 ${sobre === s.id ? "bg-accent-soft" : "bg-raised"}`}
            >
              <div className="flex items-center justify-between px-1.5 pt-1">
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold"><i className="h-2.5 w-2.5 rounded-full" style={{ background: s.cor }} />{s.nome}</span>
                <span className="num text-[12px] text-muted">{itens.length}</span>
              </div>
              {itens.map((p) => <CartaoPost key={p.id} post={p} abrir={abrir} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CartaoPost({ post, abrir }: { post: Post; abrir: (p: Partial<Post>) => void }) {
  const d = useDados();
  const atrasado = post.data < hoje() && post.status !== "publicado";
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/post", post.id)}
      onClick={() => abrir(post)}
      className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-2.5 text-left hover:border-accent"
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span className={atrasado ? "font-semibold text-bad" : ""}>{post.data.slice(8, 10)}/{post.data.slice(5, 7)}</span>
        <span className="rounded bg-raised px-1.5 py-px">{NOME_FORMATO[post.formato]}</span>
      </div>
      <div className="text-[13px] font-medium leading-snug">{post.tema}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] text-muted">{d.cliente(post.cliente_id)?.nome}</span>
        {post.responsavel_id && <Iniciais nome={d.membro(post.responsavel_id)?.nome} />}
      </div>
    </button>
  );
}

function Aprovacoes({ posts, abrir }: { posts: Post[]; abrir: (p: Partial<Post>) => void }) {
  const d = useDados();
  const pendentes = posts.filter((p) => p.status === "aprovacao" || p.status === "ajuste");
  const porCliente = new Map<string, Post[]>();
  for (const p of pendentes) porCliente.set(p.cliente_id, [...(porCliente.get(p.cliente_id) ?? []), p]);
  if (!pendentes.length) return <Vazio>Nada aguardando o cliente. Quando um post for para "Com o cliente", ele aparece aqui com a mensagem pronta para pedir a aprovação.</Vazio>;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {[...porCliente.entries()].map(([cid, ps]) => {
        const nome = d.cliente(cid)?.nome ?? "Cliente";
        const msg = `Oi, tudo bem? 😊\n\nSeparamos os próximos conteúdos para aprovação:\n\n${ps
          .filter((p) => p.status === "aprovacao")
          .map((p) => `• ${p.data.slice(8, 10)}/${p.data.slice(5, 7)} · ${NOME_FORMATO[p.formato]} · ${p.tema}${p.link_material ? `\n  ${p.link_material}` : ""}`)
          .join("\n")}\n\nPode dar uma olhadinha e nos dizer se aprova ou se quer algum ajuste?`;
        return (
          <section key={cid} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold">{nome}</h3>
              <Botao
                onClick={() => {
                  navigator.clipboard?.writeText(msg);
                  d.avisar("Mensagem copiada");
                }}
              >
                <Copy size={14} /> Copiar pedido de aprovação
              </Botao>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {ps.map((p) => (
                <li key={p.id}>
                  <button onClick={() => abrir(p)} className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2 text-left text-[13px] hover:border-accent">
                    <span className="num text-[12px] text-muted">{p.data.slice(8, 10)}/{p.data.slice(5, 7)}</span>
                    <span className="min-w-0 flex-1 truncate">{p.tema}</span>
                    <Selo cor={COR_POST[p.status]}>{NOME_POST[p.status]}</Selo>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EditorPost({ post, fechar, posts }: { post: Partial<Post>; fechar: () => void; posts: ReturnType<typeof useTabela<Post>> }) {
  const d = useDados();
  const [f, setF] = useState<Partial<Post>>(post);
  const set = (c: Partial<Post>) => setF({ ...f, ...c });
  async function salvar() {
    if (!f.cliente_id || !f.tema?.trim() || !f.data) return;
    try {
      const { id, ...campos } = f;
      await posts.salvar(id ?? null, campos);
      fechar();
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }
  return (
    <Painel aberto fechar={fechar} titulo={post.id ? "Post" : "Novo post"}>
      <div className="flex flex-col gap-3.5">
        <Rotulo texto="Cliente">
          <Selecao value={f.cliente_id ?? ""} onChange={(e) => set({ cliente_id: e.target.value })}>
            <option value="">Escolha…</option>
            {d.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Selecao>
        </Rotulo>
        <Rotulo texto="Tema do post"><Entrada value={f.tema ?? ""} onChange={(e) => set({ tema: e.target.value })} placeholder="Ex.: Antes e depois do tratamento" autoFocus /></Rotulo>
        <div className="grid grid-cols-2 gap-3">
          <Rotulo texto="Data"><Entrada type="date" value={f.data ?? ""} onChange={(e) => set({ data: e.target.value })} /></Rotulo>
          <Rotulo texto="Formato">
            <Selecao value={f.formato ?? "feed"} onChange={(e) => set({ formato: e.target.value as Post["formato"] })}>
              {FORMATOS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </Selecao>
          </Rotulo>
        </div>
        <div>
          <div className="mb-1 text-[12px] text-muted">Etapa</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_POST.map((s) => (
              <button
                key={s.id}
                onClick={() => set({ status: s.id })}
                className="rounded-full border px-2.5 py-1 text-[12px] font-medium"
                style={f.status === s.id ? { background: s.cor, borderColor: s.cor, color: "#fff" } : { borderColor: "var(--line)", color: "var(--muted)" }}
              >
                {s.nome}
              </button>
            ))}
          </div>
        </div>
        <Rotulo texto="Responsável">
          <Selecao value={f.responsavel_id ?? ""} onChange={(e) => set({ responsavel_id: e.target.value || null })}>
            <option value="">Sem responsável</option>
            {d.membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Selecao>
        </Rotulo>
        <Rotulo texto="Legenda"><textarea rows={5} value={f.legenda ?? ""} onChange={(e) => set({ legenda: e.target.value })} className={campo} /></Rotulo>
        <Rotulo texto="Link do material (Drive, Canva…)">
          <div className="flex gap-2">
            <Entrada value={f.link_material ?? ""} onChange={(e) => set({ link_material: e.target.value || null })} />
            {f.link_material && <a href={f.link_material} target="_blank" rel="noreferrer" className="grid place-items-center rounded-lg border border-line px-2 text-muted hover:text-fg"><ExternalLink size={14} /></a>}
          </div>
        </Rotulo>
        <Rotulo texto="Link do post publicado"><Entrada value={f.link_publicado ?? ""} onChange={(e) => set({ link_publicado: e.target.value || null })} /></Rotulo>
        <Rotulo texto="Observações / ajustes pedidos"><textarea rows={2} value={f.observacoes ?? ""} onChange={(e) => set({ observacoes: e.target.value || null })} className={campo} /></Rotulo>
        <div className="flex justify-between gap-2">
          {post.id ? <Botao variante="fantasma" onClick={async () => { await posts.excluir(post.id!); fechar(); }}><Trash2 size={14} /> Apagar</Botao> : <span />}
          <Botao variante="primario" onClick={salvar} disabled={!f.cliente_id || !f.tema?.trim()}>Salvar</Botao>
        </div>
      </div>
    </Painel>
  );
}
