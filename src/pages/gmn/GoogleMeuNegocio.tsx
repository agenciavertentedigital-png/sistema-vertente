import { useMemo, useState } from "react";
import { ArrowLeft, Grid3x3, MapPin, Plus, Printer, Search, Sparkles, Star, Trash2 } from "lucide-react";
import { useDados } from "../../lib/dados";
import { chamarFuncao, useTabela } from "../../lib/tabela";
import { hoje } from "../../lib/tipos";
import { supabase } from "../../lib/supabase";
import {
  CRITERIOS,
  NIVEIS,
  calcularNota,
  faixa,
  sugerirPeloGoogle,
  sugerirCompleto,
  diasDesde,
  type AvaliacaoDfs,
  type DadosCompletos,
  type InfoDfs,
  type PostagemDfs,
  type AnaliseGmn,
  type CriterioAvaliado,
  type DadosGoogle,
  type Nivel,
  type PerfilGmn,
  type PerfilGoogle,
} from "../../lib/gmn";
import { demoAnalises, demoPerfis } from "../../data/modulosDemo";
import { Botao, Entrada, Painel, Rotulo, Selecao, Vazio, campo } from "../../components/ui";
import { Abas, Anel, Cabecalho, Kpi, Selo } from "../../components/visual";

const CAMPOS_PERFIL = "id, cliente_id, nome, place_id, endereco, cidade, categoria, url_maps, palavras, ativo";
const CAMPOS_ANALISE = "id, perfil_id, data, nota, criterios, dados, origem, observacoes, criado_em";

export function useGmn() {
  const perfis = useTabela<PerfilGmn>("gmn_perfis", CAMPOS_PERFIL, demoPerfis, { ordem: { coluna: "nome" } });
  const analises = useTabela<AnaliseGmn>("gmn_analises", CAMPOS_ANALISE, demoAnalises, { ordem: { coluna: "data", asc: false } });
  const ultima = useMemo(() => {
    const m = new Map<string, AnaliseGmn[]>();
    for (const a of [...analises.linhas].sort((x, y) => y.data.localeCompare(x.data) || (y.criado_em ?? "").localeCompare(x.criado_em ?? ""))) {
      const l = m.get(a.perfil_id) ?? [];
      l.push(a);
      m.set(a.perfil_id, l);
    }
    return m;
  }, [analises.linhas]);
  return { perfis, analises, historico: (id: string) => ultima.get(id) ?? [] };
}

type Aba = "gmn" | "gmn-prospeccao";

export function GoogleMeuNegocio({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const gmn = useGmn();
  const [novo, setNovo] = useState(false);
  if (rota.startsWith("gmn-perfil-")) return <TelaPerfil key={rota} id={rota.slice(11)} gmn={gmn} ir={ir} />;
  const aba: Aba = rota === "gmn-prospeccao" ? "gmn-prospeccao" : "gmn";
  const lista = gmn.perfis.linhas.filter((p) => p.ativo && (aba === "gmn" ? p.cliente_id : !p.cliente_id));

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <Cabecalho
        icone={MapPin}
        rotulo="Fase 3 · Operacional"
        titulo="Google Meu Negócio"
        descricao="GBP Check da Vertente: nota de saúde de cada perfil, plano de ação, histórico mensal e grade de ranking no Maps."
        acoes={<Botao variante="primario" onClick={() => setNovo(true)}><Plus size={15} /> Novo perfil</Botao>}
      />
      <Abas<Aba>
        abas={[
          { id: "gmn", nome: "Perfis dos clientes", contador: gmn.perfis.linhas.filter((p) => p.cliente_id).length },
          { id: "gmn-prospeccao", nome: "Prospecção", contador: gmn.perfis.linhas.filter((p) => !p.cliente_id).length },
        ]}
        ativa={aba}
        mudar={ir}
      />
      {gmn.perfis.erro && <Vazio>{gmn.perfis.erro}</Vazio>}
      {aba === "gmn" && <Resumo perfis={lista} gmn={gmn} />}
      {gmn.perfis.carregando ? (
        <Vazio>Carregando…</Vazio>
      ) : lista.length === 0 ? (
        <Vazio>
          {aba === "gmn" ? "Nenhum perfil cadastrado. Clique em Novo perfil e ligue ao cliente." : "Cadastre aqui o perfil de uma empresa que você quer prospectar e gere a análise para a reunião."}
        </Vazio>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista
            .map((p) => ({ p, h: gmn.historico(p.id) }))
            .sort((a, b) => (a.h[0]?.nota ?? -1) - (b.h[0]?.nota ?? -1))
            .map(({ p, h }) => (
              <CartaoPerfil key={p.id} perfil={p} historico={h} abrir={() => ir(`gmn-perfil-${p.id}`)} />
            ))}
        </div>
      )}
      <NovoPerfil aberto={novo} fechar={() => setNovo(false)} gmn={gmn} prospeccao={aba === "gmn-prospeccao"} abrir={(id) => ir(`gmn-perfil-${id}`)} />
    </div>
  );
}

