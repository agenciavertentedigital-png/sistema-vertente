import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquareReply, Sparkles, MousePointerClick, Navigation, Phone, Search, ShieldCheck, Star } from "lucide-react";
import { chamarFuncao } from "../../lib/tabela";
import { supabase } from "../../lib/supabase";
import { useDados } from "../../lib/dados";
import { hoje, somarDias } from "../../lib/tipos";

interface Avaliacao { id: string; autor: string; nota: number | null; texto: string; data: string; resposta: string | null; respondida_em: string | null }
interface Relatorio {
  encontrado: boolean;
  aviso?: string;
  total: Record<string, number>;
  dias: ({ data: string } & Record<string, number>)[];
  palavras: { termo: string; impressoes: number; abaixo_de: string | null }[];
  avaliacoes: Avaliacao[];
  media: number | null;
  total_avaliacoes: number | null;
  avisos: string[];
}

const PERIODOS = [
  { id: "30", nome: "30 dias", ini: () => somarDias(hoje(), -30), fim: () => somarDias(hoje(), -1) },
  { id: "90", nome: "90 dias", ini: () => somarDias(hoje(), -90), fim: () => somarDias(hoje(), -1) },
  { id: "mes", nome: "Mês passado", ini: () => { const d = new Date(`${hoje()}T12:00:00Z`); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); }, fim: () => { const d = new Date(`${hoje()}T12:00:00Z`); d.setUTCDate(0); return d.toISOString().slice(0, 10); } },
];
const n = (v: number | undefined) => Math.round(v ?? 0).toLocaleString("pt-BR");
const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

