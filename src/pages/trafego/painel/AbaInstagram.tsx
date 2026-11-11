import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ExternalLink, Heart, Link2, MessageCircle, Search, Unlink } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { chamarFuncao } from "../../../lib/tabela";
import { useDados } from "../../../lib/dados";
import { Botao, Vazio } from "../../../components/ui";

type Soma = Record<"reach" | "views" | "accounts_engaged" | "total_interactions" | "profile_views" | "website_clicks", number>;
export interface PostIG { id: string; legenda: string; tipo: string; link: string; imagem: string | null; quando: string; curtidas: number; comentarios: number; alcance: number | null; visualizacoes: number | null; salvos: number | null; compartilhamentos: number | null; interacoes: number | null }
export interface PerfilIG {
  ig_id: string; username: string; nome: string | null; foto_url: string | null; erro?: string;
  seguidores?: number | null; publicacoes?: number | null; atual?: Soma; anterior?: Soma | null;
  dias?: { data: string; alcance?: number; novos?: number }[];
  posts?: PostIG[];
  publico?: { age?: { chave: string; valor: number }[]; gender?: { chave: string; valor: number }[]; city?: { chave: string; valor: number }[] };
  historico?: { data: string; seguidores: number }[];
}
export interface RelatorioIG { perfis: PerfilIG[]; periodo: { ini: string; fim: string } }

const int = (v: number | null | undefined) => (v === null || v === undefined || !isFinite(v) ? "—" : Math.round(v).toLocaleString("pt-BR"));
const dm = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function useRelatorioIG(clienteId: string, ini: string, fim: string, ligado = true) {
  const [r, setR] = useState<RelatorioIG | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const buscar = useCallback(async () => {
    if (!ligado) return;
    if (!supabase) return setR(demoIG(ini, fim));
    setCarregando(true); setErro("");
    try { setR(await chamarFuncao<RelatorioIG>("instagram", { acao: "relatorio", cliente_id: clienteId, ini, fim })); }
    catch (e) { setErro((e as Error).message); }
    finally { setCarregando(false); }
  }, [clienteId, ini, fim, ligado]);
  useEffect(() => { buscar(); }, [buscar]);
  return { r, carregando, erro, buscar };
}

/** Aba Instagram do dashboard do cliente. */
export function AbaInstagram({ clienteId, dados }: { clienteId: string; dados: ReturnType<typeof useRelatorioIG> }) {
  const { r, carregando, erro } = dados;
  if (erro) return <div className="rounded-xl border border-bad bg-bad-soft px-4 py-3 text-[13px] text-bad">Não foi possível buscar no Instagram: {erro}</div>;
  if (!r) return <Vazio>{carregando ? "Buscando no Instagram…" : "Carregando…"}</Vazio>;
  if (!r.perfis.length) return <Vincular clienteId={clienteId} aoVincular={dados.buscar} />;
  return (
    <div className={`flex flex-col gap-8 transition-opacity ${carregando ? "opacity-60" : ""}`}>
      {r.perfis.map((p) => <Perfil key={p.ig_id} p={p} aoMudar={dados.buscar} />)}
    </div>
  );
}

