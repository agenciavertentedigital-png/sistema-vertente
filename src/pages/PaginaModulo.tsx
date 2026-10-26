import { useState } from "react";
import { ArrowLeft, Construction, Plug } from "lucide-react";
import type { Modulo } from "../data/modulos";
import { FASE_ATUAL } from "../data/modulos";
import { FaseChip } from "../components/FaseChip";

export function PaginaModulo({ modulo, ir }: { modulo: Modulo; ir: (r: string) => void }) {
  const [aba, setAba] = useState(0);
  const Icone = modulo.icone;
  const futuro = modulo.grupo === "futuro";
  const tela = modulo.telas[aba];
  const proximo = modulo.fase === FASE_ATUAL + 1;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <button onClick={() => ir("inicio")} className="flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> Central
      </button>

      <header className="flex flex-wrap items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icone size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] font-semibold leading-tight">{modulo.nome}</h1>
            <FaseChip fase={modulo.fase} />
          </div>
          <p className="mt-1.5 max-w-[68ch] text-muted">{modulo.resumo}</p>
        </div>
      </header>

      {futuro ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-muted">
          Esta área está no radar e ainda não tem fase definida. Ela entra no plano depois que as fases 1 a 7 estiverem rodando.
        </div>
      ) : (
        <>
          {/* Telas previstas do módulo */}
          <div className="-mx-1 overflow-x-auto px-1">
            <div role="tablist" aria-label={`Telas de ${modulo.nome}`} className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1">
              {modulo.telas.map((t, i) => (
                <button
                  key={t.nome}
                  id={`aba-${modulo.id}-${i}`}
                  role="tab"
                  aria-selected={aba === i}
                  onClick={() => setAba(i)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] ${
                    aba === i ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg"
                  }`}
                >
                  {t.nome}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section
              role="tabpanel"
              aria-labelledby={`aba-${modulo.id}-${aba}`}
              className="flex min-h-[320px] min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-surface p-8 text-center"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-warn-soft text-warn">
                <Construction size={22} />
              </span>
              <h2 className="text-[18px] font-semibold">{tela.nome}</h2>
              <p className="max-w-[48ch] text-muted">{tela.descricao}</p>
              <span className="text-[12.5px] text-muted">
                {proximo ? "Esta é a próxima área a ser construída." : `Entra na Fase ${modulo.fase}.`}
              </span>
            </section>

            <aside className="flex min-w-0 flex-col gap-4">
              <div className="rounded-2xl border border-line bg-surface p-4">
                <h3 className="text-[14px] font-semibold">O que esta área vai entregar</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {modulo.entregas.map((e) => (
                    <li key={e} className="flex gap-2 text-[13px] leading-snug">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <h3 className="text-[14px] font-semibold">Integrações</h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {modulo.integracoes.map((it) => (
                    <li key={it.nome} className="flex gap-2.5">
                      <Plug size={15} className="mt-0.5 shrink-0 text-muted" />
                      <div className="min-w-0 text-[13px] leading-snug">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{it.nome}</span>
                          <span className="rounded-full bg-raised px-1.5 py-px text-[10.5px] text-muted">não conectada</span>
                        </div>
                        <div className="text-muted">{it.papel}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
