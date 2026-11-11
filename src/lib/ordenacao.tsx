import { useEffect, useState } from "react";
import { ArrowDownWideNarrow, CalendarClock, Flag } from "lucide-react";
import { ORDEM_PRIORIDADE, STATUS_ABERTOS, hoje, type Tarefa } from "./tipos";

export type Ordem = "data" | "prioridade";

/** Horário da tarefa (HH:MM) quando ela tem horário marcado no dia do prazo. */
export function horaDaTarefa(t: Pick<Tarefa, "planejado_inicio" | "prazo">): string | null {
  if (!t.planejado_inicio) return null;
  const d = new Date(t.planejado_inicio);
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (t.prazo && t.prazo !== dia) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Data + HH:MM (hora local) → ISO para planejado_inicio. */
export const inicioEm = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00`).toISOString();

const chaveData = (t: Tarefa, h: string) => {
  const aberta = STATUS_ABERTOS.includes(t.status);
  // 0 = atrasada, 1 = hoje em diante, 2 = sem data, 3 = fechada
  const grupo = !aberta ? 3 : !t.prazo ? 2 : t.prazo < h ? 0 : 1;
  return { grupo, prazo: t.prazo ?? "9999-99-99", hora: horaDaTarefa(t) ?? "99:99" };
};

/** Data: atrasadas primeiro (da mais antiga), depois as mais próximas até as mais distantes, sem data e fechadas no fim.
 *  Prioridade: urgente → baixa e, dentro da mesma prioridade, pela data. */
export function comparador(ordem: Ordem) {
  const h = hoje();
  const porData = (a: Tarefa, b: Tarefa) => {
    const x = chaveData(a, h), y = chaveData(b, h);
    return x.grupo - y.grupo || x.prazo.localeCompare(y.prazo) || x.hora.localeCompare(y.hora) || ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade];
  };
  if (ordem === "data") return porData;
  return (a: Tarefa, b: Tarefa) => {
    const fa = STATUS_ABERTOS.includes(a.status) ? 0 : 1, fb = STATUS_ABERTOS.includes(b.status) ? 0 : 1;
    return fa - fb || ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade] || porData(a, b);
  };
}

/** Ordem escolhida, lembrada por tela. */
export function useOrdem(chave: string, padrao: Ordem = "data") {
  const k = `vertente.ordem.${chave}`;
  const [ordem, setOrdem] = useState<Ordem>(() => { try { return (localStorage.getItem(k) as Ordem) || padrao; } catch { return padrao; } });
  useEffect(() => { try { localStorage.setItem(k, ordem); } catch { /* sem armazenamento */ } }, [k, ordem]);
  return [ordem, setOrdem] as const;
}

/** Controle compacto "Ordenar: Data | Prioridade". */
export function SeletorOrdem({ ordem, mudar }: { ordem: Ordem; mudar: (o: Ordem) => void }) {
  const botao = (o: Ordem, rotulo: string, Icone: typeof Flag, dica: string) => (
    <button role="tab" aria-selected={ordem === o} onClick={() => mudar(o)} title={dica}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] ${ordem === o ? "bg-raised font-medium text-fg" : "text-muted hover:text-fg"}`}>
      <Icone size={13} /> {rotulo}
    </button>
  );
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-1 text-[12px] text-muted"><ArrowDownWideNarrow size={13} /> Ordenar</span>
      <div role="tablist" aria-label="Ordenar tarefas" className="flex rounded-lg border border-line p-0.5">
        {botao("data", "Data", CalendarClock, "Atrasadas primeiro, depois as datas mais próximas")}
        {botao("prioridade", "Prioridade", Flag, "Urgente → baixa")}
      </div>
    </div>
  );
}
