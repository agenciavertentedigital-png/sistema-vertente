import { useEffect, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import type { Pilar, Prioridade, Status } from "../lib/tipos";

export const campo =
  "w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-muted/70 hover:border-line-forte focus:border-accent focus:ring-[3px] focus:ring-accent/15";

export function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[12px] text-muted">
      {texto}
      {children}
    </label>
  );
}

export function Selecao(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${campo} ${props.className ?? ""}`} />;
}

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${campo} ${props.className ?? ""}`} />;
}

export function Botao({
  children,
  variante = "secundario",
  ...props
}: { variante?: "primario" | "secundario" | "fantasma" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const estilos = {
    primario: "bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] hover:bg-accent/90",
    secundario: "border border-line bg-surface text-fg hover:border-line-forte hover:bg-raised/60",
    fantasma: "text-muted hover:bg-raised hover:text-fg",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${estilos[variante]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** Painel lateral (desktop) / tela cheia (celular). */
export function Painel({ aberto, fechar, titulo, children, largura = 520 }: { aberto: boolean; fechar: () => void; titulo: string; children: ReactNode; largura?: number }) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, fechar]);
  if (!aberto) return null;
  // Portal: o painel não herda as cores do menu lateral
  return createPortal(
    <div className="fixed inset-0 z-50 text-fg">
      <div className="anim-entrar absolute inset-0 bg-[rgb(12_14_20/0.32)] backdrop-blur-[1px]" onClick={fechar} />
      <section
        role="dialog"
        aria-label={titulo}
        className="anim-deslizar absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-bg"
        style={{ maxWidth: largura, boxShadow: "var(--sombra-flutuante)", paddingTop: "env(safe-area-inset-top, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
          <h2 className="truncate text-[15px] font-semibold">{titulo}</h2>
          <button onClick={fechar} className="rounded-lg p-1.5 text-muted hover:bg-raised" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

const COR_STATUS: Record<Status, string> = {
  a_fazer: "bg-raised text-muted",
  fazendo: "bg-accent-soft text-accent",
  aguardando: "bg-warn-soft text-warn",
  feita: "bg-ok-soft text-ok",
  nao_feita: "bg-raised text-muted line-through",
};
export function SeloStatus({ status, texto }: { status: Status; texto: string }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${COR_STATUS[status]}`}>{texto}</span>;
}

export function MarcaPrioridade({ prioridade }: { prioridade: Prioridade }) {
  if (prioridade === "normal" || prioridade === "baixa") return null;
  return (
    <span
      className={`whitespace-nowrap rounded px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide ${
        prioridade === "urgente" ? "bg-warn text-bg" : "bg-warn-soft text-warn"
      }`}
    >
      {prioridade}
    </span>
  );
}

export const COR_PILAR: Record<Pilar, string> = {
  trafego: "#3b82c4",
  social: "#b35bb0",
  gmn: "#2f9a5d",
  cs: "#d0822a",
  interno: "#7a8a93",
};

export function Iniciais({ nome }: { nome?: string }) {
  if (!nome) return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-line text-[10px] text-muted">?</span>;
  const ini = nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span title={nome} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
      {ini}
    </span>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  // "Carregando…" vira esqueleto, para a tela não piscar texto
  if (typeof children === "string" && children.startsWith("Carregando")) {
    return (
      <div className="flex flex-col gap-2.5 py-2" aria-busy="true" aria-label={children}>
        <div className="esqueleto h-4 w-1/3" />
        <div className="esqueleto h-16 w-full" />
        <div className="esqueleto h-16 w-full" />
        <div className="esqueleto h-16 w-2/3" />
      </div>
    );
  }
  return <div className="rounded-2xl border border-dashed border-line-forte px-4 py-10 text-center text-[13px] text-muted">{children}</div>;
}

export const COR_SITUACAO = {
  ok: "var(--ok)",
  atencao: "var(--warn)",
  problema: "var(--bad)",
} as const;

export function PontoSituacao({ situacao, tamanho = 10 }: { situacao: keyof typeof COR_SITUACAO | null; tamanho?: number }) {
  if (!situacao) return null;
  return <span className="inline-block shrink-0 rounded-full" style={{ width: tamanho, height: tamanho, background: COR_SITUACAO[situacao] }} />;
}
