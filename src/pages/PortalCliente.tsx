import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Camera, ChevronLeft, ChevronRight, Lock, LogOut, Sparkles, Trophy } from "lucide-react";
import { supabase } from "../lib/supabase";
import simbolo from "../assets/simbolo-azul.png";
import { LogoCliente } from "../components/LogoCliente";

// ------------------------------------------------------------------
// Tipos do que a função "portal" devolve
// ------------------------------------------------------------------
type Soma = { gasto: number; impressoes: number; cliques: number; contatos: number };
type Par = { atual: Soma; anterior: Soma };
interface Dados {
  cliente: { nome: string; logo_url: string | null } | null;
  mostrar: { trafego: boolean; diario: boolean; conquistas: boolean };
  periodo: { ini: string; fim: string; antIni: string; antFim: string };
  mes: string;
  trafego?: { plataformas: string[]; total: Par; meta: Par; google: Par; dias: { data: string; gasto: number; contatos: number }[]; campanhas: { nome: string; plataforma: string; gasto: number; contatos: number; cliques: number }[] };
  diario?: { id: string; dia: string; quando: string; tipo: string; titulo: string; texto: string; detalhes: string[] }[];
  conquistas?: { id: string; data: string; nota: string }[];
  instagram?: { username: string; foto_url: string | null; seguidores: number | null; novos: number; atual: Record<string, number>; anterior: Record<string, number> | null; posts: { id: string; link: string; imagem: string | null; tipo: string; legenda: string; alcance: number | null; curtidas: number; comentarios: number }[] }[];
}

