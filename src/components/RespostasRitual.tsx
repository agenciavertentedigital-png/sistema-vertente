import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, LifeBuoy } from "lucide-react";
import { useDados } from "../lib/dados";
import { repo } from "../lib/repo";
import { STATUS_ABERTOS, atrasada, dataCurta, diasUteis, hoje, somarDias } from "../lib/tipos";
import { useTabela } from "../lib/tabela";
import { Iniciais, TextoAuto } from "./ui";

export interface RespostaRitual {
  id: string;
  tipo: "daily" | "weekly";
  data: string;
  membro_id: string;
  cliente_id: string | null;
  setor: string | null;
  respostas: Record<string, string>;
  criado_em: string;
  atualizado_em: string;
}

export const PERGUNTAS_DAILY = [
  { id: "ontem", rotulo: "Realizado ontem", dica: "O que você entregou no último dia útil" },
  { id: "hoje", rotulo: "A fazer hoje", dica: "Suas prioridades de hoje" },
  { id: "ajuda", rotulo: "Precisa de ajuda?", dica: "Alguma trava, dúvida ou dependência de alguém" },
] as const;

export const PERGUNTAS_WEEKLY_CLIENTE = [
  { id: "semana", rotulo: "Como foi a semana do cliente?", dica: "Resultados, retorno do cliente, clima" },
  { id: "resultado", rotulo: "Principal resultado ou aprendizado", dica: "O número ou fato que mais importa" },
  { id: "proximo", rotulo: "Próximo passo", dica: "O que vamos fazer nesta semana" },
] as const;

export const SETORES = ["Administrativo", "Comercial", "Operacional", "Financeiro", "Marketing da Vertente"] as const;
export const PERGUNTAS_WEEKLY_SETOR = [
  { id: "avancou", rotulo: "O que avançou", dica: "Entregas e conquistas do setor" },
  { id: "travas", rotulo: "Travas", dica: "O que está parado ou em risco" },
  { id: "prioridade", rotulo: "Prioridade da semana", dica: "O foco do setor nesta semana" },
] as const;

const COLUNAS = "id, tipo, data, membro_id, cliente_id, setor, respostas, criado_em, atualizado_em";
const demo = (): RespostaRitual[] => [];

export function useRituais() {
  return useTabela<RespostaRitual>("rituais_respostas", COLUNAS, demo, { ordem: { coluna: "data", asc: false }, limite: 2000 });
}

type Pergunta = { id: string; rotulo: string; dica: string };

/** Formulário de respostas (salva ao clicar; uma linha por pessoa + dia/semana + cliente/setor). */
function Formulario({ perguntas, atual, salvar, compacto, inicial }: { perguntas: readonly Pergunta[]; atual?: RespostaRitual; salvar: (r: Record<string, string>) => Promise<void>; compacto?: boolean; inicial?: Record<string, string> }) {
  const [valores, setValores] = useState<Record<string, string>>(atual?.respostas ?? inicial ?? {});
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setValores(atual?.respostas ?? inicial ?? {}), [atual?.id, atual?.atualizado_em]); // eslint-disable-line react-hooks/exhaustive-deps
  const mudou = !atual || perguntas.some((p) => (valores[p.id] ?? "") !== (atual?.respostas?.[p.id] ?? ""));
  const vazio = perguntas.every((p) => !(valores[p.id] ?? "").trim());
  return (
    <div className="flex flex-col gap-2.5">
      {perguntas.map((p) => (
        <label key={p.id} className="flex flex-col gap-1">
          <span className="text-[12.5px] font-medium">{p.rotulo}</span>
          <TextoAuto
            minimo={compacto ? 64 : 120}
            value={valores[p.id] ?? ""}
            onChange={(e) => setValores((v) => ({ ...v, [p.id]: e.target.value }))}
            placeholder={p.dica}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-accent"
          />
        </label>
      ))}
      <div className="flex items-center gap-2">
        <button
          disabled={!mudou || vazio || salvando}
          onClick={async () => {
            setSalvando(true);
            try {
              await salvar(Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.trim()])));
            } finally {
              setSalvando(false);
            }
          }}
          className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg hover:opacity-90 disabled:opacity-40"
        >
          {salvando ? "Salvando…" : atual ? "Atualizar respostas" : "Salvar respostas"}
        </button>
        {atual && !mudou && <span className="flex items-center gap-1 text-[12px] text-ok"><CheckCircle2 size={13} /> Respondido</span>}
      </div>
    </div>
  );
}

