import { useEffect, useState } from "react";
import { Pause, Play, Timer } from "lucide-react";
import { formatarMin, tempoAtual, type CamposTarefa, type Tarefa } from "../../lib/tipos";

const ESTIMATIVAS = [15, 30, 45, 60, 90, 120, 180, 240];

/**
 * Controle de tempo da tarefa: estimativa, cronômetro (liga sozinho em "Fazendo")
 * e ajuste manual. O banco soma o tempo ao sair de "Fazendo".
 */
export function TempoTarefa({ t, salvar }: { t: Tarefa; salvar: (c: CamposTarefa, aviso?: string) => Promise<void> }) {
  const [agora, setAgora] = useState(Date.now());
  const [ajuste, setAjuste] = useState("");
  const rodando = t.status === "fazendo" && !!t.fazendo_desde;
  useEffect(() => {
    if (!rodando) return;
    const i = setInterval(() => setAgora(Date.now()), 15000);
    return () => clearInterval(i);
  }, [rodando]);

  const gasto = tempoAtual(t, agora);
  const est = t.estimativa_min ?? null;
  const pct = est ? Math.min(100, Math.round((gasto / est) * 100)) : 0;
  const estourou = est !== null && gasto > est;
  const aberta = !["feita", "nao_feita"].includes(t.status);

  function ajustar() {
    const txt = ajuste.trim().toLowerCase();
    if (!txt) return;
    // aceita "45", "1h", "1h30", "1:30"
    const m = txt.match(/^(\d+)\s*(?:h|:)\s*(\d+)?\s*(?:min)?$/) ;
    const min = m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : Number(txt.replace(/min/, ""));
    if (!Number.isFinite(min) || min < 0) return;
    // Se está rodando, o trecho em andamento continua sendo somado pelo banco
    const base = rodando ? Math.max(0, min - (gasto - (t.tempo_min ?? 0))) : min;
    salvar({ tempo_min: Math.round(base) }, `Tempo ajustado para ${formatarMin(min)}`);
    setAjuste("");
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-line p-3">
      <div className="flex items-center gap-2">
        <Timer size={15} className={rodando ? "text-accent" : "text-muted"} />
        <h3 className="text-[13px] font-semibold">Tempo</h3>
        {rodando && <span className="flex items-center gap-1 text-[12px] text-accent"><span className="ponto-vivo h-1.5 w-1.5 rounded-full bg-accent" /> contando</span>}
        {aberta && (
          <button
            onClick={() => salvar({ status: rodando ? "a_fazer" : "fazendo" }, rodando ? "Cronômetro pausado" : "Cronômetro ligado")}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-[12px] hover:border-accent hover:text-accent"
          >
            {rodando ? <><Pause size={12} /> Pausar</> : <><Play size={12} /> Começar</>}
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <b className={`num text-[20px] ${estourou ? "text-warn" : ""}`}>{formatarMin(gasto)}</b>
        <span className="text-[12.5px] text-muted">{est ? `de ${formatarMin(est)} estimados` : "sem estimativa"}</span>
      </div>
      {est !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-raised">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: estourou ? "rgb(var(--warn-c, 200 120 20))" : "rgb(var(--accent-c))" }} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-muted">Estimativa:</span>
        {ESTIMATIVAS.map((m) => (
          <button key={m} onClick={() => salvar({ estimativa_min: est === m ? null : m })} aria-pressed={est === m} className={`rounded-md px-1.5 py-0.5 text-[12px] ${est === m ? "bg-accent text-accent-fg" : "bg-raised text-muted hover:text-fg"}`}>
            {formatarMin(m)}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ajustar(); }} className="flex items-center gap-1.5">
        <input value={ajuste} onChange={(e) => setAjuste(e.target.value)} placeholder="Corrigir tempo total (ex.: 1h30)" className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 text-[12.5px] outline-none focus:border-accent" />
        <button disabled={!ajuste.trim()} className="h-8 rounded-lg border border-line px-2.5 text-[12.5px] hover:border-accent disabled:opacity-40">Salvar</button>
        {[15, 30].map((m) => (
          <button type="button" key={m} onClick={() => salvar({ tempo_min: (t.tempo_min ?? 0) + m }, `+${m}min`)} className="h-8 rounded-lg bg-raised px-2 text-[12px] text-muted hover:text-fg">+{m}</button>
        ))}
      </form>
    </section>
  );
}
