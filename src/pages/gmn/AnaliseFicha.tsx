import { useState } from "react";
import { CheckCircle2, ExternalLink, Link2, Loader2, MapPin, Search, Star, Trophy } from "lucide-react";
import { useDados } from "../../lib/dados";
import { chamarFuncao } from "../../lib/tabela";
import { supabase } from "../../lib/supabase";
import { hoje } from "../../lib/tipos";
import type { AnaliseGmn, PerfilGmn } from "../../lib/gmn";
import {
  CRITERIOS_FICHA,
  GRUPOS_FICHA,
  avaliarFicha,
  coletaDemo,
  coletarFicha,
  notaFicha,
  statusPct,
  type ColetaFicha,
  type ItemAnalise,
} from "../../lib/fichaGoogle";
import { Botao, Entrada, Painel, Rotulo, Selecao } from "../../components/ui";
import { Anel } from "../../components/visual";
import type { useGmn } from "./GoogleMeuNegocio";

type Gmn = ReturnType<typeof useGmn>;

const dataBR = (iso: string | null | undefined) => (iso ? new Date(iso.replace(" +00:00", "Z").replace(" ", "T")).toLocaleDateString("pt-BR") : "—");
const nivelDe = (pct: number | null) => (pct === null ? 0 : pct >= 80 ? 2 : pct >= 40 ? 1 : 0) as 0 | 1 | 2;

/** Monta e salva a análise a partir da coleta. */
export async function salvarAnaliseFicha(gmn: Gmn, perfilId: string, coleta: ColetaFicha, respostas: Record<string, boolean> = {}, analiseId: string | null = null) {
  const itens = avaliarFicha(coleta, respostas);
  return gmn.analises.salvar(analiseId, {
    perfil_id: perfilId,
    ...(analiseId ? {} : { data: hoje() }),
    nota: notaFicha(itens),
    criterios: itens.map((i) => ({ id: i.id, nivel: nivelDe(i.pct), obs: i.texto, pct: i.pct, manual: i.manual })),
    dados: { versao: 2, coleta, respostas, nota_media: coleta.info.nota, avaliacoes: coleta.info.avaliacoes, fotos: coleta.info.fotos, categoria: coleta.info.categoria },
    origem: "google",
  } as Partial<AnaliseGmn>);
}

/** Roda a coleta (ou o exemplo na prévia). */
export async function rodarColeta(placeId: string, aviso: (t: string) => void, nome?: string) {
  if (!supabase) {
    aviso("Prévia: montando um exemplo…");
    await new Promise((ok) => setTimeout(ok, 900));
    return coletaDemo(nome);
  }
  return coletarFicha(placeId, aviso);
}

// ------------------------------------------------------------------
// Nova análise: nome + link da ficha
// ------------------------------------------------------------------
interface Achado { id: string; displayName?: { text: string }; formattedAddress?: string; rating?: number; userRatingCount?: number; primaryTypeDisplayName?: { text: string }; googleMapsUri?: string }

