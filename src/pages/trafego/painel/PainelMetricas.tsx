import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Calculator, Check, ChevronDown, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import { avaliar, formatar, valorVariavel, variacaoRel, type Contexto, type DefMetrica, type Formato, type Formula } from "../../../lib/painel";

export interface ConfigPainel { cards: string[]; formulas: Formula[]; graficos: string[] }

const FORMATOS: { id: Formato; nome: string }[] = [
  { id: "int", nome: "Número" },
  { id: "dec", nome: "Número com decimal" },
  { id: "brl", nome: "Dinheiro (R$)" },
  { id: "pct", nome: "Porcentagem" },
  { id: "x", nome: "Multiplicador (x)" },
];

/** Cartão de métrica com comparação com o período anterior. */
export function CartaoMetrica({ def, ctx, editando, onRemover, onMover, destaque }: { def: DefMetrica; ctx: Contexto; editando?: boolean; onRemover?: () => void; onMover?: (d: -1 | 1) => void; destaque?: boolean }) {
  const v = def.calc(ctx.atual);
  const a = def.calc(ctx.anterior);
  const vr = variacaoRel(v, a);
  const bom = vr === null ? null : def.inverso ? vr < 0 : vr > 0;
  return (
    <div className={`group relative flex min-w-0 flex-col gap-1 rounded-2xl border p-4 ${destaque ? "border-accent bg-accent-soft" : "border-line bg-surface"} ${editando ? "ring-1 ring-dashed ring-accent/40" : ""}`} title={def.dica}>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 truncate text-[12px] text-muted">{def.nome}</div>
        {def.grupo === "Fórmulas" && <Calculator size={12} className="shrink-0 text-muted" />}
      </div>
      <div className="num text-[22px] font-semibold leading-tight">{formatar(v, def.fmt)}</div>
      {vr === null || Math.abs(vr) < 0.005 ? (
        <div className="text-[11.5px] text-muted">{a === null ? "sem comparação" : `antes: ${formatar(a, def.fmt)}`}</div>
      ) : (
        <div className={`num text-[11.5px] font-medium ${bom ? "text-ok" : "text-bad"}`}>
          {vr > 0 ? "▲" : "▼"} {Math.abs(Math.round(vr * 100))}% <span className="font-normal text-muted">antes {formatar(a, def.fmt)}</span>
        </div>
      )}
      {editando && (
        <div className="absolute -right-2 -top-2 flex gap-0.5 rounded-full border border-line bg-surface p-0.5 shadow">
          {onMover && <button onClick={() => onMover(-1)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-raised" aria-label="Mover para a esquerda"><ArrowLeft size={12} /></button>}
          {onMover && <button onClick={() => onMover(1)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-raised" aria-label="Mover para a direita"><ArrowRight size={12} /></button>}
          {onRemover && <button onClick={onRemover} className="grid h-6 w-6 place-items-center rounded-full text-bad hover:bg-bad-soft" aria-label="Remover métrica"><X size={12} /></button>}
        </div>
      )}
    </div>
  );
}

/** Métrica principal: número grande, sem caixa própria (divisórias entre elas). */
function Destaque({ def, ctx, i }: { def: DefMetrica; ctx: Contexto; i: number }) {
  const v = def.calc(ctx.atual);
  const a = def.calc(ctx.anterior);
  const vr = variacaoRel(v, a);
  const bom = vr === null ? null : def.inverso ? vr < 0 : vr > 0;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 px-5 py-5 ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`} title={def.dica}>
      <div className="truncate text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{def.nome}</div>
      <div className="num text-[28px] font-semibold leading-none tracking-tight">{formatar(v, def.fmt)}</div>
      <div className="flex items-center gap-1.5 text-[11.5px]">
        {vr === null || Math.abs(vr) < 0.005 ? (
          <span className="text-muted">{a === null ? "sem comparação" : "igual ao período anterior"}</span>
        ) : (
          <>
            <span className={`num rounded-full px-1.5 py-px font-semibold ${bom ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{vr > 0 ? "+" : "−"}{Math.abs(Math.round(vr * 100))}%</span>
            <span className="num truncate text-muted">antes {formatar(a, def.fmt)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function Secundaria({ def, ctx }: { def: DefMetrica; ctx: Contexto }) {
  const v = def.calc(ctx.atual);
  const vr = variacaoRel(v, def.calc(ctx.anterior));
  const bom = vr === null ? null : def.inverso ? vr < 0 : vr > 0;
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-surface px-4 py-3" title={def.dica}>
      <div className="truncate text-[11.5px] text-muted">{def.nome}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[15px] font-semibold">{formatar(v, def.fmt)}</span>
        {vr !== null && Math.abs(vr) >= 0.005 && <span className={`num text-[11px] ${bom ? "text-ok" : "text-bad"}`}>{vr > 0 ? "+" : "−"}{Math.abs(Math.round(vr * 100))}%</span>}
      </div>
    </div>
  );
}

/**
 * Grade de métricas personalizável: adicionar e remover do catálogo, mudar a ordem e criar fórmulas próprias.
 * Salva pela função `salvar` (por cliente e aba).
 */
export function PainelMetricas({
  titulo,
  ctx,
  catalogo,
  config,
  salvar,
  restaurar,
  personalizado,
  variaveis,
  destaques = 4,
  extra,
}: {
  titulo: string;
  ctx: Contexto;
  catalogo: DefMetrica[];
  config: ConfigPainel;
  salvar: (c: ConfigPainel) => Promise<void>;
  restaurar: () => Promise<void>;
  personalizado: boolean;
  variaveis: { id: string; nome: string }[];
  destaques?: number;
  extra?: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [verMais, setVerMais] = useState(() => { try { return localStorage.getItem("vertente.dash-mais") === "1"; } catch { return false; } });
  const alternarMais = (v: boolean) => { setVerMais(v); try { localStorage.setItem("vertente.dash-mais", v ? "1" : "0"); } catch { /* sem armazenamento */ } };
  const [escolhendo, setEscolhendo] = useState(false);
  const [formula, setFormula] = useState<Formula | null>(null);
  const porId = useMemo(() => new Map(catalogo.map((d) => [d.id, d])), [catalogo]);
  const cards = config.cards.filter((id) => porId.has(id));

  const mudar = (cards: string[], formulas = config.formulas) => salvar({ ...config, cards, formulas });
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cards.length) return;
    const nova = [...cards];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    mudar(nova);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {extra}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {editando && (
            <>
              <button onClick={() => setEscolhendo(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] hover:border-accent hover:text-accent"><Plus size={14} /> Métrica</button>
              <button onClick={() => setFormula({ id: `fx_${Date.now().toString(36)}`, nome: "", expr: "", fmt: "dec" })} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] hover:border-accent hover:text-accent"><Calculator size={14} /> Fórmula</button>
              {personalizado && <button onClick={() => restaurar()} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] text-muted hover:text-fg" title="Voltar ao padrão"><RotateCcw size={13} /> Padrão</button>}
            </>
          )}
          <button onClick={() => { setEditando(!editando); setEscolhendo(false); }} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] ${editando ? "bg-accent font-medium text-accent-fg" : "border border-line text-muted hover:text-fg"}`}>
            {editando ? <><Check size={14} /> Pronto</> : <><Pencil size={13} /> <span className="hidden sm:inline">Personalizar</span></>}
          </button>
        </div>
      </div>
      {cards.length === 0 ? (
        <button onClick={() => { setEditando(true); setEscolhendo(true); }} className="rounded-2xl border border-dashed border-line px-4 py-6 text-[13px] text-muted hover:border-accent hover:text-accent">Nenhuma métrica. Clique para escolher.</button>
      ) : editando ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((id, i) => (
            <CartaoMetrica key={id} def={porId.get(id)!} ctx={ctx} destaque={i < destaques} editando={editando} onRemover={() => mudar(cards.filter((x) => x !== id))} onMover={(d) => mover(i, d)} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {cards.slice(0, destaques).map((id, i) => (
              <Destaque key={id} def={porId.get(id)!} ctx={ctx} i={i} />
            ))}
          </div>
          {cards.length > destaques && (
            <>
              {verMais && (
                <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
                  {cards.slice(destaques).map((id) => <Secundaria key={id} def={porId.get(id)!} ctx={ctx} />)}
                </div>
              )}
              <button onClick={() => alternarMais(!verMais)} className="flex w-full items-center justify-center gap-1 border-t border-line py-2 text-[12px] text-muted hover:bg-raised/60 hover:text-fg">
                {verMais ? "Menos métricas" : `Mais ${cards.length - destaques} métricas`} <ChevronDown size={13} className={`transition-transform ${verMais ? "rotate-180" : ""}`} />
              </button>
            </>
          )}
        </div>
      )}
      {escolhendo && <Escolher catalogo={catalogo} ja={cards} fechar={() => setEscolhendo(false)} adicionar={(id) => mudar([...cards, id])} editarFormula={(id) => { const f = config.formulas.find((x) => x.id === id); if (f) { setEscolhendo(false); setFormula(f); } }} excluirFormula={(id) => mudar(cards.filter((x) => x !== id), config.formulas.filter((x) => x.id !== id))} ctx={ctx} />}
      {formula && (
        <EditorFormula
          inicial={formula}
          variaveis={variaveis}
          ctx={ctx}
          fechar={() => setFormula(null)}
          salvar={async (f) => {
            const existe = config.formulas.some((x) => x.id === f.id);
            const formulas = existe ? config.formulas.map((x) => (x.id === f.id ? f : x)) : [...config.formulas, f];
            await mudar(cards.includes(f.id) ? cards : [...cards, f.id], formulas);
            setFormula(null);
          }}
        />
      )}
    </div>
  );
}

function Escolher({ catalogo, ja, fechar, adicionar, editarFormula, excluirFormula, ctx }: { catalogo: DefMetrica[]; ja: string[]; fechar: () => void; adicionar: (id: string) => void; editarFormula: (id: string) => void; excluirFormula: (id: string) => void; ctx: Contexto }) {
  const [busca, setBusca] = useState("");
  const grupos = ["Geral", "Meta Ads", "Google Ads", "Funil", "Fórmulas"] as const;
  const filtrado = catalogo.filter((d) => !busca || d.nome.toLowerCase().includes(busca.toLowerCase()));
  return (
    <div className="anim-entrar flex flex-col gap-2 rounded-2xl border border-accent/40 bg-surface p-3">
      <div className="flex items-center gap-2">
        <Search size={14} className="text-muted" />
        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar métrica…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
        <button onClick={fechar} className="text-muted hover:text-fg" aria-label="Fechar"><X size={15} /></button>
      </div>
      <div className="grid max-h-[340px] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {grupos.map((g) => {
          const lista = filtrado.filter((d) => d.grupo === g);
          if (!lista.length) return null;
          return (
            <div key={g} className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{g}</span>
              {lista.map((d) => {
                const tem = ja.includes(d.id);
                return (
                  <div key={d.id} className="flex items-center gap-1">
                    <button disabled={tem} onClick={() => adicionar(d.id)} className={`flex min-w-0 flex-1 items-baseline gap-2 rounded-lg px-2 py-1 text-left text-[12.5px] ${tem ? "text-muted" : "hover:bg-raised"}`} title={d.dica}>
                      {tem ? <Check size={12} className="shrink-0 text-ok" /> : <Plus size={12} className="shrink-0 text-accent" />}
                      <span className="min-w-0 flex-1 truncate">{d.nome}</span>
                      <span className="num shrink-0 text-[11px] text-muted">{formatar(d.calc(ctx.atual), d.fmt)}</span>
                    </button>
                    {d.grupo === "Fórmulas" && (
                      <>
                        <button onClick={() => editarFormula(d.id)} className="text-muted hover:text-fg" aria-label="Editar fórmula"><Pencil size={12} /></button>
                        <button onClick={() => excluirFormula(d.id)} className="text-muted hover:text-bad" aria-label="Excluir fórmula"><X size={12} /></button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditorFormula({ inicial, variaveis, ctx, fechar, salvar }: { inicial: Formula; variaveis: { id: string; nome: string }[]; ctx: Contexto; fechar: () => void; salvar: (f: Formula) => Promise<void> }) {
  const [f, setF] = useState(inicial);
  const [busca, setBusca] = useState("");
  let previa = "—";
  let erro = "";
  if (f.expr.trim()) {
    try {
      previa = formatar(avaliar(f.expr, (id) => valorVariavel(id, ctx.atual)), f.fmt);
      const desconhecida = [...f.expr.matchAll(/\{([^}]+)\}/g)].map((m) => m[1].trim()).find((id) => !variaveis.some((v) => v.id === id));
      if (desconhecida) erro = `Variável desconhecida: {${desconhecida}}`;
    } catch (e) {
      erro = (e as Error).message;
    }
  }
  const campo = "h-9 rounded-lg border border-line bg-bg px-2.5 text-[13px] outline-none focus:border-accent";
  return (
    <div className="anim-entrar flex flex-col gap-2.5 rounded-2xl border border-accent/40 bg-surface p-4">
      <div className="flex items-center gap-2"><Calculator size={15} className="text-accent" /><b className="text-[13.5px]">Métrica com fórmula</b><button onClick={fechar} className="ml-auto text-muted hover:text-fg" aria-label="Fechar"><X size={15} /></button></div>
      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Nome (ex.: Custo por agendamento)" className={campo} />
        <select value={f.fmt} onChange={(e) => setF({ ...f, fmt: e.target.value as Formato })} className={campo}>
          {FORMATOS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
      </div>
      <input value={f.expr} onChange={(e) => setF({ ...f, expr: e.target.value })} placeholder="Ex.: {investimento} / {agendamentos}" className={`${campo} font-mono`} />
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-muted">Resultado agora:</span>
        <b className="num">{erro ? "—" : previa}</b>
        {erro && <span className="text-bad">{erro}</span>}
        <label className="ml-auto flex items-center gap-1.5 text-muted"><input type="checkbox" checked={!!f.inverso} onChange={(e) => setF({ ...f, inverso: e.target.checked })} /> Menor é melhor (custos)</label>
      </div>
      <div className="flex flex-col gap-1 rounded-xl bg-raised p-2">
        <div className="flex items-center gap-2 text-[11.5px] text-muted">Clique para inserir · use + − * / e parênteses<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="filtrar" className="ml-auto h-6 w-28 rounded border border-line bg-bg px-1.5 text-[11.5px]" /></div>
        <div className="flex max-h-[120px] flex-wrap gap-1 overflow-y-auto">
          {variaveis.filter((v) => !busca || v.nome.toLowerCase().includes(busca.toLowerCase())).map((v) => (
            <button key={v.id} onClick={() => setF({ ...f, expr: `${f.expr}${f.expr && !/[\s(+\-*/]$/.test(f.expr) ? " " : ""}{${v.id}}` })} className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11.5px] hover:border-accent" title={`{${v.id}}`}>{v.nome}</button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={fechar} className="h-8 rounded-lg px-3 text-[12.5px] text-muted hover:text-fg">Cancelar</button>
        <button disabled={!f.nome.trim() || !f.expr.trim() || !!erro} onClick={() => salvar({ ...f, nome: f.nome.trim() })} className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg disabled:opacity-40">Salvar fórmula</button>
      </div>
    </div>
  );
}
