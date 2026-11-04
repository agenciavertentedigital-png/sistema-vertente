import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, FileText, Loader2, Printer, ShieldCheck, Sparkles } from "lucide-react";
import { chamarFuncao } from "../../lib/tabela";
import { supabase } from "../../lib/supabase";
import { useDados } from "../../lib/dados";
import { hoje } from "../../lib/tipos";
import type { AnaliseGmn, PerfilGmn } from "../../lib/gmn";
import {
  COR_FAIXA, NOME_FAIXA, avaliarCompleta, faixaItem, faixaNota, interpretacao, notaCompleta,
  relatorioAvaliacoes, relatorioMetricas, relatorioMidia, relatorioPostagens,
  type ColetaCompleta, type ItemCompleto,
} from "../../lib/analiseCompleta";
import type { useGmn } from "./GoogleMeuNegocio";

type Gmn = ReturnType<typeof useGmn>;
export const ehOficial = (a?: AnaliseGmn) => (a?.dados as { versao?: number } | undefined)?.versao === 3;
const coletaDe = (a: AnaliseGmn) => (a.dados as unknown as { coleta: ColetaCompleta }).coleta;
const n = (v: number, casas = 0) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas });
const pct = (v: number, casas = 1) => `${n(v * 100, casas)}%`;
const dataBR = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
const nomeMes = (k: string) => new Date(`${k}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(". de ", "/").replace(".", "");

/** Roda a análise completa pela API oficial e salva no histórico da ficha. */
export async function rodarAnaliseOficial(gmn: Gmn, perfil: PerfilGmn) {
  const c = await chamarFuncao<ColetaCompleta & { encontrado: boolean }>("gbp", { acao: "gbp_analise", place_id: perfil.place_id });
  if (!c.encontrado) throw new Error("Esta ficha não está na conta da agência no Google. Use a análise pública (Analisar ficha agora).");
  const itens = avaliarCompleta(c);
  const nota = notaCompleta(itens);
  await gmn.analises.salvar(null, {
    perfil_id: perfil.id,
    data: hoje(),
    nota,
    criterios: itens.map((i) => ({ id: i.id, nivel: i.pct >= 75 ? 2 : i.pct >= 40 ? 1 : 0, obs: i.texto, pct: i.pct })),
    dados: { versao: 3, coleta: c, nota_media: c.avaliacoes_media, avaliacoes: c.avaliacoes_total, categoria: c.ficha.categoria } as never,
    origem: "google",
  } as Partial<AnaliseGmn>);
  return nota;
}

// ------------------------------------------------------------------
// Velocímetro
// ------------------------------------------------------------------
export function Velocimetro({ nota, tamanho = 220 }: { nota: number; tamanho?: number }) {
  const r = 80;
  const arco = (de: number, ate: number) => {
    const a0 = Math.PI * (1 - de / 100), a1 = Math.PI * (1 - ate / 100);
    return `M ${100 + r * Math.cos(a0)} ${100 - r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${100 + r * Math.cos(a1)} ${100 - r * Math.sin(a1)}`;
  };
  const ang = Math.PI * (1 - Math.max(0, Math.min(100, nota)) / 100);
  const f = faixaNota(nota);
  return (
    <svg viewBox="0 0 200 120" width={tamanho} height={tamanho * 0.6} aria-label={`Nota ${nota}`}>
      <path d={arco(0, 54)} stroke={COR_FAIXA.fraco} strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d={arco(56, 79)} stroke={COR_FAIXA.razoavel} strokeWidth="14" fill="none" />
      <path d={arco(81, 100)} stroke={COR_FAIXA.bom} strokeWidth="14" fill="none" strokeLinecap="round" />
      <line x1="100" y1="100" x2={100 + 62 * Math.cos(ang)} y2={100 - 62 * Math.sin(ang)} stroke="rgb(var(--fg-c))" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="100" r="7" fill="rgb(var(--fg-c))" />
      <text x="100" y="118" textAnchor="middle" fontSize="11" fill={COR_FAIXA[f]} fontWeight="700">{NOME_FAIXA[f].toUpperCase()}</text>
    </svg>
  );
}

function ItemLinha({ i, aberto }: { i: ItemCompleto; aberto: boolean }) {
  const [ab, setAb] = useState(aberto);
  const f = faixaItem(i.pct);
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <button onClick={() => setAb((x) => !x)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: COR_FAIXA[f] }}>{f === "bom" ? "✓" : f === "razoavel" ? "!" : "×"}</span>
        <span className="flex-1 text-[14px] font-medium">{i.nome}</span>
        <span className="num text-[13px] font-semibold" style={{ color: COR_FAIXA[f] }}>{i.pct}%</span>
        <ChevronDown size={15} className={`text-muted transition-transform ${ab ? "rotate-180" : ""}`} />
      </button>
      {ab && (
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 text-[13px]">
          <p className="text-muted">{i.porque}</p>
          <p>{i.texto}</p>
          <div className="relative mt-1 h-2 overflow-hidden rounded-full" style={{ background: `linear-gradient(90deg, ${COR_FAIXA.fraco} 0 40%, ${COR_FAIXA.razoavel} 40% 75%, ${COR_FAIXA.bom} 75% 100%)` }}>
            <span className="absolute top-[-3px] h-[14px] w-[3px] rounded bg-fg" style={{ left: `calc(${i.pct}% - 2px)` }} />
          </div>
          <div className="flex justify-between text-[10.5px] font-semibold text-muted"><span>FRACO</span><span>RAZOÁVEL</span><span>BOM</span></div>
        </div>
      )}
    </div>
  );
}

/** Bloco da análise completa oficial na tela da ficha. */
export function AnaliseOficial({ perfil, gmn, ir }: { perfil: PerfilGmn; gmn: Gmn; ir: (r: string) => void }) {
  const d = useDados();
  const [rodando, setRodando] = useState(false);
  const [tudo, setTudo] = useState(false);
  const ultima = gmn.historico(perfil.id).find(ehOficial);
  const c = ultima ? coletaDe(ultima) : null;
  const itens = useMemo(() => (c ? avaliarCompleta(c) : []), [c]);
  if (!perfil.place_id || !supabase) return null;

  async function rodar() {
    setRodando(true);
    try {
      const nota = await rodarAnaliseOficial(gmn, perfil);
      d.avisar(`Análise completa atualizada: nota ${nota}`);
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setRodando(false);
    }
  }

  const cont = { fraco: itens.filter((i) => faixaItem(i.pct) === "fraco").length, razoavel: itens.filter((i) => faixaItem(i.pct) === "razoavel").length, bom: itens.filter((i) => faixaItem(i.pct) === "bom").length };
  const dist = c ? [5, 4, 3, 2, 1].map((k) => c.avaliacoes.filter((a) => a.nota === k).length) : [];

  return (
    <section className="flex flex-col gap-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck size={17} className="text-ok" />
        <h2 className="text-[16px] font-semibold">Análise completa (dados oficiais do dono)</h2>
        {ultima && <span className="text-[12px] text-muted">Atualizada em {dataBR(ultima.criado_em ?? ultima.data)}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {ultima && <button onClick={() => ir(`gmn-relatorio-${perfil.id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] hover:border-accent hover:text-accent"><FileText size={14} /> Relatório avançado</button>}
          <button onClick={rodar} disabled={rodando} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg disabled:opacity-50">
            {rodando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {rodando ? "Analisando…" : ultima ? "Analisar de novo" : "Fazer análise completa"}
          </button>
        </div>
      </div>
      {!ultima ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-[13px] text-muted">Esta ficha é gerenciada pela agência: a análise completa usa os dados do dono no Google (fotos de clientes, vídeos, capa, logotipo, horário especial, data de fundação, postagens e todas as avaliações). Grátis, sem custo de DataForSEO.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col items-center rounded-2xl border border-line bg-surface p-4">
                <div className="text-[15px] font-semibold">Pontuação geral</div>
                <div className="text-[12px] text-muted">Desempenho do negócio</div>
                <Velocimetro nota={ultima.nota} />
                <b className="num -mt-1 text-[34px]">{ultima.nota}</b>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
                <div className="text-center text-[15px] font-semibold">Pontuação detalhada</div>
                {(["fraco", "razoavel", "bom"] as const).map((k) => (
                  <div key={k} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full text-[14px] font-bold text-white" style={{ background: COR_FAIXA[k] }}>{cont[k]}</span>
                    <div><div className="text-[13px] font-semibold">{NOME_FAIXA[k]}</div><div className="text-[11.5px] text-muted">{k === "fraco" ? "Itens que precisam de atenção" : k === "razoavel" ? "Itens com potencial de melhoria" : "Itens em excelente estado"}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end"><button onClick={() => setTudo((x) => !x)} className="text-[12.5px] text-accent hover:underline">{tudo ? "Recolher tudo" : "Expandir tudo"}</button></div>
            <div key={String(tudo)} className="flex flex-col gap-2">{itens.map((i) => <ItemLinha key={i.id} i={i} aberto={tudo} />)}</div>
          </div>
          {c && (
            <aside className="flex flex-col gap-3 self-start rounded-2xl border border-line bg-surface p-4 text-[13px]">
              <div className="text-[16px] font-semibold leading-tight">{c.ficha.nome}</div>
              {c.avaliacoes_media != null && <div className="flex items-center gap-1.5"><b>{n(Number(c.avaliacoes_media), 1)}</b><span className="text-[#f5b400]">★★★★★</span><span className="text-muted">({c.avaliacoes_total} avaliações)</span></div>}
              <div className="text-muted">{[c.ficha.categoria, c.local.cidade].filter(Boolean).join(" · ")}</div>
              {c.ficha.maps && <a href={c.ficha.maps} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><ExternalLink size={12} /> Ver no Maps</a>}
              {c.ficha.descricao && <p className="max-h-40 overflow-y-auto text-[12.5px] leading-relaxed text-muted">{c.ficha.descricao}</p>}
              {c.ficha.endereco && <div><div className="text-[11px] font-semibold text-muted">ENDEREÇO</div>{(c.ficha.endereco.addressLines ?? []).join(", ")} · {c.ficha.endereco.locality}</div>}
              {c.ficha.telefone && <div><div className="text-[11px] font-semibold text-muted">TELEFONE</div>{c.ficha.telefone}</div>}
              <div className="flex flex-col gap-1">
                {[5, 4, 3, 2, 1].map((k, idx) => (
                  <div key={k} className="flex items-center gap-2 text-[12px]">
                    <span className="w-3">{k}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-[#f5b400]" style={{ width: `${(dist[idx] / Math.max(1, c.avaliacoes.length)) * 100}%` }} /></div>
                    <span className="num w-8 text-right text-muted">{dist[idx]}</span>
                  </div>
                ))}
              </div>
              <div className="text-[11.5px] text-muted">{c.ficha.verificada ? "Perfil verificado" : "Perfil não verificado"}{c.ficha.problema ? ` · ${c.ficha.problema}` : ""}</div>
            </aside>
          )}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------
// Relatório avançado (página para imprimir / PDF)
// ------------------------------------------------------------------
function Sec({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 [break-inside:avoid-page]">
      <div><h2 className="text-[18px] font-semibold">{titulo}</h2>{sub && <p className="text-[13px] text-muted">{sub}</p>}</div>
      {children}
    </section>
  );
}
function Num({ v, r, d }: { v: string; r: string; d?: string }) {
  return <div className="rounded-xl border border-line px-3 py-2.5"><b className="num block text-[20px] leading-tight">{v}</b><span className="text-[12px] text-muted">{r}</span>{d && <span className="block text-[11px] text-muted">{d}</span>}</div>;
}
function Barras({ itens, cor = "rgb(var(--accent-c))" }: { itens: { rotulo: string; valor: number }[]; cor?: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="flex h-36 items-end gap-1.5">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex flex-1 flex-col items-center gap-1" title={`${i.rotulo}: ${i.valor}`}>
          <span className="num text-[10px] text-muted">{i.valor ? n(i.valor) : ""}</span>
          <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(2, (i.valor / max) * 100)}px`, background: cor }} />
          <span className="text-[10px] text-muted">{i.rotulo}</span>
        </div>
      ))}
    </div>
  );
}

export function RelatorioAvancado({ perfil, gmn, ir }: { perfil: PerfilGmn; gmn: Gmn; ir: (r: string) => void }) {
  const d = useDados();
  const ultima = gmn.historico(perfil.id).find(ehOficial);
  if (!ultima) return <div className="p-6 text-[13px] text-muted">Faça a análise completa na tela da ficha primeiro.</div>;
  const c = coletaDe(ultima);
  const itens = avaliarCompleta(c);
  const nota = ultima.nota;
  const inter = interpretacao(nota);
  const av = relatorioAvaliacoes(c);
  const me = relatorioMetricas(c);
  const po = relatorioPostagens(c);
  const mi = relatorioMidia(c);
  const cont = { fraco: itens.filter((i) => faixaItem(i.pct) === "fraco").length, razoavel: itens.filter((i) => faixaItem(i.pct) === "razoavel").length, bom: itens.filter((i) => faixaItem(i.pct) === "bom").length };
  const cliente = perfil.cliente_id ? d.cliente(perfil.cliente_id)?.nome : null;

  function imprimir() {
    const t = document.title;
    document.title = `Relatório Google - ${c.ficha.nome} - ${dataBR(hoje())}`;
    document.body.classList.add("imprimindo-diario");
    const fim = () => { document.body.classList.remove("imprimindo-diario"); document.title = t; };
    window.addEventListener("afterprint", fim, { once: true });
    window.print();
    setTimeout(fim, 1500);
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div className="nao-imprimir flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => ir(`gmn-perfil-${perfil.id}`)} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><ArrowLeft size={14} /> Voltar para a ficha</button>
        <button onClick={imprimir} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg"><Printer size={14} /> Baixar PDF</button>
      </div>

      <div id="diario-impressao" className="flex flex-col gap-4">
        <header className="rounded-2xl border border-line bg-surface p-6">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Relatório do Perfil da Empresa no Google · Vertente Digital</div>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight">{c.ficha.nome}</h1>
          <div className="text-[13px] text-muted">{[cliente, c.ficha.categoria, c.local.cidade].filter(Boolean).join(" · ")} · gerado em {dataBR(ultima.criado_em ?? ultima.data)}</div>
        </header>

        <Sec titulo="Análise de saúde" sub="Um check-up do perfil no Google: cada item mostra o que já está bom e o que precisa melhorar.">
          <div className="grid items-center gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
            <div className="flex flex-col items-center"><Velocimetro nota={nota} /><b className="num -mt-1 text-[34px]">{nota}</b></div>
            <div className="flex flex-col gap-2 text-[13.5px]">
              <div className="flex gap-2">{(["fraco", "razoavel", "bom"] as const).map((k) => <span key={k} className="rounded-full px-3 py-1 text-[12.5px] font-semibold text-white" style={{ background: COR_FAIXA[k] }}>{cont[k]} {NOME_FAIXA[k]}</span>)}</div>
              <p>{inter.texto}</p>
              <ul className="list-disc pl-5 text-muted">{inter.passos.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {itens.map((i) => {
              const f = faixaItem(i.pct);
              return (
                <div key={i.id} className="flex gap-2.5 rounded-xl border border-line p-3 text-[12.5px] [break-inside:avoid]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: COR_FAIXA[f] }}>{f === "bom" ? "✓" : f === "razoavel" ? "!" : "×"}</span>
                  <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><b>{i.nome}</b><b className="num" style={{ color: COR_FAIXA[f] }}>{i.pct}</b></div><p className="text-muted">{i.texto}</p></div>
                </div>
              );
            })}
          </div>
        </Sec>

        <Sec titulo="Avaliações" sub="Como os clientes percebem o negócio.">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Num v={n(av.media, 1)} r="Média de estrelas" />
            <Num v={n(av.total)} r="Total de avaliações" />
            <Num v={`${n(av.isr, 1)}%`} r="ISR (índice de reputação)" d="(positivas − negativas) ÷ total" />
            <Num v={pct(av.taxa_resposta, 0)} r="Taxa de resposta" />
            <Num v={pct(av.com_comentario, 0)} r="Com comentário" />
            <Num v={`${av.positivas} / ${av.neutras} / ${av.negativas}`} r="Positivas / neutras / negativas" />
            <Num v={`${av.media_palavras} palavras`} r="Tamanho médio dos comentários" d={`${av.media_caracteres} caracteres`} />
            <Num v={av.tempo_resposta_dias === null ? "—" : `${n(av.tempo_resposta_dias, 1)} dias`} r="Tempo típico de resposta" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><div className="mb-1 text-[12.5px] font-semibold">Distribuição e respostas por nota</div>
              <table className="w-full text-[12.5px]"><tbody>{av.distribuicao.map((x) => <tr key={x.nota} className="border-b border-line last:border-0"><td className="py-1">{"★".repeat(x.nota)}</td><td className="num text-right">{x.qtd}</td><td className="num text-right text-muted">{x.qtd ? pct(x.respondidas / x.qtd, 0) : "—"} respondidas</td></tr>)}</tbody></table>
            </div>
            <div><div className="mb-1 text-[12.5px] font-semibold">Avaliações por dia da semana</div><Barras itens={av.por_semana.map((x) => ({ rotulo: x.dia, valor: x.qtd }))} cor="#f5b400" /></div>
          </div>
          {av.por_mes.length > 1 && <div><div className="mb-1 text-[12.5px] font-semibold">Avaliações por mês</div><Barras itens={av.por_mes.map((x) => ({ rotulo: nomeMes(x.mes), valor: x.qtd }))} cor="#f5b400" /></div>}
        </Sec>

        <Sec titulo="Métricas" sub={`Dados do Google de ${dataBR(me.inicio)} a ${dataBR(me.fim)} (${me.dias} dias).`}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Num v={n(me.visualizacoes)} r="Visualizações" d={`${n(me.busca)} na Busca · ${n(me.mapa)} no Maps`} />
            <Num v={n(me.acoes)} r="Interações" />
            <Num v={pct(me.interesse)} r="Taxa de interesse" d="interações ÷ visualizações" />
            <Num v={`${me.engajamento}`} r="Pontuação de engajamento" d={me.engajamento >= 70 ? "Excelente" : me.engajamento >= 40 ? "Bom" : "Baixo"} />
            <Num v={pct(me.mobile)} r="Acesso pelo celular" />
            <Num v={pct(me.desktop)} r="Acesso pelo computador" />
            <Num v={me.dia_mais_ativo} r="Dia mais ativo" />
            <Num v={me.acoes_lista[0]?.nome ?? "—"} r="Ação mais popular" d={me.acoes_lista[0] ? `${n(me.acoes_lista[0].valor)} interações` : ""} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><div className="mb-1 text-[12.5px] font-semibold">Plataforma e dispositivo</div>
              {[["Busca · celular", me.plataforma.busca_mobile, "#1aa361"], ["Busca · computador", me.plataforma.busca_desktop, "#2747d6"], ["Maps · celular", me.plataforma.mapa_mobile, "#f2b705"], ["Maps · computador", me.plataforma.mapa_desktop, "#e04b3c"]].map(([r, v, cor]) => (
                <div key={r as string} className="mb-1.5 text-[12.5px]"><div className="flex justify-between"><span>{r}</span><span className="num">{n(v as number)} ({pct((v as number) / Math.max(1, me.visualizacoes), 0)})</span></div><div className="h-2 rounded-full bg-raised"><div className="h-full rounded-full" style={{ width: `${((v as number) / Math.max(1, me.visualizacoes)) * 100}%`, background: cor as string }} /></div></div>
              ))}
            </div>
            <div><div className="mb-1 text-[12.5px] font-semibold">Visualizações por dia da semana</div><Barras itens={me.semana_vis.map((x) => ({ rotulo: x.dia, valor: x.valor }))} /></div>
          </div>
          <div><div className="mb-1 text-[12.5px] font-semibold">Funil de interesse</div>
            <p className="text-[13px]">De cada 100 visualizações, {n(me.interesse * 100, 1)} viram uma ação (ligação, rota, site ou conversa). {pct(Math.max(0, 1 - me.interesse), 0)} só olharam.</p>
          </div>
        </Sec>

        <Sec titulo="Engajamento" sub="Ligações, rotas, cliques no site e conversas vindos da ficha.">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Num v={n(me.rotas)} r="Rotas solicitadas" d={`média ${n(me.stats.rotas.media, 1)}/mês · máx ${me.stats.rotas.max} · mín ${me.stats.rotas.min}`} />
            <Num v={n(me.ligacoes)} r="Ligações" d={`média ${n(me.stats.lig.media, 1)}/mês · máx ${me.stats.lig.max} · mín ${me.stats.lig.min}`} />
            <Num v={n(me.site)} r="Cliques no site" d={`média ${n(me.stats.site.media, 1)}/mês · máx ${me.stats.site.max} · mín ${me.stats.site.min}`} />
            <Num v={n(me.conversas)} r="Conversas" d={`média ${n(me.stats.conv.media, 1)}/mês`} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead><tr className="border-b border-line text-muted"><th className="py-1 text-left font-medium">Mês</th><th className="text-right font-medium">Visualizações</th><th className="text-right font-medium">Interações</th><th className="text-right font-medium">Rotas</th><th className="text-right font-medium">Ligações</th><th className="text-right font-medium">Site</th><th className="text-right font-medium">Interesse</th></tr></thead>
              <tbody>
                {me.meses.slice(-12).map((m, i, arr) => {
                  const ant = arr[i - 1];
                  const delta = ant ? m.acoes - ant.acoes : null;
                  return (
                    <tr key={m.mes} className="border-b border-line last:border-0">
                      <td className="py-1">{nomeMes(m.mes)}</td>
                      <td className="num text-right">{n(m.vis)}</td>
                      <td className="num text-right">{n(m.acoes)} {delta !== null && <span className={delta >= 0 ? "text-ok" : "text-bad"}>({delta >= 0 ? "+" : ""}{delta})</span>}</td>
                      <td className="num text-right">{n(m.rotas)}</td><td className="num text-right">{n(m.lig)}</td><td className="num text-right">{n(m.site)}</td>
                      <td className="num text-right">{m.vis ? pct(m.acoes / m.vis, 0) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Sec>

        <Sec titulo="Postagens" sub="Postar com frequência mostra ao Google que o negócio está ativo.">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Num v={n(po.total)} r="Total de posts" d={po.frequencia} />
            <Num v={dataBR(po.ultima)} r="Última postagem" />
            <Num v={po.intervalo_medio === null ? "—" : `${po.intervalo_medio} dias`} r="Intervalo médio" />
            <Num v={`${po.caracteres}`} r="Caracteres (média)" />
            <Num v={pct(po.com_midia, 0)} r="Posts com foto/vídeo" />
            <Num v={pct(po.com_cta, 0)} r="Posts com botão (CTA)" />
            <Num v={`${po.ult_30} / ${po.ult_90}`} r="Últimos 30 / 90 dias" />
            <Num v={`${po.ult_180} / ${po.ult_365}`} r="Últimos 6 / 12 meses" />
          </div>
          {po.por_mes.length > 0 && <div><div className="mb-1 text-[12.5px] font-semibold">Posts por mês</div><Barras itens={po.por_mes.map((x) => ({ rotulo: nomeMes(x.mes), valor: x.qtd }))} /></div>}
          {po.maiores_pausas.length > 0 && <div className="text-[12.5px]"><div className="font-semibold">Maiores períodos sem postar</div>{po.maiores_pausas.map((g) => <div key={g.de} className="text-muted">{dataBR(g.de)} a {dataBR(g.ate)} · {g.dias} dias</div>)}</div>}
          {po.lista.length > 0 && (
            <div className="flex flex-col gap-2">{po.lista.slice(0, 4).map((p) => (
              <div key={p.data} className="rounded-xl border border-line p-3 text-[12.5px] [break-inside:avoid]"><div className="mb-1 flex gap-2 text-muted"><b className="text-fg">{dataBR(p.data)}</b>{p.midia > 0 && <span>· com mídia</span>}{p.cta && <span>· com botão</span>}</div><p className="line-clamp-4 whitespace-pre-wrap">{p.texto}</p></div>
            ))}</div>
          )}
        </Sec>

        <Sec titulo="Mídia" sub="Fotos e vídeos da empresa e dos clientes.">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Num v={n(mi.total)} r="Total de mídias" />
            <Num v={`${mi.dono_fotos} / ${mi.dono_videos}`} r="Do proprietário (fotos / vídeos)" />
            <Num v={`${mi.clientes_fotos} / ${mi.clientes_videos}`} r="De clientes (fotos / vídeos)" />
            <Num v={`${mi.qualidade.alta} · ${mi.qualidade.media} · ${mi.qualidade.baixa}`} r="Qualidade: alta · média · baixa" d="alta ≥1080p · baixa <720p" />
          </div>
          {mi.recentes.length > 0 && (
            <div className="grid grid-cols-4 gap-2 md:grid-cols-8">{mi.recentes.map((m) => (
              <div key={`${m.data}${m.url}`} className="flex flex-col gap-0.5 text-[10.5px] text-muted">{m.url && <img src={m.url} alt="" className="aspect-square w-full rounded-lg object-cover" />}<span>{dataBR(m.data)}</span><span>{m.largura ? `${m.largura}x${m.altura}` : ""}</span></div>
            ))}</div>
          )}
        </Sec>
      </div>
    </div>
  );
}
