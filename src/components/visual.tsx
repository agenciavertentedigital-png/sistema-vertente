import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Cabeçalho padrão das áreas: rótulo pequeno, título e ações à direita. */
export function Cabecalho({ titulo, descricao, acoes, icone: Icone }: { rotulo?: string; titulo: string; descricao?: string; acoes?: ReactNode; icone?: LucideIcon }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icone && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-accent">
            <Icone size={18} strokeWidth={1.8} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight">{titulo}</h1>
          {descricao && <p className="mt-0.5 max-w-[72ch] text-[13px] text-muted">{descricao}</p>}
        </div>
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}

export function Abas<T extends string>({ abas, ativa, mudar }: { abas: { id: T; nome: string; contador?: number }[]; ativa: T; mudar: (id: T) => void }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div role="tablist" className="flex w-max gap-0.5 rounded-xl bg-raised p-0.5">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={ativa === a.id}
            onClick={() => mudar(a.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 py-1.5 text-[13px] font-medium ${ativa === a.id ? "bg-surface text-fg shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/0.05)]" : "text-muted hover:text-fg"}`}
          >
            {a.nome}
            {a.contador ? (
              <span className={`num rounded-full px-1.5 text-[10.5px] ${ativa === a.id ? "bg-accent-soft text-accent" : "bg-surface/70"}`}>{a.contador}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

type Tom = "neutro" | "ok" | "warn" | "bad" | "accent";
const TOM: Record<Tom, string> = {
  neutro: "text-fg",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  accent: "text-accent",
};

/** Número de destaque. */
export function Kpi({ rotulo, valor, detalhe, tom = "neutro", icone: Icone, onClick, ativo }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: Tom; icone?: LucideIcon; onClick?: () => void; ativo?: boolean }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`flex min-w-0 flex-col gap-0.5 rounded-2xl border bg-surface px-4 py-3 text-left ${ativo ? "border-accent ring-[3px] ring-accent/10" : "border-line"} ${onClick ? "hover:border-line-forte hover:bg-raised/40" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        {Icone && <Icone size={13} strokeWidth={1.8} />}
        {rotulo}
      </div>
      <div className={`num truncate text-[21px] font-semibold leading-tight ${TOM[tom]}`}>{valor}</div>
      {detalhe && <div className="truncate text-[11.5px] text-muted">{detalhe}</div>}
    </Tag>
  );
}

/** Anel de nota 0–100. */
export function Anel({ nota, tamanho = 64, espessura = 7, rotulo }: { nota: number | null; tamanho?: number; espessura?: number; rotulo?: string }) {
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const v = nota === null ? 0 : Math.max(0, Math.min(100, nota));
  const cor = nota === null ? "var(--line)" : v >= 75 ? "var(--ok)" : v >= 50 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="var(--raised)" strokeWidth={espessura} />
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <div className="num font-semibold" style={{ fontSize: tamanho * 0.3, color: nota === null ? "var(--muted)" : undefined }}>{nota === null ? "—" : Math.round(v)}</div>
          {rotulo && <div className="mt-0.5 text-[9px] text-muted">{rotulo}</div>}
        </div>
      </div>
    </div>
  );
}

export function Selo({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)`, color: cor }}>
      {children}
    </span>
  );
}

/** Barras simples (SVG) para séries mensais. */
export function Barras({ dados, altura = 140, formatar }: { dados: { rotulo: string; valores: { valor: number; cor: string; nome: string }[] }[]; altura?: number; formatar: (v: number) => string }) {
  const max = Math.max(1, ...dados.flatMap((d) => d.valores.map((v) => v.valor)));
  return (
    <div className="flex items-end gap-3" style={{ height: altura + 28 }}>
      {dados.map((d) => (
        <div key={d.rotulo} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full items-end justify-center gap-1" style={{ height: altura }}>
            {d.valores.map((v) => (
              <div
                key={v.nome}
                title={`${v.nome}: ${formatar(v.valor)}`}
                className="w-full max-w-[22px] rounded-t-md"
                style={{ height: Math.max(2, (v.valor / max) * altura), background: v.cor, opacity: v.valor ? 1 : 0.25 }}
              />
            ))}
          </div>
          <div className="text-[11px] text-muted">{d.rotulo}</div>
        </div>
      ))}
    </div>
  );
}

export const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function nomeMes(iso: string, curto = false) {
  const m = Number(iso.slice(5, 7)) - 1;
  return curto ? `${MESES_CURTOS[m]}/${iso.slice(2, 4)}` : `${MESES_LONGOS[m]} de ${iso.slice(0, 4)}`;
}
export function somarMeses(iso: string, n: number) {
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
