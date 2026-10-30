import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Columns3, List, Search, X } from "lucide-react";
import { MenuFiltro } from "../Filtro";
import { useDados } from "../../lib/dados";
import { repo } from "../../lib/repo";
import {
  PILAR,
  PILARES,
  STATUS,
  STATUS_ABERTOS,
  atrasada,
  hoje,
  somarDias,
  ORDEM_PRIORIDADE,
  type Status,
  type Tarefa,
} from "../../lib/tipos";
import { CartaoTarefa } from "./CartaoTarefa";
import { tipoDeRegistro } from "./RegistroRapido";
import { COR_PILAR, Entrada, Iniciais, Selecao, Vazio } from "../ui";

// ------------------------------------------------------------------
// Filtros
// ------------------------------------------------------------------
type Periodo = "todas" | "atrasadas" | "hoje" | "semana" | "prox7" | "mes" | "sem_prazo";
type Agrupar = "status" | "responsavel" | "prazo";

const PERIODOS: { id: Periodo; nome: string; dica: string }[] = [
  { id: "todas", nome: "Todas", dica: "Todas as tarefas abertas" },
  { id: "atrasadas", nome: "Atrasadas", dica: "Prazo antes de hoje" },
  { id: "hoje", nome: "Hoje", dica: "Prazo hoje" },
  { id: "semana", nome: "Esta semana", dica: "De segunda a domingo desta semana" },
  { id: "prox7", nome: "Próximos 7 dias", dica: "De hoje até daqui a 6 dias" },
  { id: "mes", nome: "Este mês", dica: "Prazo dentro deste mês" },
  { id: "sem_prazo", nome: "Sem prazo", dica: "Tarefas sem data" },
];

interface Filtros {
  periodo: Periodo;
  resp: string; // "todos" | "sem" | id
  pilar: string;
  cliente: string;
  busca: string;
  visao: "kanban" | "lista";
  agrupar: Agrupar;
}

const PADRAO: Filtros = { periodo: "todas", resp: "todos", pilar: "todos", cliente: "todos", busca: "", visao: "kanban", agrupar: "status" };
const CHAVE = "vertente.filtros-tarefas";

function lerFiltros(): Filtros {
  try {
    const v = localStorage.getItem(CHAVE);
    return v ? { ...PADRAO, ...JSON.parse(v), busca: "" } : PADRAO;
  } catch {
    return PADRAO;
  }
}

function inicioSemana(dia: string) {
  const dow = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return somarDias(dia, dow === 0 ? -6 : 1 - dow);
}

function noPeriodo(t: Tarefa, p: Periodo, h: string) {
  switch (p) {
    case "todas":
      return true;
    case "atrasadas":
      return atrasada(t);
    case "hoje":
      return t.prazo === h;
    case "semana": {
      const ini = inicioSemana(h);
      return Boolean(t.prazo && t.prazo >= ini && t.prazo <= somarDias(ini, 6));
    }
    case "prox7":
      return Boolean(t.prazo && t.prazo >= h && t.prazo <= somarDias(h, 6));
    case "mes":
      return Boolean(t.prazo && t.prazo.slice(0, 7) === h.slice(0, 7));
    case "sem_prazo":
      return !t.prazo;
  }
}

