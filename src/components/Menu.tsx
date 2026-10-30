import type { LucideIcon } from "lucide-react";
import { LayoutGrid, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Plug, Search, Sun } from "lucide-react";
import { Sininho } from "./Sininho";
import { ASSISTENTE, SECOES, ativo } from "../data/navegacao";
import { Marca } from "./Marca";

interface Props {
  rota: string;
  ir: (r: string) => void;
  tema: "light" | "dark";
  alternarTema: () => void;
  usuario: { nome: string; papel: string };
  onSair?: () => void;
  /** Menu recolhido: só ícones (desktop) */
  recolhido?: boolean;
  alternarRecolhido?: () => void;
  abrirComando?: () => void;
}

function Item({
  ativo,
  onClick,
  icone: Icone,
  rotulo,
  apagado,
  recolhido,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: LucideIcon;
  rotulo: string;
  apagado?: boolean;
  recolhido?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      title={recolhido ? rotulo : undefined}
      aria-label={recolhido ? rotulo : undefined}
      className={`group relative flex w-full items-center gap-2.5 rounded-lg py-[7px] text-left text-[13px] ${recolhido ? "justify-center px-0" : "px-2.5"} ${
        ativo ? "bg-surface font-semibold text-fg shadow-[0_0_0_1px_var(--line)]" : apagado ? "text-muted hover:bg-raised" : "text-muted hover:bg-raised hover:text-fg"
      }`}
    >
      {/* traço "vertente": marca o item ativo */}
      <span
        aria-hidden
        className={`absolute -left-3 top-1.5 bottom-1.5 w-[2.5px] origin-top rounded-full bg-accent transition-transform duration-200 ${ativo ? "scale-y-100" : "scale-y-0"} ${recolhido ? "-left-2" : ""}`}
      />
      <Icone size={recolhido ? 18 : 16} strokeWidth={ativo ? 2 : 1.7} className={ativo ? "text-accent" : ""} />
      {!recolhido && <span className="truncate">{rotulo}</span>}
    </button>
  );
}

export function Menu({ rota, ir, tema, alternarTema, usuario, onSair, recolhido = false, alternarRecolhido, abrirComando }: Props) {
  return (
    <nav className={`flex h-full flex-col gap-4 overflow-y-auto overflow-x-hidden pb-3 pt-4 ${recolhido ? "px-2" : "px-3"}`} style={{ scrollbarWidth: "none" }} aria-label="Menu principal">
      <div className={`flex items-center ${recolhido ? "flex-col gap-3" : "justify-between gap-2 px-1.5"}`}>
        <button onClick={() => ir("inicio")} title="Ir para a Central" aria-label="Ir para a Central" className="rounded-lg">
          <Marca compacta={recolhido} />
        </button>
        {alternarRecolhido && (
          <button
            onClick={alternarRecolhido}
            className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-fg"
            title={recolhido ? "Mostrar menu" : "Recolher menu"}
            aria-label={recolhido ? "Mostrar menu" : "Recolher menu"}
          >
            {recolhido ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        )}
      </div>

      {abrirComando && (
        <button
          onClick={abrirComando}
          title="Buscar e ir para (Ctrl K)"
          className={`flex items-center gap-2 rounded-lg border border-line bg-surface text-[13px] text-muted hover:border-line-forte hover:text-fg ${recolhido ? "justify-center p-2" : "px-2.5 py-1.5"}`}
        >
          <Search size={15} strokeWidth={1.8} />
          {!recolhido && <><span className="flex-1 text-left">Buscar…</span><kbd>Ctrl K</kbd></>}
        </button>
      )}

      <div className="flex flex-col gap-0.5">
        <Item ativo={rota === "inicio"} onClick={() => ir("inicio")} icone={LayoutGrid} rotulo="Central" recolhido={recolhido} />
        <Item ativo={ativo(ASSISTENTE, rota)} onClick={() => ir(ASSISTENTE.rota)} icone={ASSISTENTE.icone} rotulo={ASSISTENTE.nome} recolhido={recolhido} />
        {recolhido ? <div className="flex justify-center"><Sininho ir={ir} compacto /></div> : <Sininho ir={ir} />}
      </div>

      {SECOES.map((s) => (
        <div key={s.id} className="flex flex-col gap-0.5">
          {recolhido ? <div className="mx-2 mb-1 border-t border-line" /> : <div className="px-2.5 pb-1 text-[11.5px] font-medium text-muted/80">{s.nome}</div>}
          {s.topicos.map((t) => (
            <Item key={t.id} ativo={ativo(t, rota)} onClick={() => ir(t.rota)} icone={t.icone} rotulo={t.nome} recolhido={recolhido} />
          ))}
        </div>
      ))}

      <div className={`mt-auto flex border-t border-line pt-3 ${recolhido ? "flex-col items-center gap-1" : "items-center justify-between px-1.5"}`}>
        {!recolhido && (
          <div className="min-w-0 text-[12px] leading-tight">
            <div className="truncate font-medium">{usuario.nome}</div>
            <div className="text-muted">{usuario.papel}</div>
          </div>
        )}
        <div className={`flex ${recolhido ? "flex-col" : ""}`}>
          <button onClick={() => ir("integracoes")} className={`rounded-lg p-2 hover:bg-raised hover:text-fg ${rota === "integracoes" ? "text-accent" : "text-muted"}`} aria-label="Integrações" title="Integrações">
            <Plug size={16} />
          </button>
          <button
            onClick={alternarTema}
            className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg"
            aria-label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          >
            {tema === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {onSair && (
            <button onClick={onSair} className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg" aria-label="Sair" title="Sair">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
