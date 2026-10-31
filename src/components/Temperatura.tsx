import { useState } from "react";
import { Thermometer } from "lucide-react";
import { useDados } from "../lib/dados";
import { NIVEIS_TEMP, useTemperaturas } from "../lib/temperatura";

/** Etiqueta pequena com a temperatura atual do cliente. */
export function SeloTemperatura({ clienteId, vazio = "Sem leitura" }: { clienteId: string; vazio?: string }) {
  const t = useTemperaturas();
  const a = t.atual(clienteId);
  if (!a || a.vencida) return <span className="inline-flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-[11.5px] text-muted"><Thermometer size={12} /> {vazio}</span>;
  const n = NIVEIS_TEMP[a.nivel];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: `color-mix(in srgb, ${n.cor} 13%, transparent)`, color: n.cor }} title={a.motivo ?? n.dica}>
      <Termometro nivel={a.nivel} /> {n.nome}
    </span>
  );
}

/** Mini termômetro: 5 barrinhas preenchidas até o nível. */
export function Termometro({ nivel, grande, claro }: { nivel: number; grande?: boolean; claro?: boolean }) {
  const cor = claro ? "#fff" : NIVEIS_TEMP[nivel]?.cor ?? "var(--muted)";
  return (
    <span className="inline-flex items-end gap-[2px]" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="rounded-[1px]" style={{ width: grande ? 5 : 3, height: (grande ? 5 : 3) + i * (grande ? 2.5 : 1.6), background: i <= nivel ? cor : claro ? "rgba(255,255,255,.35)" : "var(--line-forte)" }} />
      ))}
    </span>
  );
}

/** Marcar a temperatura do cliente: escolher o nível e, se quiser, o motivo. */
export function MarcarTemperatura({ clienteId, tarefaId, compacto, aoSalvar }: { clienteId: string; tarefaId?: string; compacto?: boolean; aoSalvar?: () => void }) {
  const d = useDados();
  const t = useTemperaturas();
  const a = t.atual(clienteId);
  const [nivel, setNivel] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nivel) return;
    setSalvando(true);
    try {
      await t.salvar(null, { cliente_id: clienteId, nivel: nivel as 1, motivo: motivo.trim() || null, tarefa_id: tarefaId ?? null, autor_id: d.eu });
      d.avisar(`Temperatura marcada: ${NIVEIS_TEMP[nivel].nome}`);
      setNivel(null);
      setMotivo("");
      aoSalvar?.();
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {!compacto && <span className="mr-1 text-[12.5px] text-muted">Temperatura</span>}
        {[1, 2, 3, 4, 5].map((n) => {
          const x = NIVEIS_TEMP[n];
          const sel = nivel === n || (nivel === null && a && !a.vencida && a.nivel === n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => setNivel(n)}
              title={x.dica}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] font-medium ${sel ? "text-white" : "border-line bg-surface text-muted hover:border-line-forte hover:text-fg"}`}
              style={sel ? { background: x.cor, borderColor: x.cor } : undefined}
            >
              <Termometro nivel={n} claro={!!sel} /> {x.nome}
            </button>
          );
        })}
      </div>
      {nivel !== null && (
        <div className="anim-entrar flex gap-2">
          <input
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
            placeholder="Por quê? (opcional) ex.: reclamou dos leads na reunião"
            className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] outline-none focus:border-accent"
          />
          <button onClick={salvar} disabled={salvando} className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-semibold text-accent-fg disabled:opacity-50">Salvar</button>
          <button onClick={() => setNivel(null)} className="h-8 rounded-lg px-2 text-[12.5px] text-muted hover:bg-raised">Cancelar</button>
        </div>
      )}
      {!compacto && a && (
        <p className="text-[12px] text-muted">
          Última leitura: <b style={{ color: NIVEIS_TEMP[a.nivel].cor }}>{NIVEIS_TEMP[a.nivel].nome}</b> há {a.dias === 0 ? "menos de 1 dia" : `${a.dias} dia${a.dias > 1 ? "s" : ""}`}
          {a.motivo ? ` · ${a.motivo}` : ""}{a.vencida ? " · vencida, marque de novo" : ""}
        </p>
      )}
    </div>
  );
}
