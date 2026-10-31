import { useMemo } from "react";
import { useDados } from "../../lib/dados";
import { useFichas } from "../../lib/cadastro";
import { formatarMin, hoje, somarDias, tempoAtual } from "../../lib/tipos";
import { moedaBR } from "../../lib/tabela";
import { Vazio } from "../../components/ui";

/**
 * Horas investidas por cliente nos últimos 30 dias x mensalidade:
 * mostra quem dá mais trabalho do que paga (R$ por hora baixo).
 */
export function HorasClientes({ ir }: { ir: (r: string) => void }) {
  const d = useDados();
  const fichas = useFichas();
  const corte = somarDias(hoje(), -30);

  const linhas = useMemo(() => {
    return d.clientes
      .map((c) => {
        const ts = d.tarefas.filter((t) => t.cliente_id === c.id && ((t.concluida_em && t.concluida_em.slice(0, 10) >= corte) || !["feita", "nao_feita"].includes(t.status)));
        const min = ts.reduce((s, t) => s + tempoAtual(t), 0);
        const comTempo = ts.filter((t) => tempoAtual(t) > 0);
        const comEst = comTempo.filter((t) => t.estimativa_min);
        const est = comEst.reduce((s, t) => s + (t.estimativa_min ?? 0), 0);
        const real = comEst.reduce((s, t) => s + tempoAtual(t), 0);
        const mens = fichas.mensalidade(c.id);
        return { c, min, tarefas: comTempo.length, mens, porHora: min > 0 && mens ? mens / (min / 60) : null, desvio: est ? Math.round(((real - est) / est) * 100) : null };
      })
      .filter((l) => l.min > 0 || l.mens > 0)
      .sort((a, b) => (a.porHora ?? Infinity) - (b.porHora ?? Infinity));
  }, [d.clientes, d.tarefas, fichas, corte]);

  const total = linhas.reduce((s, l) => s + l.min, 0);
  const receita = linhas.reduce((s, l) => s + l.mens, 0);
  const semTempo = linhas.filter((l) => l.min === 0).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Mini rotulo="Horas em 30 dias" valor={formatarMin(total)} />
        <Mini rotulo="Receita mensal" valor={moedaBR(receita, 0)} />
        <Mini rotulo="R$ por hora (média)" valor={total ? moedaBR(receita / (total / 60), 0) : "—"} />
        <Mini rotulo="Clientes sem tempo lançado" valor={String(semTempo)} />
      </div>
      <p className="text-[12.5px] text-muted">O tempo é contado sozinho enquanto a tarefa está em "Fazendo" (ou pelo botão Começar no painel da tarefa). Os mais trabalhosos para o que pagam aparecem primeiro.</p>
      {linhas.length === 0 ? (
        <Vazio>Ainda não há tempo lançado nas tarefas.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 text-right font-medium">Horas (30 dias)</th>
                <th className="px-3 py-2 text-right font-medium">Tarefas com tempo</th>
                <th className="px-3 py-2 text-right font-medium">Mensalidade</th>
                <th className="px-3 py-2 text-right font-medium">R$ por hora</th>
                <th className="px-3 py-2 text-right font-medium">Real x estimado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.c.id} onClick={() => ir(`cliente-${l.c.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-raised">
                  <td className="px-3 py-2 font-medium">{l.c.nome}</td>
                  <td className="num px-3 text-right">{l.min ? formatarMin(l.min) : <span className="text-muted">—</span>}</td>
                  <td className="num px-3 text-right text-muted">{l.tarefas || "—"}</td>
                  <td className="num px-3 text-right">{l.mens ? moedaBR(l.mens, 0) : <span className="text-muted">—</span>}</td>
                  <td className={`num px-3 text-right font-semibold ${l.porHora !== null && l.porHora < 80 ? "text-bad" : l.porHora !== null && l.porHora < 150 ? "text-warn" : ""}`}>{l.porHora !== null ? moedaBR(l.porHora, 0) : <span className="font-normal text-muted">—</span>}</td>
                  <td className={`num px-3 text-right ${l.desvio !== null && l.desvio > 20 ? "text-warn" : "text-muted"}`}>{l.desvio !== null ? `${l.desvio > 0 ? "+" : ""}${l.desvio}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Mini({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <b className="num block text-[17px]">{valor}</b>
      <span className="text-[12px] text-muted">{rotulo}</span>
    </div>
  );
}
