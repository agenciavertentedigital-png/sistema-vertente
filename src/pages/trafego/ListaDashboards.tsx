import { ArrowRight } from "lucide-react";
import { useDados } from "../../lib/dados";
import { hoje, somarDias } from "../../lib/tipos";
import { STATUS_CONTA, useTrafego } from "../../lib/trafego";
import { moeda } from "./VisaoGeral";
import { Vazio } from "../../components/ui";

/** Cartões por cliente (números do banco, 7 dias até ontem) que abrem o dashboard completo ao vivo. */
export function ListaDashboards({ trafego, ir }: { trafego: ReturnType<typeof useTrafego>; ir: (r: string) => void }) {
  const d = useDados();
  const fim = somarDias(hoje(), -1);
  const ini = somarDias(fim, -6);
  const iniAnt = somarDias(ini, -7);

  const porCliente = new Map<string, { contas: typeof trafego.contas }>();
  for (const c of trafego.contas.filter((x) => x.ativa)) {
    const v = porCliente.get(c.cliente_id) ?? { contas: [] };
    v.contas.push(c);
    porCliente.set(c.cliente_id, v);
  }

  const cartoes = [...porCliente.entries()]
    .map(([clienteId, { contas }]) => {
      const ids = new Set(contas.map((c) => c.id));
      const dias = trafego.dias.filter((x) => ids.has(x.conta_id));
      const p = dias.filter((x) => x.data >= ini && x.data <= fim);
      const a = dias.filter((x) => x.data >= iniAnt && x.data < ini);
      const gasto = p.reduce((s, x) => s + x.gasto, 0);
      const gastoAnt = a.reduce((s, x) => s + x.gasto, 0);
      const contatos = p.reduce((s, x) => s + x.conversas + x.leads, 0) + p.filter((x) => /contact|lead/.test(x.tipo_resultado) && x.leads === 0).reduce((s, x) => s + x.resultados, 0);
      const serie = Array.from({ length: 7 }, (_, k) => {
        const dia = somarDias(ini, k);
        return p.filter((x) => x.data === dia).reduce((s, x) => s + x.gasto, 0);
      });
      const problema = contas.find((c) => c.status && c.status !== "ativa");
      return { clienteId, nome: d.cliente(clienteId)?.nome ?? "Cliente", contas, gasto, gastoAnt, contatos, serie, problema };
    })
    .sort((x, y) => y.gasto - x.gasto);

  if (trafego.carregando) return <Vazio>Carregando…</Vazio>;
  if (cartoes.length === 0) return <Vazio>Nenhum cliente com conta de anúncio acompanhada.</Vazio>;

  return (
    <>
      <p className="text-[13px] text-muted">
        Escolha um cliente para abrir o dashboard completo: funil, métricas por objetivo, melhores criativos e campanhas, direto da Meta. Os números abaixo são dos últimos 7 dias até ontem.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cartoes.map((c) => {
          const v = c.gastoAnt ? (c.gasto - c.gastoAnt) / c.gastoAnt : null;
          const max = Math.max(...c.serie, 1);
          return (
            <button key={c.clienteId} onClick={() => ir(`trafego-cliente-${c.clienteId}`)} className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-display text-[16px] font-semibold">{c.nome}</div>
                  <div className="truncate text-[11.5px] text-muted">{c.contas.map((x) => x.nome).join(" · ")}</div>
                </div>
                {c.problema && <span className="shrink-0 rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-medium text-bad">{STATUS_CONTA[c.problema.status!] ?? c.problema.status}</span>}
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="num text-[17px] font-semibold leading-tight">{moeda(c.gasto)}</div>
                    <div className="text-[11.5px] text-muted">
                      investido{" "}
                      {v !== null && Math.abs(v) >= 0.01 && <span className={v > 0 ? "text-ok" : "text-bad"}>{v > 0 ? "▲" : "▼"}{Math.abs(Math.round(v * 100))}%</span>}
                    </div>
                  </div>
                  <div>
                    <div className="num text-[17px] font-semibold leading-tight">{Math.round(c.contatos)}</div>
                    <div className="text-[11.5px] text-muted">contatos</div>
                  </div>
                  <div>
                    <div className="num text-[17px] font-semibold leading-tight">{c.contatos ? moeda(c.gasto / c.contatos) : "—"}</div>
                    <div className="text-[11.5px] text-muted">por contato</div>
                  </div>
                </div>
                <svg width={56} height={28} aria-hidden className="shrink-0">
                  {c.serie.map((g, i) => {
                    const hgt = g ? Math.max(2, (g / max) * 26) : 1;
                    return <rect key={i} x={i * 8} y={28 - hgt} width={6} height={hgt} rx={1} fill={g ? "var(--accent)" : "var(--line)"} opacity={i === 6 ? 1 : 0.55} />;
                  })}
                </svg>
              </div>
              <span className="flex items-center gap-1 text-[12.5px] font-medium text-accent">
                Abrir dashboard <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