function Resumo({ perfis, gmn }: { perfis: PerfilGmn[]; gmn: ReturnType<typeof useGmn> }) {
  const notas = perfis.map((p) => gmn.historico(p.id)[0]?.nota).filter((n): n is number => n !== undefined);
  const media = notas.length ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length) : null;
  const mes = hoje().slice(0, 7);
  const semAnalise = perfis.filter((p) => !gmn.historico(p.id).some((a) => a.data.startsWith(mes))).length;
  const caiu = perfis.filter((p) => {
    const [a, b] = gmn.historico(p.id);
    return a && b && a.nota < b.nota;
  }).length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div className="col-span-2 flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 lg:col-span-1" style={{ boxShadow: "var(--sombra)" }}>
        <Anel nota={media} tamanho={62} />
        <div>
          <div className="text-[12px] text-muted">Nota média</div>
          <div className="text-[14px] font-semibold" style={{ color: faixa(media).cor }}>{faixa(media).nome}</div>
        </div>
      </div>
      <Kpi rotulo="Perfis bons" valor={notas.filter((n) => n >= 75).length} tom="ok" detalhe="nota 75 ou mais" />
      <Kpi rotulo="Precisam de atenção" valor={notas.filter((n) => n < 75).length} tom={notas.some((n) => n < 50) ? "bad" : "warn"} detalhe="nota abaixo de 75" />
      <Kpi rotulo="Caíram na última análise" valor={caiu} tom={caiu ? "bad" : "neutro"} />
      <Kpi rotulo="Sem análise neste mês" valor={semAnalise} tom={semAnalise ? "warn" : "ok"} detalhe="rotina mensal" />
    </div>
  );
}

function Sparkline({ valores, largura = 96, altura = 30 }: { valores: number[]; largura?: number; altura?: number }) {
  if (valores.length < 2) return null;
  const xs = valores.map((_, i) => (i / (valores.length - 1)) * largura);
  const ys = valores.map((v) => altura - 3 - (v / 100) * (altura - 6));
  const d = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return (
    <svg width={largura} height={altura} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} fill="var(--accent)" />
    </svg>
  );
}

function CartaoPerfil({ perfil, historico, abrir }: { perfil: PerfilGmn; historico: AnaliseGmn[]; abrir: () => void }) {
  const d = useDados();
  const a = historico[0];
  const anterior = historico[1];
  const delta = a && anterior ? a.nota - anterior.nota : null;
  const fracos = a ? CRITERIOS.filter((c) => (a.criterios.find((x) => x.id === c.id)?.nivel ?? 0) === 0).sort((x, y) => y.peso - x.peso).slice(0, 3) : [];
  return (
    <button onClick={abrir} className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent" style={{ boxShadow: "var(--sombra)" }}>
      <div className="flex items-start gap-3">
        <Anel nota={a?.nota ?? null} tamanho={58} espessura={6} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{perfil.nome}</div>
          <div className="truncate text-[12px] text-muted">
            {[perfil.cliente_id ? d.cliente(perfil.cliente_id)?.nome : "Prospecção", perfil.categoria, perfil.cidade].filter(Boolean).join(" · ")}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Selo cor={faixa(a?.nota ?? null).cor}>{faixa(a?.nota ?? null).nome}</Selo>
            {delta !== null && delta !== 0 && <Selo cor={delta > 0 ? "var(--ok)" : "var(--bad)"}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta)} pts</Selo>}
          </div>
        </div>
        <Sparkline valores={[...historico].reverse().slice(-6).map((x) => x.nota)} />
      </div>
      {a?.dados?.avaliacoes != null && (
        <div className="flex gap-4 text-[12px] text-muted">
          <span className="flex items-center gap-1"><Star size={12} className="text-warn" fill="currentColor" /> <b className="num text-fg">{Number(a.dados.nota_media ?? 0).toFixed(1).replace(".", ",")}</b></span>
          <span><b className="num text-fg">{a.dados.avaliacoes}</b> avaliações</span>
          <span>análise de {a.data.slice(8, 10)}/{a.data.slice(5, 7)}</span>
        </div>
      )}
      {fracos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
          <span className="text-[11.5px] text-muted">Prioridades:</span>
          {fracos.map((c) => (
            <span key={c.id} className="rounded-md bg-bad-soft px-1.5 py-0.5 text-[11px] text-bad">{c.nome}</span>
          ))}
        </div>
      )}
      {!a && <div className="text-[12.5px] text-muted">Ainda sem análise. Abra para gerar a primeira.</div>}
    </button>
  );
}

