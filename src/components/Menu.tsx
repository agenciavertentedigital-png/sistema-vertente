import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Home, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sparkles, Sun } from "lucide-react";
import { Sininho } from "./Sininho";
import { BASE_CLIENTES, GRUPOS, MODULOS } from "../data/modulos";
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
      className={`flex w-full items-center gap-2.5 rounded-lg py-2 text-left text-[13.5px] transition-colors ${recolhido ? "justify-center px-0" : "px-2.5"} ${
        ativo
          ? "bg-accent-soft font-medium text-accent"
          : apagado
            ? "text-muted hover:bg-raised"
            : "text-fg hover:bg-raised"
      }`}
    >
      <Icone size={recolhido ? 18 : 16} />
      {!recolhido && <span className="truncate">{rotulo}</span>}
    </button>
  );
}

export function Menu({ rota, ir, tema, alternarTema, usuario, onSair, recolhido = false, alternarRecolhido }: Props) {
  return (
    <nav className={`flex h-full flex-col gap-5 overflow-y-auto overflow-x-hidden pb-3 pt-4 ${recolhido ? "px-2" : "px-3"}`} aria-label="Menu principal">
      <div className={`flex items-center ${recolhido ? "flex-col gap-3" : "justify-between gap-2 px-1.5"}`}>
        <Marca sobreEscuro compacta={recolhido} />
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

      <div className="flex flex-col gap-0.5">
        <Item ativo={rota === "inicio"} onClick={() => ir("inicio")} icone={Home} rotulo="Central" recolhido={recolhido} />
        <Item ativo={rota === "assistente"} onClick={() => ir("assistente")} icone={Sparkles} rotulo="Assistente IA" recolhido={recolhido} />
        <Item
          ativo={rota === BASE_CLIENTES.id}
          onClick={() => ir(BASE_CLIENTES.id)}
          icone={BASE_CLIENTES.icone}
          rotulo={BASE_CLIENTES.nome}
          recolhido={recolhido}
        />
        <Item ativo={rota.startsWith("reuniao")} onClick={() => ir("reuniao-daily")} icone={CalendarCheck} rotulo="Daily e Weekly" recolhido={recolhido} />
        {recolhido ? <div className="flex justify-center"><Sininho ir={ir} compacto /></div> : <Sininho ir={ir} />}
      </div>

      {GRUPOS.map((g) => (
        <div key={g.id} className="flex flex-col gap-0.5">
          {recolhido ? <div className="mx-2 mb-1 border-t border-line" /> : <div className="eyebrow px-2.5 pb-1">{g.nome}</div>}
          {MODULOS.filter((m) => m.grupo === g.id).map((m) => (
            <Item
              key={m.id}
              ativo={rota === m.id || rota.startsWith(m.id + "-") || (m.id === "clientes" && rota.startsWith("cliente"))}
              onClick={() => ir(m.id)}
              icone={m.icone}
              rotulo={m.nome}
              apagado={g.id === "futuro"}
              recolhido={recolhido}
            />
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
        {onSair && (
          <button onClick={onSair} className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg" aria-label="Sair">
            <LogOut size={16} />
          </button>
        )}
        <button
          onClick={alternarTema}
          className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg"
          aria-label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
        >
          {tema === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        </div>
      </div>
    </nav>
  );
}