/** Métricas, buscas e avaliações vindas da API oficial do Perfil da Empresa (fichas que a agência gerencia). */
export function DadosOficiaisGoogle({ placeId, nomeFicha = "" }: { placeId: string | null; nomeFicha?: string }) {
  const d = useDados();
  const [periodo, setPeriodo] = useState("30");
  const [r, setR] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<"sem" | "todas">("sem");
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [evolucao, setEvolucao] = useState<({ mes: string } & Record<string, number>)[] | null>(null);

  useEffect(() => {
    if (!placeId || !supabase) return;
    chamarFuncao<{ meses?: ({ mes: string } & Record<string, number>)[] }>("gbp", { acao: "gbp_evolucao", place_id: placeId, meses: 18 }).then((x) => setEvolucao(x.meses ?? []), () => setEvolucao([]));
  }, [placeId]);

  async function sugerir(a: Avaliacao) {
    setGerando(true);
    try {
      const x = await chamarFuncao<{ texto: string }>("gbp", { acao: "gbp_ia_resposta", empresa: nomeFicha, autor: a.autor, nota: a.nota, texto: a.texto });
      setTexto(x.texto);
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  const p = PERIODOS.find((x) => x.id === periodo)!;
  const buscar = useCallback(async () => {
    if (!placeId || !supabase) return;
    setCarregando(true);
    setErro("");
    try {
      setR(await chamarFuncao<Relatorio>("google-ads", { acao: "gbp_relatorio", place_id: placeId, inicio: p.ini(), fim: p.fim() }));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [placeId, p]);
  useEffect(() => void buscar(), [buscar]);

  if (!placeId || !supabase) return null;
  if (erro) return <section className="rounded-2xl border border-line bg-surface p-4 text-[13px] text-bad print:hidden">Dados oficiais do Google: {erro}</section>;
  if (!r) return <div className="esqueleto h-40 rounded-2xl print:hidden" />;
  if (!r.encontrado) return null; // ficha que a agência não gerencia: segue só a análise pública

  const t = r.total;
  const acoes = (t.CALL_CLICKS ?? 0) + (t.WEBSITE_CLICKS ?? 0) + (t.BUSINESS_DIRECTION_REQUESTS ?? 0) + (t.BUSINESS_CONVERSATIONS ?? 0) + (t.BUSINESS_BOOKINGS ?? 0);
  const busca = (t.BUSINESS_IMPRESSIONS_MOBILE_SEARCH ?? 0) + (t.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH ?? 0);
  const maps = (t.BUSINESS_IMPRESSIONS_MOBILE_MAPS ?? 0) + (t.BUSINESS_IMPRESSIONS_DESKTOP_MAPS ?? 0);
  const vis = busca + maps;
  const semResposta = r.avaliacoes.filter((a) => !a.resposta);
  const lista = filtro === "sem" ? semResposta : r.avaliacoes;
  const maxDia = Math.max(1, ...r.dias.map((x) => (x.CALL_CLICKS ?? 0) + (x.WEBSITE_CLICKS ?? 0) + (x.BUSINESS_DIRECTION_REQUESTS ?? 0) + (x.BUSINESS_CONVERSATIONS ?? 0)));

  async function responder(id: string) {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await chamarFuncao("google-ads", { acao: "gbp_responder", place_id: placeId, avaliacao: id, texto });
      d.avisar("Resposta publicada no Google");
      setRespondendo(null);
      setTexto("");
      buscar();
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className={`flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5 print:hidden ${carregando ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck size={16} className="text-ok" />
        <h2 className="text-[15px] font-semibold">Dados oficiais do Google</h2>
        <span className="text-[12px] text-muted">Direto da conta da agência no Perfil da Empresa</span>
        <div role="tablist" className="ml-auto flex gap-1 rounded-lg border border-line p-0.5">
          {PERIODOS.map((x) => (
            <button key={x.id} role="tab" aria-selected={periodo === x.id} onClick={() => setPeriodo(x.id)} className={`rounded-md px-2.5 py-1 text-[12px] ${periodo === x.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>{x.nome}</button>
          ))}
        </div>
      </div>
      {r.avisos.length > 0 && <p className="rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-warn">Parte dos dados não veio: {r.avisos.map((a) => a.split(". ")[0]).join(" · ")}</p>}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi icone={Search} rotulo="Visualizações" valor={n(vis)} detalhe={`${n(busca)} na Busca · ${n(maps)} no Maps`} destaque />
        <Kpi icone={MousePointerClick} rotulo="Ações na ficha" valor={n(acoes)} detalhe={vis ? `${((acoes / vis) * 100).toFixed(1).replace(".", ",")}% de quem viu` : ""} destaque />
        <Kpi icone={Phone} rotulo="Ligações" valor={n(t.CALL_CLICKS)} />
        <Kpi icone={Navigation} rotulo="Pedidos de rota" valor={n(t.BUSINESS_DIRECTION_REQUESTS)} />
        <Kpi icone={MousePointerClick} rotulo="Cliques no site" valor={n(t.WEBSITE_CLICKS)} detalhe={t.BUSINESS_CONVERSATIONS ? `${n(t.BUSINESS_CONVERSATIONS)} conversas` : ""} />
      </div>

      {r.dias.length > 0 && (
        <div>
          <div className="mb-1 text-[12px] text-muted">Ações por dia (ligações, rotas, site e conversas)</div>
          <div className="flex h-20 items-end gap-[2px]">
            {r.dias.map((x) => {
              const v = (x.CALL_CLICKS ?? 0) + (x.WEBSITE_CLICKS ?? 0) + (x.BUSINESS_DIRECTION_REQUESTS ?? 0) + (x.BUSINESS_CONVERSATIONS ?? 0);
              return <div key={x.data} title={`${x.data.split("-").reverse().join("/")}: ${v}`} className="flex-1 rounded-t-[2px] bg-accent/70 hover:bg-accent" style={{ height: `${Math.max(2, (v / maxDia) * 100)}%` }} />;
            })}
          </div>
        </div>
      )}

      {evolucao && evolucao.length > 1 && <Evolucao meses={evolucao} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <h3 className="mb-1.5 text-[13px] font-semibold">O que buscaram até achar a ficha</h3>
          {r.palavras.length === 0 ? (
            <p className="text-[12.5px] text-muted">O Google ainda não liberou as buscas deste período (saem por mês fechado e só com volume mínimo).</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-[13px]">
              {r.palavras.slice(0, 12).map((k) => (
                <li key={k.termo} className="flex justify-between gap-2 py-1.5"><span className="truncate">{k.termo}</span><span className="num shrink-0 text-muted">{k.impressoes ? n(k.impressoes) : `< ${k.abaixo_de ?? 15}`}</span></li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold">Avaliações</h3>
            {r.media != null && <span className="flex items-center gap-1 text-[12.5px]"><Star size={13} className="fill-[#f5b400] text-[#f5b400]" /> {Number(r.media).toFixed(1).replace(".", ",")} · {r.total_avaliacoes} no total</span>}
            <div className="ml-auto flex gap-1 text-[12px]">
              <button onClick={() => setFiltro("sem")} className={`rounded-md px-2 py-0.5 ${filtro === "sem" ? "bg-warn-soft font-medium text-warn" : "text-muted"}`}>Sem resposta ({semResposta.length})</button>
              <button onClick={() => setFiltro("todas")} className={`rounded-md px-2 py-0.5 ${filtro === "todas" ? "bg-raised font-medium" : "text-muted"}`}>Recentes</button>
            </div>
          </div>
          {lista.length === 0 ? (
            <p className="text-[12.5px] text-muted">{filtro === "sem" ? "Todas as avaliações recentes estão respondidas." : "Nenhuma avaliação recente."}</p>
          ) : (
            <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
              {lista.slice(0, 20).map((a) => (
                <li key={a.id} className="rounded-xl border border-line p-3 text-[13px]">
                  <div className="flex items-center gap-2">
                    <b className="truncate">{a.autor}</b>
                    <span className="text-[#f5b400]">{"★".repeat(a.nota ?? 0)}<span className="text-line-forte">{"★".repeat(5 - (a.nota ?? 0))}</span></span>
                    <span className="ml-auto text-[11.5px] text-muted">{dataBR(a.data)}</span>
                  </div>
                  {a.texto && <p className="mt-1 whitespace-pre-wrap leading-snug">{a.texto}</p>}
                  {a.resposta ? (
                    <p className="mt-2 rounded-lg bg-raised px-2.5 py-1.5 text-[12.5px] text-muted"><b className="text-fg">Resposta:</b> {a.resposta}</p>
                  ) : respondendo === a.id ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <textarea autoFocus rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva a resposta. Ela será publicada no Google com o nome da empresa." className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none focus:border-accent" />
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => sugerir(a)} disabled={gerando} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] hover:border-accent hover:text-accent disabled:opacity-50">{gerando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {texto ? "Gerar outra" : "Sugerir com IA"}</button>
                        <button onClick={() => responder(a.id)} disabled={enviando || !texto.trim()} className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg disabled:opacity-40">{enviando ? "Publicando…" : "Publicar resposta"}</button>
                        <button onClick={() => { setRespondendo(null); setTexto(""); }} className="h-8 rounded-lg px-3 text-[12.5px] text-muted">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setRespondendo(a.id); setTexto(""); }} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"><MessageSquareReply size={13} /> Responder</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Kpi({ icone: I, rotulo, valor, detalhe, destaque }: { icone: typeof Search; rotulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${destaque ? "border-accent/40 bg-accent-soft" : "border-line"}`}>
      <div className="flex items-center gap-1.5 text-[12px] text-muted"><I size={13} /> {rotulo}</div>
      <b className="num block text-[20px] leading-tight">{valor}</b>
      {detalhe && <span className="text-[11.5px] text-muted">{detalhe}</span>}
    </div>
  );
}

type Mes = { mes: string } & Record<string, number>;
const visMes = (m: Mes) => (m.BUSINESS_IMPRESSIONS_MOBILE_SEARCH ?? 0) + (m.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH ?? 0) + (m.BUSINESS_IMPRESSIONS_MOBILE_MAPS ?? 0) + (m.BUSINESS_IMPRESSIONS_DESKTOP_MAPS ?? 0);
const acoesMes = (m: Mes) => (m.CALL_CLICKS ?? 0) + (m.WEBSITE_CLICKS ?? 0) + (m.BUSINESS_DIRECTION_REQUESTS ?? 0) + (m.BUSINESS_CONVERSATIONS ?? 0);
const nomeMes = (k: string) => new Date(`${k}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(". de ", "/").replace(".", "");

/** Evolução mês a mês (até 18 meses) e comparação do último mês fechado com o anterior e com o mesmo mês do ano passado. */
function Evolucao({ meses }: { meses: Mes[] }) {
  const atualKey = hoje().slice(0, 7);
  const fechados = meses.filter((m) => m.mes < atualKey);
  const ult = fechados[fechados.length - 1];
  const ant = fechados[fechados.length - 2];
  const anoPassado = ult ? fechados.find((m) => m.mes === `${Number(ult.mes.slice(0, 4)) - 1}${ult.mes.slice(4)}`) : undefined;
  const max = Math.max(1, ...meses.map(visMes));
  const maxA = Math.max(1, ...meses.map(acoesMes));
  const comp = (rot: string, f: (m: Mes) => number) => {
    if (!ult) return null;
    const v = f(ult);
    const va = ant ? f(ant) : null;
    const vy = anoPassado ? f(anoPassado) : null;
    const p = (x: number | null) => (x ? `${v >= x ? "▲" : "▼"} ${Math.abs(Math.round(((v - x) / x) * 100))}%` : "—");
    const cor = (x: number | null) => (x ? (v >= x ? "text-ok" : "text-bad") : "text-muted");
    return (
      <div className="rounded-xl border border-line px-3 py-2 text-[12.5px]">
        <div className="text-muted">{rot} em {nomeMes(ult.mes)}</div>
        <b className="num text-[18px]">{Math.round(v).toLocaleString("pt-BR")}</b>
        <div className="flex gap-3"><span className={cor(va)}>{p(va)} vs mês anterior</span><span className={cor(vy)}>{p(vy)} vs ano passado</span></div>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {comp("Visualizações", visMes)}
        {comp("Ações na ficha", acoesMes)}
        {comp("Ligações", (m) => m.CALL_CLICKS ?? 0)}
        {comp("Pedidos de rota", (m) => m.BUSINESS_DIRECTION_REQUESTS ?? 0)}
      </div>
      <div>
        <div className="mb-1 flex gap-3 text-[12px] text-muted"><span>Evolução mês a mês ({meses.length} meses)</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent/30" /> visualizações</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent" /> ações</span></div>
        <div className="flex h-28 items-end gap-1">
          {meses.map((m) => (
            <div key={m.mes} className="flex flex-1 flex-col items-center gap-0.5" title={`${nomeMes(m.mes)}: ${visMes(m)} visualizações · ${acoesMes(m)} ações`}>
              <div className="flex h-24 w-full items-end gap-[2px]">
                <div className="flex-1 rounded-t-[2px] bg-accent/30" style={{ height: `${Math.max(2, (visMes(m) / max) * 100)}%` }} />
                <div className="flex-1 rounded-t-[2px] bg-accent" style={{ height: `${Math.max(2, (acoesMes(m) / maxA) * 100)}%` }} />
              </div>
              <span className="text-[9.5px] text-muted">{nomeMes(m.mes)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
