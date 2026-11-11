import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as PE } from "react";
import { CalendarCheck2, CalendarRange, ChevronLeft, ChevronRight, GripVertical, Inbox, Link2, Loader2, X } from "lucide-react";
import { useDados } from "../lib/dados";
import { repo } from "../lib/repo";
import { supabase } from "../lib/supabase";
import { chamarFuncao } from "../lib/tabela";
import { STATUS_ABERTOS, dataCurta, hoje, somarDias, type Tarefa } from "../lib/tipos";
import { PainelTarefa } from "../components/tarefas/PainelTarefa";

const INICIO_H = 7;
const FIM_H = 20;
const PASSO = 15; // minutos por linha
const ALTURA = 12; // px por linha de 15 min (48px por hora)
const JORNADA = 8 * 60;
const META = 0.7;
const NOMES_DIA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface Evento { id: string; titulo: string; inicio: string; fim: string; dia_todo: boolean; link: string | null }

const segundaDe = (iso: string) => somarDias(iso, -((new Date(`${iso}T12:00:00`).getDay() + 6) % 7));
const dataLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const minutosDe = (d: Date) => d.getHours() * 60 + d.getMinutes();
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const duracaoTxt = (m: number) => (m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);
const est = (t: Tarefa) => Math.max(PASSO, t.estimativa_min ?? 30);

