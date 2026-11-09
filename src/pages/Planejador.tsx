import { useMemo, useState, type DragEvent } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { useDados } from "../lib/dados";
import { repo } from "../lib/repo";
import { STATUS_ABERTOS, atrasada, dataCurta, hoje, somarDias, type Tarefa } from "../lib/tipos";
import { PainelTarefa } from "../components/tarefas/PainelTarefa";

const INICIO_H = 8;
const FIM_H = 19;
const PASSO = 30; // minutos por linha
const ALTURA = 22; // px por linha
const JORNADA = 8 * 60; // minutos de trabalho por dia
const META = 0.7; // planejar até ~70% do tempo livre
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"];

const segundaDe = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const dia = (d.getDay() + 6) % 7;
  return somarDias(iso, -dia);
};
const dataLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const duracao = (t: Tarefa) => Math.max(PASSO, Math.min(t.estimativa_min ?? PASSO, (FIM_H - INICIO_H) * 60));
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Planejador: a semana de cada pessoa em grade. Arrastar uma tarefa para um horário reserva o tempo pela estimativa. */
export function Planejador() {
  const d = useDados();
  const [pessoa, setPessoa] = useState<string>(d.eu ?? d.membros[0]?.id ?? "");
  const [semana, setSemana] = useState(segundaDe(hoje()));
  const [aberta, setAberta] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const dias = DIAS.map((_, i) => somarDias(semana, i));
  const fimSemana = somarDias(semana, 4);

  const minhas = d.tarefas.filter((t) => t.responsavel_id === pessoa && STATUS_ABERTOS.includes(t.status) && !t.triagem);
  const planejadas = useMemo(
    () =>
      d.tarefas
        .filter((t) => t.responsavel_id === pessoa && t.planejado_inicio)
        .map((t) => {
          const ini = new Date(t.planejado_inicio!);
          return { t, dia: dataLocal(ini), min: ini.getHours() * 60 + ini.getMinutes() };
        })
        .filter((x) => x.dia >= semana && x.dia <= fimSemana),
    [d.tarefas, pessoa, semana, fimSemana],
  );
  const idsPlanejadas = new Set(planejadas.map((p) => p.t.id));
  const paraPlanejar = minhas
    .filter((t) => !idsPlanejadas.has(t.id) && (!t.planejado_inicio || dataLocal(new Date(t.planejado_inicio)) < hoje()))
    .sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));

  async function planejar(id: string, dia: string | null, min = 0) {
    const quando = dia ? new Date(`${dia}T${hhmm(min)}:00`).toISOString() : null;
    try {
      await repo.salvarTarefa(id, { planejado_inicio: quando });
      await d.recarregar();
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }
  function soltar(e: DragEvent, dia: string) {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/tarefa");
    if (!id) return;
    const caixa = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const linha = Math.max(0, Math.floor((e.clientY - caixa.top) / ALTURA));
    let min = INICIO_H * 60 + Math.min(linha, ((FIM_H - INICIO_H) * 60) / PASSO - 1) * PASSO;
    // Não sobrepõe: se o horário já está ocupado, encaixa logo depois do bloco que está ali
    const tarefa = d.tarefas.find((t) => t.id === id);
    const dur = tarefa ? duracao(tarefa) : PASSO;
    const outros = planejadas.filter((p) => p.dia === dia && p.t.id !== id).sort((a, b) => a.min - b.min);
    for (const o of outros) if (min < o.min + duracao(o.t) && min + dur > o.min) min = o.min + duracao(o.t);
    planejar(id, dia, Math.min(min, FIM_H * 60 - PASSO));
  }
  const arrastar = (e: DragEvent, id: string) => {
    e.dataTransfer.setData("text/tarefa", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const linhas = ((FIM_H - INICIO_H) * 60) / PASSO;
  const nomeCli = (t: Tarefa) => d.cliente(t.cliente_id)?.nome ?? "";
  const totalSemana = planejadas.reduce((s, p) => s + duracao(p.t), 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[22px] font-semibold"><CalendarRange size={20} className="text-accent" /> Planejador</h1>
          <p className="text-[13px] text-muted">Arraste as tarefas para um horário. O bloco ocupa o tempo da estimativa; a meta é planejar até {Math.round(META * 100)}% do dia.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} className="h-9 rounded-xl border border-line bg-surface px-3 text-[13px]">
            {d.membros.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.id === d.eu ? " (eu)" : ""}</option>)}
          </select>
          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
            <button onClick={() => setSemana(somarDias(semana, -7))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-raised" aria-label="Semana anterior"><ChevronLeft size={15} /></button>
            <button onClick={() => setSemana(segundaDe(hoje()))} className="px-2 text-[12.5px] font-medium">{dataCurta(semana)} – {dataCurta(fimSemana)}</button>
            <button onClick={() => setSemana(somarDias(semana, 7))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-raised" aria-label="Próxima semana"><ChevronRight size={15} /></button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          className="flex max-h-[calc(100dvh-220px)] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-line bg-surface p-3 lg:sticky lg:top-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/tarefa"); if (id) planejar(id, null); }}
        >
          <div className="flex items-center justify-between px-1">
            <b className="text-[13px]">Para planejar</b>
            <span className="num text-[12px] text-muted">{paraPlanejar.length}</span>
          </div>
          <p className="px-1 text-[11.5px] text-muted">Arraste para a grade. Solte aqui para tirar do planejamento.</p>
          {paraPlanejar.length === 0 && <p className="px-1 py-4 text-center text-[12.5px] text-muted">Tudo planejado 🎯</p>}
          {paraPlanejar.map((t) => (
            <div key={t.id} draggable onDragStart={(e) => arrastar(e, t.id)} onClick={() => setAberta(t.id)} className="group flex cursor-grab items-start gap-1.5 rounded-xl border border-line bg-bg px-2 py-1.5 text-[12.5px] hover:border-accent active:cursor-grabbing">
              <GripVertical size={13} className="mt-0.5 shrink-0 text-muted/60" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{t.titulo}</div>
                <div className="flex gap-1.5 text-[11px] text-muted">
                  <span className="truncate">{nomeCli(t)}</span>
                  <span className={`ml-auto shrink-0 ${atrasada(t) ? "text-bad" : ""}`}>{t.prazo ? dataCurta(t.prazo) : "sem prazo"}</span>
                  <span className="shrink-0">· {t.estimativa_min ?? PASSO}min</span>
                </div>
              </div>
            </div>
          ))}
        </aside>

        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `48px repeat(5, minmax(0, 1fr))` }}>
            <div className="border-b border-line" />
            {dias.map((dia, i) => {
              const usado = planejadas.filter((p) => p.dia === dia).reduce((s, p) => s + duracao(p.t), 0);
              const limite = JORNADA * META;
              const pct = Math.min(100, (usado / limite) * 100);
              const vence = minhas.filter((t) => t.prazo === dia && !planejadas.some((p) => p.t.id === t.id)).length;
              return (
                <div key={dia} className={`border-b border-l border-line px-2 py-1.5 ${dia === hoje() ? "bg-accent-soft/50" : ""}`}>
                  <div className="flex items-baseline gap-1.5 text-[12.5px]">
                    <b className={dia === hoje() ? "text-accent" : ""}>{DIAS[i]}</b>
                    <span className="num text-muted">{dataCurta(dia)}</span>
                    {vence > 0 && <span className="ml-auto rounded-full bg-warn-soft px-1.5 text-[10.5px] text-warn" title="Vencem neste dia e não estão na grade">{vence} vence{vence > 1 ? "m" : ""}</span>}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised" title={`${Math.round(usado / 6) / 10}h planejadas de ${Math.round(limite / 6) / 10}h`}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: usado > limite ? "var(--bad)" : usado > limite * 0.85 ? "var(--warn)" : "rgb(var(--accent-c))" }} />
                  </div>
                  <div className={`mt-0.5 text-[10.5px] ${usado > limite ? "text-bad" : "text-muted"}`}>{Math.round(usado / 6) / 10}h de {Math.round(limite / 6) / 10}h{usado > limite ? " · não cabe" : ""}</div>
                </div>
              );
            })}

            <div className="relative">
              {Array.from({ length: linhas }, (_, i) => (
                <div key={i} className="pr-1 text-right text-[10.5px] text-muted" style={{ height: ALTURA }}>{i % 2 === 0 ? `${INICIO_H + i / 2}h` : ""}</div>
              ))}
            </div>
            {dias.map((dia) => (
              <div
                key={dia}
                onDragOver={(e) => { e.preventDefault(); setSobre(dia); }}
                onDragLeave={() => setSobre((s) => (s === dia ? null : s))}
                onDrop={(e) => soltar(e, dia)}
                className={`relative border-l border-line ${sobre === dia ? "bg-accent-soft/40" : ""}`}
                style={{ height: linhas * ALTURA }}
              >
                {Array.from({ length: linhas }, (_, i) => (
                  <div key={i} className={`absolute inset-x-0 ${i % 2 === 0 ? "border-t border-line/70" : "border-t border-dashed border-line/40"}`} style={{ top: i * ALTURA }} />
                ))}
                {dia === hoje() && (() => {
                  const agora = new Date();
                  const m = agora.getHours() * 60 + agora.getMinutes() - INICIO_H * 60;
                  return m > 0 && m < (FIM_H - INICIO_H) * 60 ? <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-bad" style={{ top: (m / PASSO) * ALTURA }} /> : null;
                })()}
                {planejadas.filter((p) => p.dia === dia).map(({ t, min }) => {
                  const top = ((min - INICIO_H * 60) / PASSO) * ALTURA;
                  const h = (duracao(t) / PASSO) * ALTURA - 2;
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => arrastar(e, t.id)}
                      onClick={() => setAberta(t.id)}
                      className={`group absolute inset-x-1 z-20 cursor-grab overflow-hidden rounded-lg border px-1.5 py-0.5 text-[11.5px] leading-tight active:cursor-grabbing ${atrasada(t) ? "border-bad/40 bg-bad-soft" : "border-accent/30 bg-accent-soft"}`}
                      style={{ top: Math.max(0, top) + 1, height: Math.max(ALTURA - 2, h) }}
                      title={`${t.titulo} · ${hhmm(min)}–${hhmm(min + duracao(t))}`}
                    >
                      <div className="flex items-start gap-1">
                        <span className="min-w-0 flex-1 truncate font-medium">{t.titulo}</span>
                        <button onClick={(e) => { e.stopPropagation(); planejar(t.id, null); }} className="hidden shrink-0 text-muted hover:text-fg group-hover:block" aria-label="Tirar do planejamento"><X size={11} /></button>
                      </div>
                      {h > ALTURA && <div className="truncate text-[10.5px] text-muted">{hhmm(min)} · {nomeCli(t)}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 border-t border-line px-3 py-2 text-[12px] text-muted">
            <span>Planejado na semana: <b className="text-fg">{Math.round(totalSemana / 6) / 10}h</b> de {Math.round((JORNADA * META * 5) / 6) / 10}h</span>
            <span>Abertas sem horário: <b className="text-fg">{paraPlanejar.length}</b></span>
            <span>Sem estimativa usam {PASSO} min.</span>
          </div>
        </div>
      </div>
      <PainelTarefa id={aberta} fechar={() => setAberta(null)} />
    </div>
  );
}
