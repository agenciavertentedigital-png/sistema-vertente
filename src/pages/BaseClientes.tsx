import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Origem } from "../data/clientes";
import { useClientes } from "../lib/clientes";

type Filtro = "Todos" | Origem;
const FILTROS: Filtro[] = ["Todos", "Vertente", "Parceria Marcone"];

export function BaseClientes() {
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [busca, setBusca] = useState("");
  const { clientes: CLIENTES, carregando, erro } = useClientes();

  const lista = useMemo(
    () =>
      CLIENTES.filter((c) => (filtro === "Todos" ? true : c.origem === filtro)).filter((c) =>
        c.nome.toLowerCase().includes(busca.trim().toLowerCase()),
      ),
    [filtro, busca, CLIENTES],
  );

  const contar = (f: Filtro) => (f === "Todos" ? CLIENTES.length : CLIENTES.filter((c) => c.origem === f).length);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
      <header>
        <div className="eyebrow">Fase 0 · Fundação</div>
        <h1 className="mt-1 text-[26px] font-semibold">Base de clientes</h1>
        <p className="mt-1.5 max-w-[68ch] text-muted">
          A carteira atual. Todas as áreas do sistema se ligam a esta lista de clientes.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por origem">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={`rounded-full border px-3 py-1 text-[12.5px] ${
                filtro === f ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-fg"
              }`}
            >
              {f} <span className="num">({contar(f)})</span>
            </button>
          ))}
        </div>
        <label className="ml-auto flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 sm:max-w-[280px]">
          <Search size={15} className="text-muted" />
          <input
            id="busca-clientes"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente"
            className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {["Cliente", "Origem", "Marca", "Serviços", "Responsável"].map((h) => (
                <th key={h} className="eyebrow px-4 py-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.nome} className="border-b border-line last:border-0 hover:bg-raised">
                <td className="px-4 py-2.5 font-medium">{c.nome}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11.5px] ${
                      c.origem === "Vertente" ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn"
                    }`}
                  >
                    {c.origem}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted">{c.grupo ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">{c.servicos.length ? c.servicos.join(", ") : "a cadastrar"}</td>
                <td className="px-4 py-2.5 text-muted">{c.responsavel ?? "a definir"}</td>
              </tr>
            ))}
            {carregando && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Carregando clientes…
                </td>
              </tr>
            )}
            {erro && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-warn">
                  {erro}
                </td>
              </tr>
            )}
            {!carregando && !erro && lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Nenhum cliente com esse nome.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
