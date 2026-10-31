import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, LifeBuoy } from "lucide-react";
import { useDados } from "../lib/dados";
import { useTabela } from "../lib/tabela";
import { Iniciais } from "./ui";

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
function Formulario({ perguntas, atual, salvar, compacto }: { perguntas: readonly Pergunta[]; atual?: RespostaRitual; salvar: (r: Record<string, string>) => Promise<void>; compacto?: boolean }) {
  const [valores, setValores] = useState<Record<string, string>>(atual?.respostas ?? {});
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setValores(atual?.respostas ?? {}), [atual?.id, atual?.atualizado_em]); // eslint-disable-line react-hooks/exhaustive-deps
  const mudou = perguntas.some((p) => (valores[p.id] ?? "") !== (atual?.respostas?.[p.id] ?? ""));
  const vazio = perguntas.every((p) => !(valores[p.id] ?? "").trim());
  return (
    <div className="flex flex-col gap-2.5">
      {perguntas.map((p) => (
        <label key={p.id} className="flex flex-col gap-1">
          <span className="text-[12.5px] font-medium">{p.rotulo}</span>
          <textarea
            rows={compacto ? 2 : 3}
            value={valores[p.id] ?? ""}
            onChange={(e) => setValores((v) => ({ ...v, [p.id]: e.target.value }))}
            placeholder={p.dica}
            className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none focus:border-accent"
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

  async function salvar(respostas: Record<string, string>) {
    try {
      await t.salvar(minha?.id ?? null, { tipo: "daily", data, membro_id: eu ?? undefined, respostas, atualizado_em: new Date().toISOString() } as Partial<RespostaRitual>);
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
      {t.erro ? (
        <p className="text-[12.5px] text-bad">Respostas indisponíveis: {t.erro}</p>
      ) : (
        <>
          <Formulario perguntas={PERGUNTAS_DAILY} atual={minha} salvar={salvar} />
          <div className="border-t border-line pt-3">
            <h3 className="mb-2 text-[12.5px] font-semibold text-muted">Respostas do time</h3>
            <Consolidado perguntas={PERGUNTAS_DAILY} linhas={doDia} />
          </div>
        </>
      )}
    </section>
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
                  <div className="anim-entrar grid gap-4 px-1 pb-3 pt-2 md:grid-cols-2">
                    <Formulario perguntas={perguntas} atual={minha} salvar={(r) => salvar(i, minha, r)} compacto />
                    <div>
                      <h3 className="mb-2 text-[12.5px] font-semibold text-muted">Respostas do time</h3>
                      <Consolidado perguntas={perguntas} linhas={linhas} />
                    </div>
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
