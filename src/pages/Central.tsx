import { ArrowRight } from "lucide-react";
import { FASES, FASE_ATUAL, GRUPOS, MODULOS } from "../data/modulos";
import { CLIENTES } from "../data/clientes";
import { FaseChip } from "../components/FaseChip";

export function Central({ ir }: { ir: (r: string) => void }) {
  const marcas = new Set(CLIENTES.map((c) => c.grupo ?? c.nome)).size;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">Central de operação</div>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[32px]">Toda a operação da Vertente num só lugar</h1>
          <p className="mt-2 max-w-[62ch] text-muted">
            Escolha uma área. Cada uma é construída em fases, na ordem de prioridade da agência.
          </p>
        </div>
        <button
          onClick={() => ir("base")}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-accent"
        >
          <span className="num text-[26px] font-medium leading-none">{CLIENTES.length}</span>
          <span className="text-[12.5px] leading-tight text-muted">
            contas na base
            <br />
            {marcas} marcas
          </span>
        </button>
      </header>

      {/* Trilha de construção: as fases são uma sequência real */}
      <section aria-labelledby="titulo-fases" className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-fases" className="text-[15px] font-semibold">Construção do sistema</h2>
          <span className="text-[12.5px] text-muted">
            Agora: <strong className="text-fg">Fase {FASE_ATUAL} · {FASES[FASE_ATUAL].nome}</strong>
          </span>
        </div>
        <div className="mt-4 overflow-x-auto pb-1">
          <ol className="grid min-w-[760px] grid-cols-8 gap-1.5">
            {FASES.map((f) => {
              const estado = f.numero < FASE_ATUAL ? "feita" : f.numero === FASE_ATUAL ? "atual" : "depois";
              return (
                <li key={f.numero} className="flex flex-col gap-2">
                  <div
                    className={`h-1.5 rounded-full ${
                      estado === "atual" ? "bg-accent" : estado === "feita" ? "bg-ok" : "bg-raised"
                    }`}
                  />
                  <div className="num text-[11px] text-muted">Fase {f.numero}</div>
                  <div className={`text-[12.5px] leading-snug ${estado === "atual" ? "font-semibold" : ""}`}>{f.nome}</div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {GRUPOS.map((g) => {
        const itens = MODULOS.filter((m) => m.grupo === g.id);
        const futuro = g.id === "futuro";
        return (
          <section key={g.id} aria-labelledby={`grupo-${g.id}`} className="flex flex-col gap-3">
            <h2 id={`grupo-${g.id}`} className="eyebrow">
              {g.nome}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {itens.map((m) => {
                const Icone = m.icone;
                return (
                  <button
                    key={m.id}
                    onClick={() => ir(m.id)}
                    className={`group flex flex-col gap-3 rounded-xl border p-4 text-left transition-colors ${
                      futuro
                        ? "border-dashed border-line bg-transparent hover:bg-surface"
                        : "border-line bg-surface hover:border-accent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-lg ${
                          futuro ? "bg-raised text-muted" : "bg-accent-soft text-accent"
                        }`}
                      >
                        <Icone size={18} />
                      </span>
                      <FaseChip fase={m.fase} />
                    </div>
                    <div>
                      <div className="font-display text-[16px] font-semibold">{m.nome}</div>
                      <p className="mt-1 text-[13px] leading-snug text-muted">{m.resumo}</p>
                    </div>
                    {!futuro && (
                      <span className="mt-auto flex items-center gap-1 text-[12.5px] font-medium text-accent">
                        Abrir <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
