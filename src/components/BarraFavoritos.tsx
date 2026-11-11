import { useState, type DragEvent } from "react";
import { BarChart3, CheckSquare, LayoutGrid, Star, User, X, type LucideIcon } from "lucide-react";
import { ASSISTENTE, DASHBOARD, SECOES, ativo, type Topico } from "../data/navegacao";
import { useDados } from "../lib/dados";
import { abrirTarefaGlobal, lerArrasto, useFavoritos, type Favorito } from "../lib/favoritos";

const TOPICOS: Topico[] = [DASHBOARD, ASSISTENTE, ...SECOES.flatMap((s) => s.topicos)];

/** Nome curto e ícone para uma rota do sistema. */
export function descreverRota(rota: string, nomeCliente: (id: string) => string | undefined): { nome: string; icone: LucideIcon; cor?: string } {
  if (rota === "inicio" || rota === "") return { nome: "Central Vertente", icone: LayoutGrid };
  let m = rota.match(/^trafego-cliente-(.+)$/);
  if (m) return { nome: `Dash · ${nomeCliente(m[1]) ?? "cliente"}`, icone: BarChart3, cor: "#1d4ed8" };
  m = rota.match(/^cliente-(.+)$/);
  if (m) return { nome: nomeCliente(m[1]) ?? "Cliente", icone: User, cor: "#2f54eb" };
  for (const t of TOPICOS) {
    const at = t.atalhos.find((a) => a.rota === rota && a.rota !== t.rota);
    if (at) return { nome: `${t.nome} · ${at.nome}`, icone: t.icone, cor: t.cor };
    if (ativo(t, rota)) return { nome: t.nome, icone: t.icone, cor: t.cor };
  }
  return { nome: rota, icone: Star };
}

/** Barra fina de atalhos no topo (estilo ClickUp). Arraste menus, tarefas, clientes ou dashboards para cá. */
export function BarraFavoritos({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const fav = useFavoritos();
  const d = useDados();
  const [sobre, setSobre] = useState<string | null>(null);
  if (!fav.ativo) return null;
  const nomeCli = (id: string) => d.cliente(id)?.nome;
  const fixada = fav.tem("rota", rota);

  const soltar = (e: DragEvent, antesDe: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setSobre(null);
    const interno = e.dataTransfer.getData("text/favorito-id");
    if (interno) return fav.mover(interno, antesDe);
    const f = lerArrasto(e);
    if (f) fav.adicionar(f, antesDe ?? undefined);
  };
  const aceitar = (e: DragEvent, alvo: string) => { e.preventDefault(); setSobre(alvo); };

  const abrir = (f: Favorito) => (f.tipo === "tarefa" ? abrirTarefaGlobal(f.alvo) : ir(f.alvo));
  const visual = (f: Favorito) => {
    if (f.tipo === "tarefa") {
      const t = d.tarefas.find((x) => x.id === f.alvo);
      return { nome: t?.titulo ?? f.nome, icone: CheckSquare, cor: "#7c3aed", feita: t?.status === "feita" };
    }
    const r = descreverRota(f.alvo, nomeCli);
    return { ...r, nome: f.nome || r.nome, feita: false };
  };

  return (
    <div
      onDragOver={(e) => aceitar(e, "fim")}
      onDragLeave={() => setSobre(null)}
      onDrop={(e) => soltar(e, null)}
      className={`flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b px-3 transition-colors lg:px-5 ${fav.arrastando ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}
      style={{ scrollbarWidth: "none" }}
      aria-label="Favoritos"
    >
      <Star size={13} className={`shrink-0 ${fav.itens.length ? "fill-[#f2b33d] text-[#f2b33d]" : "text-muted"}`} />
      {fav.itens.length === 0 && (
        <span className="whitespace-nowrap px-1 text-[12px] text-muted">{fav.arrastando ? "Solte aqui para fixar" : "Favoritos: arraste um menu, cliente, dashboard ou tarefa para cá, ou fixe a página atual →"}</span>
      )}
      {fav.itens.map((f) => {
        const v = visual(f);
        const Icone = v.icone;
        const atual = f.tipo === "rota" && f.alvo === rota;
        return (
          <div key={f.id} className="flex shrink-0 items-center">
            {sobre === f.id && <span className="mx-0.5 h-5 w-0.5 rounded bg-accent" />}
            <button
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/favorito-id", f.id); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => aceitar(e, f.id)}
              onDrop={(e) => soltar(e, f.id)}
              onClick={() => abrir(f)}
              title={v.nome}
              className={`group flex h-7 max-w-[180px] items-center gap-1.5 rounded-lg px-2 text-[12px] transition-colors ${atual ? "bg-accent-soft font-medium text-accent" : "text-fg hover:bg-raised"}`}
            >
              <Icone size={13} className="shrink-0" style={{ color: v.cor }} />
              <span className={`truncate ${v.feita ? "text-muted line-through" : ""}`}>{v.nome}</span>
              <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); fav.remover(f.id); }} className="-mr-1 hidden shrink-0 rounded p-0.5 text-muted hover:bg-line hover:text-fg group-hover:inline-flex" aria-label={`Tirar ${v.nome} dos favoritos`}>
                <X size={11} />
              </span>
            </button>
          </div>
        );
      })}
      {sobre === "fim" && fav.itens.length > 0 && <span className="mx-0.5 h-5 w-0.5 shrink-0 rounded bg-accent" />}
      <button
        onClick={() => (fixada ? fav.remover(`rota:${rota}`) : fav.adicionar({ tipo: "rota", alvo: rota, nome: descreverRota(rota, nomeCli).nome }))}
        className={`ml-auto flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11.5px] ${fixada ? "text-[#c98a0b]" : "text-muted hover:bg-raised hover:text-fg"}`}
        title={fixada ? "Tirar esta página dos favoritos" : "Fixar esta página nos favoritos"}
      >
        <Star size={12} className={fixada ? "fill-current" : ""} /> {fixada ? "Fixada" : "Fixar página"}
      </button>
    </div>
  );
}
