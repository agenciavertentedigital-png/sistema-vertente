import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { useDados } from "../../../lib/dados";
import { useTabela } from "../../../lib/tabela";
import { DEMO_IDS } from "../../../lib/repo";
import { AUTO, BASE, formatar, valorEtapa, variacaoRel, type ConfigFunil, type Contexto, type EtapaFunil, type Fonte } from "../../../lib/painel";
import { GraficoSeries, PainelGraficos, type DefGrafico } from "./Graficos";
import { useDiarioPlataformas } from "./config";

export interface Lancamento { id: string; cliente_id: string; inicio: string; fim: string; valores: Record<string, number>; observacao: string | null; criado_em: string }

const dataBR = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
const rotuloPeriodo = (l: Lancamento) => {
  const mesmoMes = l.inicio.slice(0, 7) === l.fim.slice(0, 7) && l.inicio.endsWith("-01");
  return mesmoMes ? new Date(`${l.inicio}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(". de ", "/").replace(" de ", "/") : `${dataBR(l.inicio)}–${dataBR(l.fim)}`;
};

export function useLancamentosFunil() {
  return useTabela<Lancamento>("funil_lancamentos", "id, cliente_id, inicio, fim, valores, observacao, criado_em", demoLancamentos, { ordem: { coluna: "inicio", asc: false }, limite: 3000 });
}

/** Prévia: meses de exemplo para cada cliente. */
function demoLancamentos(): Lancamento[] {
  const out: Lancamento[] = [];
  const h = new Date();
  for (const id of DEMO_IDS.values()) {
    for (let k = 1; k <= 8; k++) {
      const ini = new Date(h.getFullYear(), h.getMonth() - k, 1);
      const fim = new Date(h.getFullYear(), h.getMonth() - k + 1, 0);
      const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
      const q = 140 + ((k * 37) % 60);
      const ag = Math.round(q * (0.42 + ((k * 7) % 10) / 100));
      const pr = Math.round(ag * (0.68 + ((k * 3) % 10) / 100));
      const vd = Math.round(pr * (0.3 + ((k * 5) % 15) / 100));
      out.push({ id: `fl-${id}-${k}`, cliente_id: id, inicio: f(ini), fim: f(fim), valores: { qualificados: q, agendamentos: ag, comparecimentos: pr, vendas: vd, faturamento: vd * 4200, faturamento_leads: vd * 2600 }, observacao: null, criado_em: f(fim) });
    }
  }
  return out;
}

/** Soma os lançamentos que cabem inteiros no período. */
export function somarLancamentos(ls: Lancamento[], ini: string, fim: string) {
  const dentro = ls.filter((l) => l.inicio >= ini && l.fim <= fim);
  const manual: Record<string, number> = {};
  for (const l of dentro) for (const [k, v] of Object.entries(l.valores ?? {})) if (v !== null && v !== undefined && isFinite(Number(v))) manual[k] = (manual[k] ?? 0) + Number(v);
  return { manual, temManual: dentro.length > 0, n: dentro.length };
}

const CORES = ["#2747d6", "#7c3aed", "#0891b2", "#16a34a", "#f59e0b", "#db2777", "#e2701c", "#64748b"];

/** Funil de vendas completo: etapas automáticas (Meta + Google) e as lançadas, com taxas, custo por etapa e comparativo. */
export function FunilVendas({
  clienteId,
  ctx,
  cfg,
  salvarCfg,
  lanc,
  graficos,
  salvarGraficos,
  periodoTexto,
}: {
  clienteId: string;
  ctx: Contexto;
  cfg: ConfigFunil;
  salvarCfg: (c: ConfigFunil) => Promise<void>;
  lanc: ReturnType<typeof useLancamentosFunil>;
  graficos: string[];
  salvarGraficos: (ids: string[]) => Promise<void>;
  periodoTexto: string;
}) {
  const [configurando, setConfigurando] = useState(false);
  const [editando, setEditando] = useState<Partial<Lancamento> | null>(null);
  const doCliente = lanc.linhas.filter((l) => l.cliente_id === clienteId);

  const etapas = cfg.etapas.map((e) => ({ e, v: valorEtapa(e, ctx.atual), a: valorEtapa(e, ctx.anterior) }));
  const visiveis = etapas.filter((x) => x.v !== null);
  // Gargalo: o passo cuja taxa mais caiu em relação ao período anterior; sem comparação, o passo de menor taxa depois do contato
  const passos = visiveis.slice(1).map((x, i) => {
    const antes = visiveis[i];
    const tx = antes.v ? (x.v ?? 0) / antes.v : null;
    const txA = antes.a && x.a !== null ? x.a / antes.a : null;
    return { id: x.e.id, tx, txA, queda: tx !== null && txA !== null ? tx - txA : null };
  });
  const comQueda = passos.filter((p) => p.queda !== null && p.queda < -0.02).sort((a, b) => (a.queda ?? 0) - (b.queda ?? 0));
  const idxContato = visiveis.findIndex((x) => x.e.auto === "contatos" || x.e.fonte === "manual");
  const depoisContato = passos.filter((_, i) => i + 1 > idxContato && passos[i].tx !== null);
  const gargalo = comQueda[0]?.id ?? (depoisContato.length > 1 ? [...depoisContato].sort((a, b) => (a.tx ?? 1) - (b.tx ?? 1))[0].id : null);
  const investimento = BASE.investimento.v(ctx.atual);
  const maxLog = Math.log10(Math.max(10, ...visiveis.map((x) => x.v ?? 0)));

  // Evolução dos lançamentos (para os gráficos): investimento do mesmo período vem das plataformas
  const ordenados = [...doCliente].sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(-18);
  const dias = useDiarioPlataformas(clienteId, ordenados[0]?.inicio ?? "", ordenados[ordenados.length - 1]?.fim ?? "");
  const investPor = (l: Lancamento) => dias.filter((d) => d.data >= l.inicio && d.data <= l.fim).reduce((s, d) => s + d.meta.gasto + d.google.gasto, 0);
  const contatosPor = (l: Lancamento) => dias.filter((d) => d.data >= l.inicio && d.data <= l.fim).reduce((s, d) => s + d.meta.contatos + d.google.contatos, 0);
  const manuais = cfg.etapas.filter((e) => e.fonte === "manual");
  const ultima = manuais[manuais.length - 1];
  const rotulos = ordenados.map(rotuloPeriodo);

  const catalogoGraficos: DefGrafico[] = [
    {
      id: "evolucao",
      nome: "Evolução do funil",
      descricao: "Etapas lançadas em cada período",
      largo: true,
      render: () => <GraficoSeries rotulos={rotulos} tipo="linha" series={manuais.map((e, i) => ({ nome: e.nome, cor: CORES[(i + 1) % CORES.length], valores: ordenados.map((l) => l.valores?.[e.id] ?? null) }))} />,
    },
    {
      id: "taxas",
      nome: "Taxas de conversão por período",
      descricao: "Quanto de cada etapa passa para a seguinte",
      largo: true,
      render: () => (
        <GraficoSeries
          rotulos={rotulos}
          tipo="barras"
          fmt="pct"
          series={manuais.slice(1).map((e, i) => ({ nome: `${manuais[i].nome} → ${e.nome}`, cor: CORES[(i + 1) % CORES.length], valores: ordenados.map((l) => { const a = l.valores?.[manuais[i].id]; const b = l.valores?.[e.id]; return a && b !== undefined ? b / a : null; }) }))}
        />
      ),
    },
    {
      id: "receita",
      nome: "Investimento x vendas",
      descricao: "Valor vendido e investimento em anúncios por período",
      render: () => <GraficoSeries rotulos={rotulos} tipo="linha" fmt="brl" series={[...cfg.valores.map((v, i) => ({ nome: v.nome, cor: CORES[(i + 3) % CORES.length], valores: ordenados.map((l) => l.valores?.[v.id] ?? null) })), { nome: "Investimento", cor: "#64748b", valores: ordenados.map((l) => investPor(l) || null) }]} />,
    },
    {
      id: "custo_final",
      nome: ultima ? `Custo por ${ultima.nome.toLowerCase()}` : "Custo por venda",
      descricao: "Investimento ÷ última etapa, por período (menor é melhor)",
      render: () => <GraficoSeries rotulos={rotulos} tipo="linha" fmt="brl" series={[{ nome: "Custo", cor: "#c8382e", valores: ordenados.map((l) => { const v = ultima ? l.valores?.[ultima.id] : 0; const i = investPor(l); return v && i ? i / v : null; }) }]} />,
    },
    {
      id: "custo_contato",
      nome: "Custo por contato",
      descricao: "Investimento ÷ contatos das plataformas, por período",
      render: () => <GraficoSeries rotulos={rotulos} tipo="linha" fmt="brl" series={[{ nome: "Custo por contato", cor: "#2747d6", valores: ordenados.map((l) => { const c = contatosPor(l); const i = investPor(l); return c && i ? i / c : null; }) }]} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">Funil de vendas completo</h2>
            <p className="text-[12.5px] text-muted">Do anúncio visto à venda. Etapas com <span className="rounded bg-accent-soft px-1 text-accent">auto</span> vêm das plataformas; as outras são lançadas. {periodoTexto}</p>
          </div>
          <button onClick={() => setConfigurando(!configurando)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] ${configurando ? "bg-accent text-accent-fg" : "border border-line text-muted hover:text-fg"}`}><Settings2 size={14} /> Etapas</button>
          <button onClick={() => setEditando({ valores: {} })} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg"><Plus size={14} /> Lançar números</button>
        </div>

        {configurando && <ConfigEtapas cfg={cfg} salvar={salvarCfg} fechar={() => setConfigurando(false)} />}
        {editando && <FormLancamento cfg={cfg} inicial={editando} clienteId={clienteId} lanc={lanc} fechar={() => setEditando(null)} />}

        {!ctx.atual.temManual && (
          <p className="rounded-xl border border-dashed border-warn/50 bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Nenhum número lançado dentro deste período. As etapas manuais aparecem quando houver lançamento que caiba inteiro no período (ex.: o mês todo).</p>
        )}

        <ol className="flex flex-col gap-1">
          {visiveis.map((x, i) => {
            const antes = visiveis[i - 1];
            const tx = antes && antes.v ? (x.v ?? 0) / antes.v : null;
            const txA = antes && antes.a && x.a !== null ? x.a / antes.a : null;
            const dTx = tx !== null && txA !== null ? tx - txA : null;
            const vr = variacaoRel(x.v, x.a);
            const larg = x.v ? Math.max(6, (Math.log10(Math.max(1, x.v)) / maxLog) * 100) : 0;
            const custo = investimento && x.v ? investimento / x.v : null;
            const cor = CORES[i % CORES.length];
            return (
              <li key={x.e.id} className="flex flex-col gap-1">
                {antes && (
                  <div className="flex items-center gap-2 pl-2 text-[11.5px] text-muted">
                    <ArrowDown size={12} />
                    <span>taxa <b className="num text-fg">{formatar(tx, "pct")}</b></span>
                    {dTx !== null && Math.abs(dTx) >= 0.001 && <span className={dTx > 0 ? "text-ok" : "text-bad"}>{dTx > 0 ? "▲" : "▼"} {Math.abs(dTx * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p. vs antes ({formatar(txA, "pct")})</span>}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-[150px] shrink-0 sm:w-[190px]">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium">
                      <span className="truncate">{x.e.nome}</span>
                      {x.e.fonte === "auto" && <span className="rounded bg-accent-soft px-1 text-[10px] text-accent">auto</span>}
                    </div>
                    {custo !== null && i > 0 && <div className="num text-[11px] text-muted">{formatar(custo, "brl")} por {x.e.nome.toLowerCase().replace(/s$/, "")}</div>}
                  </div>
                  <div className="relative h-9 min-w-0 flex-1 rounded-lg bg-raised">
                    <div className="flex h-full items-center rounded-lg px-2.5 text-[12.5px] font-semibold text-white" style={{ width: `${larg}%`, background: cor }}>
                      <span className="num">{formatar(x.v, "int")}</span>
                    </div>
                    {gargalo === x.e.id && <span className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md bg-bad px-1.5 py-0.5 text-[10.5px] font-semibold text-white"><AlertTriangle size={11} /> Gargalo</span>}
                  </div>
                  <div className="w-[92px] shrink-0 text-right text-[11.5px]">
                    {vr === null ? <span className="text-muted">—</span> : <span className={vr >= 0 ? "text-ok" : "text-bad"}>{vr >= 0 ? "▲" : "▼"} {Math.abs(Math.round(vr * 100))}%</span>}
                    <div className="num text-muted">antes {formatar(x.a, "int")}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {cfg.valores.length > 0 && ctx.atual.temManual && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cfg.valores.map((v) => {
              const val = ctx.atual.manual[v.id] ?? null;
              const ant = ctx.anterior.temManual ? ctx.anterior.manual[v.id] ?? null : null;
              const vr = variacaoRel(val, ant);
              return (
                <div key={v.id} className="rounded-xl border border-line px-3 py-2">
                  <span className="block truncate text-[11.5px] text-muted">{v.nome}</span>
                  <b className="num block text-[18px]">{formatar(val, "brl")}</b>
                  {vr !== null && <span className={`text-[11px] ${vr >= 0 ? "text-ok" : "text-bad"}`}>{vr >= 0 ? "▲" : "▼"} {Math.abs(Math.round(vr * 100))}% vs antes</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <PainelGraficos titulo="Evolução do funil" catalogo={catalogoGraficos} ids={graficos} salvar={salvarGraficos} />

      <TabelaLancamentos cfg={cfg} linhas={doCliente} editar={(l) => setEditando(l)} excluir={(id) => lanc.excluir(id)} investPor={investPor} />
    </div>
  );
}

function slug(nome: string) {
  return (nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "etapa").slice(0, 24) + "_" + Math.random().toString(36).slice(2, 5);
}

function ConfigEtapas({ cfg, salvar, fechar }: { cfg: ConfigFunil; salvar: (c: ConfigFunil) => Promise<void>; fechar: () => void }) {
  const d = useDados();
  const [c, setC] = useState<ConfigFunil>(cfg);
  const mudaEtapa = (i: number, x: Partial<EtapaFunil>) => setC({ ...c, etapas: c.etapas.map((e, k) => (k === i ? { ...e, ...x } : e)) });
  const mover = (i: number, dd: -1 | 1) => {
    const j = i + dd;
    if (j < 0 || j >= c.etapas.length) return;
    const es = [...c.etapas];
    [es[i], es[j]] = [es[j], es[i]];
    setC({ ...c, etapas: es });
  };
  const campo = "h-8 rounded-lg border border-line bg-bg px-2 text-[12.5px] outline-none focus:border-accent";
  return (
    <div className="anim-entrar flex flex-col gap-3 rounded-xl bg-raised p-3">
      <div className="flex items-center gap-2"><b className="text-[13px]">Etapas do funil deste cliente</b><span className="text-[12px] text-muted">A ordem é a do funil. Etapas automáticas puxam das plataformas.</span><button onClick={fechar} className="ml-auto text-muted hover:text-fg" aria-label="Fechar"><X size={15} /></button></div>
      <div className="flex flex-col gap-1.5">
        {c.etapas.map((e, i) => (
          <div key={e.id} className="grid items-center gap-1.5 sm:grid-cols-[1fr_230px_auto]">
            <input value={e.nome} onChange={(ev) => mudaEtapa(i, { nome: ev.target.value })} className={campo} />
            <select value={e.fonte === "auto" ? e.auto : "manual"} onChange={(ev) => (ev.target.value === "manual" ? mudaEtapa(i, { fonte: "manual", auto: undefined }) : mudaEtapa(i, { fonte: "auto", auto: ev.target.value }))} className={campo}>
              <option value="manual">Lançada à mão</option>
              {Object.entries(AUTO).map(([k, n]) => <option key={k} value={k}>Auto: {n}</option>)}
            </select>
            <div className="flex gap-0.5">
              <button onClick={() => mover(i, -1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface" aria-label="Subir"><ArrowUp size={13} /></button>
              <button onClick={() => mover(i, 1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface" aria-label="Descer"><ArrowDown size={13} /></button>
              <button onClick={() => setC({ ...c, etapas: c.etapas.filter((_, k) => k !== i) })} className="grid h-8 w-8 place-items-center rounded-lg text-bad hover:bg-bad-soft" aria-label="Remover etapa"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <button onClick={() => setC({ ...c, etapas: [...c.etapas, { id: slug("etapa"), nome: "Nova etapa", fonte: "manual" }] })} className="self-start text-[12.5px] text-accent">+ etapa</button>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-line pt-3">
        <b className="text-[12.5px]">Valores em R$ lançados</b>
        {c.valores.map((v, i) => (
          <div key={v.id} className="flex gap-1.5">
            <input value={v.nome} onChange={(ev) => setC({ ...c, valores: c.valores.map((x, k) => (k === i ? { ...x, nome: ev.target.value } : x)) })} className={`${campo} flex-1`} />
            <button onClick={() => setC({ ...c, valores: c.valores.filter((_, k) => k !== i) })} className="grid h-8 w-8 place-items-center rounded-lg text-bad hover:bg-bad-soft" aria-label="Remover valor"><Trash2 size={13} /></button>
          </div>
        ))}
        <button onClick={() => setC({ ...c, valores: [...c.valores, { id: slug("valor"), nome: "Novo valor" }] })} className="self-start text-[12.5px] text-accent">+ valor</button>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={fechar} className="h-8 rounded-lg px-3 text-[12.5px] text-muted hover:text-fg">Cancelar</button>
        <button onClick={async () => { try { await salvar({ ...c, etapas: c.etapas.map((e) => ({ ...e, nome: e.nome.trim() || "Etapa" })) }); fechar(); d.avisar("Etapas salvas"); } catch (e) { d.avisar((e as Error).message); } }} className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg">Salvar etapas</button>
      </div>
    </div>
  );
}

function FormLancamento({ cfg, inicial, clienteId, lanc, fechar }: { cfg: ConfigFunil; inicial: Partial<Lancamento>; clienteId: string; lanc: ReturnType<typeof useLancamentosFunil>; fechar: () => void }) {
  const d = useDados();
  const mesPassado = (() => { const h = new Date(); const ini = new Date(h.getFullYear(), h.getMonth() - 1, 1); const fim = new Date(h.getFullYear(), h.getMonth(), 0); const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; return { ini: f(ini), fim: f(fim) }; })();
  const [ini, setIni] = useState(inicial.inicio ?? mesPassado.ini);
  const [fim, setFim] = useState(inicial.fim ?? mesPassado.fim);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(inicial.valores ?? {}).map(([k, v]) => [k, String(v).replace(".", ",")])));
  const [obs, setObs] = useState(inicial.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const campos = [...cfg.etapas.filter((e) => e.fonte === "manual").map((e) => ({ id: e.id, nome: e.nome, dinheiro: false })), ...cfg.valores.map((v) => ({ id: v.id, nome: v.nome, dinheiro: true }))];
  const n = (s?: string) => (s?.trim() ? Number(s.replace(/\./g, "").replace(",", ".")) : null);
  async function salvar() {
    if (ini > fim) return d.avisar("A data inicial precisa ser antes da final");
    const valores: Record<string, number> = {};
    for (const c of campos) { const v = n(vals[c.id]); if (v !== null && isFinite(v)) valores[c.id] = v; }
    setSalvando(true);
    try {
      await lanc.salvar(inicial.id ?? null, { cliente_id: clienteId, inicio: ini, fim, valores, observacao: obs.trim() || null } as Partial<Lancamento>);
      d.avisar("Números salvos");
      fechar();
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }
  const campo = "h-9 w-full rounded-lg border border-line bg-bg px-2.5 text-[13px] outline-none focus:border-accent";
  return (
    <div className="anim-entrar flex flex-col gap-3 rounded-xl bg-raised p-3">
      <div className="flex items-center gap-2"><b className="text-[13px]">{inicial.id ? "Editar lançamento" : "Lançar números do cliente"}</b><button onClick={fechar} className="ml-auto text-muted hover:text-fg" aria-label="Fechar"><X size={15} /></button></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-[12px] text-muted">De<input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className={campo} /></label>
        <label className="flex flex-col gap-1 text-[12px] text-muted">Até<input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} /></label>
        {campos.map((c) => (
          <label key={c.id} className="flex flex-col gap-1 text-[12px] text-muted">{c.nome}{c.dinheiro ? " (R$)" : ""}<input inputMode="decimal" value={vals[c.id] ?? ""} onChange={(e) => setVals({ ...vals, [c.id]: e.target.value })} placeholder="—" className={campo} /></label>
        ))}
      </div>
      <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (ex.: fonte: planilha do cliente)" className={campo} />
      <div className="flex items-center gap-2">
        <button onClick={salvar} disabled={salvando} className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg disabled:opacity-40">{salvando ? "Salvando…" : "Salvar"}</button>
        <span className="text-[12px] text-muted">Preencha só o que tiver. O ideal é lançar por mês, do dia 1 ao último dia.</span>
      </div>
    </div>
  );
}

function TabelaLancamentos({ cfg, linhas, editar, excluir, investPor }: { cfg: ConfigFunil; linhas: Lancamento[]; editar: (l: Lancamento) => void; excluir: (id: string) => void; investPor: (l: Lancamento) => number }) {
  const cols = [...cfg.etapas.filter((e) => e.fonte === "manual").map((e) => ({ id: e.id, nome: e.nome, fmt: "int" as const })), ...cfg.valores.map((v) => ({ id: v.id, nome: v.nome, fmt: "brl" as const }))];
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const ordenadas = useMemo(() => [...linhas].sort((a, b) => b.inicio.localeCompare(a.inicio)), [linhas]);
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline gap-2"><h2 className="text-[15px] font-semibold">Tabela de dados</h2><span className="text-[12px] text-muted">{linhas.length} lançamentos · investimento puxado das plataformas</span></div>
      {linhas.length === 0 ? (
        <p className="text-[12.5px] text-muted">Nenhum lançamento ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[11.5px] text-muted">
                <th className="py-2 pr-3 font-medium">Período</th>
                <th className="py-2 pr-3 text-right font-medium">Investimento</th>
                {cols.map((c) => <th key={c.id} className="py-2 pr-3 text-right font-medium">{c.nome}</th>)}
                <th className="py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((l) => (
                <tr key={l.id} className="border-b border-line/60 last:border-0" title={l.observacao ?? undefined}>
                  <td className="num py-2 pr-3">{rotuloPeriodo(l)}</td>
                  <td className="num py-2 pr-3 text-right text-muted">{formatar(investPor(l) || null, "brl")}</td>
                  {cols.map((c) => <td key={c.id} className="num py-2 pr-3 text-right">{formatar(l.valores?.[c.id] ?? null, c.fmt)}</td>)}
                  <td className="py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => editar(l)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg" aria-label="Editar"><Pencil size={13} /></button>
                      {confirmar === l.id ? (
                        <button onClick={() => { excluir(l.id); setConfirmar(null); }} className="h-7 rounded-lg bg-bad px-2 text-[11.5px] font-medium text-white">Excluir?</button>
                      ) : (
                        <button onClick={() => setConfirmar(l.id)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad" aria-label="Excluir"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export type { Fonte };
