import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, Code2, Copy, Download, Link2, MousePointerClick, Pencil, Plus, QrCode, Radar, Trash2, X } from "lucide-react";
import { useDados } from "../../lib/dados";
import { supabase } from "../../lib/supabase";
import { useTabela } from "../../lib/tabela";
import { hoje, somarDias } from "../../lib/tipos";
import { DEMO_IDS } from "../../lib/repo";
import { Vazio } from "../../components/ui";
import { GraficoSeries } from "./painel/Graficos";

interface LinkR { id: string; cliente_id: string; slug: string; nome: string; canal: string; whatsapp: string; mensagem: string; codigo_visivel: boolean; utm: Record<string, string>; ativo: boolean; criado_em: string }
interface Clique { id: string; link_id: string | null; cliente_id: string; codigo: string; origem: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null; ad_id: string | null; gclid: string | null; fbclid: string | null; pagina: string | null; dispositivo: string | null; conversa_id: string | null; criado_em: string }

const DOMINIO = "https://sistema.agenciavertente.com.br";
const CANAIS: Record<string, string> = { site: "Site / landing page", bio: "Bio do Instagram", gmn: "Google Meu Negócio", anuncio: "Anúncio (destino site/link)", qr: "QR code impresso", email: "E-mail / mensagem", outro: "Outro" };
const MENSAGEM_CANAL: Record<string, string> = { site: "Olá! Vim pelo site e gostaria de mais informações.", bio: "Olá! Vim pelo Instagram e gostaria de mais informações.", gmn: "Olá! Encontrei vocês no Google e gostaria de mais informações.", anuncio: "Olá! Vi o anúncio e gostaria de mais informações.", qr: "Olá! Gostaria de mais informações.", email: "Olá! Gostaria de mais informações.", outro: "Olá! Gostaria de mais informações." };
export const ORIGEM: Record<string, { nome: string; cor: string }> = {
  meta_ads: { nome: "Meta Ads", cor: "#2747d6" },
  meta: { nome: "Facebook/Instagram", cor: "#5b7cf0" },
  google_ads: { nome: "Google Ads", cor: "#e2701c" },
  google: { nome: "Google", cor: "#f2a65a" },
  google_organico: { nome: "Google orgânico", cor: "#16a34a" },
  google_meu_negocio: { nome: "Google Meu Negócio", cor: "#0f9d58" },
  instagram: { nome: "Instagram", cor: "#db2777" },
  instagram_bio: { nome: "Bio do Instagram", cor: "#be185d" },
  facebook: { nome: "Facebook", cor: "#3b5998" },
  qr_code: { nome: "QR code", cor: "#7c3aed" },
  outro_site: { nome: "Outro site", cor: "#0891b2" },
  direto: { nome: "Direto", cor: "#64748b" },
};
const nomeOrigem = (o: string) => ORIGEM[o]?.nome ?? o;
const corOrigem = (o: string) => ORIGEM[o]?.cor ?? "#94a3b8";

function demoLinks(): LinkR[] {
  const id = [...DEMO_IDS.values()][0] ?? "ex-1";
  return [
    { id: "rl-1", cliente_id: id, slug: "nobrefio-site", nome: "Botão do site", canal: "site", whatsapp: "5531999990000", mensagem: MENSAGEM_CANAL.site, codigo_visivel: false, utm: {}, ativo: true, criado_em: hoje() },
    { id: "rl-2", cliente_id: id, slug: "nobrefio-bio", nome: "Link da bio", canal: "bio", whatsapp: "5531999990000", mensagem: MENSAGEM_CANAL.bio, codigo_visivel: false, utm: { utm_source: "instagram", utm_medium: "bio" }, ativo: true, criado_em: hoje() },
  ];
}
function demoCliques(): Clique[] {
  const id = [...DEMO_IDS.values()][0] ?? "ex-1";
  const origens = ["meta_ads", "meta_ads", "meta_ads", "google_ads", "google_ads", "instagram_bio", "google_organico", "direto"];
  const camps = ["[CAPTAÇÃO] Transplante | Conversas", "[LP] Avaliação capilar", "[REMARKETING] Depoimentos"];
  return Array.from({ length: 160 }, (_, i) => {
    const o = origens[i % origens.length];
    const dia = somarDias(hoje(), -(i % 30));
    return { id: `c-${i}`, link_id: o === "instagram_bio" ? "rl-2" : "rl-1", cliente_id: id, codigo: `K${(i * 7919).toString(36).toUpperCase().slice(0, 6)}`, origem: o, utm_source: o.startsWith("meta") ? "facebook" : o === "google_ads" ? "google" : null, utm_medium: o.endsWith("ads") ? "cpc" : null, utm_campaign: o.endsWith("ads") ? camps[i % 3] : null, utm_content: o === "meta_ads" ? `Vídeo ${1 + (i % 4)}` : null, utm_term: null, ad_id: null, gclid: o === "google_ads" ? "Cj0K…" : null, fbclid: o === "meta_ads" ? "IwAR…" : null, pagina: "https://nobrefio.com.br/avaliacao", dispositivo: i % 5 ? "celular" : "computador", conversa_id: null, criado_em: `${dia}T${String(9 + (i % 10)).padStart(2, "0")}:12:00Z` };
  });
}

