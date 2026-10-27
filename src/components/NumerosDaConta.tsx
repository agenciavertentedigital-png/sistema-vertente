import { useEffect, useState } from "react";
import { hoje, somarDias } from "../lib/tipos";
import { STATUS_CONTA, repoTrafego, type ContaAnuncio, type DiaConta } from "../lib/trafego";
import { moeda, resumir } from "../pages/trafego/VisaoGeral";
import { nomeResultado } from "../lib/trafego";

/** Números de ontem das contas Meta do cliente, comparados com a média dos 7 dias anteriores. */
export function NumerosDaConta({ clienteId, compacto }: { clienteId: string; compacto?: boolean }) {
  const [dados, setDados] = useState<{ contas: ContaAnuncio[]; dias: DiaConta[] } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([repoTrafego.contas(), repoTrafego.dias(somarDias(hoje(), -16))])
      .then(([contas, dias]) => vivo && setDados({ contas: contas.filter((c) => c.cliente_id === clienteId && c.ativa), dias }))
      .catch(() => vivo && setDados({ contas: [], dias: [] }));
    return () => {
      vivo = false;
    };
  }, [clienteId]);

  if (!dados || dados.contas.length === 0) return null;
  const ontem = somarDias(hoje(), -1);

  return (
    <div className={`grid gap-2 ${compacto ? "" : "sm:grid-cols-2"}`}>
      {dados.contas.map((c) => {
        const d1 = resumir(c, dados.dias, ontem, ontem);
        const d7 = resumir(c, dados.dias, somarDias(ontem, -7), somarDias(ontem, -1));
        const custoMedio = d7.custo;
        const v = d1.custo !== null && custoMedio ? (d1.custo - custoMedio) / custoMedio : null;
        const semDados = !c.ultimo_sync;
        return (
          <div key={c.id} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-[12.5px]">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate font-medium">{c.nome}</span>
              {c.status && c.status !== "ativa" && (
                <span className="whitespace-nowrap rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-medium text-bad">{STATUS_CONTA[c.status] ?? c.status}</span>
              )}
            </div>
            {semDados ? (
              <span className="text-muted">Números entram quando a Meta for conectada.</span>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span><span className="text-muted">Ontem </span><span className="num font-medium">{moeda(d1.gasto)}</span></span>
                <span>
                  <span className="num font-medium">{Math.round(d1.resultados)}</span> <span className="text-muted">{nomeResultado(d1.tipo || d7.tipo, d1.resultados !== 1)}</span>
                </span>
                <span>
                  <span className="text-muted">Custo </span>
                  <span className="num font-medium">{d1.custo !== null ? moeda(d1.custo) : "—"}</span>
                  {v !== null && Math.abs(v) >= 0.05 && (
                    <span className={`num ml-1 text-[11px] ${v > 0 ? "text-bad" : "text-ok"}`}>
                      {v > 0 ? "▲" : "▼"}{Math.abs(Math.round(v * 100))}% vs 7 dias
                    </span>
                  )}
                </span>
                {c.saldo !== null && <span><span className="text-muted">Saldo </span><span className="num font-medium">{moeda(c.saldo)}</span></span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