function Perfil({ p, aoMudar }: { p: PerfilIG; aoMudar: () => void }) {
  const d = useDados();
  const [ordem, setOrdem] = useState<"alcance" | "interacoes" | "recentes">("alcance");
  if (p.erro) return <div className="rounded-xl border border-warn bg-warn-soft px-4 py-3 text-[13px] text-warn">@{p.username}: {p.erro}</div>;
  const a = p.atual!, b = p.anterior ?? null;
  const novos = (p.dias ?? []).reduce((s, x) => s + (x.novos ?? 0), 0);
  const kpis: { nome: string; v: number; ant: number | null }[] = [
    { nome: "Alcance", v: a.reach, ant: b?.reach ?? null },
    { nome: "Visualizações", v: a.views, ant: b?.views ?? null },
    { nome: "Interações", v: a.total_interactions, ant: b?.total_interactions ?? null },
    { nome: "Visitas ao perfil", v: a.profile_views, ant: b?.profile_views ?? null },
  ];
  const posts = [...(p.posts ?? [])].sort((x, y) => ordem === "recentes" ? y.quando.localeCompare(x.quando) : ordem === "alcance" ? (y.alcance ?? y.curtidas) - (x.alcance ?? x.curtidas) : (y.interacoes ?? y.curtidas + y.comentarios) - (x.interacoes ?? x.curtidas + x.comentarios)).slice(0, 8);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {p.foto_url ? <img src={p.foto_url} alt="" className="h-11 w-11 rounded-full border border-line object-cover" /> : <span className="h-11 w-11 rounded-full bg-raised" />}
        <div className="min-w-0">
          <a href={`https://instagram.com/${p.username}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[15px] font-semibold hover:underline">@{p.username} <ExternalLink size={12} className="text-muted" /></a>
          <div className="num text-[12.5px] text-muted"><b className="text-fg">{int(p.seguidores)}</b> seguidores · {int(p.publicacoes)} publicações{novos ? <> · <span className="text-ok">+{int(novos)} novos no período</span></> : null}</div>
        </div>
        {supabase && <button onClick={async () => { try { await chamarFuncao("instagram", { acao: "desvincular", ig_id: p.ig_id }); d.avisar("Perfil desligado do cliente"); aoMudar(); } catch (e) { d.avisar((e as Error).message); } }} className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted hover:text-bad" title="Desligar este perfil do cliente"><Unlink size={12} /> Desligar</button>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {kpis.map((k, i) => {
            const vr = k.ant ? (k.v - k.ant) / k.ant : null;
            return (
              <div key={k.nome} className={`flex flex-col gap-1.5 px-5 py-5 ${i % 2 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}>
                <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{k.nome}</span>
                <span className="num text-[28px] font-semibold leading-none tracking-tight">{int(k.v)}</span>
                {vr !== null && Math.abs(vr) >= 0.005 ? (
                  <span className={`num inline-flex w-fit items-center gap-0.5 rounded-full px-1.5 py-px text-[11.5px] font-semibold ${vr > 0 ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{vr > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(Math.round(vr * 100))}%</span>
                ) : <span className="text-[11.5px] text-muted">{k.ant === null ? "sem comparação" : "estável"}</span>}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3">
          {[["Contas com engajamento", a.accounts_engaged], ["Cliques no link da bio", a.website_clicks], ["Novos seguidores", novos || null]].map(([n, v]) => (
            <div key={n as string} className="bg-surface px-4 py-3"><div className="text-[11.5px] text-muted">{n}</div><div className="num text-[15px] font-semibold">{int(v as number | null)}</div></div>
          ))}
        </div>
        {(p.dias?.length ?? 0) > 1 && <div className="border-t border-line px-5 pb-4 pt-4"><Serie dias={p.dias!} /></div>}
      </div>

      {posts.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold">Publicações do período</h3>
            <span className="text-[12px] text-muted">{p.posts!.length}</span>
            <div role="tablist" className="ml-auto flex">
              {([["alcance", "Maior alcance"], ["interacoes", "Mais interações"], ["recentes", "Recentes"]] as const).map(([v, n]) => <button key={v} role="tab" aria-selected={ordem === v} onClick={() => setOrdem(v)} className="rounded-md px-2.5 py-1 text-[12px]">{n}</button>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {posts.map((x) => <CartaoPost key={x.id} x={x} />)}
          </div>
        </div>
      )}

      {p.publico && (p.publico.age?.length || p.publico.city?.length) ? <Publico pub={p.publico} /> : null}
    </section>
  );
}

function CartaoPost({ x }: { x: PostIG }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <a href={x.link} target="_blank" rel="noreferrer" className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-bg hover:border-line-forte">
      <div className="relative aspect-square bg-raised">
        {x.imagem && !falhou ? <img src={x.imagem} alt="" loading="lazy" onError={() => setFalhou(true)} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[12px] text-muted">{x.tipo}</div>}
        <span className="absolute left-2 top-2 rounded-full bg-[rgb(12_14_20/0.6)] px-2 py-0.5 text-[10.5px] font-medium text-white">{x.tipo}</span>
      </div>
      <div className="flex flex-col gap-1.5 p-2.5 text-[12px]">
        <p className="line-clamp-2 min-h-[2.6em] text-muted">{x.legenda || "Sem legenda"}</p>
        <div className="num flex items-center gap-3">
          <span title="Alcance"><b className="text-fg">{int(x.alcance)}</b> <span className="text-muted">alcance</span></span>
          <span className="ml-auto flex items-center gap-0.5 text-muted"><Heart size={11} />{int(x.curtidas)}</span>
          <span className="flex items-center gap-0.5 text-muted"><MessageCircle size={11} />{int(x.comentarios)}</span>
        </div>
        <div className="num text-[11px] text-muted">{dm(x.quando)}{x.salvos ? ` · ${int(x.salvos)} salvos` : ""}{x.compartilhamentos ? ` · ${int(x.compartilhamentos)} compart.` : ""}</div>
      </div>
    </a>
  );
}

function Serie({ dias }: { dias: { data: string; alcance?: number; novos?: number }[] }) {
  const W = 1000, H = 150;
  const maxA = Math.max(...dias.map((d) => d.alcance ?? 0), 1);
  const bw = W / dias.length;
  const [f, setF] = useState<number | null>(null);
  const foco = f !== null ? dias[f] : null;
  return (
    <div>
      <div className="mb-1 flex items-center gap-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#c2508a", opacity: 0.45 }} /> Alcance por dia</span>
        {foco && <span className="num ml-auto text-fg">{dm(foco.data)}: {int(foco.alcance)} alcance · {foco.novos !== undefined ? `${foco.novos >= 0 ? "+" : ""}${int(foco.novos)} seguidores` : ""}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[130px] w-full" onMouseLeave={() => setF(null)}>
        {dias.map((d, i) => {
          const h = ((d.alcance ?? 0) / maxA) * (H - 10);
          return <rect key={d.data} x={i * bw + bw * 0.15} y={H - h} width={bw * 0.7} height={Math.max(h, 1)} rx={3} fill="#c2508a" opacity={f === i ? 0.85 : 0.4} onMouseEnter={() => setF(i)} />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{dm(dias[0].data)}</span><span>{dm(dias[dias.length - 1].data)}</span></div>
    </div>
  );
}

function Publico({ pub }: { pub: NonNullable<PerfilIG["publico"]> }) {
  const idades = useMemo(() => [...(pub.age ?? [])].sort((a, b) => a.chave.localeCompare(b.chave)), [pub.age]);
  const totalIdade = idades.reduce((s, x) => s + x.valor, 0) || 1;
  const gen = pub.gender ?? [];
  const totalGen = gen.reduce((s, x) => s + x.valor, 0) || 1;
  const NOME_G: Record<string, string> = { F: "Mulheres", M: "Homens", U: "Não informado" };
  const COR_G: Record<string, string> = { F: "#c2508a", M: "#3b6fe0", U: "#a3a8b4" };
  const maxC = Math.max(...(pub.city ?? []).map((c) => c.valor), 1);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h3 className="mb-3 text-[15px] font-semibold">Quem segue</h3>
        {gen.length > 0 && (
          <div className="mb-4">
            <div className="flex h-2.5 overflow-hidden rounded-full">{gen.map((g) => <span key={g.chave} style={{ width: `${(g.valor / totalGen) * 100}%`, background: COR_G[g.chave] ?? "#a3a8b4" }} />)}</div>
            <div className="mt-1.5 flex flex-wrap gap-3 text-[12px] text-muted">{gen.map((g) => <span key={g.chave} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: COR_G[g.chave] ?? "#a3a8b4" }} />{NOME_G[g.chave] ?? g.chave} <b className="num text-fg">{Math.round((g.valor / totalGen) * 100)}%</b></span>)}</div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {idades.map((x) => (
            <div key={x.chave} className="flex items-center gap-2 text-[12.5px]">
              <span className="num w-12 shrink-0 text-muted">{x.chave}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full bg-accent" style={{ width: `${(x.valor / totalIdade) * 100}%` }} /></span>
              <span className="num w-10 shrink-0 text-right">{Math.round((x.valor / totalIdade) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      {(pub.city?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <h3 className="mb-3 text-[15px] font-semibold">Principais cidades</h3>
          <div className="flex flex-col gap-2">
            {pub.city!.map((c) => (
              <div key={c.chave} className="flex items-center gap-2 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate">{c.chave.replace(/, ([^,]+)$/, " · $1").replace(" (state)", "")}</span>
                <span className="h-2 w-28 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full" style={{ width: `${(c.valor / maxC) * 100}%`, background: "#c2508a" }} /></span>
                <span className="num w-12 text-right">{int(c.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Quando o cliente ainda não tem perfil ligado: lista os perfis que o token enxerga, com sugestão pelo nome. */
function Vincular({ clienteId, aoVincular }: { clienteId: string; aoVincular: () => void }) {
  const d = useDados();
  const nome = d.cliente(clienteId)?.nome ?? "";
  const [perfis, setPerfis] = useState<{ id: string; username: string; name?: string; pagina?: string; profile_picture_url?: string; followers_count?: number; cliente_id: string | null }[] | null>(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!supabase) return setPerfis([]);
    chamarFuncao<{ perfis: NonNullable<typeof perfis> }>("instagram", { acao: "disponiveis" }).then((r) => setPerfis(r.perfis), (e) => setErro((e as Error).message));
  }, []);
  const palavras = norm(nome).length > 3 ? nome.split(/\s+/).map(norm).filter((w) => w.length > 3) : [];
  const nota = (p: NonNullable<typeof perfis>[number]) => palavras.filter((w) => norm(`${p.username}${p.name ?? ""}${p.pagina ?? ""}`).includes(w)).length;
  const lista = (perfis ?? []).filter((p) => !busca || norm(`${p.username}${p.name ?? ""}${p.pagina ?? ""}`).includes(norm(busca))).sort((a, b) => nota(b) - nota(a) || (a.cliente_id ? 1 : 0) - (b.cliente_id ? 1 : 0));
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-[15px] font-semibold">Ligar o Instagram de {nome}</h3>
      <p className="mt-0.5 text-[12.5px] text-muted">Escolha o perfil. Aparecem os perfis profissionais ligados às Páginas que o token da Meta acessa.</p>
      {erro ? <p className="mt-3 text-[13px] text-bad">{erro}</p> : perfis === null ? <p className="mt-3 text-[13px] text-muted">Buscando perfis…</p> : (
        <>
          <label className="mt-3 flex h-9 max-w-[320px] items-center gap-2 rounded-xl border border-line bg-bg px-3 text-[13px] focus-within:border-accent">
            <Search size={14} className="text-muted" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar perfil" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          <ul className="mt-3 flex flex-col">
            {lista.map((p) => {
              const outro = p.cliente_id && p.cliente_id !== clienteId ? d.cliente(p.cliente_id)?.nome : null;
              return (
                <li key={p.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                  {p.profile_picture_url ? <img src={p.profile_picture_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="h-9 w-9 rounded-full bg-raised" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">@{p.username} {nota(p) > 0 && <span className="ml-1 rounded-full bg-accent-soft px-1.5 text-[10.5px] text-accent">sugerido</span>}</div>
                    <div className="truncate text-[12px] text-muted">{p.pagina ?? p.name}{p.followers_count ? ` · ${int(p.followers_count)} seguidores` : ""}{outro ? ` · ligado a ${outro}` : ""}</div>
                  </div>
                  <Botao onClick={async () => { try { await chamarFuncao("instagram", { acao: "vincular", ig_id: p.id, cliente_id: clienteId }); d.avisar(`@${p.username} ligado a ${nome}`); aoVincular(); } catch (e) { d.avisar((e as Error).message); } }}><Link2 size={13} /> Ligar</Botao>
                </li>
              );
            })}
            {lista.length === 0 && <li className="py-3 text-[13px] text-muted">Nenhum perfil encontrado. O Instagram precisa ser profissional e estar ligado à Página do Facebook do cliente, com a Página acessível pelo usuário do sistema.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function demoIG(ini: string, fim: string): RelatorioIG {
  const n = Math.max(1, Math.round((Date.parse(fim) - Date.parse(ini)) / 86400000) + 1);
  const dias = Array.from({ length: Math.min(n, 30) }, (_, k) => { const d = new Date(`${fim}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (Math.min(n, 30) - 1 - k)); return { data: d.toISOString().slice(0, 10), alcance: 400 + ((k * 137) % 520), novos: 2 + ((k * 5) % 9) }; });
  const posts: PostIG[] = Array.from({ length: 6 }, (_, k) => ({ id: String(k), legenda: ["Antes e depois do tratamento capilar: 8 meses de evolução.", "3 mitos sobre o transplante capilar que você precisa parar de acreditar.", "Conheça a nossa estrutura em Ipatinga.", "Depoimento do Carlos, 6 meses após o procedimento.", "Agenda aberta para avaliação gratuita em dezembro.", "Como funciona a primeira consulta, passo a passo."][k], tipo: ["Reels", "Carrossel", "Imagem", "Reels", "Imagem", "Carrossel"][k], link: "https://instagram.com", imagem: null, quando: `${fim}T15:00:00Z`, curtidas: 40 + k * 11, comentarios: 3 + k, alcance: 2400 - k * 280, visualizacoes: 5100 - k * 500, salvos: 12 + k, compartilhamentos: 6, interacoes: 80 - k * 6 }));
  return {
    periodo: { ini, fim },
    perfis: [{
      ig_id: "1", username: "clinicanobrefio", nome: "Clínica Nobre Fio", foto_url: null, seguidores: 8432, publicacoes: 512,
      atual: { reach: 18420, views: 64210, accounts_engaged: 1210, total_interactions: 2380, profile_views: 1530, website_clicks: 212 },
      anterior: { reach: 15100, views: 58800, accounts_engaged: 1090, total_interactions: 2510, profile_views: 1290, website_clicks: 190 },
      dias, posts,
      publico: { age: [{ chave: "18-24", valor: 610 }, { chave: "25-34", valor: 2710 }, { chave: "35-44", valor: 2830 }, { chave: "45-54", valor: 1420 }, { chave: "55-64", valor: 520 }, { chave: "65+", valor: 180 }], gender: [{ chave: "M", valor: 5320 }, { chave: "F", valor: 3110 }], city: [{ chave: "Ipatinga, Minas Gerais", valor: 2410 }, { chave: "Coronel Fabriciano, Minas Gerais", valor: 820 }, { chave: "Timóteo, Minas Gerais", valor: 610 }, { chave: "Belo Horizonte, Minas Gerais", valor: 420 }, { chave: "Santana do Paraíso, Minas Gerais", valor: 310 }] },
      historico: [],
    }],
  };
}
