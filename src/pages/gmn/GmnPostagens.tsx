import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Loader2, RefreshCw, Send, Sparkles } from "lucide-react";
import { chamarFuncao, useTabela } from "../../lib/tabela";
import { supabase } from "../../lib/supabase";
import { useDados } from "../../lib/dados";
import type { PerfilGmn } from "../../lib/gmn";

interface Agendada {
  id: string; perfil_id: string | null; place_id: string; tipo: string; texto: string; cta_tipo: string | null; cta_url: string | null;
  foto_url: string | null; evento: { titulo?: string; inicio?: string; fim?: string } | null; oferta: { cupom?: string; link?: string; termos?: string } | null;
  quando: string; status: "rascunho" | "agendada" | "publicando" | "publicada" | "falhou"; tentativas: number; erro: string | null; google_url: string | null; criado_em: string;
}
interface PostG { nome: string; data: string; tipo: string; texto: string; estado: string; cta: string | null; url: string | null; foto: string | null }

const CAMPOS = "id,perfil_id,place_id,tipo,texto,cta_tipo,cta_url,foto_url,evento,oferta,quando,status,tentativas,erro,google_url,criado_em";
const STATUS: Record<string, { nome: string; cor: string }> = {
  agendada: { nome: "Agendada", cor: "#2747d6" },
  publicando: { nome: "Publicando", cor: "#7c4dff" },
  publicada: { nome: "Publicada", cor: "#1aa361" },
  falhou: { nome: "Falhou", cor: "#e04b3c" },
  rascunho: { nome: "Rascunho", cor: "#8a8f98" },
  tentar: { nome: "Nova tentativa", cor: "#f2b705" },
};
const CTAS = [["", "Sem botão"], ["LEARN_MORE", "Saiba mais"], ["BOOK", "Reservar"], ["ORDER", "Pedir on-line"], ["SHOP", "Comprar"], ["SIGN_UP", "Inscrever-se"], ["CALL", "Ligar agora"]];
const TIPOS = [["STANDARD", "Novidade"], ["OFFER", "Oferta"], ["EVENT", "Evento"]];
const chaveDia = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
const agoraLocal = () => new Date(Date.now() - 3 * 3600_000 + 60 * 60_000).toISOString().slice(0, 16);