/** Rastreamento (Fase 1): links rastreados por cliente, script de site e de onde vieram os cliques para o WhatsApp. */
export function Rastreamento() {
  const d = useDados();
  const links = useTabela<LinkR>("rastreio_links", "id, cliente_id, slug, nome, canal, whatsapp, mensagem, codigo_visivel, utm, ativo, criado_em", demoLinks, { ordem: { coluna: "criado_em", asc: false } });
  const [clienteId, setClienteId] = useState<string>("");
  const [dias, setDias] = useState(30);
  const [cliques, setCliques] = useState<Clique[]>([]);
  const [editando, setEditando] = useState<Partial<LinkR> | null>(null);
  const [instalar, setInstalar] = useState(false);

  const clientes = d.clientes;
  const comLinks = new Set(links.linhas.map((l) => l.cliente_id));
  useEffect(() => {
    if (!clienteId && clientes.length) setClienteId([...clientes].sort((a, b) => Number(comLinks.has(b.id)) - Number(comLinks.has(a.id)))[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes.length, links.linhas.length]);

  const desde = somarDias(hoje(), -dias + 1);
  useEffect(() => {
    if (!clienteId) return;
    if (!supabase) {
      setCliques(demoCliques().filter((c) => c.cliente_id === clienteId && c.criado_em.slice(0, 10) >= desde));
      return;
    }
    supabase
      .from("rastreio_cliques")
      .select("id, link_id, cliente_id, codigo, origem, utm_source, utm_medium, utm_campaign, utm_content, utm_term, ad_id, gclid, fbclid, pagina, dispositivo, conversa_id, criado_em")
      .eq("cliente_id", clienteId)
      .gte("criado_em", `${desde}T00:00:00-03:00`)
      .order("criado_em", { ascending: false })
      .limit(5000)
      .then(({ data }) => setCliques((data ?? []) as Clique[]));
  }, [clienteId, desde]);

  const doCliente = links.linhas.filter((l) => l.cliente_id === clienteId);
  const cliente = d.cliente(clienteId);
  const contar = <K extends string>(f: (c: Clique) => K | null) => {
    const m = new Map<K, number>();
    for (const c of cliques) { const k = f(c); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const porOrigem = contar((c) => c.origem);
  const porCampanha = contar((c) => c.utm_campaign);
  const porAnuncio = contar((c) => c.utm_content);
  const porLink = contar((c) => c.link_id);
  const pagos = cliques.filter((c) => c.origem === "meta_ads" || c.origem === "google_ads").length;
  const serie = useMemo(() => {
    const ds: string[] = [];
    for (let x = desde; x <= hoje(); x = somarDias(x, 1)) ds.push(x);
    const top = porOrigem.slice(0, 5).map(([o]) => o);
    return { rotulos: ds.map((x) => `${x.slice(8, 10)}/${x.slice(5, 7)}`), series: top.map((o) => ({ nome: nomeOrigem(o), cor: corOrigem(o), valores: ds.map((dia) => cliques.filter((c) => c.origem === o && c.criado_em.slice(0, 10) === dia).length) })) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliques, desde]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Radar size={18} className="text-accent" />
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="h-9 min-w-[220px] rounded-xl border border-line bg-surface px-3 text-[13px]">
          {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}{comLinks.has(c.id) ? " ●" : ""}</option>)}
        </select>
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {[7, 30, 90].map((n) => <button key={n} onClick={() => setDias(n)} className={`rounded-lg px-3 py-1 text-[12.5px] ${dias === n ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>{n} dias</button>)}
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setInstalar(!instalar)} className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] ${instalar ? "bg-accent text-accent-fg" : "border border-line text-muted hover:text-fg"}`}><Code2 size={14} /> Instalar no site e anúncios</button>
          <button onClick={() => setEditando({ cliente_id: clienteId, canal: "site", mensagem: MENSAGEM_CANAL.site, codigo_visivel: false, utm: {}, ativo: true, whatsapp: doCliente[0]?.whatsapp ?? "" })} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-[12.5px] font-medium text-accent-fg"><Plus size={14} /> Novo link</button>
        </div>
      </div>

      {editando && <EditorLink inicial={editando} links={links} nomeCliente={cliente?.nome ?? ""} fechar={() => setEditando(null)} />}
      {instalar && <Instalacao links={doCliente} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Links rastreados</h2>
        {doCliente.length === 0 ? (
          <Vazio>Nenhum link para {cliente?.nome ?? "este cliente"}. Crie um para o botão do site, outro para a bio e outro para o Google Meu Negócio.</Vazio>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {doCliente.map((l) => <CartaoLink key={l.id} l={l} cliques={porLink.find(([id]) => id === l.id)?.[1] ?? 0} editar={() => setEditando(l)} links={links} />)}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">De onde vieram os cliques para o WhatsApp</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Numero rotulo="Cliques para o WhatsApp" valor={cliques.length} />
          <Numero rotulo="De anúncios (Meta + Google)" valor={pagos} extra={cliques.length ? `${Math.round((pagos / cliques.length) * 100)}%` : ""} />
          <Numero rotulo="Com campanha identificada" valor={cliques.filter((c) => c.utm_campaign || c.ad_id).length} />
          <Numero rotulo="Ligados a uma conversa" valor={cliques.filter((c) => c.conversa_id).length} extra="Fase 2" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Bloco titulo="Por origem">
            <Barras itens={porOrigem.map(([o, n]) => ({ nome: nomeOrigem(o), n, cor: corOrigem(o) }))} total={cliques.length} />
          </Bloco>
          <Bloco titulo="Cliques por dia">
            <GraficoSeries rotulos={serie.rotulos} series={serie.series} tipo="empilhado" altura={200} />
          </Bloco>
          <Bloco titulo="Por campanha (utm_campaign)">
            <Barras itens={porCampanha.slice(0, 10).map(([o, n]) => ({ nome: o, n, cor: "#2747d6" }))} total={cliques.length} vazio="Nenhum clique com campanha. Use os parâmetros de URL nos anúncios (botão Instalar)." />
          </Bloco>
          <Bloco titulo="Por anúncio / criativo (utm_content)">
            <Barras itens={porAnuncio.slice(0, 10).map(([o, n]) => ({ nome: o, n, cor: "#7c3aed" }))} total={cliques.length} vazio="Nenhum clique com anúncio identificado." />
          </Bloco>
        </div>
        <Bloco titulo={`Últimos cliques (${Math.min(cliques.length, 50)} de ${cliques.length})`}>
          {cliques.length === 0 ? (
            <p className="text-[12.5px] text-muted">Nenhum clique no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12.5px]">
                <thead><tr className="border-b border-line text-left text-[11.5px] text-muted"><th className="py-1.5 pr-3 font-medium">Quando</th><th className="py-1.5 pr-3 font-medium">Origem</th><th className="py-1.5 pr-3 font-medium">Campanha · anúncio</th><th className="py-1.5 pr-3 font-medium">Página</th><th className="py-1.5 pr-3 font-medium">Aparelho</th><th className="py-1.5 font-medium">Código</th></tr></thead>
                <tbody>
                  {cliques.slice(0, 50).map((c) => (
                    <tr key={c.id} className="border-b border-line/60 last:border-0">
                      <td className="num whitespace-nowrap py-1.5 pr-3">{new Date(c.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-1.5 pr-3"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: corOrigem(c.origem) }} />{nomeOrigem(c.origem)}</span></td>
                      <td className="max-w-[260px] truncate py-1.5 pr-3 text-muted" title={[c.utm_campaign, c.utm_content, c.utm_term].filter(Boolean).join(" · ")}>{[c.utm_campaign, c.utm_content].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="max-w-[200px] truncate py-1.5 pr-3 text-muted" title={c.pagina ?? ""}>{c.pagina ? c.pagina.replace(/^https?:\/\/(www\.)?/, "").split("?")[0] : "—"}</td>
                      <td className="py-1.5 pr-3 text-muted">{c.dispositivo ?? "—"}</td>
                      <td className="num py-1.5 text-muted">{c.codigo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloco>
      </section>
    </div>
  );
}

function Numero({ rotulo, valor, extra }: { rotulo: string; valor: number; extra?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-[12px] text-muted">{rotulo}</div>
      <div className="flex items-baseline gap-2"><b className="num text-[24px]">{valor.toLocaleString("pt-BR")}</b>{extra && <span className="text-[12px] text-muted">{extra}</span>}</div>
    </div>
  );
}
function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4"><h3 className="text-[13.5px] font-semibold">{titulo}</h3>{children}</section>;
}
function Barras({ itens, total, vazio = "Sem cliques no período." }: { itens: { nome: string; n: number; cor: string }[]; total: number; vazio?: string }) {
  if (!itens.length) return <p className="text-[12.5px] text-muted">{vazio}</p>;
  const max = Math.max(...itens.map((x) => x.n));
  return (
    <ul className="flex flex-col gap-1.5">
      {itens.map((x) => (
        <li key={x.nome} className="flex flex-col gap-0.5 text-[12.5px]">
          <div className="flex gap-2"><span className="min-w-0 flex-1 truncate" title={x.nome}>{x.nome}</span><b className="num">{x.n}</b><span className="num w-10 text-right text-muted">{total ? Math.round((x.n / total) * 100) : 0}%</span></div>
          <div className="h-1.5 rounded-full bg-raised"><div className="h-full rounded-full" style={{ width: `${(x.n / max) * 100}%`, background: x.cor }} /></div>
        </li>
      ))}
    </ul>
  );
}

function CartaoLink({ l, cliques, editar, links }: { l: LinkR; cliques: number; editar: () => void; links: ReturnType<typeof useTabela<LinkR>> }) {
  const d = useDados();
  const url = `${DOMINIO}/r/${l.slug}`;
  const [qr, setQr] = useState("");
  const [apagar, setApagar] = useState(false);
  return (
    <div className={`flex flex-col gap-2 rounded-2xl border bg-surface p-4 ${l.ativo ? "border-line" : "border-dashed border-line opacity-60"}`}>
      <div className="flex items-start gap-2">
        <Link2 size={15} className="mt-0.5 text-accent" />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[13.5px]">{l.nome}</b>
          <span className="text-[11.5px] text-muted">{CANAIS[l.canal] ?? l.canal} · WhatsApp +{l.whatsapp}</span>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-[11.5px]"><MousePointerClick size={11} /> <b className="num">{cliques}</b></span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-raised px-2 py-1.5">
        <code className="min-w-0 flex-1 truncate text-[12px]">{url}</code>
        <button onClick={() => { navigator.clipboard?.writeText(url); d.avisar("Link copiado"); }} className="text-muted hover:text-fg" aria-label="Copiar link"><Copy size={13} /></button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={async () => setQr(qr ? "" : await QRCode.toDataURL(url, { width: 600, margin: 1 }))} className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-[12px] hover:border-accent"><QrCode size={12} /> QR code</button>
        <button onClick={editar} className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-[12px] hover:border-accent"><Pencil size={12} /> Editar</button>
        <button onClick={() => links.salvar(l.id, { ativo: !l.ativo })} className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-[12px] hover:border-accent">{l.ativo ? "Pausar" : "Ativar"}</button>
        {apagar ? (
          <button onClick={() => links.excluir(l.id)} className="ml-auto h-7 rounded-lg bg-bad px-2 text-[12px] font-medium text-white">Excluir link?</button>
        ) : (
          <button onClick={() => setApagar(true)} className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad" aria-label="Excluir"><Trash2 size={13} /></button>
        )}
      </div>
      {qr && (
        <div className="flex items-center gap-3 rounded-xl bg-white p-2">
          <img src={qr} alt={`QR code de ${l.nome}`} className="h-28 w-28" />
          <a href={qr} download={`qr-${l.slug}.png`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-medium text-accent-fg"><Download size={13} /> Baixar PNG</a>
        </div>
      )}
    </div>
  );
}

function EditorLink({ inicial, links, nomeCliente, fechar }: { inicial: Partial<LinkR>; links: ReturnType<typeof useTabela<LinkR>>; nomeCliente: string; fechar: () => void }) {
  const d = useDados();
  const base = nomeCliente.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^(clinica|dra?|espaco|oticas?)\s+/, "").replace(/[^a-z0-9]+/g, "").slice(0, 16) || "cliente";
  const [f, setF] = useState<Partial<LinkR>>({ ...inicial, slug: inicial.slug ?? `${base}-${inicial.canal ?? "site"}`, nome: inicial.nome ?? CANAIS[inicial.canal ?? "site"] });
  const [salvando, setSalvando] = useState(false);
  const campo = "h-9 w-full rounded-lg border border-line bg-bg px-2.5 text-[13px] outline-none focus:border-accent";
  const zap = (f.whatsapp ?? "").replace(/\D/g, "");
  const slugOk = /^[a-z0-9-]{3,40}$/.test(f.slug ?? "");
  async function salvar() {
    setSalvando(true);
    try {
      const utm = Object.fromEntries(Object.entries(f.utm ?? {}).filter(([, v]) => v && String(v).trim()));
      await links.salvar(inicial.id ?? null, { cliente_id: f.cliente_id, slug: f.slug, nome: (f.nome ?? "").trim() || "Link", canal: f.canal, whatsapp: zap, mensagem: (f.mensagem ?? "").trim() || MENSAGEM_CANAL.site, codigo_visivel: !!f.codigo_visivel, utm, ativo: f.ativo ?? true });
      d.avisar("Link salvo");
      fechar();
    } catch (e) {
      const m = (e as Error).message;
      d.avisar(/duplicate|unique/i.test(m) ? "Esse endereço já está em uso. Escolha outro." : m);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <section className="anim-entrar flex flex-col gap-3 rounded-2xl border border-accent/40 bg-surface p-4">
      <div className="flex items-center gap-2"><Link2 size={15} className="text-accent" /><b className="text-[13.5px]">{inicial.id ? "Editar link" : "Novo link rastreado"}</b><button onClick={fechar} className="ml-auto text-muted hover:text-fg" aria-label="Fechar"><X size={15} /></button></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-[12px] text-muted">Onde vai ser usado
          <select value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value, mensagem: Object.values(MENSAGEM_CANAL).includes(f.mensagem ?? "") ? MENSAGEM_CANAL[e.target.value] : f.mensagem, nome: Object.values(CANAIS).includes(f.nome ?? "") ? CANAIS[e.target.value] : f.nome, slug: inicial.id ? f.slug : `${base}-${e.target.value}` })} className={campo}>
            {Object.entries(CANAIS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-muted">Nome<input value={f.nome ?? ""} onChange={(e) => setF({ ...f, nome: e.target.value })} className={campo} /></label>
        <label className="flex flex-col gap-1 text-[12px] text-muted">WhatsApp do cliente (com DDI)<input value={f.whatsapp ?? ""} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="5531999999999" className={`${campo} ${zap && !/^\d{12,13}$/.test(zap) ? "!border-warn" : ""}`} /></label>
        <label className="flex flex-col gap-1 text-[12px] text-muted">Endereço do link
          <div className="flex items-center rounded-lg border border-line bg-bg pl-2.5 text-[12px] text-muted focus-within:border-accent">/r/<input value={f.slug ?? ""} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className="h-9 min-w-0 flex-1 bg-transparent px-1 text-[13px] text-fg outline-none" /></div>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-muted">Mensagem que já vem escrita no WhatsApp<input value={f.mensagem ?? ""} onChange={(e) => setF({ ...f, mensagem: e.target.value })} className={campo} /></label>
      <div className="grid gap-2 sm:grid-cols-3">
        {(["utm_source", "utm_medium", "utm_campaign"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-[12px] text-muted">{k} fixo (opcional)<input value={f.utm?.[k] ?? ""} onChange={(e) => setF({ ...f, utm: { ...(f.utm ?? {}), [k]: e.target.value } })} placeholder={k === "utm_source" ? (f.canal === "bio" ? "instagram" : f.canal === "gmn" ? "google_meu_negocio" : "") : ""} className={campo} /></label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={!!f.codigo_visivel} onChange={(e) => setF({ ...f, codigo_visivel: e.target.checked })} /> Mostrar o código na mensagem (ex.: "cód. K7Q2M9A"). Por padrão ele vai invisível.</label>
      <div className="flex items-center gap-2">
        <button onClick={salvar} disabled={salvando || !slugOk || !/^\d{10,15}$/.test(zap) || !f.cliente_id} className="h-9 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-fg disabled:opacity-40">{salvando ? "Salvando…" : "Salvar link"}</button>
        {!slugOk && <span className="text-[12px] text-warn">O endereço precisa ter de 3 a 40 letras minúsculas, números ou hífen.</span>}
      </div>
    </section>
  );
}

function Instalacao({ links }: { links: LinkR[] }) {
  const d = useDados();
  const site = links.find((l) => l.canal === "site" && l.ativo) ?? links[0];
  const script = `<script src="${DOMINIO}/rastreio.js" data-link="${site?.slug ?? "SLUG-DO-LINK"}" async></script>`;
  const meta = "utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}";
  const google = "utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={creative}&utm_term={keyword}";
  const copiar = (t: string) => { navigator.clipboard?.writeText(t); d.avisar("Copiado"); };
  const Item = ({ n, titulo, texto, valor }: { n: number; titulo: string; texto: string; valor: string }) => (
    <li className="flex flex-col gap-1.5">
      <b className="text-[13px]">{n}. {titulo}</b>
      <p className="text-[12.5px] text-muted">{texto}</p>
      <div className="flex items-start gap-2 rounded-lg bg-raised p-2"><code className="min-w-0 flex-1 break-all text-[11.5px]">{valor}</code><button onClick={() => copiar(valor)} className="shrink-0 text-muted hover:text-fg" aria-label="Copiar"><Copy size={13} /></button></div>
    </li>
  );
  return (
    <section className="anim-entrar flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2"><Code2 size={15} className="text-accent" /><b className="text-[13.5px]">Como instalar</b></div>
      <ol className="grid gap-4 lg:grid-cols-3">
        <Item n={1} titulo="Script no site do cliente" texto="Cole antes de </body> em todas as páginas (ou pelo Google Tag Manager, como HTML personalizado). Ele guarda de onde a pessoa veio e troca todos os botões de WhatsApp pelo link rastreado. Não precisa mudar os botões." valor={script} />
        <Item n={2} titulo="Meta Ads · parâmetros de URL" texto="No anúncio com destino site, em Parâmetros de URL. Assim cada clique chega com campanha, conjunto e anúncio." valor={meta} />
        <Item n={3} titulo="Google Ads · sufixo do URL final" texto="Em Configurações da conta → Rastreamento → Sufixo do URL final. Deixe a codificação automática (gclid) ligada." valor={google} />
      </ol>
      <p className="flex items-start gap-1.5 text-[12px] text-muted"><Check size={13} className="mt-0.5 shrink-0 text-ok" /> Anúncios de mensagem da Meta (clique para o WhatsApp) não passam pelo link: a origem deles vem da própria conversa, na Fase 2, quando o WhatsApp do cliente estiver conectado.</p>
    </section>
  );
}
