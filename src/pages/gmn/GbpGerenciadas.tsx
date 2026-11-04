import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, MessageSquareReply, Printer, RefreshCw, Search, Sparkles } from "lucide-react";
import { chamarFuncao } from "../../lib/tabela";
import { supabase } from "../../lib/supabase";
import { useDados } from "../../lib/dados";
import { Vazio } from "../../components/ui";
import type { PerfilGmn } from "../../lib/gmn";

// ------------------------------------------------------------------
// Dados: todas as fichas que a conta da agência gerencia no Google
// ------------------------------------------------------------------
export interface AvaliacaoG { id: string; autor: string; nota: number | null; texto: string; data: string; resposta: string | null }
export interface FichaG {
  conta: string;
  local: string;
  nome: string;
  place_id: string | null;
  maps: string | null;
  cidade: string | null;
  site: string | null;
  media: number | null;
  total_avaliacoes: number | null;
  sem_resposta: number;
  ultima_avaliacao: string | null;
  avaliacoes: AvaliacaoG[];
  ultima_postagem: string | null;
  postagens: { data: string; tipo: string; texto: string; estado: string; url: string | null }[];
  status: string | null;
  verificada: boolean | null;
  problema: string | null;
  descricao: string | null;
  categoria: string | null;
  categorias_extras: string[];
  tem_horario: boolean;
  servicos: number;
  erros: string[];
}

let cache: { em: number; fichas: FichaG[] } | null = null;

