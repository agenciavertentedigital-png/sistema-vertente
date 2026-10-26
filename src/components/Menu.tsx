import type { LucideIcon } from "lucide-react";
import { Home, Moon, Sun } from "lucide-react";
import { BASE_CLIENTES, GRUPOS, MODULOS } from "../data/modulos";
import { Marca } from "./Marca";

interface Props {
  rota: string;
  ir: (r: string) => void;
  tema: "light" | "dark";
  alternarTema: () => void;
}

function Item({
  ativo,
  onClick,
  icone: Icone,
  rotulo,
  apagado,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: LucideIcon;
  rotulo: string;
  apagado?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
        ativo
          ? "bg-accent-soft font-medium text-accent"
          : apagado
            ? "text-muted hover:bg-raised"
            : "text-fg hover:bg-raised"
      }`}
    >
      <Icone size={16} />
      <span className="truncate">{rotulo}</span>
    </button>
  );
}

export function Menu({ rota, ir, tema, alternarTema }: Props) {
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-3 pb-3 pt-4" aria-label="Menu principal">
      <div className="px-1.5">
        <Marca />
      </div>

      <div className="flex flex-col gap-0.5">
        <Item ativo={rota === "inicio"} onClick={() => ir("inicio")} icone={Home} rotulo="Central" />
        <Item
          ativo={rota === BASE_CLIENTES.id}
          onClick={() => ir(BASE_CLIENTES.id)}
          icone={BASE_CLIENTES.icone}
          rotulo={BASE_CLIENTES.nome}
        />
      </div>

      {GRUPOS.map((g) => (
        <div key={g.id} className="flex flex-col gap-0.5">
          <div className="eyebrow px-2.5 pb-1">{g.nome}</div>
          {MODULOS.filter((m) => m.grupo === g.id).map((m) => (
            <Item
              key={m.id}
              ativo={rota === m.id}
              onClick={() => ir(m.id)}
              icone={m.icone}
              rotulo={m.nome}
              apagado={g.id === "futuro"}
            />
          ))}
        </div>
      ))}

      <div className="mt-auto flex items-center justify-between border-t border-line px-1.5 pt-3">
        <div className="text-[12px] leading-tight">
          <div className="font-medium">Rener</div>
          <div className="text-muted">Administrador</div>
        </div>
        <button
          onClick={alternarTema}
          className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg"
          aria-label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
        >
          {tema === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </nav>
  );
}
