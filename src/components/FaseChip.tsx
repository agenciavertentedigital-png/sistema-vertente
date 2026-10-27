import { FASE_ATUAL } from "../data/modulos";

/** Selo de fase: mostra se o módulo é o próximo a ser construído ou quando vem. */
export function FaseChip({ fase }: { fase: number | null }) {
  if (fase === null) {
    return <span className="eyebrow rounded-full border border-line px-2 py-0.5">Sem fase</span>;
  }
  const agora = fase === FASE_ATUAL;
  const proximo = fase === FASE_ATUAL + 1;
  const pronto = fase < FASE_ATUAL;
  const estilo = pronto ? "bg-ok-soft text-ok" : agora || proximo ? "bg-accent-soft text-accent" : "bg-raised text-muted";
  const texto = pronto
    ? `Fase ${fase} · pronta`
    : agora
      ? `Fase ${fase} · em uso`
      : proximo
        ? `Fase ${fase} · próxima`
        : `Fase ${fase}`;
  return (
    <span className={`num whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${estilo}`}>{texto}</span>
  );
}