export function useFichasGoogle() {
  const [fichas, setFichas] = useState<FichaG[] | null>(cache?.fichas ?? null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const carregar = useCallback(async (forcar = false) => {
    if (!supabase) return setFichas(demoFichas());
    if (!forcar && cache && Date.now() - cache.em < 5 * 60_000) return setFichas(cache.fichas);
    setCarregando(true);
    setErro("");
    try {
      const r = await chamarFuncao<{ fichas: FichaG[] }>("gbp", { acao: "gbp_monitor" });
      cache = { em: Date.now(), fichas: r.fichas };
      setFichas(r.fichas);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => void carregar(), [carregar]);
  return { fichas, erro, carregando, recarregar: () => carregar(true) };
}

const dias = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null);
const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");
export const linkAvaliar = (placeId: string) => `https://search.google.com/local/writereview?placeid=${placeId}`;

/** Pontos de atenção de uma ficha gerenciada (o que pede ação agora). */
function pendencias(f: FichaG) {
  const p: { texto: string; grave: boolean }[] = [];
  if (f.problema) p.push({ texto: `Google: ${f.problema}`, grave: true });
  if (f.status && f.status !== "OPEN") p.push({ texto: f.status === "CLOSED_PERMANENTLY" ? "Marcada como fechada" : "Fechada temporariamente", grave: true });
  if (f.sem_resposta) p.push({ texto: `${f.sem_resposta} avaliação${f.sem_resposta > 1 ? "ões" : ""} sem resposta`, grave: f.sem_resposta >= 3 });
  const dp = dias(f.ultima_postagem);
  if (dp === null) p.push({ texto: "Nunca postou", grave: false });
  else if (dp > 15) p.push({ texto: `Sem postagem há ${dp} dias`, grave: dp > 45 });
  if (!f.descricao) p.push({ texto: "Sem descrição", grave: false });
  if (!f.categorias_extras.length) p.push({ texto: "Sem categorias secundárias", grave: false });
  if (!f.tem_horario) p.push({ texto: "Sem horário", grave: false });
  if (!f.servicos) p.push({ texto: "Sem serviços cadastrados", grave: false });
  return p;
}

function Estrelas({ nota }: { nota: number | null }) {
  const n = Math.round(nota ?? 0);
  return <span className="whitespace-nowrap text-[#f5b400]">{"★".repeat(n)}<span className="text-line-forte">{"★".repeat(Math.max(0, 5 - n))}</span></span>;
}

// ------------------------------------------------------------------
// Monitoramento
// ------------------------------------------------------------------
export function FichasGerenciadas({ perfis, ir, criarPerfil }: { perfis: PerfilGmn[]; ir: (r: string) => void; criarPerfil: (f: FichaG) => Promise<void> }) {
  const g = useFichasGoogle();
  if (!supabase) return <Vazio>Disponível no sistema conectado ao Google.</Vazio>;
  if (g.erro) return <Vazio>{g.erro}</Vazio>;
  if (!g.fichas) return <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="esqueleto h-16 rounded-xl" />)}</div>;

  const lista = g.fichas
    .map((f) => ({ f, perfil: perfis.find((p) => p.place_id && p.place_id === f.place_id), pend: pendencias(f) }))
    .sort((a, b) => b.pend.filter((x) => x.grave).length - a.pend.filter((x) => x.grave).length || b.pend.length - a.pend.length);
  const semResp = g.fichas.reduce((s, f) => s + f.sem_resposta, 0);
  const semPost = g.fichas.filter((f) => (dias(f.ultima_postagem) ?? 999) > 15).length;
  const problemas = g.fichas.filter((f) => f.problema || (f.status && f.status !== "OPEN")).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Fichas gerenciadas" valor={g.fichas.length} />
        <Kpi rotulo="Avaliações sem resposta" valor={semResp} tom={semResp ? "warn" : "ok"} />
        <Kpi rotulo="Sem postar há +15 dias" valor={semPost} tom={semPost ? "warn" : "ok"} />
        <Kpi rotulo="Problemas no Google" valor={problemas} tom={problemas ? "bad" : "ok"} detalhe="suspensão, verificação, fechada" />
      </div>
      <div className="flex items-center gap-2 text-[12.5px] text-muted">
        <span>Direto da conta da agência no Perfil da Empresa. As pendências mais graves aparecem primeiro.</span>
        <button onClick={g.recarregar} disabled={g.carregando} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 hover:text-fg"><RefreshCw size={13} className={g.carregando ? "animate-spin" : ""} /> Atualizar</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[880px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th className="px-3 py-2 font-medium">Ficha</th>
              <th className="px-3 font-medium">Avaliações</th>
              <th className="px-3 font-medium">Última postagem</th>
              <th className="px-3 font-medium">Pendências</th>
              <th className="px-3" />
            </tr>
          </thead>
          <tbody>
            {lista.map(({ f, perfil, pend }) => (
              <tr key={f.local} className="border-b border-line align-top last:border-0">
                <td className="max-w-[300px] px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {f.verificada ? <CheckCircle2 size={13} className="shrink-0 text-ok" /> : <AlertTriangle size={13} className="shrink-0 text-warn" />}
                    <span className="truncate font-medium" title={f.nome}>{f.nome}</span>
                  </div>
                  <div className="truncate pl-5 text-[12px] text-muted">{[f.categoria, f.cidade].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {f.total_avaliacoes ? <><Estrelas nota={f.media} /> <b className="num">{Number(f.media).toFixed(1).replace(".", ",")}</b> <span className="text-muted">({f.total_avaliacoes})</span></> : <span className="text-muted">Nenhuma</span>}
                  {f.sem_resposta > 0 && <div className="text-[12px] text-warn">{f.sem_resposta} sem resposta</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {f.ultima_postagem ? <>{dataBR(f.ultima_postagem)} <span className={`text-[12px] ${(dias(f.ultima_postagem) ?? 0) > 15 ? "text-warn" : "text-muted"}`}>({dias(f.ultima_postagem)} dias)</span></> : <span className="text-muted">Nunca</span>}
                </td>
                <td className="px-3 py-2.5">
                  {pend.length === 0 ? <span className="text-[12px] text-ok">Tudo em dia</span> : (
                    <div className="flex flex-wrap gap-1">
                      {pend.map((x) => <span key={x.texto} className={`rounded-full px-2 py-0.5 text-[11.5px] ${x.grave ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}>{x.texto}</span>)}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {perfil ? (
                    <button onClick={() => ir(`gmn-perfil-${perfil.id}`)} className="text-[12.5px] font-medium text-accent hover:underline">Abrir</button>
                  ) : (
                    <button onClick={() => criarPerfil(f)} className="text-[12.5px] font-medium text-accent hover:underline">Acompanhar</button>
                  )}
                  {f.maps && <a href={f.maps} target="_blank" rel="noreferrer" className="ml-3 inline-flex text-muted hover:text-fg" title="Abrir no Maps"><ExternalLink size={13} /></a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Central de avaliações (todas as fichas, com resposta por IA)
// ------------------------------------------------------------------
export function CentralAvaliacoes() {
  const d = useDados();
  const g = useFichasGoogle();
  const [filtro, setFiltro] = useState<"sem" | "baixas" | "todas">("sem");
  const [ficha, setFicha] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [respondidas, setRespondidas] = useState<Record<string, string>>({});

  const todas = useMemo(() => (g.fichas ?? []).flatMap((f) => f.avaliacoes.map((a) => ({ ...a, f, resposta: respondidas[a.id] ?? a.resposta }))).sort((a, b) => b.data.localeCompare(a.data)), [g.fichas, respondidas]);
  if (!supabase) return <Vazio>Disponível no sistema conectado ao Google.</Vazio>;
  if (g.erro) return <Vazio>{g.erro}</Vazio>;
  if (!g.fichas) return <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="esqueleto h-24 rounded-xl" />)}</div>;

  const lista = todas.filter((a) => (!ficha || a.f.local === ficha) && (filtro === "sem" ? !a.resposta : filtro === "baixas" ? (a.nota ?? 5) <= 3 : true));

  async function sugerir(a: (typeof todas)[number]) {
    setGerando(true);
    try {
      const r = await chamarFuncao<{ texto: string }>("gbp", { acao: "gbp_ia_resposta", empresa: a.f.nome, autor: a.autor, nota: a.nota, texto: a.texto });
      setTexto(r.texto);
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setGerando(false);
    }
  }
  async function publicar(a: (typeof todas)[number]) {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await chamarFuncao("google-ads", { acao: "gbp_responder", place_id: a.f.place_id, avaliacao: a.id, texto });
      setRespondidas((r) => ({ ...r, [a.id]: texto.trim() }));
      d.avisar("Resposta publicada no Google");
      setAberta(null);
      setTexto("");
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {([["sem", `Sem resposta (${todas.filter((a) => !a.resposta).length})`], ["baixas", "Notas 1 a 3"], ["todas", "Todas recentes"]] as const).map(([v, n]) => (
            <button key={v} role="tab" aria-selected={filtro === v} onClick={() => setFiltro(v)} className={`rounded-lg px-3 py-1 text-[12.5px] ${filtro === v ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>{n}</button>
          ))}
        </div>
        <select value={ficha} onChange={(e) => setFicha(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]">
          <option value="">Todas as fichas</option>
          {g.fichas.map((f) => <option key={f.local} value={f.local}>{f.nome}</option>)}
        </select>
        <button onClick={g.recarregar} disabled={g.carregando} className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg border border-line px-3 text-[12.5px] text-muted hover:text-fg"><RefreshCw size={13} className={g.carregando ? "animate-spin" : ""} /> Atualizar</button>
      </div>
      {lista.length === 0 ? (
        <Vazio>{filtro === "sem" ? "Nenhuma avaliação recente sem resposta. Tudo em dia." : "Nada para mostrar com esse filtro."}</Vazio>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {lista.slice(0, 60).map((a) => (
            <li key={a.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-[13px]">
              <div className="flex items-center gap-2">
                <b className="truncate">{a.autor}</b>
                <Estrelas nota={a.nota} />
                <span className="ml-auto whitespace-nowrap text-[11.5px] text-muted">{dataBR(a.data)}</span>
              </div>
              <div className="text-[12px] text-muted">{a.f.nome}</div>
              {a.texto ? <p className="whitespace-pre-wrap leading-snug">{a.texto}</p> : <p className="text-muted">Sem texto, só a nota.</p>}
              {a.resposta ? (
                <p className="rounded-lg bg-raised px-3 py-2 text-[12.5px]"><b>Resposta:</b> {a.resposta}</p>
              ) : aberta === a.id ? (
                <div className="flex flex-col gap-2">
                  <textarea autoFocus rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva a resposta ou gere com a IA." className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none focus:border-accent" />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => sugerir(a)} disabled={gerando} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] hover:border-accent hover:text-accent disabled:opacity-50">
                      {gerando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {texto ? "Gerar outra" : "Sugerir com IA"}
                    </button>
                    <button onClick={() => publicar(a)} disabled={enviando || !texto.trim()} className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg disabled:opacity-40">{enviando ? "Publicando…" : "Publicar no Google"}</button>
                    <button onClick={() => { setAberta(null); setTexto(""); }} className="h-8 rounded-lg px-3 text-[12.5px] text-muted">Cancelar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAberta(a.id); setTexto(""); }} className="inline-flex w-fit items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"><MessageSquareReply size={13} /> Responder</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Ferramentas: cartão de avaliação (QR) e busca de categorias
// ------------------------------------------------------------------
export function FerramentasGmn({ perfis }: { perfis: PerfilGmn[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <CartaoAvaliacao perfis={perfis} />
      <BuscaCategorias />
    </div>
  );
}

function CartaoAvaliacao({ perfis }: { perfis: PerfilGmn[] }) {
  const d = useDados();
  const comPlace = perfis.filter((p) => p.place_id);
  const [id, setId] = useState(comPlace[0]?.id ?? "");
  const [titulo, setTitulo] = useState("Gostou do atendimento?");
  const [sub, setSub] = useState("Sua avaliação no Google ajuda outras pessoas a nos encontrarem.");
  const [cor, setCor] = useState("#2747d6");
  const [qr, setQr] = useState("");
  const perfil = comPlace.find((p) => p.id === id);
  const link = perfil?.place_id ? linkAvaliar(perfil.place_id) : "";
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!link) return setQr("");
    QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: "#111827", light: "#ffffff" } }).then(setQr, () => setQr(""));
  }, [link]);

  function imprimir() {
    if (!area.current) return;
    const w = window.open("", "_blank", "width=700,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cartão de avaliação</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui,sans-serif}@page{margin:10mm}</style></head><body>${area.current.outerHTML}</body></html>`);
    w.document.close();
    w.onload = () => w.print();
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-[15px] font-semibold">Cartão de avaliação</h2>
      <p className="text-[12.5px] text-muted">Cartão com QR Code que leva direto para a tela de avaliar a empresa no Google. Para balcão, mesa, embalagem ou WhatsApp.</p>
      {comPlace.length === 0 ? <Vazio>Cadastre uma ficha ligada ao Google para gerar o cartão.</Vazio> : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex flex-col gap-2 text-[13px]">
            <label className="flex flex-col gap-1">Ficha
              <select value={id} onChange={(e) => setId(e.target.value)} className="h-9 rounded-lg border border-line bg-bg px-2">{comPlace.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-9 rounded-lg border border-line bg-bg px-2.5" /></label>
            <label className="flex flex-col gap-1">Texto<input value={sub} onChange={(e) => setSub(e.target.value)} className="h-9 rounded-lg border border-line bg-bg px-2.5" /></label>
            <label className="flex items-center gap-2">Cor <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-8 w-12 rounded border border-line" /></label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={imprimir} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg"><Printer size={13} /> Imprimir / PDF</button>
              <button onClick={() => navigator.clipboard?.writeText(link).then(() => d.avisar("Link de avaliação copiado"))} className="h-8 rounded-lg border border-line px-3 text-[12.5px]">Copiar link de avaliação</button>
              {qr && <a href={qr} download="qrcode-avaliacao.png" className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12.5px]">Baixar QR</a>}
            </div>
          </div>
          <div ref={area} style={{ width: 260, borderRadius: 18, overflow: "hidden", border: "1px solid #e5e7eb", background: "#fff", fontFamily: "system-ui,sans-serif", textAlign: "center", color: "#111827" }}>
            <div style={{ background: cor, color: "#fff", padding: "18px 16px 14px" }}>
              <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 600 }}>{perfil?.nome}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{titulo}</div>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ color: "#f5b400", fontSize: 22, letterSpacing: 2 }}>★★★★★</div>
              {qr && <img src={qr} alt="QR Code" style={{ width: 170, height: 170, margin: "8px auto" }} />}
              <div style={{ fontSize: 12.5, color: "#4b5563" }}>{sub}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>Aponte a câmera do celular para o código</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function BuscaCategorias() {
  const [busca, setBusca] = useState("");
  const [res, setRes] = useState<{ id: string; nome: string }[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  async function buscar() {
    if (busca.trim().length < 2 || !supabase) return;
    setCarregando(true);
    setErro("");
    try {
      setRes((await chamarFuncao<{ categorias: { id: string; nome: string }[] }>("gbp", { acao: "gbp_categorias", busca })).categorias);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-[15px] font-semibold">Busca de categorias</h2>
      <p className="text-[12.5px] text-muted">As categorias oficiais do Google em português. Use para escolher a principal e as secundárias de cada ficha.</p>
      <form onSubmit={(e) => { e.preventDefault(); buscar(); }} className="flex gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: clínica, ótica, advogado" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 text-[13px]" />
        <button disabled={carregando || busca.trim().length < 2} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg disabled:opacity-40">{carregando ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Buscar</button>
      </form>
      {!supabase && <p className="text-[12.5px] text-muted">Disponível no sistema conectado ao Google.</p>}
      {erro && <p className="text-[12.5px] text-bad">{erro}</p>}
      {res && (res.length === 0 ? <p className="text-[12.5px] text-muted">Nenhuma categoria com esse nome.</p> : (
        <ul className="flex max-h-[360px] flex-col divide-y divide-line overflow-y-auto text-[13px]">
          {res.map((c) => <li key={c.id} className="flex justify-between gap-2 py-1.5"><span>{c.nome}</span><span className="truncate font-mono text-[11px] text-muted">{c.id.replace("categories/", "")}</span></li>)}
        </ul>
      ))}
    </section>
  );
}

function Kpi({ rotulo, valor, tom = "neutro", detalhe }: { rotulo: string; valor: number; tom?: "ok" | "warn" | "bad" | "neutro"; detalhe?: string }) {
  const cor = tom === "ok" ? "text-ok" : tom === "warn" ? "text-warn" : tom === "bad" ? "text-bad" : "";
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="text-[12px] text-muted">{rotulo}</div>
      <b className={`num block text-[22px] ${cor}`}>{valor}</b>
      {detalhe && <span className="text-[11.5px] text-muted">{detalhe}</span>}
    </div>
  );
}

function demoFichas(): FichaG[] {
  const iso = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
  const base = (nome: string, extra: Partial<FichaG>): FichaG => ({ conta: "accounts/1", local: `locations/${nome}`, nome, place_id: null, maps: null, cidade: "Ipatinga", site: null, media: 4.9, total_avaliacoes: 120, sem_resposta: 0, ultima_avaliacao: iso(3), avaliacoes: [], ultima_postagem: iso(5), postagens: [], status: "OPEN", verificada: true, problema: null, descricao: "…", categoria: "Clínica", categorias_extras: ["Spa"], tem_horario: true, servicos: 6, erros: [], ...extra });
  return [
    base("Clínica Exemplo", { sem_resposta: 3, avaliacoes: [{ id: "r1", autor: "Ana Souza", nota: 5, texto: "Atendimento excelente, equipe muito atenciosa!", data: iso(2), resposta: null }, { id: "r2", autor: "Carlos M.", nota: 2, texto: "Demorou para ser atendido.", data: iso(6), resposta: null }] }),
    base("Loja Exemplo", { ultima_postagem: iso(40), categorias_extras: [], servicos: 0 }),
    base("Escritório Exemplo", { descricao: null, ultima_postagem: null }),
  ];
}
