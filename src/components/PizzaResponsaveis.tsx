import { useState } from "react";
import { PieChart } from "lucide-react";
import { useDados } from "../lib/dados";
import { STATUS_ABERTOS, hoje } from "../lib/tipos";

// Paleta categórica (funciona no claro e no escuro); "Sem responsável" fica em cinza
const CORES = ["#3B6FE0", "#E07A3B", "#2BA58B", "#C2508A", "#8A63D2", "#D4A72C", "#4FA3C7", "#B5523B", "#5E8C3A", "#7C7F8C"];

type Filtro = "ate_hoje" | "hoje" | "atrasadas";
const FILTROS: { id: Filtro; nome: string }[] = [
  { id: "ate_hoje", nome: "Hoje e antes" },
  { id: "hoje", nome: "Só hoje" },
  { id: "atrasadas", nome: "Atrasadas" },
];

/** Pizza das demandas abertas por responsável (como o "Workload" do ClickUp). */
export function PizzaResponsaveis({ ir }: { ir: (r: string) => void }) {
  const d = useDados();
  const [filtro, setFiltro] = useState<Filtro>("ate_hoje");
  const [foco, setFoco] = useState<string | null>(null);
  const h = hoje();

  const tarefas = d.tarefas.filter(
    (t) => STATUS_ABERTOS.includes(t.status) && !t.triagem && t.prazo &&
      (filtro === "hoje" ? t.prazo === h : filtro === "atrasadas" ? t.prazo < h : t.prazo <= h),
  );
  const mapa = new Map<string, { n: number; atrasadas: number }>();
  for (const t of tarefas) {
    const k = t.responsavel_id ?? "";
    const v = mapa.get(k) ?? { n: 0, atrasadas: 0 };
    v.n++;
    if (t.prazo! < h) v.atrasadas++;
    mapa.set(k, v);
  }
  const fatias = [...mapa.entries()]
    .map(([id, v], i) => ({ id, nome: id ? d.membros.find((m) => m.id === id)?.nome ?? "Ex-membro" : "Sem responsável", ...v, cor: id ? CORES[i % CORES.length] : "#A3A8B4" }))
    .sort((a, b) => (a.id === "" ? 1 : b.id === "" ? -1 : b.n - a.n))
    .map((f, i) => ({ ...f, cor: f.id ? CORES[i % CORES.length] : "#A3A8B4" }));
  const total = tarefas.length;

  // Donut em SVG
  const R = 62, r = 40, C = 80;
  let ang = -Math.PI / 2;
  const arcos = fatias.map((f) => {
    const a = (f.n / Math.max(total, 1)) * Math.PI * 2;
    const a0 = ang, a1 = ang + a;
    ang = a1;
    const p = (rad: number, raio: number) => `${C + raio * Math.cos(rad)} ${C + raio * Math.sin(rad)}`;
    const grande = a > Math.PI ? 1 : 0;
    const caminho = fatias.length === 1
      ? `M ${p(-Math.PI / 2, R)} A ${R} ${R} 0 1 1 ${p(-Math.PI / 2 - 0.0001, R)} L ${p(-Math.PI / 2 - 0.0001, r)} A ${r} ${r} 0 1 0 ${p(-Math.PI / 2, r)} Z`
      : `M ${p(a0, R)} A ${R} ${R} 0 ${grande} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${grande} 0 ${p(a0, r)} Z`;
    return { ...f, caminho };
  });
  const ativo = fatias.find((f) => f.id === foco);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-muted"><PieChart size={14} /> Demandas por responsável</h2>
        <div role="tablist" className="ml-auto flex gap-0.5 rounded-lg bg-raised p-0.5">
          {FILTROS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)} className={`rounded-md px-2.5 py-1 text-[12px] ${filtro === f.id ? "bg-surface font-medium text-fg shadow-sm" : "text-muted hover:text-fg"}`}>{f.nome}</button>
          ))}
        </div>
      </div>
      {total === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted">Nenhuma demanda aberta {filtro === "hoje" ? "com prazo hoje" : filtro === "atrasadas" ? "atrasada" : "com prazo até hoje"}.</p>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10 sm:px-4">
          <svg viewBox="0 0 160 160" width={168} height={168} className="shrink-0" role="img" aria-label={`${total} demandas divididas por responsável`}>
            {arcos.map((a) => (
              <path key={a.id} d={a.caminho} fill={a.cor} stroke="var(--surface)" strokeWidth={2}
                opacity={foco && foco !== a.id ? 0.3 : 1} className="cursor-pointer transition-opacity"
                onMouseEnter={() => setFoco(a.id)} onMouseLeave={() => setFoco(null)}>
                <title>{`${a.nome}: ${a.n}`}</title>
              </path>
            ))}
            <text x={C} y={C - 2} textAnchor="middle" className="num fill-[var(--fg)] text-[26px] font-semibold">{ativo ? ativo.n : total}</text>
            <text x={C} y={C + 16} textAnchor="middle" className="fill-[var(--muted)] text-[10.5px]">{ativo ? ativo.nome.split(" ")[0] : "demandas"}</text>
          </svg>
          <ul className="flex w-full min-w-0 max-w-[460px] flex-col">
            {fatias.map((f) => (
              <li key={f.id}>
                <button onMouseEnter={() => setFoco(f.id)} onMouseLeave={() => setFoco(null)} onClick={() => ir("clientes")}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-raised ${foco && foco !== f.id ? "opacity-50" : ""}`}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.cor }} />
                  <span className="min-w-0 flex-1 truncate">{f.nome}</span>
                  {filtro === "ate_hoje" && f.atrasadas > 0 && <span className="num shrink-0 text-[11.5px] text-bad">{f.atrasadas} atrasada{f.atrasadas > 1 ? "s" : ""}</span>}
                  <span className="num w-8 shrink-0 text-right font-semibold">{f.n}</span>
                  <span className="num w-9 shrink-0 text-right text-[11.5px] text-muted">{Math.round((f.n / total) * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