const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
async function portal<T>(corpo: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${base}/functions/v1/portal`, { method: "POST", headers: { "Content-Type": "application/json", apikey: chave ?? "", Authorization: `Bearer ${chave ?? ""}` }, body: JSON.stringify(corpo) });
  const j = (await r.json().catch(() => ({}))) as T & { erro?: string };
  if (!r.ok || j.erro) throw Object.assign(new Error(j.erro ?? "Não foi possível carregar."), { status: r.status });
  return j;
}

// ------------------------------------------------------------------
// Datas e números
// ------------------------------------------------------------------
const hojeSP = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const somarDias = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dm = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v >= 1000 ? 0 : 2 });
const int = (v: number) => Math.round(v).toLocaleString("pt-BR");
const nomeMes = (mes: string) => { const t = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const somarMes = (mes: string, n: number) => { const [a, m] = mes.split("-").map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
const rotuloDia = (d: string) => { const t = new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); return t.charAt(0).toUpperCase() + t.slice(1); };

const PERIODOS = [
  { id: "7", nome: "7 dias", dias: 7 },
  { id: "30", nome: "30 dias", dias: 30 },
  { id: "90", nome: "90 dias", dias: 90 },
] as const;

const CHAVE = (slug: string) => `vertente.painel.${slug}`;

/** Página pública do cliente: senha → painel com tráfego, conquistas e diário de bordo. */
export function PortalCliente({ slug }: { slug: string }) {
  const [token, setToken] = useState<string | null>(() => { try { return sessionStorage.getItem(CHAVE(slug)); } catch { return null; } });
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [dados, setDados] = useState<Dados | null>(null);
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["id"]>("30");
  const [mes, setMes] = useState(hojeSP().slice(0, 7));
  const [carregando, setCarregando] = useState(false);

  useEffect(() => { document.title = dados?.cliente ? `${dados.cliente.nome} · Painel Vertente` : "Painel do cliente · Vertente Digital"; }, [dados?.cliente]);

  const sair = useCallback(() => { try { sessionStorage.removeItem(CHAVE(slug)); } catch { /* */ } setToken(null); setDados(null); }, [slug]);

  const carregar = useCallback(async () => {
    if (!token) return;
    const fim = somarDias(hojeSP(), -1);
    const dias = PERIODOS.find((p) => p.id === periodo)!.dias;
    if (!supabase) { setDados(demo(somarDias(fim, -(dias - 1)), fim, mes)); return; }
    setCarregando(true);
    try {
      setDados(await portal<Dados>({ acao: "dados", token, ini: somarDias(fim, -(dias - 1)), fim, mes }));
    } catch (e) {
      if ((e as { status?: number }).status === 401 || (e as { status?: number }).status === 403) { sair(); setErro((e as Error).message); }
    } finally { setCarregando(false); }
  }, [token, periodo, mes, sair]);
  useEffect(() => { carregar(); }, [carregar]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!senha) return;
    setEntrando(true); setErro("");
    try {
      const t = supabase ? (await portal<{ token: string }>({ acao: "entrar", slug, senha })).token : "demo";
      try { sessionStorage.setItem(CHAVE(slug), t); } catch { /* */ }
      setToken(t); setSenha("");
    } catch (err) { setErro((err as Error).message); } finally { setEntrando(false); }
  }

  // ---------- Tela de senha ----------
  if (!token) {
    return (
      <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-4 text-fg">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.12] blur-3xl" style={{ background: "var(--accent)" }} />
        <form onSubmit={entrar} className="relative flex w-full max-w-[360px] flex-col items-center gap-5 rounded-3xl border border-line bg-surface px-7 py-9 text-center" style={{ boxShadow: "var(--sombra-flutuante)" }}>
          <img src={simbolo} alt="" className="h-11 w-11" />
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">Painel do cliente</h1>
            <p className="mt-1 text-[13px] text-muted">Acompanhe os resultados e tudo o que a Vertente Digital fez pelo seu negócio.</p>
          </div>
          <label className="flex w-full items-center gap-2 rounded-xl border border-line bg-bg px-3 focus-within:border-accent">
            <Lock size={15} className="text-muted" />
            <input type="password" autoFocus autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" aria-label="Senha" className="h-11 min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
          </label>
          {erro && <p className="-mt-2 text-[12.5px] text-bad">{erro}</p>}
          <button type="submit" disabled={!senha || entrando} className="h-11 w-full rounded-xl bg-accent text-[14px] font-semibold text-accent-fg hover:bg-accent/90 disabled:opacity-50">{entrando ? "Entrando…" : "Entrar"}</button>
          <p className="text-[11.5px] text-muted">Vertente Digital</p>
        </form>
      </div>
    );
  }

  if (!dados) return <div className="grid min-h-dvh place-items-center bg-bg text-[13px] text-muted">Carregando seu painel…</div>;

  const nome = dados.cliente?.nome ?? "Seu negócio";
  return (
    <div className="min-h-dvh bg-bg text-fg">
      {/* Topo */}
      <header className="relative overflow-hidden border-b border-line bg-surface">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ background: "radial-gradient(90% 160% at 0% 0%, var(--accent) 0%, transparent 60%)" }} />
        <div className="relative mx-auto flex max-w-[1080px] items-center gap-4 px-4 py-6 sm:px-8 sm:py-8">
          <LogoCliente nome={nome} url={dados.cliente?.logo_url ?? undefined} tamanho={60} />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted">Painel do cliente</div>
            <h1 className="truncate text-[24px] font-semibold leading-tight tracking-tight sm:text-[28px]">{nome}</h1>
          </div>
          <div className="hidden items-center gap-2 text-[12px] text-muted sm:flex"><img src={simbolo} alt="" className="h-6 w-6" /> Vertente Digital</div>
          <button onClick={sair} className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-raised hover:text-fg" aria-label="Sair" title="Sair"><LogOut size={16} /></button>
        </div>
      </header>

      <main className={`mx-auto flex max-w-[1080px] flex-col gap-10 px-4 py-8 sm:px-8 ${carregando ? "opacity-70 transition-opacity" : ""}`}>
        {dados.mostrar.trafego && dados.trafego && <Trafego t={dados.trafego} periodo={periodo} setPeriodo={setPeriodo} p={dados.periodo} />}
        {dados.instagram && dados.instagram.length > 0 && <Instagram perfis={dados.instagram} />}
        {dados.mostrar.conquistas && dados.conquistas && dados.conquistas.length > 0 && <Conquistas lista={dados.conquistas} />}
        {dados.mostrar.diario && dados.diario && <Diario itens={dados.diario} mes={mes} setMes={setMes} />}
        <footer className="flex items-center justify-center gap-2 pb-6 pt-4 text-[12px] text-muted"><img src={simbolo} alt="" className="h-4 w-4 opacity-70" /> Feito pela Vertente Digital</footer>
      </main>
    </div>
  );
}

// ------------------------------------------------------------------
// Blocos
// ------------------------------------------------------------------
function Titulo({ icone, children, direita }: { icone: React.ReactNode; children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">{icone}{children}</h2>
      <div className="ml-auto">{direita}</div>
    </div>
  );
}

function variacao(a: number, b: number) { return b ? (a - b) / b : null; }

function Trafego({ t, periodo, setPeriodo, p }: { t: NonNullable<Dados["trafego"]>; periodo: string; setPeriodo: (v: "7" | "30" | "90") => void; p: Dados["periodo"] }) {
  const a = t.total.atual, b = t.total.anterior;
  const kpis = [
    { nome: "Investimento", v: brl(a.gasto), vr: variacao(a.gasto, b.gasto), neutro: true },
    { nome: "Contatos", v: int(a.contatos), vr: variacao(a.contatos, b.contatos) },
    { nome: "Custo por contato", v: a.contatos ? brl(a.gasto / a.contatos) : "—", vr: a.contatos && b.contatos ? variacao(a.gasto / a.contatos, b.gasto / b.contatos) : null, inverso: true },
    { nome: "Cliques", v: int(a.cliques), vr: variacao(a.cliques, b.cliques) },
  ];
  const duas = t.plataformas.length > 1;
  return (
    <section>
      <Titulo icone={<Sparkles size={17} className="text-accent" />} direita={
        <div role="tablist" className="flex gap-0.5 rounded-xl bg-raised p-0.5">
          {PERIODOS.map((x) => <button key={x.id} role="tab" aria-selected={periodo === x.id} onClick={() => setPeriodo(x.id)} className={`rounded-lg px-3 py-1 text-[12.5px] ${periodo === x.id ? "bg-surface font-medium shadow-sm" : "text-muted"}`}>{x.nome}</button>)}
        </div>
      }>Resultados das campanhas</Titulo>
      <p className="-mt-2 mb-4 text-[12.5px] text-muted">{dm(p.ini)} a {dm(p.fim)} · comparado com {dm(p.antIni)} a {dm(p.antFim)}</p>
      <div className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {kpis.map((k, i) => {
            const bom = k.vr === null || k.neutro ? null : k.inverso ? k.vr < 0 : k.vr > 0;
            return (
              <div key={k.nome} className={`flex flex-col gap-2 px-5 py-6 ${i % 2 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}>
                <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">{k.nome}</span>
                <span className="num text-[30px] font-semibold leading-none tracking-tight">{k.v}</span>
                {k.vr !== null && Math.abs(k.vr) >= 0.005 ? (
                  <span className={`num inline-flex w-fit items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${bom === null ? "bg-raised text-muted" : bom ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
                    {k.vr > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(Math.round(k.vr * 100))}%
                  </span>
                ) : <span className="text-[11.5px] text-muted">estável</span>}
              </div>
            );
          })}
        </div>
        <div className="border-t border-line px-5 pb-4 pt-5">
          <Grafico dias={t.dias} />
        </div>
        {duas && (
          <div className="grid grid-cols-1 border-t border-line sm:grid-cols-2">
            {(["meta", "google"] as const).map((pl, i) => {
              const x = t[pl].atual;
              return (
                <div key={pl} className={`flex items-center gap-4 px-5 py-4 ${i ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: pl === "meta" ? "#3b5bdb" : "#e2701c" }} />
                  <span className="w-24 text-[13px] font-semibold">{pl === "meta" ? "Meta Ads" : "Google Ads"}</span>
                  <span className="num text-[13px] text-muted">{brl(x.gasto)} · <b className="text-fg">{int(x.contatos)}</b> contatos</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {t.campanhas.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="px-5 pb-1 pt-4 text-[13px] font-semibold">Campanhas no período</div>
          <ul>
            {t.campanhas.map((c) => (
              <li key={c.nome + c.plataforma} className="flex items-center gap-3 border-t border-line px-5 py-3 text-[13px] first:border-t-0">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.plataforma === "google" ? "#e2701c" : "#3b5bdb" }} />
                <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                <span className="num shrink-0 text-muted">{brl(c.gasto)}</span>
                <span className="num w-24 shrink-0 text-right"><b>{int(c.contatos)}</b> <span className="text-muted">contatos</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Grafico({ dias }: { dias: { data: string; gasto: number; contatos: number }[] }) {
  const W = 1000, H = 180, pad = 4;
  const maxG = Math.max(...dias.map((d) => d.gasto), 1), maxC = Math.max(...dias.map((d) => d.contatos), 1);
  const bw = (W - pad * 2) / Math.max(dias.length, 1);
  const pts = dias.map((d, i) => `${pad + i * bw + bw / 2},${H - 8 - (d.contatos / maxC) * (H - 28)}`).join(" ");
  const [foco, setFoco] = useState<number | null>(null);
  const f = foco !== null ? dias[foco] : null;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent/35" /> Investimento por dia</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-ok" /> Contatos por dia</span>
        {f && <span className="ml-auto num text-fg">{dm(f.data)}: {brl(f.gasto)} · {int(f.contatos)} contatos</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[170px] w-full" preserveAspectRatio="none" onMouseLeave={() => setFoco(null)}>
        {dias.map((d, i) => {
          const h = (d.gasto / maxG) * (H - 28);
          return <rect key={d.data} x={pad + i * bw + bw * 0.18} y={H - 8 - h} width={bw * 0.64} height={Math.max(h, 1)} rx={Math.min(4, bw * 0.2)} fill="var(--accent)" opacity={foco === i ? 0.7 : 0.28} onMouseEnter={() => setFoco(i)} />;
        })}
        <polyline points={pts} fill="none" stroke="var(--ok)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{dias[0] && dm(dias[0].data)}</span><span>{dias.length > 2 && dm(dias[Math.floor(dias.length / 2)].data)}</span><span>{dias.length > 0 && dm(dias[dias.length - 1].data)}</span></div>
    </div>
  );
}

function Instagram({ perfis }: { perfis: NonNullable<Dados["instagram"]> }) {
  return (
    <section>
      <Titulo icone={<Camera size={17} style={{ color: "#c2508a" }} />}>Instagram</Titulo>
      <div className="flex flex-col gap-4">
        {perfis.map((p) => {
          const k = [["Alcance", "reach"], ["Visualizações", "views"], ["Interações", "total_interactions"], ["Visitas ao perfil", "profile_views"]] as const;
          return (
            <div key={p.username} className="overflow-hidden rounded-3xl border border-line bg-surface">
              <div className="flex items-center gap-3 px-5 pt-5">
                {p.foto_url ? <img src={p.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="h-10 w-10 rounded-full bg-raised" />}
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">@{p.username}</div>
                  <div className="num text-[12.5px] text-muted"><b className="text-fg">{int(p.seguidores ?? 0)}</b> seguidores{p.novos > 0 ? <span className="text-ok"> · +{int(p.novos)} no período</span> : null}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 border-t border-line md:grid-cols-4">
                {k.map(([nome, chave], i) => {
                  const v = p.atual?.[chave] ?? 0, b = p.anterior?.[chave] ?? 0;
                  const vr = b ? (v - b) / b : null;
                  return (
                    <div key={chave} className={`flex flex-col gap-1.5 px-5 py-5 ${i % 2 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}>
                      <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">{nome}</span>
                      <span className="num text-[26px] font-semibold leading-none tracking-tight">{int(v)}</span>
                      {vr !== null && Math.abs(vr) >= 0.005 ? <span className={`num inline-flex w-fit items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${vr > 0 ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{vr > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(Math.round(vr * 100))}%</span> : <span className="text-[11.5px] text-muted">estável</span>}
                    </div>
                  );
                })}
              </div>
              {p.posts.length > 0 && (
                <div className="grid grid-cols-2 gap-3 border-t border-line p-5 md:grid-cols-4">
                  {p.posts.map((x) => (
                    <a key={x.id} href={x.link} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-line bg-bg hover:border-line-forte">
                      <div className="aspect-square bg-raised">{x.imagem ? <img src={x.imagem} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[12px] text-muted">{x.tipo}</div>}</div>
                      <div className="num flex items-center gap-2 px-3 py-2 text-[12px]"><b>{int(x.alcance ?? 0)}</b><span className="text-muted">alcance</span><span className="ml-auto text-muted">♥ {int(x.curtidas)}</span></div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Conquistas({ lista }: { lista: NonNullable<Dados["conquistas"]> }) {
  return (
    <section>
      <Titulo icone={<Trophy size={17} className="text-[#d4a72c]" />}>Pequenas conquistas</Titulo>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
        {lista.map((c) => (
          <article key={c.id} className="flex w-[280px] shrink-0 snap-start flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d4a72c]/15 text-[#b8901f]"><Trophy size={16} /></span>
            <p className="text-[14px] font-medium leading-snug">{c.nota}</p>
            <span className="mt-auto text-[11.5px] text-muted">{dm(c.data)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

const COR: Record<string, string> = { otimizacao: "var(--accent)", ajuste: "#3b5bdb", entrega: "var(--ok)", reuniao: "#8a63d2", combinado: "#e07a3b" };

function Diario({ itens, mes, setMes }: { itens: NonNullable<Dados["diario"]>; mes: string; setMes: (m: string) => void }) {
  const porDia = useMemo(() => {
    const m = new Map<string, typeof itens>();
    for (const i of itens) m.set(i.dia, [...(m.get(i.dia) ?? []), i]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [itens]);
  const contagem = { entregas: itens.filter((i) => i.tipo === "entrega").length, ajustes: itens.filter((i) => i.tipo === "ajuste" || i.tipo === "otimizacao").length, reunioes: itens.filter((i) => i.tipo === "reuniao").length };
  const atual = hojeSP().slice(0, 7);
  return (
    <section>
      <Titulo icone={<CalendarDays size={17} className="text-accent" />} direita={
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-0.5">
          <button onClick={() => setMes(somarMes(mes, -1))} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg" aria-label="Mês anterior"><ChevronLeft size={16} /></button>
          <span className="min-w-[128px] text-center text-[13px] font-medium">{nomeMes(mes)}</span>
          <button onClick={() => setMes(somarMes(mes, 1))} disabled={mes >= atual} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg disabled:opacity-30" aria-label="Próximo mês"><ChevronRight size={16} /></button>
        </div>
      }>Diário de Bordo</Titulo>
      <p className="-mt-2 mb-4 text-[12.5px] text-muted">O que a Vertente Digital fez pelo seu negócio, dia a dia.</p>
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[[contagem.entregas, "entregas concluídas"], [contagem.ajustes, "ajustes e otimizações"], [contagem.reunioes, "reuniões"]].map(([n, r]) => (
          <div key={r as string} className="rounded-2xl border border-line bg-surface px-4 py-3"><div className="num text-[22px] font-semibold">{n}</div><div className="text-[11.5px] text-muted">{r}</div></div>
        ))}
      </div>
      {porDia.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line px-6 py-10 text-center text-[13px] text-muted">Nada registrado em {nomeMes(mes).toLowerCase()} ainda.</div>
      ) : (
        <ol className="relative flex flex-col gap-6 border-l border-line pl-6">
          {porDia.map(([dia, lista]) => (
            <li key={dia} className="relative">
              <span className="absolute -left-[29.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-bg bg-line-forte" />
              <h3 className="mb-2 text-[12.5px] font-semibold text-muted">{rotuloDia(dia)}</h3>
              <div className="flex flex-col gap-2">
                {lista.map((i) => (
                  <article key={i.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
                    <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: COR[i.tipo] ?? "var(--muted)" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: COR[i.tipo] ?? "var(--muted)" }} />{i.titulo}
                    </div>
                    {i.texto && <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed">{i.texto}</p>}
                    {i.detalhes.length > 0 && <ul className="mt-1 text-[12.5px] text-muted">{i.detalhes.map((x, k) => <li key={k}>{x}</li>)}</ul>}
                  </article>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ------------------------------------------------------------------
// Prévia (sem banco)
// ------------------------------------------------------------------
function demo(ini: string, fim: string, mes: string): Dados {
  const n = Math.round((Date.parse(fim) - Date.parse(ini)) / 86400000) + 1;
  const dias = Array.from({ length: n }, (_, k) => ({ data: somarDias(ini, k), gasto: 80 + ((k * 37) % 60), contatos: 6 + ((k * 7) % 9) }));
  const s = (f: number): Soma => ({ gasto: dias.reduce((x, d) => x + d.gasto, 0) * f, impressoes: 120000 * f, cliques: 2400 * f, contatos: dias.reduce((x, d) => x + d.contatos, 0) * f });
  return {
    cliente: { nome: "Clínica Nobre Fio", logo_url: null },
    mostrar: { trafego: true, diario: true, conquistas: true },
    periodo: { ini, fim, antIni: somarDias(ini, -n), antFim: somarDias(ini, -1) },
    mes,
    trafego: { plataformas: ["meta", "google"], total: { atual: s(1), anterior: s(0.86) }, meta: { atual: s(0.66), anterior: s(0.6) }, google: { atual: s(0.34), anterior: s(0.3) }, dias, campanhas: [{ nome: "[VD] Mensagens - Implante capilar", plataforma: "meta", gasto: 1984, contatos: 176, cliques: 1648 }, { nome: "[VD] Cadastro - Avaliação gratuita", plataforma: "meta", gasto: 1202, contatos: 68, cliques: 933 }, { nome: "Pesquisa - Transplante capilar", plataforma: "google", gasto: 1785, contatos: 90, cliques: 555 }] },
    instagram: [{ username: "clinicanobrefio", foto_url: null, seguidores: 8432, novos: 174, atual: { reach: 18420, views: 64210, total_interactions: 2380, profile_views: 1530 }, anterior: { reach: 15100, views: 58800, total_interactions: 2510, profile_views: 1290 }, posts: [{ id: "p1", link: "https://instagram.com", imagem: null, tipo: "Reels", legenda: "", alcance: 2400, curtidas: 40, comentarios: 3 }, { id: "p2", link: "https://instagram.com", imagem: null, tipo: "Carrossel", legenda: "", alcance: 2120, curtidas: 51, comentarios: 4 }, { id: "p3", link: "https://instagram.com", imagem: null, tipo: "Imagem", legenda: "", alcance: 1840, curtidas: 62, comentarios: 5 }, { id: "p4", link: "https://instagram.com", imagem: null, tipo: "Reels", legenda: "", alcance: 1560, curtidas: 73, comentarios: 6 }] }],
    conquistas: [{ id: "1", data: somarDias(fim, -2), nota: "Custo por contato caiu 22% na semana com os novos criativos de depoimento." }, { id: "2", data: somarDias(fim, -9), nota: "Recorde de 31 conversas em um único dia." }, { id: "3", data: somarDias(fim, -20), nota: "Campanha de avaliação gratuita trouxe 14 agendamentos no primeiro mês." }],
    diario: [
      { id: "a", dia: somarDias(fim, 0), quando: `${fim}T15:00:00Z`, tipo: "otimizacao", titulo: "Otimização · Meta Ads", texto: "Pausamos 3 anúncios com CTR baixo e subimos 2 criativos novos no remarketing.", detalhes: [] },
      { id: "b", dia: somarDias(fim, 0), quando: `${fim}T13:00:00Z`, tipo: "entrega", titulo: "Entrega concluída", texto: "Roteiros de vídeo de novembro", detalhes: [] },
      { id: "c", dia: somarDias(fim, -2), quando: `${somarDias(fim, -2)}T13:00:00Z`, tipo: "ajuste", titulo: "Ajuste na Meta · Orçamento alterado", texto: "conjunto \"Remarketing 30d\"", detalhes: [] },
      { id: "d", dia: somarDias(fim, -4), quando: `${somarDias(fim, -4)}T13:00:00Z`, tipo: "reuniao", titulo: "Reunião", texto: "Alinhamos a campanha de dezembro com foco em avaliação gratuita.", detalhes: [] },
    ],
  };
}