export function NovaAnaliseFicha({ aberto, fechar, gmn, prospeccao, ir }: { aberto: boolean; fechar: () => void; gmn: Gmn; prospeccao: boolean; ir: (r: string) => void }) {
  const d = useDados();
  const [nome, setNome] = useState("");
  const [link, setLink] = useState("");
  const [achado, setAchado] = useState<Achado | null>(null);
  const [outros, setOutros] = useState<Achado[]>([]);
  const [cliente, setCliente] = useState("");
  const [etapa, setEtapa] = useState<"dados" | "confirmar" | "rodando">("dados");
  const [msg, setMsg] = useState("");

  function limpar() {
    setNome(""); setLink(""); setAchado(null); setOutros([]); setCliente(""); setEtapa("dados"); setMsg("");
  }

  async function localizar() {
    setMsg("Procurando a ficha no Google…");
    try {
      if (!supabase) {
        setAchado({ id: "demo", displayName: { text: nome || "Empresa de exemplo" }, formattedAddress: "R. Exemplo, 121 - Ipatinga - MG", rating: 5, userRatingCount: 123, primaryTypeDisplayName: { text: "Instituição educacional" } });
      } else {
        const r = await chamarFuncao<{ perfil: Achado; outros: Achado[] }>("gbp-check", { acao: "localizar", nome, link });
        setAchado(r.perfil);
        setOutros(r.outros ?? []);
      }
      setEtapa("confirmar");
      setMsg("");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function analisar() {
    if (!achado) return;
    setEtapa("rodando");
    try {
      const existente = gmn.perfis.linhas.find((p) => p.place_id === achado.id && achado.id !== "demo");
      const coleta = await rodarColeta(achado.id, setMsg, achado.displayName?.text);
      setMsg("Montando o relatório…");
      const perfilId =
        existente?.id ??
        (await gmn.perfis.salvar(null, {
          cliente_id: prospeccao ? null : cliente || null,
          nome: coleta.info.titulo ?? achado.displayName?.text ?? nome,
          place_id: achado.id === "demo" ? null : achado.id,
          endereco: coleta.info.endereco ?? achado.formattedAddress ?? null,
          cidade: coleta.info.cidade ?? null,
          categoria: coleta.info.categoria ?? achado.primaryTypeDisplayName?.text ?? null,
          url_maps: link || achado.googleMapsUri || null,
          palavras: [coleta.info.categoria].filter(Boolean) as string[],
          ativo: true,
        } as Partial<PerfilGmn>));
      await salvarAnaliseFicha(gmn, perfilId, coleta);
      d.avisar(`Análise pronta · custo US$ ${coleta.custo.toFixed(3)}`);
      limpar();
      fechar();
      ir(`gmn-perfil-${perfilId}`);
    } catch (e) {
      setMsg((e as Error).message);
      setEtapa("confirmar");
    }
  }

  return (
    <Painel aberto={aberto} fechar={() => { limpar(); fechar(); }} titulo="Analisar ficha do Google" largura={560}>
      <div className="flex flex-col gap-4">
        {etapa === "dados" && (
          <>
            <p className="text-[13px] text-muted">Cole o link da ficha (do Google Maps ou da busca) e o nome da empresa. O sistema encontra a ficha e faz a análise completa: informações, fotos, avaliações, postagens e concorrentes.</p>
            <Rotulo texto="Nome da empresa">
              <Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Clínica Nobre Fio Ipatinga" />
            </Rotulo>
            <Rotulo texto="Link da ficha no Google">
              <Entrada value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://maps.app.goo.gl/… ou link do Google Maps" onKeyDown={(e) => e.key === "Enter" && (nome || link) && localizar()} />
            </Rotulo>
            <Botao variante="primario" onClick={localizar} disabled={!nome.trim() && !link.trim()}><Search size={14} /> Encontrar ficha</Botao>
          </>
        )}

        {etapa !== "dados" && achado && (
          <div className="rounded-2xl border border-accent/40 bg-accent-soft/40 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg"><MapPin size={18} /></span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">{achado.displayName?.text}</div>
                <div className="text-[12.5px] text-muted">{achado.formattedAddress}</div>
                <div className="mt-1 flex flex-wrap gap-3 text-[12.5px]">
                  {achado.primaryTypeDisplayName && <span>{achado.primaryTypeDisplayName.text}</span>}
                  {achado.rating != null && <span className="flex items-center gap-1"><Star size={12} className="text-warn" fill="currentColor" /> {String(achado.rating).replace(".", ",")} · {achado.userRatingCount} avaliações</span>}
                  {achado.googleMapsUri && <a href={achado.googleMapsUri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent"><ExternalLink size={12} /> ver no Maps</a>}
                </div>
              </div>
            </div>
          </div>
        )}

        {etapa === "confirmar" && (
          <>
            {outros.length > 0 && (
              <div className="text-[12.5px]">
                <div className="mb-1 text-muted">Não é essa? Outras encontradas:</div>
                {outros.map((o) => (
                  <button key={o.id} onClick={() => { setOutros([achado!, ...outros.filter((x) => x.id !== o.id)]); setAchado(o); }} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-raised">
                    <b>{o.displayName?.text}</b> <span className="text-muted">· {o.formattedAddress}</span>
                  </button>
                ))}
              </div>
            )}
            {!prospeccao && (
              <Rotulo texto="Cliente (deixe em branco para prospecção)">
                <Selecao value={cliente} onChange={(e) => setCliente(e.target.value)}>
                  <option value="">Prospecção</option>
                  {d.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Selecao>
              </Rotulo>
            )}
            <div className="flex gap-2">
              <Botao onClick={() => setEtapa("dados")}>Voltar</Botao>
              <Botao variante="primario" onClick={analisar} className="flex-1"><CheckCircle2 size={14} /> É essa. Analisar agora (~US$ 0,03)</Botao>
            </div>
          </>
        )}

        {etapa === "rodando" && (
          <div className="flex items-center gap-3 rounded-xl bg-raised p-4 text-[13px]">
            <Loader2 size={18} className="animate-spin text-accent" />
            <span>{msg || "Analisando…"}</span>
          </div>
        )}
        {etapa !== "rodando" && msg && <p className="text-[12.5px] text-muted">{msg}</p>}
      </div>
    </Painel>
  );
}

// ------------------------------------------------------------------
// Relatório da análise
// ------------------------------------------------------------------
export function RelatorioFicha({ perfil, analise, gmn, ocultarRecomendacoes }: { perfil: PerfilGmn; analise: AnaliseGmn; gmn: Gmn; ocultarRecomendacoes: boolean }) {
  const d = useDados();
  const coleta = analise.dados.coleta!;
  const respostas = analise.dados.respostas ?? {};
  const itens: ItemAnalise[] = avaliarFicha(coleta, respostas);
  const porId = new Map(itens.map((i) => [i.id, i]));
  const contagem = { fraco: 0, razoavel: 0, bom: 0, verificar: 0 };
  for (const i of itens) contagem[statusPct(i.pct).chave]++;

  async function responder(id: string, sim: boolean) {
    try {
      await salvarAnaliseFicha(gmn, perfil.id, coleta, { ...respostas, [id]: sim }, analise.id);
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  const prioridades = CRITERIOS_FICHA.map((c) => ({ c, i: porId.get(c.id)! }))
    .filter(({ i }) => i.pct !== null && i.pct < 80)
    .sort((a, b) => b.c.peso * (100 - (b.i.pct ?? 0)) - a.c.peso * (100 - (a.i.pct ?? 0)));
  const fortes = CRITERIOS_FICHA.filter((c) => (porId.get(c.id)?.pct ?? 0) >= 100).sort((a, b) => b.peso - a.peso).slice(0, 4);

  return (
    <div className="flex flex-col gap-5">
      {/* Placar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["bom", "Bom", "var(--ok)"], ["razoavel", "Razoável", "var(--warn)"], ["fraco", "Fraco", "var(--bad)"], ["verificar", "Verificar", "var(--muted)"]] as const).map(([k, n, cor]) => (
          <div key={k} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <span className="num text-[30px] font-semibold" style={{ color: cor }}>{contagem[k]}</span>
            <span className="text-[13px] text-muted">{n}</span>
          </div>
        ))}
      </div>

      {/* Resumo executivo */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold"><Trophy size={15} className="text-ok" /> Pontos fortes</h3>
          {fortes.length ? (
            <ul className="mt-2 flex flex-col gap-1 text-[12.5px]">{fortes.map((c) => <li key={c.id}>✓ <b>{c.nome}</b> <span className="text-muted">— {porId.get(c.id)?.texto}</span></li>)}</ul>
          ) : <p className="mt-2 text-[12.5px] text-muted">Nenhum ponto 100% ainda.</p>}
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="text-[14px] font-semibold">O que mais vai melhorar a ficha</h3>
          {prioridades.length ? (
            <ol className="mt-2 flex flex-col gap-1.5 text-[12.5px]">
              {prioridades.slice(0, 5).map(({ c }, n) => (
                <li key={c.id} className="flex gap-2"><span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[10.5px] font-semibold text-accent">{n + 1}</span><span><b>{c.nome}</b>{!ocultarRecomendacoes && <span className="text-muted"> — {c.recomendacao}</span>}</span></li>
              ))}
            </ol>
          ) : <p className="mt-2 text-[12.5px] text-ok">Tudo em nível Bom. Manter a rotina mensal.</p>}
        </div>
      </div>

      {/* Critérios por grupo */}
      {GRUPOS_FICHA.map((g) => {
        const cs = CRITERIOS_FICHA.filter((c) => c.grupo === g);
        const validos = cs.map((c) => porId.get(c.id)!).filter((i) => i.pct !== null);
        const pg = validos.length ? Math.round(validos.reduce((s, i) => s + (i.pct ?? 0), 0) / validos.length) : null;
        return (
          <section key={g} className="print:break-inside-avoid">
            <div className="mb-2 flex items-end justify-between">
              <h2 className="text-[17px] font-semibold">{g}</h2>
              {pg !== null && <span className="num text-[13px] font-semibold" style={{ color: statusPct(pg).cor }}>{pg}%</span>}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {cs.map((c) => {
                const i = porId.get(c.id)!;
                const st = statusPct(i.pct);
                return (
                  <article key={c.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 print:break-inside-avoid">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[14px] font-semibold">{c.nome}</h3>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: st.cor }}>{st.nome}</span>
                    </div>
                    <p className="text-[12px] leading-snug text-muted">{c.porque}</p>
                    <p className="text-[13px] leading-snug">{i.texto}</p>
                    {i.pct !== null ? (
                      <div className="mt-auto flex items-center gap-2">
                        <div className="relative flex h-2.5 flex-1 overflow-hidden rounded-full bg-raised">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, i.pct)}%`, background: st.cor }} />
                          <span className="absolute left-[40%] top-0 h-full w-px bg-bg" />
                          <span className="absolute left-[80%] top-0 h-full w-px bg-bg" />
                        </div>
                        <span className="num w-10 text-right text-[12.5px] font-semibold" style={{ color: st.cor }}>{i.pct}%</span>
                      </div>
                    ) : null}
                    {c.pergunta && (i.pct === null || i.manual) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-xl bg-raised px-3 py-2 text-[12.5px] print:hidden">
                        <span className="flex-1">{c.pergunta}</span>
                        <button onClick={() => responder(c.id, true)} className={`rounded-lg px-2.5 py-1 font-medium ${respostas[c.id] === true ? "bg-ok text-white" : "border border-line bg-surface"}`}>Sim</button>
                        <button onClick={() => responder(c.id, false)} className={`rounded-lg px-2.5 py-1 font-medium ${respostas[c.id] === false ? "bg-bad text-white" : "border border-line bg-surface"}`}>Não</button>
                      </div>
                    )}
                    {!ocultarRecomendacoes && i.pct !== null && i.pct < 80 && <p className="rounded-lg bg-accent-soft/50 px-2.5 py-1.5 text-[12px] text-accent">→ {c.recomendacao}</p>}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Concorrentes */}
      {coleta.concorrentes.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4 print:break-inside-avoid">
          <h2 className="text-[16px] font-semibold">Comparativo com concorrentes</h2>
          <p className="text-[12px] text-muted">Busca por "{coleta.info.categoria}" no Google Maps, a partir do endereço da empresa.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead className="text-left text-[11.5px] text-muted">
                <tr><th className="py-1.5">Posição</th><th>Empresa</th><th>Nota</th><th>Avaliações</th><th>Reivindicada</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[
                  { nome: coleta.info.titulo ?? perfil.nome, posicao: coleta.posicao_categoria, nota: coleta.info.nota, avaliacoes: coleta.info.avaliacoes, reivindicado: coleta.info.reivindicado, eu: true },
                  ...coleta.concorrentes.map((x) => ({ ...x, eu: false })),
                ]
                  .sort((a, b) => (a.posicao ?? 99) - (b.posicao ?? 99))
                  .map((x) => (
                    <tr key={x.nome} className={x.eu ? "bg-accent-soft/50 font-semibold" : ""}>
                      <td className="num py-2 pl-1">{x.posicao ? `${x.posicao}º` : "fora do top 20"}</td>
                      <td>{x.nome}</td>
                      <td className="num">{x.nota != null ? `★ ${String(x.nota).replace(".", ",")}` : "—"}</td>
                      <td className="num">{x.avaliacoes ?? "—"}</td>
                      <td>{x.reivindicado === null ? "—" : x.reivindicado ? "sim" : "não"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Avaliações e postagens */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Distribuicao dist={coleta.info.distribuicao ?? {}} />
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="text-[14px] font-semibold">O que os clientes mais citam</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(coleta.info.temas ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, v]) => (
              <span key={t} className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent">{t} <span className="num opacity-70">{v}</span></span>
            ))}
            {!Object.keys(coleta.info.temas ?? {}).length && <span className="text-[12.5px] text-muted">O Google ainda não agrupou temas para esta ficha.</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="text-[14px] font-semibold">Últimas postagens</h3>
          {coleta.postagens.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {coleta.postagens.slice(0, 3).map((p, n) => (
                <li key={n} className="flex gap-2 text-[12px]">
                  {p.imagem && <img src={p.imagem} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy" />}
                  <div className="min-w-0"><div className="text-muted">{dataBR(p.data)}</div><p className="line-clamp-2">{p.texto}</p></div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[12.5px] text-bad">Nenhuma postagem encontrada.</p>}
        </div>
      </div>

      {coleta.avaliacoes.some((a) => !a.respondida) && (
        <section className="rounded-2xl border border-line bg-surface p-4 print:break-inside-avoid">
          <h3 className="text-[14px] font-semibold">Avaliações sem resposta</h3>
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {coleta.avaliacoes.filter((a) => !a.respondida).sort((a, b) => (a.nota ?? 5) - (b.nota ?? 5)).slice(0, 6).map((a, n) => (
              <li key={n} className="py-2 text-[12.5px]">
                <div className="flex justify-between gap-2"><b>{a.autor ?? "Cliente"} · {"★".repeat(Number(a.nota ?? 0))}</b><span className="text-muted">{dataBR(a.data)}</span></div>
                {a.texto && <p className="text-muted">{a.texto}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-muted print:hidden">
        Dados coletados em {new Date(coleta.coletado_em).toLocaleString("pt-BR")} · últimas {coleta.avaliacoes.length} avaliações e {coleta.postagens.length} postagens · custo US$ {coleta.custo.toFixed(3)}.
        {" "}Fotos do proprietário, de clientes e da última foto são estimadas pelas fotos em destaque e pelas postagens; horário especial, fundação e vídeos você confirma com Sim/Não.
      </p>
    </div>
  );
}

function Distribuicao({ dist }: { dist: Record<string, number> }) {
  const total = Object.values(dist).reduce((s, v) => s + Number(v || 0), 0);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="text-[14px] font-semibold">Distribuição das notas</h3>
      <div className="mt-3 flex flex-col gap-1.5">
        {[5, 4, 3, 2, 1].map((n) => {
          const v = Number(dist[String(n)] ?? 0);
          return (
            <div key={n} className="flex items-center gap-2 text-[12px]">
              <span className="w-6 text-muted">{n}★</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised">
                <div className="h-full rounded-full" style={{ width: `${total ? (v / total) * 100 : 0}%`, background: n >= 4 ? "var(--ok)" : n === 3 ? "var(--warn)" : "var(--bad)" }} />
              </div>
              <span className="num w-9 text-right">{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Cabeçalho compacto com o link para a ficha. */
export function LinkFicha({ perfil, coleta }: { perfil: PerfilGmn; coleta?: ColetaFicha }) {
  const url = coleta?.info.maps ?? perfil.url_maps;
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-white/80 hover:text-white">
      <Link2 size={13} /> Abrir a ficha no Google
    </a>
  );
}

export { Anel };