export function GmnPostagens({ perfis }: { perfis: PerfilGmn[] }) {
  const d = useDados();
  const fichas = perfis.filter((p) => p.place_id && p.cliente_id);
  const [placeId, setPlaceId] = useState(fichas[0]?.place_id ?? "");
  const ficha = fichas.find((f) => f.place_id === placeId);
  const fila = useTabela<Agendada>("gmn_postagens", CAMPOS, () => [], { ordem: { coluna: "quando", asc: false }, limite: 500 });
  const minhas = fila.linhas.filter((p) => p.place_id === placeId);
  const [google, setGoogle] = useState<PostG[] | null>(null);
  const [erroG, setErroG] = useState("");
  const [carregandoG, setCarregandoG] = useState(false);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [editor, setEditor] = useState<Partial<Agendada> | null>(null);

  async function carregarGoogle() {
    if (!placeId || !supabase) return;
    setCarregandoG(true);
    setErroG("");
    try {
      setGoogle((await chamarFuncao<{ postagens: PostG[] }>("gbp", { acao: "gbp_posts", place_id: placeId })).postagens);
    } catch (e) {
      setErroG((e as Error).message);
    } finally {
      setCarregandoG(false);
    }
  }
  useEffect(() => { setGoogle(null); carregarGoogle(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [placeId]);

  // Itens do calendário: o que já está no Google + a fila do sistema (sem duplicar o que já foi publicado)
  const itens = useMemo(() => {
    const lista: { dia: string; status: string; texto: string; url: string | null; agendada?: Agendada }[] = [];
    for (const p of google ?? []) lista.push({ dia: chaveDia(p.data), status: "publicada", texto: p.texto, url: p.url });
    for (const p of minhas) {
      if (p.status === "publicada" && google) continue;
      lista.push({ dia: chaveDia(p.quando), status: p.status === "agendada" && p.tentativas > 0 ? "tentar" : p.status, texto: p.texto, url: p.google_url, agendada: p });
    }
    return lista;
  }, [google, minhas]);

  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1));
  const diasMes = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const celulas = [...Array(primeiro.getUTCDay()).fill(null), ...Array.from({ length: diasMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
  const mudarMes = (k: number) => { const x = new Date(Date.UTC(ano, m - 1 + k, 1)); setMes(x.toISOString().slice(0, 7)); };
  const contagem = Object.fromEntries(Object.keys(STATUS).map((k) => [k, itens.filter((i) => i.status === k && i.dia.startsWith(mes)).length]));

  if (fila.erro && /gmn_postagens|schema cache|does not exist/i.test(fila.erro)) return <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-[13px] text-muted">As postagens ficam disponíveis assim que a atualização do banco (tabela de postagens agendadas) for aprovada.</p>;
  if (!fichas.length) return <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-[13px] text-muted">Ligue uma ficha do Google a um cliente (Perfis dos clientes) para publicar e agendar postagens.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-3 text-[13px]">
          {fichas.map((f) => <option key={f.id} value={f.place_id!}>{d.cliente(f.cliente_id!)?.nome ?? f.nome} · {f.nome}</option>)}
        </select>
        <button onClick={carregarGoogle} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] hover:border-accent"><RefreshCw size={13} className={carregandoG ? "animate-spin" : ""} /> Atualizar</button>
        <button onClick={() => setEditor({ tipo: "STANDARD", texto: "", quando: agoraLocal() })} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg"><Send size={14} /> Nova postagem</button>
      </div>
      {erroG && <p className="rounded-xl bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{erroG}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays size={16} className="text-muted" />
            <b className="text-[15px] capitalize">{primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })}</b>
            <div className="ml-auto flex gap-1">
              <button onClick={() => mudarMes(-1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line"><ChevronLeft size={14} /></button>
              <button onClick={() => setMes(new Date().toISOString().slice(0, 7))} className="h-8 rounded-lg border border-line px-2 text-[12px]">Hoje</button>
              <button onClick={() => mudarMes(1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="mb-2 flex flex-wrap gap-3 text-[11.5px]">
            {["agendada", "publicada", "falhou", "tentar"].map((k) => <span key={k} className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[k].cor }} />{STATUS[k].nome} ({contagem[k]})</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">{["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((x) => <div key={x}>{x}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {celulas.map((dia, i) => {
              const doDia = dia ? itens.filter((x) => x.dia === dia) : [];
              return (
                <div key={i} className={`min-h-[78px] rounded-lg border p-1 text-left ${dia ? "border-line" : "border-transparent"} ${dia === chaveDia(new Date().toISOString()) ? "bg-accent-soft" : ""}`}>
                  {dia && <div className="text-[11px] text-muted">{Number(dia.slice(8))}</div>}
                  {doDia.slice(0, 3).map((x, k) => (
                    <button key={k} title={x.texto} onClick={() => x.agendada && x.status !== "publicada" ? setEditor({ ...x.agendada, quando: new Date(new Date(x.agendada.quando).getTime() - 3 * 3600_000).toISOString().slice(0, 16) }) : x.url && window.open(x.url, "_blank")}
                      className="mt-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[10.5px] font-medium text-white" style={{ background: STATUS[x.status].cor }}>{x.texto.slice(0, 40) || "Post"}</button>
                  ))}
                  {doDia.length > 3 && <div className="text-[10px] text-muted">+{doDia.length - 3}</div>}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="flex flex-col gap-2 self-start">
          <div className="text-[13px] font-semibold">Fila do sistema</div>
          {minhas.filter((p) => p.status !== "publicada").length === 0 && <p className="text-[12.5px] text-muted">Nenhuma postagem agendada para esta ficha.</p>}
          {minhas.filter((p) => p.status !== "publicada").sort((a, b) => a.quando.localeCompare(b.quando)).map((p) => (
            <button key={p.id} onClick={() => setEditor({ ...p, quando: new Date(new Date(p.quando).getTime() - 3 * 3600_000).toISOString().slice(0, 16) })} className="rounded-xl border border-line bg-surface p-3 text-left text-[12.5px] hover:border-accent">
              <div className="mb-1 flex items-center gap-2"><span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white" style={{ background: STATUS[p.status === "agendada" && p.tentativas > 0 ? "tentar" : p.status].cor }}>{STATUS[p.status === "agendada" && p.tentativas > 0 ? "tentar" : p.status].nome}</span><span className="text-muted">{new Date(p.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></div>
              <p className="line-clamp-2">{p.texto}</p>
              {p.erro && <p className="mt-1 text-[11.5px] text-bad">{p.erro}</p>}
            </button>
          ))}
          <div className="mt-2 text-[13px] font-semibold">Últimas no Google</div>
          {google === null ? <p className="text-[12.5px] text-muted">{carregandoG ? "Carregando…" : "—"}</p> : google.slice(0, 5).map((p) => (
            <div key={p.nome} className="rounded-xl border border-line bg-surface p-3 text-[12.5px]">
              <div className="mb-1 flex items-center gap-2 text-muted">{new Date(p.data).toLocaleDateString("pt-BR")}{p.url && <a href={p.url} target="_blank" rel="noreferrer" className="ml-auto text-accent"><ExternalLink size={12} /></a>}</div>
              <div className="flex gap-2">{p.foto && <img src={p.foto} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}<p className="line-clamp-3">{p.texto}</p></div>
            </div>
          ))}
        </aside>
      </div>

      {editor && ficha && <EditorPost inicial={editor} ficha={ficha} fila={fila} fechar={() => setEditor(null)} aposPublicar={carregarGoogle} />}
    </div>
  );
}

function EditorPost({ inicial, ficha, fila, fechar, aposPublicar }: { inicial: Partial<Agendada>; ficha: PerfilGmn; fila: ReturnType<typeof useTabela<Agendada>>; fechar: () => void; aposPublicar: () => void }) {
  const d = useDados();
  const [p, setP] = useState<Partial<Agendada>>(inicial);
  const [tema, setTema] = useState("");
  const [ocupado, setOcupado] = useState("");
  const muda = (c: Partial<Agendada>) => setP((x) => ({ ...x, ...c }));
  const ev = p.evento ?? {};
  const of = p.oferta ?? {};
  const precisaUrl = p.cta_tipo && p.cta_tipo !== "CALL";

  async function gerar() {
    setOcupado("ia");
    try {
      const r = await chamarFuncao<{ texto: string }>("gbp", { acao: "gbp_post_ia", empresa: `${ficha.nome}${ficha.cidade ? ` (${ficha.cidade})` : ""}${ficha.categoria ? ` · ${ficha.categoria}` : ""}`, tema, tipo: p.tipo });
      muda({ texto: r.texto.slice(0, 1500) });
    } catch (e) { d.avisar((e as Error).message); } finally { setOcupado(""); }
  }
  async function enviarFoto(f: File) {
    if (!supabase) return;
    setOcupado("foto");
    try {
      const caminho = `${ficha.id}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage.from("gmn-midia").upload(caminho, f, { contentType: f.type });
      if (error) throw new Error(error.message);
      muda({ foto_url: supabase.storage.from("gmn-midia").getPublicUrl(caminho).data.publicUrl });
    } catch (e) { d.avisar((e as Error).message); } finally { setOcupado(""); }
  }
  async function salvar(agora: boolean) {
    if (!p.texto?.trim()) return d.avisar("Escreva o texto da postagem.");
    if (precisaUrl && !p.cta_url) return d.avisar("Informe o link do botão.");
    if (p.tipo !== "STANDARD" && (!ev.inicio || !ev.fim)) return d.avisar("Informe início e fim do evento/oferta.");
    setOcupado(agora ? "publicar" : "salvar");
    try {
      const campos: Partial<Agendada> = {
        perfil_id: ficha.id, place_id: ficha.place_id!, tipo: p.tipo ?? "STANDARD", texto: p.texto.trim(), cta_tipo: p.cta_tipo || null, cta_url: precisaUrl ? p.cta_url : null,
        foto_url: p.foto_url || null, evento: p.tipo === "STANDARD" ? null : { ...ev, inicio: ev.inicio ? new Date(`${ev.inicio}:00-03:00`).toISOString() : undefined, fim: ev.fim ? new Date(`${ev.fim}:00-03:00`).toISOString() : undefined },
        oferta: p.tipo === "OFFER" ? of : null, quando: agora ? new Date().toISOString() : new Date(`${p.quando}:00-03:00`).toISOString(), status: "agendada", erro: null, tentativas: 0,
      };
      const id = await fila.salvar(p.id ?? null, campos);
      if (agora) {
        await chamarFuncao("gbp", { acao: "gbp_publicar", id });
        await fila.recarregar();
        aposPublicar();
        d.avisar("Postagem publicada no Google.");
      } else d.avisar("Postagem agendada. O sistema publica sozinho no horário (verifica a cada 15 min).");
      fechar();
    } catch (e) {
      await fila.recarregar();
      d.avisar((e as Error).message);
    } finally { setOcupado(""); }
  }
  const campo = "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px]";
  // evento/oferta usam datetime-local; convertemos ISO salvo para o horário de Brasília
  const local = (iso?: string) => (iso && iso.includes("Z") ? new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16) : iso ?? "");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={fechar}>
      <div className="flex max-h-[92vh] w-full max-w-[640px] flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><b className="text-[16px]">{p.id ? "Editar postagem" : "Nova postagem"}</b><span className="text-[12px] text-muted">{ficha.nome}</span></div>
        <div className="flex gap-1">{TIPOS.map(([k, n]) => <button key={k} onClick={() => muda({ tipo: k })} className={`h-8 rounded-lg border px-3 text-[12.5px] ${p.tipo === k ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>{n}</button>)}</div>
        <div className="flex gap-2">
          <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Tema para a IA (ex.: divórcio consensual, promoção de óculos)" className={campo} />
          <button onClick={gerar} disabled={!!ocupado} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] hover:border-accent disabled:opacity-50">{ocupado === "ia" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Escrever com IA</button>
        </div>
        <textarea value={p.texto ?? ""} onChange={(e) => muda({ texto: e.target.value.slice(0, 1500) })} rows={8} placeholder="Texto da postagem" className="w-full rounded-lg border border-line bg-surface p-3 text-[13px]" />
        <div className="text-right text-[11px] text-muted">{(p.texto ?? "").length}/1500 · o Google recusa telefone no texto</div>
        {p.tipo !== "STANDARD" && (
          <div className="grid gap-2 md:grid-cols-3">
            <input value={ev.titulo ?? ""} onChange={(e) => muda({ evento: { ...ev, titulo: e.target.value } })} placeholder={p.tipo === "OFFER" ? "Título da oferta" : "Título do evento"} className={campo} />
            <input type="datetime-local" value={local(ev.inicio)} onChange={(e) => muda({ evento: { ...ev, inicio: e.target.value } })} className={campo} />
            <input type="datetime-local" value={local(ev.fim)} onChange={(e) => muda({ evento: { ...ev, fim: e.target.value } })} className={campo} />
          </div>
        )}
        {p.tipo === "OFFER" && (
          <div className="grid gap-2 md:grid-cols-3">
            <input value={of.cupom ?? ""} onChange={(e) => muda({ oferta: { ...of, cupom: e.target.value } })} placeholder="Cupom (opcional)" className={campo} />
            <input value={of.link ?? ""} onChange={(e) => muda({ oferta: { ...of, link: e.target.value } })} placeholder="Link para resgatar" className={campo} />
            <input value={of.termos ?? ""} onChange={(e) => muda({ oferta: { ...of, termos: e.target.value } })} placeholder="Termos e condições" className={campo} />
          </div>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          <select value={p.cta_tipo ?? ""} onChange={(e) => muda({ cta_tipo: e.target.value || null })} className={campo}>{CTAS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
          {precisaUrl && <input value={p.cta_url ?? ""} onChange={(e) => muda({ cta_url: e.target.value })} placeholder="https://… (link do botão)" className={campo} />}
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] hover:border-accent">
            {ocupado === "foto" ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={14} />} {p.foto_url ? "Trocar foto" : "Adicionar foto"}
            <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && enviarFoto(e.target.files[0])} />
          </label>
          {p.foto_url && <><img src={p.foto_url} alt="" className="h-12 w-12 rounded-lg object-cover" /><button onClick={() => muda({ foto_url: null })} className="text-[12px] text-muted hover:text-bad">remover</button></>}
          <span className="text-[11px] text-muted">JPG/PNG, mín. 400×300, até 5 MB</span>
        </div>
        {p.erro && <p className="rounded-lg bg-bad/10 px-3 py-2 text-[12px] text-bad">Última tentativa: {p.erro}</p>}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <input type="datetime-local" value={p.quando ?? ""} onChange={(e) => muda({ quando: e.target.value })} className="h-9 rounded-lg border border-line bg-surface px-3 text-[13px]" />
          <button onClick={() => salvar(false)} disabled={!!ocupado} className="h-9 rounded-lg border border-line px-3 text-[13px] hover:border-accent disabled:opacity-50">{ocupado === "salvar" ? "Salvando…" : "Agendar"}</button>
          {p.id && <button onClick={async () => { await fila.salvar(p.id!, { status: "rascunho" }); fechar(); }} className="h-9 rounded-lg px-3 text-[13px] text-muted hover:text-fg">Pausar (rascunho)</button>}
          <button onClick={fechar} className="ml-auto h-9 rounded-lg px-3 text-[13px] text-muted">Cancelar</button>
          <button onClick={() => salvar(true)} disabled={!!ocupado} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg disabled:opacity-50">{ocupado === "publicar" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Publicar agora</button>
        </div>
      </div>
    </div>
  );
}
