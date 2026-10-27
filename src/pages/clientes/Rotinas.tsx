import { useState } from "react";
import { Repeat } from "lucide-react";
import { useDados } from "../../lib/dados";
import { repo } from "../../lib/repo";
import { FREQUENCIA, PILAR, PRIORIDADE, type Prioridade, type Rotina } from "../../lib/tipos";
import { Botao, Rotulo, Selecao, campo } from "../../components/ui";

/** Modelos de rotina: checklist, mensagem e prioridade usados em todos os clientes. */
export function Rotinas() {
  const d = useDados();
  const [editando, setEditando] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[72ch] text-[13px] text-muted">
        Cada rotina é um modelo. A tarefa é criada sozinha às 6h no dia certo, para cada cliente que usa a rotina. Se a anterior ainda estiver
        aberta, nenhuma cópia nova é criada. Quem faz e em que dia fica na tela de cada cliente.
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {d.rotinas.map((r) => {
          const usos = d.clienteRotinas.filter((c) => c.rotina_id === r.id && c.ativa).length;
          return editando === r.id ? (
            <EditarRotina key={r.id} r={r} fechar={() => setEditando(null)} />
          ) : (
            <div key={r.id} className={`flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 ${r.ativa ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 font-display text-[15px] font-semibold">
                    <Repeat size={14} className="text-muted" /> {r.nome}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {PILAR[r.pilar]} · {FREQUENCIA[r.frequencia_padrao]} · prioridade {PRIORIDADE[r.prioridade].toLowerCase()}
                  </div>
                </div>
                <span className="num whitespace-nowrap rounded-full bg-raised px-2 py-0.5 text-[11.5px] text-muted">
                  {usos} {usos === 1 ? "cliente" : "clientes"}
                </span>
              </div>
              <ul className="flex flex-col gap-1 text-[12.5px]">
                {r.checklist.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted" /> {i}
                  </li>
                ))}
              </ul>
              {r.mensagem && <p className="line-clamp-2 rounded-lg bg-raised px-2.5 py-1.5 text-[12px] text-muted">{r.mensagem}</p>}
              <Botao variante="fantasma" className="self-start" onClick={() => setEditando(r.id)}>Editar modelo</Botao>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditarRotina({ r, fechar }: { r: Rotina; fechar: () => void }) {
  const d = useDados();
  const [checklist, setChecklist] = useState(r.checklist.join("\n"));
  const [mensagem, setMensagem] = useState(r.mensagem ?? "");
  const [prioridade, setPrioridade] = useState<Prioridade>(r.prioridade);
  const [ativa, setAtiva] = useState(r.ativa);
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-accent bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await repo.salvarRotina(r.id, {
            checklist: checklist.split("\n").map((s) => s.trim()).filter(Boolean),
            mensagem: mensagem.trim() || null,
            prioridade,
            ativa,
          });
          await d.recarregar();
          d.avisar("Modelo salvo. Vale para as próximas tarefas desta rotina.");
          fechar();
        } catch (err) {
          d.avisar((err as Error).message);
        }
      }}
    >
      <div className="font-display text-[15px] font-semibold">{r.nome}</div>
      <Rotulo texto="Checklist (um item por linha)">
        <textarea id={`rot-check-${r.id}`} rows={6} value={checklist} onChange={(e) => setChecklist(e.target.value)} className={campo} />
      </Rotulo>
      <Rotulo texto="Mensagem pronta (opcional)">
        <textarea id={`rot-msg-${r.id}`} rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value)} className={campo} />
      </Rotulo>
      <div className="flex flex-wrap items-end gap-3">
        <Rotulo texto="Prioridade">
          <Selecao id={`rot-prio-${r.id}`} value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>
            {Object.entries(PRIORIDADE).map(([v, n]) => (
              <option key={v} value={v}>{n}</option>
            ))}
          </Selecao>
        </Rotulo>
        <label className="flex items-center gap-2 pb-1.5 text-[13px]">
          <input id={`rot-ativa-${r.id}`} type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Rotina ativa
        </label>
      </div>
      <div className="flex gap-2">
        <Botao variante="primario" type="submit">Salvar modelo</Botao>
        <Botao variante="fantasma" type="button" onClick={fechar}>Cancelar</Botao>
      </div>
    </form>
  );
}
