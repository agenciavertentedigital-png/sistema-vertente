import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Hourglass } from "lucide-react";
import { useDados } from "../lib/dados";
import { repo } from "../lib/repo";
import { CANAL, SITUACAO, STATUS_ABERTOS, atrasada, dataCurta, diasUteis, hoje, somarDias, type Registro } from "../lib/tipos";
import { Botao, Entrada, Iniciais, PontoSituacao, Rotulo, Vazio } from "../components/ui";
import { CampoMencao, TextoComMencoes } from "../components/LinhaDoTempo";
import { PainelTarefa } from "../components/tarefas/PainelTarefa";

type Tipo = "daily" | "weekly";

/** Segunda-feira da semana de uma data. */
function segunda(dia: string) {
  const dow = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return somarDias(dia, dow === 0 ? -6 : 1 - dow);
}

export function Reunioes({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const tipo: Tipo = rota === "reuniao-weekly" ? "weekly" : "daily";
  const d = useDados();
  const [tarefa, setTarefa] = useState<string | null>(null);
  const hj = hoje();
  const agencia = d.clientes.find((c) => c.nome.toLowerCase().includes("vertente"));

  // ---- Alertas automáticos ----
  const contas = useMemo(() => {
    const ult = new Map<string, Registro>();
    for (const r of d.registros
      .filter((r) => (r.tipo === "revisao" || r.tipo === "otimizacao") && r.situacao)
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em)))
      ult.set(`${r.cliente_id}|${r.canal ?? ""}`, r);
    return [...ult.values()].filter((r) => r.situacao !== "ok").sort((a, b) => (a.situacao === "problema" ? -1 : 1) - (b.situacao === "problema" ? -1 : 1));
  }, [d.registros]);

  const abertas = d.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status));
  const atrasadas = abertas.filter((t) => atrasada(t));
  const aguardando = abertas.filter((t) => t.status === "aguardando");

  // ---- Por pessoa ----
  const inicioPeriodo = tipo === "daily" ? diasUteis(2)[0] : somarDias(segunda(hj), -7);
  const fimPeriodo = tipo === "daily" ? hj : somarDias(segunda(hj), -1);
  const pessoas = d.membros
    .map((m) => {
      const minhas = d.tarefas.filter((t) => t.responsavel_id === m.id);
      const feitas = minhas.filter((t) => t.status === "feita" && t.concluida_em && t.concluida_em.slice(0, 10) >= inicioPeriodo && t.concluida_em.slice(0, 10) <= fimPeriodo).length;
      const hoje_ = minhas.filter((t) => STATUS_ABERTOS.includes(t.status) && t.prazo && (tipo === "daily" ? t.prazo <= hj : t.prazo <= somarDias(segunda(hj), 6))).length;
      const atr = minhas.filter((t) => atrasada(t)).length;
      return { m, feitas, hoje: hoje_, atr };
    })
    .filter((p) => p.feitas || p.hoje || p.atr);

  // ---- Semana (weekly) ----
  const semanaPassada = useMemo(() => {
    if (tipo !== "weekly") return null;
    const ini = somarDias(segunda(hj), -7);
    const fim = somarDias(segunda(hj), -1);
    const regs = d.registros.filter((r) => r.data >= ini && r.data <= fim);
    const revisoes = regs.filter((r) => r.tipo === "revisao").length;
    const otim = regs.filter((r) => r.tipo === "otimizacao").length;
    const problemas = regs.filter((r) => r.situacao === "problema").length;
    const concluidas = d.tarefas.filter((t) => t.status === "feita" && t.concluida_em && t.concluida_em.slice(0, 10) >= ini && t.concluida_em.slice(0, 10) <= fim).length;
    const naoFeitas = d.tarefas.filter((t) => t.status === "nao_feita" && t.prazo && t.prazo >= ini && t.prazo <= fim).length;
    return { ini, fim, revisoes, otim, problemas, concluidas, naoFeitas };
  }, [tipo, d.registros, d.tarefas, hj]);

  const rotinaTarefa = d.tarefas.find((t) => {
    if (!t.cliente_rotina_id || !STATUS_ABERTOS.includes(t.status)) return false;
    const cr = d.clienteRotinas.find((c) => c.id === t.cliente_rotina_id);
    const nome = d.rotinas.find((r) => r.id === cr?.rotina_id)?.nome.toLowerCase() ?? "";
    return nome.startsWith(tipo);
  });

  const anteriores = d.registros.filter((r) => r.tipo === tipo).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const jaFeita = anteriores.find((r) => (tipo === "daily" ? r.data === hj : r.data >= segunda(hj)));

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">Ritual do time · {tipo === "daily" ? new Date(`${hj}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" }) : `semana de ${new Date(`${segunda(hj)}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: "UTC" })}`}</div>
          <h1 className="text-[22px] font-semibold leading-tight">{tipo === "daily" ? "Daily" : "Weekly"}</h1>
        </div>
        <div role="tablist" className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1">
          {(["daily", "weekly"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={tipo === v} onClick={() => ir(`reuniao-${v}`)} className={`rounded-lg px-3 py-1.5 text-[13px] ${tipo === v ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg"}`}>
              {v === "daily" ? "Daily" : "Weekly"}
            </button>
          ))}
        </div>
      </header>

      {d.carregando ? (
        <Vazio>Carregando…</Vazio>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-5">
            {semanaPassada && (
              <section className="flex flex-col gap-2">
                <h2 className="text-[14px] font-semibold">Semana passada <span className="font-normal text-muted">({dataCurta(semanaPassada.ini)} a {dataCurta(semanaPassada.fim)})</span></h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Mini rotulo="Revisões" valor={semanaPassada.revisoes} />
                  <Mini rotulo="Otimizações" valor={semanaPassada.otim} />
                  <Mini rotulo="Tarefas concluídas" valor={semanaPassada.concluidas} />
                  <Mini rotulo="Não feitas" valor={semanaPassada.naoFeitas} alerta={semanaPassada.naoFeitas > 0} />
                  <Mini rotulo="Registros em problema" valor={semanaPassada.problemas} alerta={semanaPassada.problemas > 0} />
                </div>
              </section>
            )}

            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold"><AlertTriangle size={15} className="text-bad" /> Contas que pedem atenção</h2>
              {contas.length === 0 ? (
                <p className="rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] text-muted">Todas as contas revisadas estão em verde.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {contas.map((r) => (
                    <li key={r.id}>
                      <button onClick={() => ir(`cliente-${r.cliente_id}`)} className="flex w-full items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-left text-[13px] hover:border-accent">
                        <PontoSituacao situacao={r.situacao} tamanho={11} />
                        <span className="min-w-0 flex-1 leading-snug">
                          <span className="font-medium">{d.cliente(r.cliente_id)?.nome}</span>
                          <span className="text-muted"> · {r.canal ? CANAL[r.canal] : "—"} · {SITUACAO[r.situacao!]} desde {dataCurta(r.data).toLowerCase()}</span>
                          {r.nota && <span className="block text-muted"><TextoComMencoes texto={r.nota} /></span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-5 sm:grid-cols-2">
              <ListaTarefas titulo="Atrasadas" icone={<Clock size={15} className="text-warn" />} lista={atrasadas} abrir={setTarefa} vazio="Nada atrasado." />
              <ListaTarefas titulo="Aguardando alguém" icone={<Hourglass size={15} className="text-muted" />} lista={aguardando} abrir={setTarefa} vazio="Nada parado esperando." />
            </div>

            <section className="flex flex-col gap-2">
              <h2 className="text-[14px] font-semibold">Cada pessoa</h2>
              {pessoas.length === 0 ? (
                <Vazio>Sem tarefas com responsável no período.</Vazio>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
                  <table className="w-full min-w-[420px] text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="eyebrow px-3 py-2 font-normal">Pessoa</th>
                        <th className="eyebrow px-3 py-2 text-right font-normal">{tipo === "daily" ? "Fez (ontem e hoje)" : "Fez na semana"}</th>
                        <th className="eyebrow px-3 py-2 text-right font-normal">{tipo === "daily" ? "Para hoje" : "Para esta semana"}</th>
                        <th className="eyebrow px-3 py-2 text-right font-normal">Atrasadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pessoas.map((p) => (
                        <tr key={p.m.id} className="border-b border-line last:border-0">
                          <td className="px-3 py-2"><span className="flex items-center gap-2"><Iniciais nome={p.m.nome} />{p.m.nome}</span></td>
                          <td className="num px-3 text-right">{p.feitas}</td>
                          <td className="num px-3 text-right">{p.hoje}</td>
                          <td className={`num px-3 text-right ${p.atr ? "font-semibold text-warn" : "text-muted"}`}>{p.atr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-0">
            {jaFeita ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-ok bg-ok-soft/40 p-4">
                <div className="flex items-center gap-2 font-semibold text-ok"><CheckCircle2 size={16} /> {tipo === "daily" ? "Daily de hoje registrada" : "Weekly da semana registrada"}</div>
                <AtaReuniao r={jaFeita} />
              </div>
            ) : agencia ? (
              <FormReuniao tipo={tipo} clienteId={agencia.id} tarefaId={rotinaTarefa?.id ?? null} />
            ) : (
              <Vazio>Cadastre o cliente "Agência Vertente Digital" para registrar as reuniões internas.</Vazio>
            )}

            {anteriores.filter((r) => r.id !== jaFeita?.id).length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-[13px] font-semibold">Anteriores</h2>
                {anteriores
                  .filter((r) => r.id !== jaFeita?.id)
                  .slice(0, 6)
                  .map((r) => (
                    <details key={r.id} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
                      <summary className="cursor-pointer font-medium">{dataCurta(r.data)} <span className="font-normal text-muted">· {d.membro(r.autor_id)?.nome ?? ""}</span></summary>
                      <div className="mt-2"><AtaReuniao r={r} /></div>
                    </details>
                  ))}
              </section>
            )}
          </aside>
        </div>
      )}
      <PainelTarefa id={tarefa} fechar={() => setTarefa(null)} />
    </div>
  );
}

function Mini({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${alerta ? "border-warn bg-warn-soft" : "border-line bg-surface"}`}>
      <div className={`num text-[20px] font-medium leading-none ${alerta ? "text-warn" : ""}`}>{valor}</div>
      <div className="mt-1 text-[12px] text-muted">{rotulo}</div>
    </div>
  );
}

function ListaTarefas({ titulo, icone, lista, abrir, vazio }: { titulo: string; icone: React.ReactNode; lista: ReturnType<typeof useDados>["tarefas"]; abrir: (id: string) => void; vazio: string }) {
  const d = useDados();
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold">{icone} {titulo} <span className="num font-normal text-muted">{lista.length}</span></h2>
      {lista.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] text-muted">{vazio}</p>
      ) : (
        <ul className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
          {lista.slice(0, 30).map((t) => (
            <li key={t.id}>
              <button onClick={() => abrir(t.id)} className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-[12.5px] hover:border-accent">
                <span className="min-w-0 flex-1 truncate"><span className="text-muted">{d.cliente(t.cliente_id)?.nome} · </span>{t.titulo}</span>
                <span className="num shrink-0 text-muted">{dataCurta(t.prazo)}</span>
                <Iniciais nome={d.membro(t.responsavel_id)?.nome} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AtaReuniao({ r }: { r: Registro }) {
  const focos = r.dados?.focos?.filter(Boolean) ?? [];
  return (
    <div className="flex flex-col gap-2 text-[13px] leading-snug">
      {focos.length > 0 && (
        <div>
          <div className="eyebrow mb-1">Focos</div>
          <ol className="list-decimal pl-5">{focos.map((f, i) => <li key={i}>{f}</li>)}</ol>
        </div>
      )}
      {r.dados?.bloqueios && (
        <div>
          <div className="eyebrow mb-1">Bloqueios</div>
          <p className="whitespace-pre-wrap"><TextoComMencoes texto={r.dados.bloqueios} /></p>
        </div>
      )}
      {r.dados?.decisoes && (
        <div>
          <div className="eyebrow mb-1">Decisões</div>
          <p className="whitespace-pre-wrap"><TextoComMencoes texto={r.dados.decisoes} /></p>
        </div>
      )}
    </div>
  );
}

function FormReuniao({ tipo, clienteId, tarefaId }: { tipo: Tipo; clienteId: string; tarefaId: string | null }) {
  const d = useDados();
  const [focos, setFocos] = useState(["", "", ""]);
  const [bloqueios, setBloqueios] = useState("");
  const [decisoes, setDecisoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const pronto = focos.some((f) => f.trim());

  async function salvar() {
    setSalvando(true);
    try {
      const nota = [bloqueios.trim(), decisoes.trim()].filter(Boolean).join("\n\n") || null;
      await repo.registrar({
        cliente_id: clienteId,
        tarefa_id: tarefaId,
        tipo,
        nota, // a nota leva bloqueios e decisões para que as @menções avisem as pessoas
        dados: { focos: focos.map((f) => f.trim()).filter(Boolean), bloqueios: bloqueios.trim(), decisoes: decisoes.trim() },
      });
      if (tarefaId) await repo.salvarTarefa(tarefaId, { status: "feita" });
      await d.recarregar();
      d.avisar(tarefaId ? `${tipo === "daily" ? "Daily" : "Weekly"} registrada e tarefa da rotina concluída` : "Reunião registrada");
    } catch (e) {
      d.avisar(`Não foi possível salvar: ${(e as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent bg-surface p-4">
      <div>
        <div className="eyebrow">Ata rápida</div>
        <h2 className="mt-0.5 text-[15px] font-semibold">{tipo === "daily" ? "3 focos de hoje" : "3 focos da semana"}</h2>
      </div>
      {focos.map((f, i) => (
        <Entrada key={i} id={`foco-${i}`} aria-label={`Foco ${i + 1}`} placeholder={`${i + 1}. ${i === 0 ? "O mais importante" : "Foco"}`} value={f} onChange={(e) => setFocos((v) => v.map((x, j) => (j === i ? e.target.value : x)))} />
      ))}
      <Rotulo texto="Bloqueios (quem precisa de quê, use @Nome)">
        <CampoMencao id="bloqueios" rows={2} valor={bloqueios} mudar={setBloqueios} />
      </Rotulo>
      <Rotulo texto="Decisões">
        <CampoMencao id="decisoes" rows={2} valor={decisoes} mudar={setDecisoes} />
      </Rotulo>
      <Botao variante="primario" disabled={!pronto || salvando} onClick={salvar}>
        {salvando ? "Salvando…" : tarefaId ? "Registrar e concluir a rotina" : "Registrar"}
      </Botao>
    </div>
  );
}