export function ordenarTarefas(a: Tarefa, b: Tarefa) {
  return (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") || ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade];
}

// ------------------------------------------------------------------
// Quadro
// ------------------------------------------------------------------
export function QuadroTarefas({ abrir }: { abrir: (id: string) => void }) {
  const d = useDados();
  const [f, setF] = useState<Filtros>(lerFiltros);
  const h = hoje();
  const set = (p: Partial<Filtros>) => setF((v) => ({ ...v, ...p }));

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ ...f, busca: "" }));
    } catch {
      /* navegador sem armazenamento: só não lembra os filtros */
    }
  }, [f]);

  // Filtros que não são de período (valem para abertas e concluídas)
  const base = useMemo(
    () =>
      d.tarefas
        .filter((t) => !t.triagem)
        .filter((t) => f.resp === "todos" || (f.resp === "sem" ? !t.responsavel_id : t.responsavel_id === f.resp))
        .filter((t) => f.pilar === "todos" || t.pilar === f.pilar)
        .filter((t) => f.cliente === "todos" || t.cliente_id === f.cliente)
        .filter((t) => {
          const q = f.busca.trim().toLowerCase();
          return !q || t.titulo.toLowerCase().includes(q) || (d.cliente(t.cliente_id)?.nome ?? "").toLowerCase().includes(q);
        }),
    [d.tarefas, f.resp, f.pilar, f.cliente, f.busca], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const abertasBase = base.filter((t) => STATUS_ABERTOS.includes(t.status));
  const abertas = abertasBase.filter((t) => noPeriodo(t, f.periodo, h)).sort(ordenarTarefas);
  const feitas = base
    .filter((t) => t.status === "feita" && t.concluida_em && t.concluida_em.slice(0, 10) >= somarDias(h, -7))
    .sort((a, b) => (b.concluida_em ?? "").localeCompare(a.concluida_em ?? ""));

  const conta = (p: Periodo) => abertasBase.filter((t) => noPeriodo(t, p, h)).length;
  const filtrosAtivos = f.periodo !== "todas" || f.resp !== "todos" || f.pilar !== "todos" || f.cliente !== "todos" || f.busca.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      {/* Números clicáveis: viram filtro */}
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-4 [&>*+*]:border-l [&>*+*]:border-line [&>*:nth-child(3)]:max-sm:border-l-0 [&>*:nth-child(n+3)]:max-sm:border-t">
        <NumeroFiltro rotulo="Atrasadas" valor={conta("atrasadas")} ativo={f.periodo === "atrasadas"} alerta={conta("atrasadas") > 0} onClick={() => set({ periodo: f.periodo === "atrasadas" ? "todas" : "atrasadas" })} />
        <NumeroFiltro rotulo="Para hoje" valor={conta("hoje")} ativo={f.periodo === "hoje"} onClick={() => set({ periodo: f.periodo === "hoje" ? "todas" : "hoje" })} />
        <NumeroFiltro rotulo="Esta semana" valor={conta("semana")} ativo={f.periodo === "semana"} onClick={() => set({ periodo: f.periodo === "semana" ? "todas" : "semana" })} />
        <NumeroFiltro rotulo="Próximos 7 dias" valor={conta("prox7")} ativo={f.periodo === "prox7"} onClick={() => set({ periodo: f.periodo === "prox7" ? "todas" : "prox7" })} />
      </div>

      {/* Barra de filtros: uma linha só, cada filtro abre sua lista */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Entrada id="filtro-busca" value={f.busca} onChange={(e) => set({ busca: e.target.value })} placeholder="Buscar tarefa ou cliente" className="!h-8 !pl-8" />
        </div>
        <MenuFiltro
          rotulo="Prazo"
          valor={f.periodo}
          padrao="todas"
          mudar={(id) => set({ periodo: id as Periodo })}
          opcoes={PERIODOS.map((p) => ({ id: p.id, nome: p.nome, dica: p.dica, contador: p.id === "todas" ? undefined : conta(p.id) }))}
        />
        <MenuFiltro
          rotulo="Quem"
          valor={f.resp}
          padrao="todos"
          mudar={(id) => set({ resp: id })}
          opcoes={[
            { id: "todos", nome: "Todos" },
            ...(d.eu ? [{ id: d.eu, nome: "Minhas", antes: <Iniciais nome={d.membro(d.eu)?.nome} /> }] : []),
            ...d.membros.filter((m) => m.id !== d.eu).map((m) => ({ id: m.id, nome: m.nome, antes: <Iniciais nome={m.nome} /> })),
            { id: "sem", nome: "Sem responsável" },
          ]}
        />
        <MenuFiltro
          rotulo="Pilar"
          valor={f.pilar}
          padrao="todos"
          mudar={(id) => set({ pilar: id })}
          opcoes={[{ id: "todos", nome: "Todos" }, ...PILARES.map((p) => ({ id: p, nome: PILAR[p], antes: <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COR_PILAR[p] }} /> }))]}
        />
        <MenuFiltro
          rotulo="Cliente"
          valor={f.cliente}
          padrao="todos"
          buscavel
          mudar={(id) => set({ cliente: id })}
          opcoes={[{ id: "todos", nome: "Todos" }, ...d.clientes.map((c) => ({ id: c.id, nome: c.nome }))]}
        />
        {filtrosAtivos && (
          <button onClick={() => setF({ ...PADRAO, visao: f.visao, agrupar: f.agrupar })} className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] text-muted hover:bg-raised hover:text-fg">
            <X size={13} /> Limpar
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
            {f.visao === "kanban" && (
              <Selecao id="agrupar" aria-label="Agrupar colunas por" value={f.agrupar} onChange={(e) => set({ agrupar: e.target.value as Agrupar })} className="!w-auto">
                <option value="status">Colunas: status</option>
                <option value="responsavel">Colunas: responsável</option>
                <option value="prazo">Colunas: prazo</option>
              </Selecao>
            )}
            <div role="tablist" aria-label="Visualização" className="flex rounded-lg border border-line p-0.5">
              <button role="tab" aria-selected={f.visao === "kanban"} onClick={() => set({ visao: "kanban" })} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] ${f.visao === "kanban" ? "bg-raised font-medium" : "text-muted"}`}>
                <Columns3 size={14} /> Kanban
              </button>
              <button role="tab" aria-selected={f.visao === "lista"} onClick={() => set({ visao: "lista" })} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] ${f.visao === "lista" ? "bg-raised font-medium" : "text-muted"}`}>
                <List size={14} /> Lista
              </button>
            </div>
        </div>
      </div>

      <p className="-mt-1 text-[12.5px] text-muted">
        <span className="num font-medium text-fg">{abertas.length}</span> tarefa{abertas.length === 1 ? "" : "s"} aberta{abertas.length === 1 ? "" : "s"}
        {f.periodo !== "todas" && <> · {PERIODOS.find((p) => p.id === f.periodo)?.dica.toLowerCase()}</>}
      </p>

      {f.visao === "kanban" ? (
        <Kanban abertas={abertas} feitas={f.periodo === "todas" ? feitas : []} agrupar={f.agrupar} abrir={abrir} />
      ) : abertas.length === 0 ? (
        <Vazio>Nenhuma tarefa aberta com esses filtros.</Vazio>
      ) : (
        <Lista tarefas={abertas} abrir={abrir} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Kanban
// ------------------------------------------------------------------
interface Coluna {
  id: string;
  nome: string;
  cor: string;
  tarefas: Tarefa[];
  status?: Status; // quando a coluna é de status, aceita soltar
  responsavel?: string | null;
}

function Kanban({ abertas, feitas, agrupar, abrir }: { abertas: Tarefa[]; feitas: Tarefa[]; agrupar: Agrupar; abrir: (id: string) => void }) {
  const d = useDados();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const h = hoje();

  let colunas: Coluna[];
  if (agrupar === "status") {
    colunas = [
      { id: "a_fazer", nome: STATUS.a_fazer, cor: "var(--muted)", status: "a_fazer", tarefas: abertas.filter((t) => t.status === "a_fazer") },
      { id: "fazendo", nome: STATUS.fazendo, cor: "var(--accent)", status: "fazendo", tarefas: abertas.filter((t) => t.status === "fazendo") },
      { id: "aguardando", nome: STATUS.aguardando, cor: "var(--warn)", status: "aguardando", tarefas: abertas.filter((t) => t.status === "aguardando") },
      { id: "feita", nome: "Feitas (7 dias)", cor: "var(--ok)", status: "feita", tarefas: feitas },
    ];
  } else if (agrupar === "responsavel") {
    colunas = [
      ...d.membros.map((m) => ({ id: m.id, nome: m.nome, cor: "var(--accent)", responsavel: m.id, tarefas: abertas.filter((t) => t.responsavel_id === m.id) })),
      { id: "sem", nome: "Sem responsável", cor: "var(--muted)", responsavel: null, tarefas: abertas.filter((t) => !t.responsavel_id) },
    ].filter((c) => c.tarefas.length > 0 || c.id !== "sem");
  } else {
    const fimSemana = somarDias(h, 6);
    colunas = [
      { id: "atr", nome: "Atrasadas", cor: "var(--bad)", tarefas: abertas.filter((t) => atrasada(t)) },
      { id: "hoje", nome: "Hoje", cor: "var(--accent)", tarefas: abertas.filter((t) => t.prazo === h) },
      { id: "prox", nome: "Próximos 7 dias", cor: "var(--accent)", tarefas: abertas.filter((t) => t.prazo && t.prazo > h && t.prazo <= fimSemana) },
      { id: "depois", nome: "Depois", cor: "var(--muted)", tarefas: abertas.filter((t) => t.prazo && t.prazo > fimSemana) },
      { id: "sem", nome: "Sem prazo", cor: "var(--muted)", tarefas: abertas.filter((t) => !t.prazo) },
    ];
  }

  async function soltar(col: Coluna, e: DragEvent) {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/plain") || arrastando;
    setArrastando(null);
    const t = d.tarefas.find((x) => x.id === id);
    if (!t) return;
    try {
      if (col.status && col.status !== t.status) {
        const cr = d.clienteRotinas.find((c) => c.id === t.cliente_rotina_id);
        const nomeRotina = d.rotinas.find((r) => r.id === cr?.rotina_id)?.nome;
        if (col.status === "feita" && tipoDeRegistro(t, nomeRotina)) {
          d.avisar("Esta tarefa pede o registro rápido. Preencha e clique em Registrar e concluir.");
          abrir(t.id);
          return;
        }
        await repo.salvarTarefa(t.id, { status: col.status });
        await d.recarregar();
        d.avisar(`Movida para ${col.nome}`);
      } else if (col.responsavel !== undefined && col.responsavel !== t.responsavel_id) {
        await repo.salvarTarefa(t.id, { responsavel_id: col.responsavel });
        await d.recarregar();
        d.avisar(col.responsavel ? `Passada para ${col.nome}` : "Ficou sem responsável");
      }
    } catch (err) {
      d.avisar((err as Error).message);
    }
  }

  const aceitaSoltar = (c: Coluna) => c.status !== undefined || c.responsavel !== undefined;

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(260px, 1fr))` }}>
        {colunas.map((c) => (
          <section
            key={c.id}
            onDragOver={(e) => {
              if (!aceitaSoltar(c)) return;
              e.preventDefault();
              setSobre(c.id);
            }}
            onDragLeave={() => setSobre((s) => (s === c.id ? null : s))}
            onDrop={(e) => aceitaSoltar(c) && soltar(c, e)}
            className={`flex min-h-[200px] min-w-0 flex-col gap-2 rounded-2xl p-2.5 transition-colors ${sobre === c.id ? "bg-accent-soft ring-2 ring-accent" : "bg-raised"}`}
          >
            <h2 className="flex items-center gap-2 px-1 text-[13px] font-semibold">
              {agrupar === "responsavel" && c.responsavel ? <Iniciais nome={c.nome} /> : <span className="h-2 w-2 rounded-full" style={{ background: c.cor }} />}
              <span className="truncate">{c.nome}</span>
              <span className="num font-normal text-muted">{c.tarefas.length}</span>
            </h2>
            <div className="flex max-h-[68vh] flex-col gap-2 overflow-y-auto pr-0.5">
              {c.tarefas.map((t) => (
                <div
                  key={t.id}
                  draggable={aceitaSoltar(c)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", t.id);
                    e.dataTransfer.effectAllowed = "move";
                    setArrastando(t.id);
                  }}
                  onDragEnd={() => setArrastando(null)}
                  className={arrastando === t.id ? "opacity-40" : ""}
                >
                  <CartaoTarefa tarefa={t} abrir={abrir} />
                </div>
              ))}
              {c.tarefas.length === 0 && <p className="px-1 py-6 text-center text-[12px] text-muted">{aceitaSoltar(c) ? "Arraste uma tarefa para cá" : "Nada aqui"}</p>}
            </div>
          </section>
        ))}
      </div>
      {agrupar !== "prazo" && <p className="mt-2 text-[12px] text-muted">Arraste os cartões entre as colunas para mudar {agrupar === "status" ? "o status" : "o responsável"}.</p>}
    </div>
  );
}

// ------------------------------------------------------------------
// Lista agrupada por prazo
// ------------------------------------------------------------------
function Lista({ tarefas, abrir }: { tarefas: Tarefa[]; abrir: (id: string) => void }) {
  const h = hoje();
  const fim = somarDias(h, 6);
  const grupos = [
    { nome: "Atrasadas", tarefas: tarefas.filter((t) => atrasada(t)), alerta: true },
    { nome: "Hoje", tarefas: tarefas.filter((t) => t.prazo === h) },
    { nome: "Próximos 7 dias", tarefas: tarefas.filter((t) => t.prazo && t.prazo > h && t.prazo <= fim) },
    { nome: "Depois", tarefas: tarefas.filter((t) => t.prazo && t.prazo > fim) },
    { nome: "Sem prazo", tarefas: tarefas.filter((t) => !t.prazo) },
  ];
  return (
    <div className="flex flex-col gap-5">
      {grupos
        .filter((g) => g.tarefas.length > 0)
        .map((g) => (
          <section key={g.nome} className="flex flex-col gap-2">
            <h2 className={`flex items-center gap-2 text-[13px] font-semibold ${g.alerta ? "text-warn" : ""}`}>
              {g.nome} <span className="num font-normal text-muted">{g.tarefas.length}</span>
            </h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {g.tarefas.map((t) => (
                <CartaoTarefa key={t.id} tarefa={t} abrir={abrir} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

// ------------------------------------------------------------------
function NumeroFiltro({ rotulo, valor, ativo, alerta, onClick }: { rotulo: string; valor: number; ativo: boolean; alerta?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`relative px-4 py-3 text-left ${ativo ? "bg-accent-soft/70" : "hover:bg-raised/50"}`}
    >
      {ativo && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-accent" />}
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        {alerta && <span className="h-1.5 w-1.5 rounded-full bg-bad" />}
        {rotulo}
      </div>
      <div className={`num mt-1 text-[22px] font-semibold leading-none ${alerta ? "text-bad" : ativo ? "text-accent" : ""}`}>{valor}</div>
    </button>
  );
}