// ------------------------------------------------------------------
// Novo perfil (com busca no Google)
// ------------------------------------------------------------------
function NovoPerfil({ aberto, fechar, gmn, prospeccao, abrir }: { aberto: boolean; fechar: () => void; gmn: ReturnType<typeof useGmn>; prospeccao: boolean; abrir: (id: string) => void }) {
  const d = useDados();
  const [f, setF] = useState({ cliente_id: "", nome: "", cidade: "", categoria: "", palavras: "", place_id: "", endereco: "", url_maps: "" });
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<PerfilGoogle[]>([]);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function buscar() {
    setMsg("Buscando no Google…");
    try {
      const r = await chamarFuncao<{ resultados: PerfilGoogle[] }>("gbp-check", { acao: "buscar", texto: busca });
      setResultados(r.resultados);
      setMsg(r.resultados.length ? "" : "Nada encontrado. Tente com o nome + cidade.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function salvar() {
    if (!f.nome.trim()) return;
    setSalvando(true);
    try {
      const id = await gmn.perfis.salvar(null, {
        cliente_id: prospeccao ? null : f.cliente_id || null,
        nome: f.nome.trim(),
        cidade: f.cidade || null,
        categoria: f.categoria || null,
        palavras: f.palavras.split(",").map((p) => p.trim()).filter(Boolean),
        place_id: f.place_id || null,
        endereco: f.endereco || null,
        url_maps: f.url_maps || null,
        ativo: true,
      });
      fechar();
      abrir(id);
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Painel aberto={aberto} fechar={fechar} titulo={prospeccao ? "Perfil para prospecção" : "Novo perfil de cliente"}>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="text-[13px] font-medium">Buscar no Google</div>
          <p className="mt-0.5 text-[12px] text-muted">Preenche os dados e liga o perfil para ler nota, avaliações e fazer a grade de ranking.</p>
          <div className="mt-2 flex gap-2">
            <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: Clínica Nobre Fio Ipatinga" onKeyDown={(e) => e.key === "Enter" && buscar()} />
            <Botao onClick={buscar} disabled={!busca.trim()}><Search size={14} /> Buscar</Botao>
          </div>
          {msg && <p className="mt-2 text-[12px] text-muted">{msg}</p>}
          {resultados.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => {
                      setF({ ...f, nome: r.displayName?.text ?? f.nome, endereco: r.formattedAddress ?? "", categoria: r.primaryTypeDisplayName?.text ?? f.categoria, place_id: r.id, cidade: (r.formattedAddress ?? "").split(",").slice(-3, -2)[0]?.split("-")[0]?.trim() ?? f.cidade });
                      setResultados([]);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-[12.5px] hover:border-accent ${f.place_id === r.id ? "border-accent" : "border-line"}`}
                  >
                    <div className="font-medium">{r.displayName?.text}</div>
                    <div className="text-muted">{r.formattedAddress}</div>
                    {r.rating && <div className="text-muted">★ {r.rating} · {r.userRatingCount} avaliações</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {f.place_id && <p className="mt-2 text-[12px] text-ok">Perfil do Google ligado.</p>}
        </div>
        {!prospeccao && (
          <Rotulo texto="Cliente">
            <Selecao value={f.cliente_id} onChange={(e) => setF({ ...f, cliente_id: e.target.value, nome: f.nome || d.cliente(e.target.value)?.nome || "" })}>
              <option value="">Escolha…</option>
              {d.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Selecao>
          </Rotulo>
        )}
        <Rotulo texto="Nome no Google"><Entrada value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Rotulo>
        <div className="grid grid-cols-2 gap-3">
          <Rotulo texto="Categoria"><Entrada value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} /></Rotulo>
          <Rotulo texto="Cidade"><Entrada value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></Rotulo>
        </div>
        <Rotulo texto="Palavras de busca (separadas por vírgula)"><Entrada value={f.palavras} onChange={(e) => setF({ ...f, palavras: e.target.value })} placeholder="transplante capilar, clínica capilar" /></Rotulo>
        <Rotulo texto="Link do perfil no Maps (opcional)"><Entrada value={f.url_maps} onChange={(e) => setF({ ...f, url_maps: e.target.value })} /></Rotulo>
        <Botao variante="primario" onClick={salvar} disabled={salvando || !f.nome.trim() || (!prospeccao && !f.cliente_id)}>Salvar e abrir</Botao>
      </div>
    </Painel>
  );
}

// ------------------------------------------------------------------
// Tela do perfil
// ------------------------------------------------------------------
function TelaPerfil({ id, gmn, ir }: { id: string; gmn: ReturnType<typeof useGmn>; ir: (r: string) => void }) {
  const d = useDados();
  const perfil = gmn.perfis.linhas.find((p) => p.id === id);
  const historico = gmn.historico(id);
  const [editor, setEditor] = useState<AnaliseGmn | "nova" | null>(null);
  const [ocultarRecomendacoes, setOcultar] = useState(false);
  if (gmn.perfis.carregando) return <Vazio>Carregando…</Vazio>;
  if (!perfil) return <Vazio>Perfil não encontrado.</Vazio>;
  const a = historico[0];
  const niveis = new Map((a?.criterios ?? []).map((c) => [c.id, c]));
  const plano = CRITERIOS.filter((c) => (niveis.get(c.id)?.nivel ?? 0) < 2).sort((x, y) => (niveis.get(x.id)?.nivel ?? 0) - (niveis.get(y.id)?.nivel ?? 0) || y.peso - x.peso);
  const grupos = [...new Set(CRITERIOS.map((c) => c.grupo))];

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <button onClick={() => ir(perfil.cliente_id ? "gmn" : "gmn-prospeccao")} className="flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-fg">
          <ArrowLeft size={14} /> Google Meu Negócio
        </button>
        <div className="flex flex-wrap gap-2">
          {!perfil.cliente_id && (
            <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
              <input type="checkbox" checked={ocultarRecomendacoes} onChange={(e) => setOcultar(e.target.checked)} /> Ocultar recomendações (reunião)
            </label>
          )}
          <Botao onClick={() => window.print()} disabled={!a}><Printer size={14} /> Relatório em PDF</Botao>
          <Botao variante="primario" onClick={() => setEditor("nova")}><Sparkles size={14} /> Nova análise</Botao>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl p-6 text-white" style={{ background: "linear-gradient(135deg,#1d34a0 0%,#0b1450 60%,#060b2c 100%)" }}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="rounded-full bg-white/95 p-1.5 text-fg" style={{ color: "#0e1533" }}>
            <Anel nota={a?.nota ?? null} tamanho={112} espessura={10} rotulo="de 100" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">GBP Check · Vertente</div>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight">{perfil.nome}</h1>
            <div className="mt-1 text-[13px] text-white/70">
              {[perfil.cliente_id ? d.cliente(perfil.cliente_id)?.nome : "Prospecção", perfil.categoria, perfil.cidade].filter(Boolean).join(" · ")}
            </div>
            {a && (
              <div className="mt-3 flex flex-wrap gap-5 text-[13px]">
                <Info rotulo="Situação" valor={faixa(a.nota).nome} />
                {a.dados?.nota_media != null && <Info rotulo="Nota no Google" valor={`★ ${Number(a.dados.nota_media).toFixed(1).replace(".", ",")}`} />}
                {a.dados?.avaliacoes != null && <Info rotulo="Avaliações" valor={String(a.dados.avaliacoes)} />}
                <Info rotulo="Última análise" valor={`${a.data.slice(8, 10)}/${a.data.slice(5, 7)}/${a.data.slice(0, 4)}`} />
                {historico[1] && <Info rotulo="Mês anterior" valor={`${historico[1].nota} pts`} />}
              </div>
            )}
          </div>
        </div>
      </section>

      {a?.dados?.completo && <RaioX c={a.dados.completo} esconderCusto={ocultarRecomendacoes} />}

      {!a ? (
        <Vazio>Este perfil ainda não tem análise. Clique em Nova análise{perfil.place_id ? " e use os dados do Google para começar" : ""}.</Vazio>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-w-0 flex-col gap-4">
            {grupos.map((g) => {
              const cs = CRITERIOS.filter((c) => c.grupo === g);
              const pts = cs.reduce((s, c) => s + (c.peso * (niveis.get(c.id)?.nivel ?? 0)) / 2, 0);
              const tot = cs.reduce((s, c) => s + c.peso, 0);
              return (
                <div key={g} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-semibold">{g}</h2>
                    <span className="num text-[13px] font-semibold" style={{ color: faixa((pts / tot) * 100).cor }}>{Math.round((pts / tot) * 100)}%</span>
                  </div>
                  <ul className="mt-3 flex flex-col divide-y divide-line">
                    {cs.map((c) => {
                      const n = niveis.get(c.id)?.nivel ?? 0;
                      return (
                        <li key={c.id} className="flex items-center gap-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-medium">{c.nome}</div>
                            <div className="text-[12px] text-muted">{niveis.get(c.id)?.obs || c.como}</div>
                          </div>
                          <div className="flex gap-1">
                            {NIVEIS.map((x) => (
                              <span key={x.nivel} className="h-2 w-6 rounded-full" style={{ background: x.nivel <= n ? NIVEIS[n].cor : "var(--raised)" }} />
                            ))}
                          </div>
                          <span className="w-[64px] text-right text-[12px] font-medium" style={{ color: NIVEIS[n].cor }}>{NIVEIS[n].nome}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
          <aside className="flex min-w-0 flex-col gap-4">
            <Historico historico={historico} editar={(x) => setEditor(x)} />
            {!ocultarRecomendacoes && (
              <div className="rounded-2xl border border-line bg-surface p-4">
                <h2 className="text-[15px] font-semibold">Plano de ação</h2>
                <p className="text-[12px] text-muted">Do que mais pesa na nota para o que menos pesa.</p>
                {plano.length === 0 ? (
                  <p className="mt-3 text-[13px] text-ok">Tudo em nível Bom. Manter a rotina mensal.</p>
                ) : (
                  <ol className="mt-3 flex flex-col gap-2.5">
                    {plano.slice(0, 8).map((c, i) => (
                      <li key={c.id} className="flex gap-2.5 text-[12.5px] leading-snug">
                        <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[10.5px] font-semibold text-accent">{i + 1}</span>
                        <div>
                          <div className="font-medium">{c.nome} <span className="font-normal text-muted">· +{Math.round((c.peso * (2 - (niveis.get(c.id)?.nivel ?? 0))) / 2 / CRITERIOS.reduce((s, x) => s + x.peso, 0) * 100)} pts</span></div>
                          <div className="text-muted">{c.recomendacao}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      <GradeRanking perfil={perfil} />

      <div className="flex justify-end print:hidden">
        <Botao
          variante="fantasma"
          onClick={async () => {
            if (!confirm(`Apagar o perfil ${perfil.nome} e todas as análises?`)) return;
            await gmn.perfis.excluir(perfil.id);
            ir(perfil.cliente_id ? "gmn" : "gmn-prospeccao");
          }}
        >
          <Trash2 size={14} /> Apagar perfil
        </Botao>
      </div>

      {editor && <EditorAnalise perfil={perfil} base={editor === "nova" ? a ?? null : editor} editando={editor !== "nova"} gmn={gmn} fechar={() => setEditor(null)} />}
    </div>
  );
}

const dataBR = (iso: string | null) => (iso ? new Date(iso.replace(" +00:00", "Z").replace(" ", "T")).toLocaleDateString("pt-BR") : "—");
const haDias = (iso: string | null) => {
  const d = diasDesde(iso);
  return d === null ? "nunca" : d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
};

/** Raio-X da análise completa (DataForSEO): reputação, atividade e o que os clientes comentam. */
function RaioX({ c, esconderCusto }: { c: DadosCompletos; esconderCusto: boolean }) {
  const dist = c.distribuicao ?? {};
  const totalDist = Object.values(dist).reduce((s, v) => s + Number(v || 0), 0);
  const dPost = diasDesde(c.ultima_postagem);
  const cards = [
    { rotulo: "Avaliações respondidas", valor: c.respostas_pct === null ? "—" : `${c.respostas_pct}%`, detalhe: `das últimas ${c.avaliacoes_lidas}`, tom: c.respostas_pct === null ? "" : c.respostas_pct >= 90 ? "text-ok" : c.respostas_pct >= 50 ? "text-warn" : "text-bad" },
    { rotulo: "Avaliações em 30 dias", valor: String(c.avaliacoes_30d), detalhe: `última ${haDias(c.ultima_avaliacao)}`, tom: c.avaliacoes_30d >= 8 ? "text-ok" : c.avaliacoes_30d >= 3 ? "text-warn" : "text-bad" },
    { rotulo: "Postagens em 90 dias", valor: String(c.postagens_90d), detalhe: `última ${haDias(c.ultima_postagem)}`, tom: dPost !== null && dPost <= 7 ? "text-ok" : dPost !== null && dPost <= 30 ? "text-warn" : "text-bad" },
    { rotulo: "Fotos no perfil", valor: String(c.fotos ?? "—"), detalhe: c.fotos && c.fotos >= 30 ? "boa quantidade" : "abaixo de 30", tom: (c.fotos ?? 0) >= 30 ? "text-ok" : (c.fotos ?? 0) >= 10 ? "text-warn" : "text-bad" },
  ];
  return (
    <section className="flex flex-col gap-4 print:break-inside-avoid">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[17px] font-semibold">Raio-X do perfil</h2>
          <p className="text-[12px] text-muted">Dados completos lidos do Google: reputação, atividade e o que os clientes comentam.</p>
        </div>
        {!esconderCusto && <span className="text-[11.5px] text-muted print:hidden">custo da análise: US$ {c.custo.toFixed(3)}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((k) => (
          <div key={k.rotulo} className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-[12px] text-muted">{k.rotulo}</div>
            <div className={`num mt-1 text-[26px] font-semibold ${k.tom}`}>{k.valor}</div>
            <div className="text-[11.5px] text-muted">{k.detalhe}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="text-[14px] font-semibold">Distribuição das notas</h3>
          <div className="mt-3 flex flex-col gap-1.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const v = Number(dist[String(n)] ?? 0);
              return (
                <div key={n} className="flex items-center gap-2 text-[12px]">
                  <span className="w-6 text-muted">{n}★</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised">
                    <div className="h-full rounded-full" style={{ width: `${totalDist ? (v / totalDist) * 100 : 0}%`, background: n >= 4 ? "var(--ok)" : n === 3 ? "var(--warn)" : "var(--bad)" }} />
                  </div>
                  <span className="num w-9 text-right">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="text-[14px] font-semibold">O que os clientes mais citam</h3>
          {c.temas.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.temas.map(([t, v]) => (
                <span key={t} className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent">{t} <span className="num opacity-70">{v}</span></span>
              ))}
            </div>
          ) : <p className="mt-3 text-[12.5px] text-muted">O Google ainda não agrupou temas para este perfil.</p>}
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="text-[14px] font-semibold">Ficha do perfil</h3>
          <ul className="mt-2 flex flex-col gap-1 text-[12.5px]">
            <li><span className="text-muted">Reivindicado:</span> {c.reivindicado === null ? "—" : c.reivindicado ? "sim" : "não (qualquer um pode reivindicar)"}</li>
            <li><span className="text-muted">Categorias:</span> {c.categorias.join(", ") || "—"}</li>
            <li><span className="text-muted">Descrição:</span> {c.descricao_tamanho ? `${c.descricao_tamanho} de 750 caracteres` : "sem descrição"}</li>
            <li><span className="text-muted">Atributos:</span> {c.atributos || "nenhum"} · <span className="text-muted">Serviços:</span> {c.servicos || "nenhum"}</li>
            <li><span className="text-muted">Perguntas e respostas:</span> {c.perguntas ?? "—"}</li>
          </ul>
        </div>
      </div>
      {(c.avaliacoes_sem_resposta.length > 0 || c.postagens_recentes.length > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="text-[14px] font-semibold">Avaliações recentes sem resposta</h3>
            {c.avaliacoes_sem_resposta.length === 0 ? <p className="mt-2 text-[12.5px] text-ok">Todas as recentes estão respondidas.</p> : (
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {c.avaliacoes_sem_resposta.map((r, i) => (
                  <li key={i} className="py-2 text-[12.5px]">
                    <div className="flex justify-between"><b>{r.autor ?? "Cliente"} · {"★".repeat(Number(r.nota ?? 0))}</b><span className="text-muted">{dataBR(r.data)}</span></div>
                    {r.texto && <p className="line-clamp-2 text-muted">{r.texto}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="text-[14px] font-semibold">Últimas postagens</h3>
            {c.postagens_recentes.length === 0 ? <p className="mt-2 text-[12.5px] text-bad">Nenhuma postagem encontrada no perfil.</p> : (
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {c.postagens_recentes.map((p, i) => (
                  <li key={i} className="flex gap-3 py-2 text-[12.5px]">
                    {p.imagem && <img src={p.imagem} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />}
                    <div className="min-w-0"><div className="text-muted">{dataBR(p.data)}</div><p className="line-clamp-2">{p.texto ?? ""}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] text-white/55">{rotulo}</div>
      <div className="font-semibold">{valor}</div>
    </div>
  );
}

function Historico({ historico, editar }: { historico: AnaliseGmn[]; editar: (a: AnaliseGmn) => void }) {
  const serie = [...historico].reverse().slice(-8);
  const L = 300;
  const A = 90;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-[15px] font-semibold">Evolução</h2>
      {serie.length > 1 && (
        <svg viewBox={`0 0 ${L} ${A + 18}`} className="mt-2 w-full" aria-hidden>
          {[25, 50, 75].map((y) => (
            <line key={y} x1={0} x2={L} y1={A - (y / 100) * A} y2={A - (y / 100) * A} stroke="var(--line)" strokeDasharray="3 4" />
          ))}
          <path
            d={serie.map((x, i) => `${i ? "L" : "M"}${(i / (serie.length - 1)) * (L - 44) + 22},${A - (x.nota / 100) * A}`).join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.5}
          />
          {serie.map((x, i) => (
            <g key={x.id}>
              <circle cx={(i / (serie.length - 1)) * (L - 44) + 22} cy={A - (x.nota / 100) * A} r={4} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />
              <text x={(i / (serie.length - 1)) * (L - 44) + 22} y={A + 14} textAnchor="middle" fontSize={9} fill="var(--muted)">
                {x.data.slice(8, 10)}/{x.data.slice(5, 7)}
              </text>
            </g>
          ))}
        </svg>
      )}
      <ul className="mt-2 flex flex-col gap-1">
        {historico.slice(0, 6).map((x) => (
          <li key={x.id}>
            <button onClick={() => editar(x)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-raised">
              <span>{x.data.slice(8, 10)}/{x.data.slice(5, 7)}/{x.data.slice(0, 4)} {x.origem === "google" && <span className="text-muted">· com dados do Google</span>}</span>
              <span className="num font-semibold" style={{ color: faixa(x.nota).cor }}>{x.nota}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------
// Editor da análise
// ------------------------------------------------------------------
function EditorAnalise({ perfil, base, editando, gmn, fechar }: { perfil: PerfilGmn; base: AnaliseGmn | null; editando: boolean; gmn: ReturnType<typeof useGmn>; fechar: () => void }) {
  const d = useDados();
  const [criterios, setCriterios] = useState<CriterioAvaliado[]>(CRITERIOS.map((c) => base?.criterios.find((x) => x.id === c.id) ?? { id: c.id, nivel: 0 }));
  const [dados, setDados] = useState<DadosGoogle>(editando ? base?.dados ?? {} : {});
  const [origem, setOrigem] = useState<"manual" | "google">(editando ? base?.origem ?? "manual" : "manual");
  const [obs, setObs] = useState(editando ? base?.observacoes ?? "" : "");
  const [data, setData] = useState(editando ? base!.data : hoje());
  const [msg, setMsg] = useState("");
  const nota = calcularNota(criterios);

  const nivel = (id: string, n: Nivel) => setCriterios((cs) => cs.map((c) => (c.id === id ? { ...c, nivel: n } : c)));
  const obsCrit = (id: string, t: string) => setCriterios((cs) => cs.map((c) => (c.id === id ? { ...c, obs: t } : c)));

  async function lerGoogle() {
    setMsg("Lendo o perfil no Google…");
    try {
      const r = await chamarFuncao<{ perfil: PerfilGoogle }>("gbp-check", { acao: "detalhes", place_id: perfil.place_id });
      const s = sugerirPeloGoogle(r.perfil);
      setDados(s.dados);
      setOrigem("google");
      setCriterios((cs) => cs.map((c) => (s.niveis[c.id] !== undefined ? { ...c, nivel: s.niveis[c.id] } : c)));
      setMsg(`Preenchido com o Google: nota ${s.dados.nota_media ?? "—"}, ${s.dados.avaliacoes ?? 0} avaliações. Confira os outros critérios no perfil.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const [completando, setCompletando] = useState(false);
  async function analisarCompleto() {
    setCompletando(true);
    setMsg("Lendo o perfil completo no Google (DataForSEO)…");
    try {
      const r = await chamarFuncao<{ info: InfoDfs; tarefas: { avaliacoes: string; postagens: string }; custo: number }>("gbp-check", { acao: "completo", place_id: perfil.place_id });
      const aplicar = (av: AvaliacaoDfs[] | null, po: PostagemDfs[] | null, custo: number) => {
        const s = sugerirCompleto(r.info, av, po, custo);
        setDados(s.dados);
        setOrigem("google");
        setCriterios((cs) => cs.map((c) => (s.niveis[c.id] !== undefined ? { ...c, nivel: s.niveis[c.id], obs: s.obs[c.id] ?? c.obs } : c)));
      };
      aplicar(null, null, r.custo);
      setMsg("Perfil lido. Buscando avaliações e postagens (leva até 2 minutos)…");
      for (let i = 0; i < 24; i++) {
        await new Promise((ok) => setTimeout(ok, 6000));
        const t = await chamarFuncao<{ pronto: boolean; avaliacoes?: AvaliacaoDfs[]; postagens?: PostagemDfs[]; custo?: number }>("gbp-check", { acao: "completo_resultado", ...r.tarefas });
        if (t.pronto) {
          const total = r.custo + (t.custo ?? 0);
          aplicar(t.avaliacoes ?? [], t.postagens ?? [], total);
          setMsg(`Análise completa pronta · custo US$ ${total.toFixed(3)}. Confira fotos recentes e o que for manual.`);
          return;
        }
      }
      setMsg("Avaliações e postagens demoraram demais; os dados do perfil já foram preenchidos. Tente de novo em alguns minutos.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setCompletando(false);
    }
  }

  async function salvar() {
    try {
      await gmn.analises.salvar(editando ? base!.id : null, { perfil_id: perfil.id, data, nota, criterios, dados, origem, observacoes: obs || null });
      d.avisar("Análise salva");
      fechar();
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  return (
    <Painel aberto fechar={fechar} titulo={editando ? "Editar análise" : "Nova análise"} largura={620}>
      <div className="flex flex-col gap-4">
        <div className="sticky -top-4 z-10 -mx-4 -mt-4 flex items-center gap-4 border-b border-line bg-bg px-4 py-3">
          <Anel nota={nota} tamanho={56} espessura={6} />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">{perfil.nome}</div>
            <div className="text-[12px]" style={{ color: faixa(nota).cor }}>{faixa(nota).nome}</div>
          </div>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={`${campo} !w-auto`} />
        </div>
        {perfil.place_id ? (
          <div className="flex flex-wrap items-center gap-2">
            <Botao variante="primario" onClick={analisarCompleto} disabled={completando}><Sparkles size={14} /> {completando ? "Analisando…" : "Análise completa"}</Botao>
            <Botao onClick={lerGoogle} disabled={completando}>Leitura rápida (grátis)</Botao>
            {msg && <span className="text-[12px] text-muted">{msg}</span>}
          </div>
        ) : (
          <p className="text-[12px] text-muted">Ligue o perfil ao Google (Novo perfil → Buscar) para preencher nota, avaliações, horário e contato automaticamente.</p>
        )}
        {CRITERIOS.map((c) => {
          const v = criterios.find((x) => x.id === c.id)!;
          return (
            <div key={c.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">{c.nome} <span className="text-[11px] font-normal text-muted">peso {c.peso}</span></div>
                  <div className="text-[12px] text-muted">Bom = {c.como}</div>
                </div>
                <div className="flex gap-1">
                  {NIVEIS.map((x) => (
                    <button
                      key={x.nivel}
                      onClick={() => nivel(c.id, x.nivel)}
                      className="rounded-lg border px-2.5 py-1 text-[12px] font-medium"
                      style={v.nivel === x.nivel ? { background: x.cor, borderColor: x.cor, color: "#fff" } : { borderColor: "var(--line)", color: "var(--muted)" }}
                    >
                      {x.nome}
                    </button>
                  ))}
                </div>
              </div>
              <input value={v.obs ?? ""} onChange={(e) => obsCrit(c.id, e.target.value)} placeholder="Observação (opcional)" className={`${campo} mt-2`} />
            </div>
          );
        })}
        <Rotulo texto="Observações gerais">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className={campo} />
        </Rotulo>
        <div className="flex justify-between gap-2">
          {editando ? (
            <Botao variante="fantasma" onClick={async () => { await gmn.analises.excluir(base!.id); fechar(); }}><Trash2 size={14} /> Apagar</Botao>
          ) : <span />}
          <Botao variante="primario" onClick={salvar}>Salvar análise · {nota} pts</Botao>
        </div>
      </div>
    </Painel>
  );
}

// ------------------------------------------------------------------
// Grade de ranking
// ------------------------------------------------------------------
interface PontoGrade {
  linha: number;
  coluna: number;
  posicao: number | null;
  primeiro: string | null;
}

function GradeRanking({ perfil }: { perfil: PerfilGmn }) {
  const [palavra, setPalavra] = useState(perfil.palavras[0] ?? perfil.categoria ?? "");
  const [passo, setPasso] = useState(1);
  const [pontos, setPontos] = useState<PontoGrade[] | null>(null);
  const [msg, setMsg] = useState("");
  const [rodando, setRodando] = useState(false);
  const [fonte, setFonte] = useState<"maps" | "places">("maps");

  async function gerar() {
    setRodando(true);
    setMsg(fonte === "maps" ? "Buscando a palavra no Google Maps de 25 pontos… leva uns 20 segundos." : "Consultando 25 pontos no Google… leva alguns segundos.");
    try {
      const r = await chamarFuncao<{ pontos: PontoGrade[]; custo?: number }>("gbp-check", { acao: "grade", place_id: perfil.place_id, palavra, passo_km: passo, tamanho: 5, fonte });
      setPontos(r.pontos);
      setMsg(r.custo ? `Grade do Google Maps real · custo US$ ${r.custo.toFixed(3)}` : "Grade aproximada pela Places API (grátis).");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setRodando(false);
    }
  }

  const exemplo: PontoGrade[] = Array.from({ length: 25 }, (_, i) => {
    const l = Math.floor(i / 5);
    const c = i % 5;
    const dist = Math.abs(l - 2) + Math.abs(c - 2);
    return { linha: l, coluna: c, posicao: dist === 0 ? 1 : dist === 1 ? 2 + (i % 2) : dist === 2 ? 4 + (i % 4) : dist === 3 ? 9 + (i % 5) : null, primeiro: null };
  });
  const mostrar = pontos ?? exemplo;
  const top3 = mostrar.filter((p) => p.posicao && p.posicao <= 3).length;
  const media = mostrar.filter((p) => p.posicao).reduce((s, p) => s + (p.posicao ?? 0), 0) / Math.max(1, mostrar.filter((p) => p.posicao).length);
  const cor = (p: number | null) => (p === null ? "var(--raised)" : p <= 3 ? "var(--ok)" : p <= 10 ? "var(--warn)" : "var(--bad)");

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Grid3x3 size={16} /> Grade de ranking no Maps</h2>
          <p className="text-[12px] text-muted">Posição do perfil numa busca feita de 25 pontos ao redor da empresa.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <Rotulo texto="Palavra"><Entrada value={palavra} onChange={(e) => setPalavra(e.target.value)} className="!w-[200px]" /></Rotulo>
          <Rotulo texto="Distância entre pontos">
            <Selecao value={passo} onChange={(e) => setPasso(Number(e.target.value))} className="!w-auto">
              {[0.5, 1, 2, 3].map((p) => <option key={p} value={p}>{String(p).replace(".", ",")} km</option>)}
            </Selecao>
          </Rotulo>
          <Rotulo texto="Fonte">
            <Selecao value={fonte} onChange={(e) => setFonte(e.target.value as "maps" | "places")} className="!w-auto">
              <option value="maps">Google Maps real (~US$ 0,05)</option>
              <option value="places">Aproximada (grátis)</option>
            </Selecao>
          </Rotulo>
          <Botao variante="primario" onClick={gerar} disabled={rodando || !perfil.place_id || !palavra.trim()}>Gerar grade</Botao>
        </div>
      </div>
      {!perfil.place_id && <p className="mt-2 text-[12px] text-warn">Ligue este perfil ao Google para gerar a grade.</p>}
      {msg && <p className="mt-2 text-[12px] text-muted">{msg}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className={`relative grid grid-cols-5 gap-2 rounded-2xl p-4 ${pontos ? "" : "opacity-60"}`} style={{ background: "repeating-linear-gradient(45deg,var(--raised) 0 10px,transparent 10px 20px)" }}>
          {mostrar.map((p) => (
            <div
              key={`${p.linha}-${p.coluna}`}
              title={p.primeiro ? `1º lugar aqui: ${p.primeiro}` : undefined}
              className={`num grid h-11 w-11 place-items-center rounded-full text-[13px] font-semibold text-white shadow-sm ${p.linha === 2 && p.coluna === 2 ? "ring-4 ring-accent-soft" : ""}`}
              style={{ background: cor(p.posicao), color: p.posicao === null ? "var(--muted)" : "#fff" }}
            >
              {p.posicao ?? "20+"}
            </div>
          ))}
          {!pontos && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-fg px-2 py-0.5 text-[10.5px] font-semibold text-bg">exemplo</span>}
        </div>
        <div className="flex flex-col gap-3">
          <Kpi rotulo="Pontos no top 3" valor={`${top3} de 25`} tom={top3 >= 13 ? "ok" : top3 >= 6 ? "warn" : "bad"} />
          <Kpi rotulo="Posição média (onde aparece)" valor={media ? media.toFixed(1).replace(".", ",") : "—"} />
          <div className="flex gap-3 text-[11.5px] text-muted">
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-ok" /> 1–3</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-warn" /> 4–10</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-bad" /> 11–20</span>
          </div>
        </div>
      </div>
      {!supabase && <p className="mt-3 text-[11.5px] text-muted">Na prévia a grade é um exemplo. No sistema conectado ela consulta o Google de verdade.</p>}
    </section>
  );
}
