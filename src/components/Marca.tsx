/** Marca provisória: três faixas descendo como uma vertente. Trocar pelo logo oficial. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="var(--accent)" />
        <path d="M6 9 L14 19 L22 9" fill="none" stroke="var(--accent-fg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 9 L14 14 L18 9" fill="none" stroke="var(--accent-fg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      </svg>
      {!compacta && (
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold">Vertente</div>
          <div className="eyebrow text-[10px]">Sistema interno</div>
        </div>
      )}
    </div>
  );
}