/** Respostas consolidadas de várias pessoas para o mesmo item. */
function Consolidado({ perguntas, linhas }: { perguntas: readonly Pergunta[]; linhas: RespostaRitual[] }) {
  const d = useDados();
  if (!linhas.length) return <p className="text-[12.5px] text-muted">Ninguém respondeu ainda.</p>;
  return (
    <div className="flex flex-col gap-3">
      {linhas.map((r) => (
        <div key={r.id} className="flex gap-2.5">
          <Iniciais nome={d.membro(r.membro_id)?.nome ?? "?"} />
          <div className="min-w-0 flex-1 text-[13px] leading-snug">
            <span className="font-medium">{d.membro(r.membro_id)?.nome ?? "Alguém"}</span>
            {perguntas.map((p) =>
              r.respostas?.[p.id] ? (
                <p key={p.id} className={`mt-1 whitespace-pre-wrap ${p.id === "ajuda" || p.id === "travas" ? "rounded-lg bg-warn/10 px-2 py-1" : ""}`}>
                  <span className="text-[12px] text-muted">{p.rotulo.replace(/\?$/, "")}: </span>
                  {r.respostas[p.id]}
                </p>
              ) : null,
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Daily: cada pessoa responde as três perguntas; o time vê tudo consolidado no mesmo dia. */
export function DailyRespostas({ data }: { data: string }) {
  const d = useDados();
  const t = useRituais();
  const doDia = t.linhas.filter((r) => r.tipo === "daily" && r.data === data && !r.cliente_id && !r.setor);
  const eu = d.eu ?? d.membros[0]?.id ?? null;
  const minha = doDia.find((r) => r.membro_id === eu);
  const pedemAjuda = doDia.filter((r) => (r.respostas?.ajuda ?? "").trim() && !/^(n[aã]o|nada|-)\.?$/i.test(r.respostas.ajuda.trim()));

  // Pré-preenche com as tarefas: o que concluiu no último dia útil e o que tem para hoje
  const inicial = useMemo(() => {
    if (!eu) return undefined;
    const ontem = diasUteis(2)[0];
    const minhas = d.tarefas.filter((x) => x.responsavel_id === eu);
    const nomeT = (x: (typeof minhas)[number]) => `- ${d.cliente(x.cliente_id)?.nome ? d.cliente(x.cliente_id)!.nome + ": " : ""}${x.titulo}`;
    const fez = minhas.filter((x) => x.status === "feita" && x.concluida_em && x.concluida_em.slice(0, 10) >= ontem && x.concluida_em.slice(0, 10) < data);
    const fazer = minhas.filter((x) => STATUS_ABERTOS.includes(x.status) && x.prazo && x.prazo <= data).sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""));
    return { ontem: fez.map(nomeT).join("\n"), hoje: fazer.slice(0, 15).map((x) => nomeT(x) + (x.prazo! < data ? " (atrasada)" : "")).join("\n"), ajuda: "" };
  }, [eu, d.tarefas, data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar(respostas: Record<string, string>) {
    try {
      await t.salvar(minha?.id ?? null, { tipo: "daily", data, membro_id: eu ?? undefined, respostas: { ...(minha?.respostas ?? {}), ...respostas }, atualizado_em: new Date().toISOString() } as Partial<RespostaRitual>);
      d.avisar("Daily salva");
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[14px] font-semibold">Sua daily</h2>
        <span className="text-[12px] text-muted">{doDia.length} de {d.membros.length} responderam</span>
        {pedemAjuda.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[12px] font-medium text-warn"><LifeBuoy size={12} /> {pedemAjuda.length} pede{pedemAjuda.length > 1 ? "m" : ""} ajuda</span>
        )}
      </div>
      {!minha && <p className="-mt-1 text-[12px] text-muted">Já veio preenchida com o que você concluiu no último dia útil e o que tem para hoje. Ajuste e salve.</p>}
      {t.erro ? (
        <p className="text-[12.5px] text-bad">Respostas indisponíveis: {t.erro}</p>
      ) : (
        <>
          <Formulario perguntas={PERGUNTAS_DAILY} atual={minha} salvar={salvar} inicial={inicial} />
          {pedemAjuda.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <h3 className="text-[12.5px] font-semibold text-warn">Bloqueios para encaminhar</h3>
              {pedemAjuda.map((r) => <Encaminhar key={r.id} r={r} salvarRitual={t.salvar} />)}
            </div>
          )}
          <div className="border-t border-line pt-3">
            <h3 className="mb-2 text-[12.5px] font-semibold text-muted">Respostas do time</h3>
            <Consolidado perguntas={PERGUNTAS_DAILY} linhas={doDia} />
          </div>
        </>
      )}
    </section>
  );
}

/** Um bloqueio da daily vira encaminhamento: quem ajuda, próximo passo e quando (cria a tarefa para quem ajuda). */
function Encaminhar({ r, salvarRitual }: { r: RespostaRitual; salvarRitual: ReturnType<typeof useRituais>["salvar"] }) {
  const d = useDados();
  const [quem, setQuem] = useState("");
  const [passo, setPasso] = useState("");
  const [quando, setQuando] = useState(hoje());
  const [salvando, setSalvando] = useState(false);
  const pediu = d.membro(r.membro_id)?.nome.split(" ")[0] ?? "Alguém";
  const feito = r.respostas?.encaminhado;
  const agencia = d.clientes.find((c) => c.nome.toLowerCase().includes("vertente"));

  async function criar() {
    setSalvando(true);
    try {
      const titulo = `Ajudar ${pediu}: ${passo.trim()}`;
      await repo.salvarTarefa(null, { cliente_id: agencia?.id, titulo, descricao: `Bloqueio da daily de ${pediu}: ${r.respostas.ajuda}`, pilar: "interno", prioridade: "alta", prazo: quando, responsavel_id: quem, status: "a_fazer" });
      const nomeQuem = d.membro(quem)?.nome.split(" ")[0] ?? "";
      await salvarRitual(r.id, { respostas: { ...r.respostas, encaminhado: `${nomeQuem} · ${passo.trim()} · até ${dataCurta(quando).toLowerCase()}` } } as Partial<RespostaRitual>);
      await d.recarregar();
      d.avisar(`Encaminhado para ${nomeQuem}`);
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-warn/10 px-3 py-2 text-[13px]">
      <div><b>{pediu}:</b> {r.respostas.ajuda}</div>
      {feito ? (
        <div className="flex items-center gap-1 text-[12.5px] text-ok"><CheckCircle2 size={13} /> Encaminhado: {feito}</div>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-[150px_1fr_140px_auto]">
          <select value={quem} onChange={(e) => setQuem(e.target.value)} className="h-8 rounded-lg border border-line bg-bg px-2 text-[12.5px]">
            <option value="">Quem ajuda…</option>
            {d.membros.filter((m) => m.id !== r.membro_id).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <input value={passo} onChange={(e) => setPasso(e.target.value)} placeholder="Próximo passo" className="h-8 rounded-lg border border-line bg-bg px-2 text-[12.5px] outline-none focus:border-accent" />
          <input type="date" value={quando} onChange={(e) => setQuando(e.target.value)} className="h-8 rounded-lg border border-line bg-bg px-2 text-[12.5px]" />
          <button disabled={!quem || !passo.trim() || salvando} onClick={criar} className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg disabled:opacity-40">{salvando ? "…" : "Encaminhar"}</button>
        </div>
      )}
    </div>
  );
}

/** Weekly: perguntas por cliente ativo e por setor da Vertente. */
export function WeeklyRespostas({ semana }: { semana: string }) {
  const d = useDados();
  const t = useRituais();
  const [aba, setAba] = useState<"clientes" | "setores">("clientes");
  const [aberto, setAberto] = useState<string | null>(null);
  const eu = d.eu ?? d.membros[0]?.id ?? null;
  const daSemana = t.linhas.filter((r) => r.tipo === "weekly" && r.data === semana);
  const clientes = useMemo(() => d.clientes.filter((c) => !c.nome.toLowerCase().includes("vertente")).sort((a, b) => a.nome.localeCompare(b.nome)), [d.clientes]);

  const itens =
    aba === "clientes"
      ? clientes.map((c) => ({ chave: `c-${c.id}`, nome: c.nome, cliente_id: c.id as string | null, setor: null as string | null }))
      : SETORES.map((s) => ({ chave: `s-${s}`, nome: s, cliente_id: null as string | null, setor: s as string | null }));
  const perguntas = aba === "clientes" ? PERGUNTAS_WEEKLY_CLIENTE : PERGUNTAS_WEEKLY_SETOR;
  const respondidos = itens.filter((i) => daSemana.some((r) => r.cliente_id === i.cliente_id && r.setor === i.setor)).length;

  async function salvar(i: (typeof itens)[number], atual: RespostaRitual | undefined, respostas: Record<string, string>) {
    try {
      await t.salvar(atual?.id ?? null, { tipo: "weekly", data: semana, membro_id: eu ?? undefined, cliente_id: i.cliente_id, setor: i.setor, respostas, atualizado_em: new Date().toISOString() } as Partial<RespostaRitual>);
      d.avisar(`Weekly salva: ${i.nome}`);
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[14px] font-semibold">Perguntas da semana</h2>
        <span className="text-[12px] text-muted">{respondidos} de {itens.length} respondidos</span>
        <div role="tablist" className="ml-auto flex gap-1 rounded-lg border border-line p-0.5">
          {(["clientes", "setores"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={aba === v} onClick={() => setAba(v)} className={`rounded-md px-2.5 py-1 text-[12.5px] ${aba === v ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
              {v === "clientes" ? "Por cliente" : "Por setor"}
            </button>
          ))}
        </div>
      </div>
      {t.erro ? (
        <p className="text-[12.5px] text-bad">Respostas indisponíveis: {t.erro}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {itens.map((i) => {
            const linhas = daSemana.filter((r) => r.cliente_id === i.cliente_id && r.setor === i.setor);
            const minha = linhas.find((r) => r.membro_id === eu);
            const ab = aberto === i.chave;
            return (
              <li key={i.chave} className="py-1">
                <button onClick={() => setAberto(ab ? null : i.chave)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-[13px] hover:bg-raised">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${linhas.length ? "bg-ok" : "bg-line-forte"}`} />
                  <span className="flex-1 truncate font-medium">{i.nome}</span>
                  {linhas.length > 0 && <span className="text-[12px] text-muted">{linhas.length} resposta{linhas.length > 1 ? "s" : ""}</span>}
                  <ChevronDown size={14} className={`text-muted transition-transform ${ab ? "rotate-180" : ""}`} />
                </button>
                {ab && (
                  <div className="anim-entrar flex flex-col gap-3 px-1 pb-3 pt-2">
                    {i.cliente_id && <NumerosSemana clienteId={i.cliente_id} semana={semana} />}
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                      <Formulario perguntas={perguntas} atual={minha} salvar={(r) => salvar(i, minha, r)} />
                      <div className="flex flex-col gap-3">
                        <div>
                          <h3 className="mb-2 text-[12.5px] font-semibold text-muted">Respostas do time</h3>
                          <Consolidado perguntas={perguntas} linhas={linhas} />
                        </div>
                        {(() => {
                          const ant = t.linhas.filter((r) => r.tipo === "weekly" && r.data === somarDias(semana, -7) && r.cliente_id === i.cliente_id && r.setor === i.setor);
                          return ant.length ? (
                            <details className="rounded-lg border border-line px-2 py-1.5">
                              <summary className="cursor-pointer text-[12.5px] font-semibold text-muted">Weekly anterior ({dataCurta(somarDias(semana, -7))})</summary>
                              <div className="mt-2"><Consolidado perguntas={perguntas} linhas={ant} /></div>
                            </details>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <Decisoes clienteId={i.cliente_id} setor={i.setor} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Números automáticos da semana passada e itens em aberto do cliente, para a weekly começar com os fatos. */
function NumerosSemana({ clienteId, semana }: { clienteId: string; semana: string }) {
  const d = useDados();
  const ini = somarDias(semana, -7);
  const fim = somarDias(semana, -1);
  const doCli = d.tarefas.filter((t) => t.cliente_id === clienteId);
  const feitas = doCli.filter((t) => t.status === "feita" && t.concluida_em && t.concluida_em.slice(0, 10) >= ini && t.concluida_em.slice(0, 10) <= fim).length;
  const abertas = doCli.filter((t) => STATUS_ABERTOS.includes(t.status) && !t.triagem && !/^revis[aã]o di[aá]ria/i.test(t.titulo));
  const vertente = abertas.filter((t) => (t.lado ?? "vertente") === "vertente");
  const cliente = abertas.filter((t) => t.lado === "cliente");
  const regs = d.registros.filter((r) => r.cliente_id === clienteId && r.data >= ini && r.data <= fim);
  const otim = regs.filter((r) => r.tipo === "otimizacao").length;
  const atencao = regs.filter((r) => r.situacao && r.situacao !== "ok").length;
  const itens: [string, number, boolean?][] = [
    ["Concluídas na semana", feitas],
    ["Otimizações", otim],
    ["Revisões em atenção", atencao, atencao > 0],
    ["Vertente deve", vertente.length],
    ["Atrasadas", vertente.filter(atrasada).length, vertente.some(atrasada)],
    ["Cliente deve", cliente.length, cliente.length > 0],
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {itens.map(([r, v, al]) => (
          <div key={r} className={`rounded-lg border px-2 py-1.5 ${al ? "border-warn bg-warn-soft" : "border-line"}`}>
            <div className={`num text-[16px] font-medium leading-none ${al ? "text-warn" : ""}`}>{v}</div>
            <div className="mt-0.5 text-[11px] text-muted">{r}</div>
          </div>
        ))}
      </div>
      {(vertente.length > 0 || cliente.length > 0) && (
        <div className="grid gap-x-4 text-[12.5px] sm:grid-cols-2">
          {vertente.slice(0, 5).map((t) => <div key={t.id} className={`truncate ${atrasada(t) ? "text-bad" : ""}`}>• {t.titulo} <span className="text-muted">· {dataCurta(t.prazo)}</span></div>)}
          {cliente.slice(0, 5).map((t) => <div key={t.id} className="truncate text-muted">⏳ {t.titulo}{t.contato_cliente ? ` · ${t.contato_cliente}` : ""}</div>)}
        </div>
      )}
    </div>
  );
}

/** Decisões da weekly que já viram tarefa ligada ao cliente (ou à agência, nos setores). */
function Decisoes({ clienteId, setor }: { clienteId: string | null; setor: string | null }) {
  const d = useDados();
  const [texto, setTexto] = useState("");
  const [quem, setQuem] = useState(d.eu ?? "");
  const [prazo, setPrazo] = useState(somarDias(hoje(), 7));
  const [salvando, setSalvando] = useState(false);
  const agencia = d.clientes.find((c) => c.nome.toLowerCase().includes("vertente"));
  async function criar() {
    setSalvando(true);
    try {
      await repo.salvarTarefa(null, { cliente_id: clienteId ?? agencia?.id, titulo: texto.trim(), descricao: `Decisão da weekly${setor ? ` (${setor})` : ""}`, pilar: clienteId ? "cs" : "interno", prioridade: "normal", prazo, responsavel_id: quem || null, status: "a_fazer" });
      await d.recarregar();
      setTexto("");
      d.avisar("Decisão virou tarefa");
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div className="grid gap-1.5 rounded-lg border border-dashed border-line p-2 sm:grid-cols-[1fr_150px_140px_auto]">
      <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && texto.trim() && criar()} placeholder="Decisão da weekly → vira tarefa (ex.: Testar criativo de depoimento)" className="h-8 rounded-lg border border-line bg-bg px-2 text-[12.5px] outline-none focus:border-accent" />
      <select value={quem} onChange={(e) => setQuem(e.target.value)} className="h-8 rounded-lg border border-line bg-bg px-2 text-[12.5px]">
        <option value="">Responsável…</option>
        {d.membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
      <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="h-8 rounded-lg border border-line bg-bg px-2 text-[12.5px]" />
      <button disabled={!texto.trim() || salvando} onClick={criar} className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg disabled:opacity-40">Criar tarefa</button>
    </div>
  );
}
