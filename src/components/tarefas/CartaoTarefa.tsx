import { CalendarDays, CheckSquare, Repeat } from "lucide-react";
import { useDados } from "../../lib/dados";
import { CANAL, STATUS, atrasada, dataCurta, type Tarefa } from "../../lib/tipos";
import { COR_PILAR, Iniciais, MarcaPrioridade, SeloStatus } from "../ui";

export function CartaoTarefa({ tarefa: t, abrir, mostrarCliente = true }: { tarefa: Tarefa; abrir: (id: string) => void; mostrarCliente?: boolean }) {
  const { cliente, membro } = useDados();
  const atraso = atrasada(t);
  const fechada = t.status === "feita" || t.status === "nao_feita";
  return (
    <button
      onClick={() => abrir(t.id)}
      className={`group flex w-full flex-col gap-2 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent ${fechada ? "opacity-60" : ""}`}
      style={{ borderLeft: `3px solid ${COR_PILAR[t.pilar]}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {mostrarCliente && <div className="truncate text-[11.5px] text-muted">{cliente(t.cliente_id)?.nome ?? "Cliente"}</div>}
          <div className={`text-[13.5px] font-medium leading-snug ${fechada ? "line-through" : ""}`}>{t.titulo}</div>
        </div>
        <Iniciais nome={membro(t.responsavel_id)?.nome} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
        <SeloStatus status={t.status} texto={STATUS[t.status]} />
        <MarcaPrioridade prioridade={t.prioridade} />
        {t.canal && <span className="rounded bg-raised px-1.5 py-px text-muted">{CANAL[t.canal]}</span>}
        {t.cliente_rotina_id && (
          <span className="flex items-center gap-1 text-muted" title="Rotina">
            <Repeat size={12} />
          </span>
        )}
        {t.checklist_total > 0 && (
          <span className="num flex items-center gap-1 text-muted">
            <CheckSquare size={12} />
            {t.checklist_feitos}/{t.checklist_total}
          </span>
        )}
        <span className={`num ml-auto flex items-center gap-1 ${atraso ? "font-semibold text-warn" : "text-muted"}`}>
          <CalendarDays size={12} />
          {dataCurta(t.prazo)}
        </span>
      </div>
    </button>
  );
}
