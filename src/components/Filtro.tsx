import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";

export interface OpcaoFiltro { id: string; nome: string; contador?: number; antes?: ReactNode; dica?: string }

/**
 * Filtro compacto: um botão com o nome e o valor escolhido que abre uma lista.
 * Quando há valor diferente do padrão, o botão fica marcado e ganha um "x" para limpar.
 */
export function MenuFiltro({ rotulo, valor, padrao, opcoes, mudar, buscavel }: { rotulo: string; valor: string; padrao: string; opcoes: OpcaoFiltro[]; mudar: (id: string) => void; buscavel?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef<HTMLDivElement>(null);
  const ativo = valor !== padrao;
  const atual = opcoes.find((o) => o.id === valor);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const lista = buscavel && busca.trim() ? opcoes.filter((o) => o.nome.toLowerCase().includes(busca.trim().toLowerCase())) : opcoes;

  return (
    <div ref={caixa} className="relative">
      <div className={`flex h-8 items-center rounded-lg border text-[12.5px] ${ativo ? "border-accent/40 bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:border-line-forte hover:text-fg"}`}>
        <button onClick={() => { setAberto((a) => !a); setBusca(""); }} aria-expanded={aberto} aria-haspopup="listbox" className="flex h-full items-center gap-1.5 pl-2.5 pr-2">
          <span className={ativo ? "opacity-70" : ""}>{rotulo}</span>
          {ativo && <span className="max-w-[140px] truncate font-semibold">{atual?.nome}</span>}
          {!ativo && <ChevronDown size={13} className="opacity-60" />}
        </button>
        {ativo && (
          <button onClick={() => mudar(padrao)} className="grid h-full place-items-center pr-2 pl-0.5 opacity-70 hover:opacity-100" aria-label={`Limpar ${rotulo}`}>
            <X size={13} />
          </button>
        )}
      </div>
      {aberto && (
        <div role="listbox" className="anim-surgir absolute left-0 top-[calc(100%+6px)] z-30 w-[240px] overflow-hidden rounded-xl border border-line bg-surface p-1" style={{ boxShadow: "var(--sombra-flutuante)" }}>
          {buscavel && (
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${rotulo.toLowerCase()}…`} className="mb-1 w-full rounded-md border-b border-line bg-transparent px-2.5 py-2 text-[13px] outline-none" />
          )}
          <div className="max-h-[300px] overflow-y-auto">
            {lista.map((o) => (
              <button
                key={o.id}
                role="option"
                aria-selected={o.id === valor}
                title={o.dica}
                onClick={() => { mudar(o.id); setAberto(false); }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-raised"
              >
                <span className="grid w-4 shrink-0 place-items-center text-accent">{o.id === valor && <Check size={14} />}</span>
                {o.antes}
                <span className="min-w-0 flex-1 truncate">{o.nome}</span>
                {o.contador !== undefined && <span className="num text-[12px] text-muted">{o.contador}</span>}
              </button>
            ))}
            {lista.length === 0 && <p className="px-3 py-3 text-[12.5px] text-muted">Nada encontrado.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