/** Planejador no modelo do ClickUp: tarefas com data já aparecem no dia, sem data ficam na caixa ao lado; arrastar, mudar a duração e ver a Google Agenda. */
export function Planejador() {
  const d = useDados();
  const [pessoa, setPessoa] = useState<string>(d.eu ?? d.membros[0]?.id ?? "");
  const [semana, setSemana] = useState(segundaDe(hoje()));
  const [fds, setFds] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [duracoes, setDuracoes] = useState<Record<string, number>>({}); // ajuste ao vivo enquanto arrasta a borda
  const dias = Array.from({ length: fds ? 7 : 5 }, (_, i) => somarDias(semana, i));
  const fimSemana = dias[dias.length - 1];
  const agenda = useAgenda(pessoa, semana, somarDias(semana, 6), pessoa === d.eu);

  // Volta da conexão com o Google
  useEffect(() => {
    const m = location.hash.match(/agenda=([a-z_]+)/);
    if (!m) return;
    const msg: Record<string, string> = { ok: "Google Agenda conectada.", recusado: "Conexão com a agenda cancelada.", expirado: "O link de conexão expirou. Tente de novo.", sem_refresh: "O Google não liberou o acesso contínuo. Tente de novo.", erro: "Não consegui guardar a conexão." };
    d.avisar(msg[m[1]] ?? "Agenda: retorno desconhecido.");
    history.replaceState(null, "", "#planejador");
    agenda.recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minhas = d.tarefas.filter((t) => t.responsavel_id === pessoa && !t.triagem);
  const abertas = minhas.filter((t) => STATUS_ABERTOS.includes(t.status));
  const plano = (t: Tarefa) => {
    if (!t.planejado_inicio) return null;
    const ini = new Date(t.planejado_inicio);
    return { dia: dataLocal(ini), min: minutosDe(ini) };
  };
  const naGrade = minhas.filter((t) => { const p = plano(t); return p && p.dia >= semana && p.dia <= fimSemana && (STATUS_ABERTOS.includes(t.status) || t.status === "feita"); });
  const idsGrade = new Set(naGrade.map((t) => t.id));
  const doDia = (dia: string) => abertas.filter((t) => t.prazo === dia && !idsGrade.has(t.id));
  const semData = abertas.filter((t) => !t.prazo && !t.planejado_inicio).sort((a, b) => a.titulo.localeCompare(b.titulo));
  const atrasadas = abertas.filter((t) => t.prazo && t.prazo < semana && !(plano(t) && plano(t)!.dia >= semana)).sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""));
  const duracao = (t: Tarefa) => duracoes[t.id] ?? est(t);

  const eventosDia = (dia: string) =>
    agenda.eventos
      .filter((e) => !e.dia_todo && dataLocal(new Date(e.inicio)) === dia)
      .map((e) => { const a = new Date(e.inicio); const b = new Date(e.fim); return { e, min: minutosDe(a), dur: Math.max(15, Math.round((b.getTime() - a.getTime()) / 60000)) }; });
  const eventosDiaTodo = (dia: string) => agenda.eventos.filter((e) => e.dia_todo && e.inicio.slice(0, 10) <= dia && e.fim.slice(0, 10) > dia);

  async function salvar(id: string, campos: Parameters<typeof repo.salvarTarefa>[1], aviso?: string) {
    try {
      await repo.salvarTarefa(id, campos);
      await d.recarregar();
      if (aviso) d.avisar(aviso);
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  /** Solta na grade: encaixa sem sobrepor tarefas nem compromissos da agenda. */
  function soltarGrade(e: DragEvent, dia: string) {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/tarefa");
    const t = d.tarefas.find((x) => x.id === id);
    if (!t) return;
    const caixa = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let min = INICIO_H * 60 + Math.max(0, Math.floor((e.clientY - caixa.top) / ALTURA)) * PASSO;
    const dur = duracao(t);
    const ocupados = [
      ...naGrade.filter((x) => x.id !== id && plano(x)!.dia === dia).map((x) => ({ min: plano(x)!.min, dur: duracao(x) })),
      ...eventosDia(dia).map((x) => ({ min: x.min, dur: x.dur })),
    ].sort((a, b) => a.min - b.min);
    for (const o of ocupados) if (min < o.min + o.dur && min + dur > o.min) min = o.min + o.dur;
    min = Math.min(min, FIM_H * 60 - PASSO);
    const quando = new Date(`${dia}T${hhmm(min)}:00`).toISOString();
    salvar(id, { planejado_inicio: quando, ...(t.prazo ? {} : { prazo: dia }) });
  }
  function soltarDia(e: DragEvent, dia: string) {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/tarefa");
    if (id) salvar(id, { prazo: dia, planejado_inicio: null });
  }
  function soltarCaixa(e: DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/tarefa");
    if (id) salvar(id, { prazo: null, planejado_inicio: null }, "Tarefa voltou para Sem data");
  }
  const arrastar = (e: DragEvent, id: string) => {
    e.dataTransfer.setData("text/tarefa", id);
    e.dataTransfer.effectAllowed = "move";
  };

  /** Arrastar a borda de baixo muda a estimativa (de 15 em 15 minutos). */
  function redimensionar(e: PE, t: Tarefa) {
    e.preventDefault();
    e.stopPropagation();
    const y0 = e.clientY;
    const base = est(t);
    const mover = (ev: PointerEvent) => setDuracoes((x) => ({ ...x, [t.id]: Math.max(PASSO, base + Math.round((ev.clientY - y0) / ALTURA) * PASSO) }));
    const soltar = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      const nova = Math.max(PASSO, base + Math.round((ev.clientY - y0) / ALTURA) * PASSO);
      if (nova !== base) salvar(t.id, { estimativa_min: nova }).then(() => setDuracoes((x) => { const y = { ...x }; delete y[t.id]; return y; }));
      else setDuracoes((x) => { const y = { ...x }; delete y[t.id]; return y; });
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  }

  const linhas = ((FIM_H - INICIO_H) * 60) / PASSO;
  const nomeCli = (t: Tarefa) => d.cliente(t.cliente_id)?.nome ?? "";
  const hojeISO = hoje();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[22px] font-semibold"><CalendarRange size={20} className="text-accent" /> Planejador</h1>
          <p className="text-[13px] text-muted">Tarefas com data já aparecem no dia; arraste para um horário. Puxe a borda de baixo do bloco para mudar o tempo estimado.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pessoa === d.eu && <BotaoAgenda agenda={agenda} />}
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} className="h-9 rounded-xl border border-line bg-surface px-3 text-[13px]">
            {d.membros.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.id === d.eu ? " (eu)" : ""}</option>)}
          </select>
          <label className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[12.5px] text-muted"><input type="checkbox" checked={fds} onChange={(e) => setFds(e.target.checked)} /> Fim de semana</label>
          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
            <button onClick={() => setSemana(somarDias(semana, -7))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-raised" aria-label="Semana anterior"><ChevronLeft size={15} /></button>
            <button onClick={() => setSemana(segundaDe(hoje()))} className="px-2 text-[12.5px] font-medium">{dataCurta(semana)} – {dataCurta(fimSemana)}</button>
            <button onClick={() => setSemana(somarDias(semana, 7))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-raised" aria-label="Próxima semana"><ChevronRight size={15} /></button>
          </div>
        </div>
      </header>
      {agenda.erro && <p className="rounded-xl border border-warn bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Google Agenda: {agenda.erro}</p>}

      {(() => {
        // Indicadores da semana da pessoa
        const feitas = minhas.filter((t) => t.status === "feita" && t.concluida_em && dataLocal(new Date(t.concluida_em)) >= semana && dataLocal(new Date(t.concluida_em)) <= fimSemana);
        const previstas = minhas.filter((t) => (t.prazo && t.prazo >= semana && t.prazo <= fimSemana) || idsGrade.has(t.id));
        const planejadoMin = naGrade.reduce((s, t) => s + duracao(t), 0);
        const reunioesMin = dias.reduce((s, dia) => s + eventosDia(dia).reduce((x, e) => x + e.dur, 0), 0);
        const capacidade = dias.filter((dia) => !["0", "6"].includes(String(new Date(`${dia}T12:00:00Z`).getUTCDay()))).length * JORNADA * META - reunioesMin * META;
        const comTempo = feitas.filter((t) => t.estimativa_min && t.tempo_min);
        const estSoma = comTempo.reduce((s, t) => s + (t.estimativa_min ?? 0), 0), realSoma = comTempo.reduce((s, t) => s + (t.tempo_min ?? 0), 0);
        const desvio = estSoma ? (realSoma - estSoma) / estSoma : null;
        const porPilar = new Map<string, number>();
        for (const t of feitas) porPilar.set(t.pilar, (porPilar.get(t.pilar) ?? 0) + (t.tempo_min || t.estimativa_min || 0));
        const totalPilar = [...porPilar.values()].reduce((s, v) => s + v, 0);
        const NOME_P: Record<string, string> = { trafego: "Tráfego", social: "Social", gmn: "GMN", cs: "CS", interno: "Interno" };
        const COR_P: Record<string, string> = { trafego: "#3b6fe0", social: "#c2508a", gmn: "#2ba58b", cs: "#e07a3b", interno: "#8a63d2" };
        const cel = "flex flex-col gap-0.5 px-4 py-3";
        return (
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-5">
            <div className={cel}><span className="text-[11.5px] text-muted">Concluídas na semana</span><span className="num text-[18px] font-semibold">{feitas.length}<span className="text-[13px] font-normal text-muted"> / {previstas.length} previstas</span></span></div>
            <div className={`${cel} border-l border-line`}><span className="text-[11.5px] text-muted">Planejado na grade</span><span className="num text-[18px] font-semibold">{duracaoTxt(planejadoMin)}<span className="text-[13px] font-normal text-muted"> de {duracaoTxt(Math.max(0, Math.round(capacidade)))}</span></span></div>
            <div className={`${cel} border-t border-line md:border-l md:border-t-0`}><span className="text-[11.5px] text-muted">Reuniões na agenda</span><span className="num text-[18px] font-semibold">{duracaoTxt(reunioesMin)}</span></div>
            <div className={`${cel} border-l border-t border-line md:border-t-0`}><span className="text-[11.5px] text-muted">Estimado x real</span><span className={`num text-[18px] font-semibold ${desvio === null ? "" : Math.abs(desvio) <= 0.15 ? "text-ok" : "text-warn"}`}>{desvio === null ? "—" : `${desvio > 0 ? "+" : ""}${Math.round(desvio * 100)}%`}</span><span className="text-[11px] text-muted">{desvio === null ? "sem tempo medido" : `${duracaoTxt(estSoma)} → ${duracaoTxt(realSoma)}`}</span></div>
            <div className={`${cel} col-span-2 border-t border-line md:col-span-1 md:border-l md:border-t-0`}>
              <span className="text-[11.5px] text-muted">Tempo por pilar</span>
              {totalPilar ? (
                <>
                  <div className="mt-1 flex h-2 overflow-hidden rounded-full">{[...porPilar.entries()].map(([k, v]) => <span key={k} title={`${NOME_P[k] ?? k}: ${duracaoTxt(v)}`} style={{ width: `${(v / totalPilar) * 100}%`, background: COR_P[k] ?? "#a3a8b4" }} />)}</div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted">{[...porPilar.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => <span key={k}>{NOME_P[k] ?? k} {Math.round((v / totalPilar) * 100)}%</span>)}</div>
                </>
              ) : <span className="text-[12px] text-muted">nada concluído ainda</span>}
            </div>
          </div>
        );
      })()}

      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="flex max-h-[calc(100dvh-200px)] flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-surface p-3 lg:sticky lg:top-4" onDragOver={(e) => e.preventDefault()} onDrop={soltarCaixa}>
          <div>
            <div className="flex items-center gap-1.5 px-1"><Inbox size={14} className="text-muted" /><b className="text-[13px]">Sem data</b><span className="num ml-auto text-[12px] text-muted">{semData.length}</span></div>
            <p className="px-1 text-[11.5px] text-muted">Arraste para um dia ou horário. Solte aqui para tirar a data.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {semData.length === 0 && <p className="px-1 py-2 text-center text-[12px] text-muted">Nada sem data 🎯</p>}
            {semData.map((t) => <ItemLateral key={t.id} t={t} cliente={nomeCli(t)} arrastar={arrastar} abrir={() => setAberta(t.id)} />)}
          </div>
          {atrasadas.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-line pt-3">
              <div className="flex items-center gap-1.5 px-1"><b className="text-[13px] text-bad">Atrasadas</b><span className="num ml-auto text-[12px] text-muted">{atrasadas.length}</span></div>
              {atrasadas.map((t) => <ItemLateral key={t.id} t={t} cliente={nomeCli(t)} arrastar={arrastar} abrir={() => setAberta(t.id)} atrasada />)}
            </div>
          )}
        </aside>

        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <div className="grid" style={{ gridTemplateColumns: `52px repeat(${dias.length}, minmax(${fds ? 120 : 150}px, 1fr))` }}>
            {/* Cabeçalho com capacidade */}
            <div className="sticky top-0 z-30 border-b border-line bg-surface" />
            {dias.map((dia, i) => {
              const tarefasMin = naGrade.filter((t) => plano(t)!.dia === dia && t.status !== "feita").reduce((s, t) => s + duracao(t), 0) + doDia(dia).reduce((s, t) => s + est(t), 0);
              const reunioes = eventosDia(dia).reduce((s, x) => s + x.dur, 0);
              const livre = Math.max(0, JORNADA - reunioes);
              const limite = livre * META;
              const pct = limite ? Math.min(100, (tarefasMin / limite) * 100) : 100;
              const estoura = tarefasMin > limite;
              return (
                <div key={dia} className={`sticky top-0 z-30 border-b border-l border-line px-2 py-1.5 ${dia === hojeISO ? "bg-accent-soft" : "bg-surface"}`}>
                  <div className="flex items-baseline gap-1.5 text-[12.5px]"><b className={dia === hojeISO ? "text-accent" : ""}>{NOMES_DIA[i]}</b><span className="num text-muted">{dataCurta(dia)}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised" title={`Tarefas ${duracaoTxt(tarefasMin)} · reuniões ${duracaoTxt(reunioes)} · cabe até ${duracaoTxt(Math.round(limite))}`}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: estoura ? "var(--bad)" : pct > 85 ? "var(--warn)" : "rgb(var(--accent-c))" }} />
                  </div>
                  <div className={`mt-0.5 text-[10.5px] ${estoura ? "text-bad" : "text-muted"}`}>{duracaoTxt(tarefasMin)} de {duracaoTxt(Math.round(limite))}{reunioes ? ` · ${duracaoTxt(reunioes)} reuniões` : ""}</div>
                </div>
              );
            })}

            {/* Faixa do dia: tarefas com data sem horário + compromissos de dia inteiro */}
            <div className="border-b border-line px-1 py-1.5 text-right text-[10px] leading-tight text-muted">no dia</div>
            {dias.map((dia) => (
              <div key={dia} onDragOver={(e) => { e.preventDefault(); setSobre(`d${dia}`); }} onDragLeave={() => setSobre(null)} onDrop={(e) => soltarDia(e, dia)} className={`flex min-h-[44px] flex-col gap-1 border-b border-l border-line p-1 ${sobre === `d${dia}` ? "bg-accent-soft/50" : ""}`}>
                {eventosDiaTodo(dia).map((e) => <div key={e.id} className="truncate rounded-md bg-raised px-1.5 py-0.5 text-[11px] text-muted" title={e.titulo}><CalendarCheck2 size={10} className="mr-1 inline" />{e.titulo}</div>)}
                {doDia(dia).map((t) => (
                  <div key={t.id} draggable onDragStart={(e) => arrastar(e, t.id)} onClick={() => setAberta(t.id)} className={`cursor-grab truncate rounded-md border px-1.5 py-0.5 text-[11.5px] active:cursor-grabbing ${t.prazo! < hojeISO ? "border-bad/40 bg-bad-soft" : "border-line bg-bg hover:border-accent"}`} title={`${t.titulo} · ${nomeCli(t)} · ${duracaoTxt(est(t))}`}>
                    {t.titulo} <span className="text-muted">· {duracaoTxt(est(t))}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* Grade de horários */}
            <div className="relative">
              {Array.from({ length: linhas }, (_, i) => <div key={i} className="pr-1 text-right text-[10.5px] text-muted" style={{ height: ALTURA }}>{i % 4 === 0 ? `${INICIO_H + i / 4}h` : ""}</div>)}
            </div>
            {dias.map((dia) => (
              <div key={dia} onDragOver={(e) => { e.preventDefault(); setSobre(dia); }} onDragLeave={() => setSobre((s) => (s === dia ? null : s))} onDrop={(e) => soltarGrade(e, dia)} className={`relative border-l border-line ${sobre === dia ? "bg-accent-soft/30" : ""}`} style={{ height: linhas * ALTURA }}>
                {Array.from({ length: linhas / 2 }, (_, i) => <div key={i} className={`absolute inset-x-0 ${i % 2 === 0 ? "border-t border-line/70" : "border-t border-dashed border-line/40"}`} style={{ top: i * ALTURA * 2 }} />)}
                {dia === hojeISO && (() => { const m = minutosDe(new Date()) - INICIO_H * 60; return m > 0 && m < (FIM_H - INICIO_H) * 60 ? <div className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-bad" style={{ top: (m / PASSO) * ALTURA }} /> : null; })()}
                {eventosDia(dia).map(({ e, min, dur }) => (
                  <a key={e.id} href={e.link ?? undefined} target="_blank" rel="noreferrer" className="absolute inset-x-1 z-10 overflow-hidden rounded-lg border border-line px-1.5 py-0.5 text-[11px] leading-tight text-muted" style={{ top: Math.max(0, ((min - INICIO_H * 60) / PASSO) * ALTURA) + 1, height: Math.max(ALTURA * 2 - 2, (dur / PASSO) * ALTURA - 2), background: "repeating-linear-gradient(135deg, var(--raised) 0 6px, var(--surface) 6px 12px)" }} title={`${e.titulo} · ${hhmm(min)}–${hhmm(min + dur)}`}>
                    <CalendarCheck2 size={10} className="mr-1 inline" /><b className="font-medium">{e.titulo}</b>
                    {dur >= 45 && <div>{hhmm(min)}–{hhmm(min + dur)}</div>}
                  </a>
                ))}
                {naGrade.filter((t) => plano(t)!.dia === dia).map((t) => {
                  const { min } = plano(t)!;
                  const dur = duracao(t);
                  const top = ((min - INICIO_H * 60) / PASSO) * ALTURA;
                  const h = (dur / PASSO) * ALTURA - 2;
                  const feita = t.status === "feita";
                  const depoisPrazo = t.prazo && t.prazo < dia;
                  return (
                    <div
                      key={t.id}
                      draggable={!feita}
                      onDragStart={(e) => arrastar(e, t.id)}
                      onClick={() => setAberta(t.id)}
                      className={`group absolute inset-x-1 z-20 cursor-grab overflow-hidden rounded-lg border px-1.5 pt-0.5 text-[11.5px] leading-tight shadow-sm active:cursor-grabbing ${feita ? "border-line bg-raised opacity-60" : depoisPrazo ? "border-bad/50 bg-bad-soft" : "border-accent/40 bg-accent-soft"}`}
                      style={{ top: Math.max(0, top) + 1, height: Math.max(ALTURA * 2 - 2, h) }}
                      title={`${t.titulo} · ${hhmm(min)}–${hhmm(min + dur)} (${duracaoTxt(dur)})${depoisPrazo ? ` · depois do prazo (${dataCurta(t.prazo)})` : ""}`}
                    >
                      <div className="flex items-start gap-1">
                        <span className={`min-w-0 flex-1 truncate font-medium ${feita ? "line-through" : ""}`}>{t.titulo}</span>
                        {!feita && <button onClick={(ev) => { ev.stopPropagation(); salvar(t.id, { planejado_inicio: null }); }} className="hidden shrink-0 text-muted hover:text-fg group-hover:block" aria-label="Tirar do horário"><X size={11} /></button>}
                      </div>
                      {h > ALTURA * 2 && <div className="truncate text-[10.5px] text-muted">{hhmm(min)}–{hhmm(min + dur)} · {duracaoTxt(dur)}{nomeCli(t) ? ` · ${nomeCli(t)}` : ""}</div>}
                      {!feita && <div onPointerDown={(e) => redimensionar(e, t)} onClick={(e) => e.stopPropagation()} className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100" style={{ background: "linear-gradient(transparent, rgb(var(--accent-c) / 0.35))" }} title="Arraste para mudar o tempo estimado" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <PainelTarefa id={aberta} fechar={() => setAberta(null)} />
    </div>
  );
}

function ItemLateral({ t, cliente, arrastar, abrir, atrasada }: { t: Tarefa; cliente: string; arrastar: (e: DragEvent, id: string) => void; abrir: () => void; atrasada?: boolean }) {
  return (
    <div draggable onDragStart={(e) => arrastar(e, t.id)} onClick={abrir} className="flex cursor-grab items-start gap-1.5 rounded-xl border border-line bg-bg px-2 py-1.5 text-[12.5px] hover:border-accent active:cursor-grabbing">
      <GripVertical size={13} className="mt-0.5 shrink-0 text-muted/60" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{t.titulo}</div>
        <div className="flex gap-1.5 text-[11px] text-muted">
          <span className="truncate">{cliente}</span>
          {atrasada && t.prazo && <span className="ml-auto shrink-0 text-bad">{dataCurta(t.prazo)}</span>}
          <span className={`shrink-0 ${atrasada ? "" : "ml-auto"}`}>· {duracaoTxt(est(t))}</span>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Google Agenda
// ------------------------------------------------------------------
function useAgenda(membroId: string, ini: string, fim: string, proprio: boolean) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const pedido = useRef(0);
  const recarregar = useCallback(async () => {
    if (!supabase || !membroId) {
      setConectado(false);
      setEventos(supabase ? [] : demoEventos(ini));
      return;
    }
    const n = ++pedido.current;
    setCarregando(true);
    try {
      const { data } = await supabase.from("agenda_conexoes").select("email").eq("membro_id", membroId).maybeSingle();
      if (n !== pedido.current) return;
      setEmail((data as { email: string | null } | null)?.email ?? null);
      if (!data) {
        setConectado(false);
        setEventos([]);
        setErro("");
        return;
      }
      const r = await chamarFuncao<{ conectado: boolean; eventos: Evento[]; erro?: string }>("agenda", { acao: "eventos", inicio: ini, fim, membro_id: membroId });
      if (n !== pedido.current) return;
      setConectado(r.conectado);
      setEventos(r.eventos ?? []);
      setErro(r.erro ?? "");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      if (n === pedido.current) setCarregando(false);
    }
  }, [membroId, ini, fim]);
  useEffect(() => void recarregar(), [recarregar]);
  return useMemo(() => ({ eventos, conectado, email, erro, carregando, recarregar, proprio }), [eventos, conectado, email, erro, carregando, recarregar, proprio]);
}

function BotaoAgenda({ agenda }: { agenda: ReturnType<typeof useAgenda> }) {
  const d = useDados();
  const [indo, setIndo] = useState(false);
  async function conectar() {
    if (!supabase) return d.avisar("A conexão com o Google funciona só no sistema publicado.");
    setIndo(true);
    try {
      const r = await chamarFuncao<{ url: string }>("agenda", { acao: "conectar" });
      location.href = r.url;
    } catch (e) {
      d.avisar((e as Error).message);
      setIndo(false);
    }
  }
  async function desconectar() {
    await chamarFuncao("agenda", { acao: "desconectar" }).catch(() => null);
    agenda.recarregar();
  }
  if (agenda.conectado)
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ok/40 bg-ok-soft px-3 text-[12.5px] text-ok" title={agenda.email ?? undefined}>
        {agenda.carregando ? <Loader2 size={13} className="animate-spin" /> : <CalendarCheck2 size={14} />} Google Agenda {agenda.email ? `· ${agenda.email}` : ""}
        <button onClick={desconectar} className="ml-1 text-muted hover:text-bad" aria-label="Desconectar agenda"><X size={12} /></button>
      </span>
    );
  return (
    <button onClick={conectar} disabled={indo} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[12.5px] hover:border-accent hover:text-accent">
      {indo ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={14} />} Conectar Google Agenda
    </button>
  );
}

function demoEventos(segunda: string): Evento[] {
  const ev = (dia: number, h: number, m: number, dur: number, titulo: string): Evento => {
    const ini = new Date(`${somarDias(segunda, dia)}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    return { id: `${dia}-${h}`, titulo, inicio: ini.toISOString(), fim: new Date(ini.getTime() + dur * 60000).toISOString(), dia_todo: false, link: null };
  };
  return [ev(0, 9, 0, 30, "Daily Vertente"), ev(1, 9, 0, 30, "Daily Vertente"), ev(1, 14, 0, 60, "Reunião Nobre Fio"), ev(2, 9, 0, 30, "Daily Vertente"), ev(3, 9, 0, 30, "Daily Vertente"), ev(3, 16, 0, 90, "Weekly"), ev(4, 9, 0, 30, "Daily Vertente")];
}
