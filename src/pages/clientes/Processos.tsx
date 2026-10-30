import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ListChecks, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useDados } from "../../lib/dados";
import { useTabela } from "../../lib/tabela";
import { PILAR, PILARES, PRIORIDADE, dataCurta, hoje, type Pilar, type Prioridade } from "../../lib/tipos";
import { aplicarProcesso, prazoUtil, processosDemo, type Etapa, type Processo, type ProcessoAplicado } from "../../lib/processos";
import { Botao, COR_PILAR, Entrada, Painel, Rotulo, Selecao, Vazio, campo } from "../../components/ui";

export function useProcessos() {
  const processos = useTabela<Processo>("processos", "id, nome, tipo, descricao, etapas, ordem", processosDemo, { ordem: { coluna: "ordem" } });
  const aplicados = useTabela<ProcessoAplicado>("processos_aplicados", "id, processo_id, nome, cliente_id, inicio, criado_em", () => [], { ordem: { coluna: "criado_em", asc: false } });
  return { processos, aplicados };
}

/** Progresso dos processos aplicados (pelas tarefas ligadas a cada um). */
export function ProgressoProcessos({ clienteId, aplicados }: { clienteId?: string; aplicados: ProcessoAplicado[] }) {
  const d = useDados();
  const lista = aplicados.filter((a) => !clienteId || a.cliente_id === clienteId);
  if (!lista.length) return null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {lista.map((a) => {
        const ts = d.tarefas.filter((t) => t.processo_aplicado_id === a.id);
        const feitas = ts.filter((t) => t.status === "feita" || t.status === "nao_feita").length;
        const pct = ts.length ? Math.round((feitas / ts.length) * 100) : 0;
        const proxima = ts.filter((t) => t.status !== "feita" && t.status !== "nao_feita").sort((x, y) => (x.prazo ?? "").localeCompare(y.prazo ?? ""))[0];
        return (
          <div key={a.id} className="rounded-xl border border-line bg-surface px-3.5 py-3" style={{ boxShadow: "var(--sombra)" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold">{a.nome}{!clienteId && <span className="font-normal text-muted"> · {d.cliente(a.cliente_id)?.nome}</span>}</div>
                <div className="text-[11.5px] text-muted">Início {a.inicio.slice(8, 10)}/{a.inicio.slice(5, 7)} · {feitas} de {ts.length} etapas</div>
              </div>
              {pct === 100 ? <CheckCircle2 size={20} className="shrink-0 text-ok" /> : <span className="num shrink-0 text-[15px] font-semibold text-accent">{pct}%</span>}
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-raised">
              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "var(--ok)" : "var(--accent)" }} />
            </div>
            {proxima && <div className="mt-1.5 truncate text-[11.5px] text-muted">Próxima: {proxima.titulo.replace(`${a.nome} · `, "")} · {dataCurta(proxima.prazo)}</div>}
          </div>
        );
      })}
    </div>
  );
}

/** Aba "Onboarding" da Gestão de Clientes. */
export function Processos() {
  const { processos, aplicados } = useProcessos();
  const [aplicar, setAplicar] = useState<Processo | null>(null);
  const [editar, setEditar] = useState<Processo | "novo" | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[80ch] text-[13px] text-muted">
        Ao fechar um cliente, aplique o <b>Pré-onboarding</b> no dia do fechamento e o <b>Onboarding</b> no dia do kickoff. As tarefas aparecem prontas, com checklist,
        prazo e responsável, no quadro de tarefas e na tela do cliente.
      </p>
      {processos.carregando ? (
        <Vazio>Carregando…</Vazio>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {processos.linhas.map((p) => (
            <section key={p.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4" style={{ boxShadow: "var(--sombra)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-accent">
                    <ListChecks size={18} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold">{p.nome}</h2>
                    <p className="text-[12.5px] text-muted">{p.descricao}</p>
                  </div>
                </div>
                <Botao variante="fantasma" onClick={() => setEditar(p)} aria-label="Editar processo"><Pencil size={14} /></Botao>
              </div>
              <ol className="relative flex flex-col gap-2 border-l-2 border-line pl-4">
                {p.etapas.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-surface" style={{ background: COR_PILAR[e.pilar] }} />
                    <div className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="font-medium">{e.titulo}</span>
                      <span className="shrink-0 text-[11.5px] text-muted">{e.dias === 0 ? "no dia" : `+${e.dias} dia${e.dias > 1 ? "s" : ""}`} · {e.checklist.length} itens</span>
                    </div>
                  </li>
                ))}
              </ol>
              <Botao variante="primario" onClick={() => setAplicar(p)} className="mt-auto self-start"><Play size={14} /> Aplicar em um cliente</Botao>
            </section>
          ))}
          <button onClick={() => setEditar("novo")} className="grid min-h-[160px] place-items-center rounded-2xl border border-dashed border-line text-[13px] text-muted hover:border-accent hover:text-accent">
            <span className="flex items-center gap-2"><Plus size={16} /> Novo processo (ex.: Offboarding, Renovação)</span>
          </button>
        </div>
      )}
      <div>
        <h2 className="eyebrow mb-2">Em andamento</h2>
        {aplicados.linhas.length ? <ProgressoProcessos aplicados={aplicados.linhas} /> : <Vazio>Nenhum processo aplicado ainda.</Vazio>}
      </div>
      {aplicar && <AplicarProcesso processos={processos.linhas} inicial={aplicar} fechar={() => setAplicar(null)} aoAplicar={() => aplicados.recarregar()} />}
      {editar && <EditorProcesso processo={editar === "novo" ? null : editar} salvar={processos.salvar} excluir={processos.excluir} fechar={() => setEditar(null)} />}
    </div>
  );
}

export function AplicarProcesso({ processos, inicial, clienteId, fechar, aoAplicar }: { processos: Processo[]; inicial?: Processo; clienteId?: string; fechar: () => void; aoAplicar?: () => void }) {
  const d = useDados();
  const [procId, setProcId] = useState(inicial?.id ?? processos[0]?.id ?? "");
  const [cliente, setCliente] = useState(clienteId ?? "");
  const [inicio, setInicio] = useState(hoje());
  const [resp, setResp] = useState<Partial<Record<Pilar, string | null>>>(() => Object.fromEntries(PILARES.map((p) => [p, d.eu])));
  const [aplicando, setAplicando] = useState(false);
  const p = processos.find((x) => x.id === procId);
  const pilares = useMemo(() => PILARES.filter((pl) => p?.etapas.some((e) => e.pilar === pl)), [p]);

  async function confirmar() {
    if (!p || !cliente) return;
    setAplicando(true);
    try {
      const n = await aplicarProcesso(p, cliente, inicio, resp);
      await d.recarregar();
      aoAplicar?.();
      d.avisar(`${n} tarefas criadas para ${d.cliente(cliente)?.nome}`);
      fechar();
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Painel aberto fechar={fechar} titulo="Aplicar processo" largura={560}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Rotulo texto="Processo">
            <Selecao value={procId} onChange={(e) => setProcId(e.target.value)}>
              {processos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </Selecao>
          </Rotulo>
          <Rotulo texto="Cliente">
            <Selecao value={cliente} onChange={(e) => setCliente(e.target.value)} disabled={Boolean(clienteId)}>
              <option value="">Escolha…</option>
              {d.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Selecao>
          </Rotulo>
          <Rotulo texto={p?.tipo === "onboarding" ? "Data do kickoff" : "Data de início (fechamento)"}>
            <Entrada type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Rotulo>
        </div>
        <div>
          <div className="mb-1.5 text-[12px] text-muted">Responsável por pilar</div>
          <div className="grid grid-cols-1 gap-2">
            {pilares.map((pl) => (
              <label key={pl} className="flex items-center gap-2 text-[12.5px]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COR_PILAR[pl] }} />
                <span className="w-[110px] shrink-0">{PILAR[pl]}</span>
                <select value={resp[pl] ?? ""} onChange={(e) => setResp({ ...resp, [pl]: e.target.value || null })} className={campo}>
                  <option value="">Sem responsável</option>
                  {d.membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
        {p && (
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="mb-2 text-[12px] font-medium text-muted">Vai criar {p.etapas.length} tarefas</div>
            <ul className="flex flex-col gap-1.5">
              {p.etapas.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COR_PILAR[e.pilar] }} />
                    <span className="truncate">{e.titulo}</span>
                  </span>
                  <span className="num shrink-0 text-muted">{prazoUtil(inicio, e.dias).slice(8, 10)}/{prazoUtil(inicio, e.dias).slice(5, 7)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Botao variante="primario" onClick={confirmar} disabled={!p || !cliente || aplicando}>{aplicando ? "Criando tarefas…" : `Criar ${p?.etapas.length ?? 0} tarefas`}</Botao>
      </div>
    </Painel>
  );
}

function EditorProcesso({ processo, salvar, excluir, fechar }: { processo: Processo | null; salvar: (id: string | null, c: Partial<Processo>) => Promise<string>; excluir: (id: string) => Promise<void>; fechar: () => void }) {
  const d = useDados();
  const [nome, setNome] = useState(processo?.nome ?? "");
  const [descricao, setDescricao] = useState(processo?.descricao ?? "");
  const [etapas, setEtapas] = useState<Etapa[]>(processo?.etapas ?? [{ titulo: "", pilar: "cs", dias: 0, prioridade: "normal", checklist: [] }]);
  const mudar = (i: number, c: Partial<Etapa>) => setEtapas(etapas.map((e, k) => (k === i ? { ...e, ...c } : e)));
  const mover = (i: number, dir: -1 | 1) => {
    const n = [...etapas];
    const j = i + dir;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    setEtapas(n);
  };

  return (
    <Painel aberto fechar={fechar} titulo={processo ? `Editar ${processo.nome}` : "Novo processo"} largura={680}>
      <div className="flex flex-col gap-4">
        <Rotulo texto="Nome"><Entrada value={nome} onChange={(e) => setNome(e.target.value)} /></Rotulo>
        <Rotulo texto="Descrição"><Entrada value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Rotulo>
        {etapas.map((e, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{i + 1}</span>
              <Entrada value={e.titulo} onChange={(ev) => mudar(i, { titulo: ev.target.value })} placeholder="Título da tarefa" />
              <Botao variante="fantasma" onClick={() => mover(i, -1)} aria-label="Subir"><ArrowUp size={14} /></Botao>
              <Botao variante="fantasma" onClick={() => mover(i, 1)} aria-label="Descer"><ArrowDown size={14} /></Botao>
              <Botao variante="fantasma" onClick={() => setEtapas(etapas.filter((_, k) => k !== i))} aria-label="Remover"><Trash2 size={14} /></Botao>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Selecao value={e.pilar} onChange={(ev) => mudar(i, { pilar: ev.target.value as Pilar })}>
                {PILARES.map((p) => <option key={p} value={p}>{PILAR[p]}</option>)}
              </Selecao>
              <Selecao value={e.prioridade} onChange={(ev) => mudar(i, { prioridade: ev.target.value as Prioridade })}>
                {(Object.keys(PRIORIDADE) as Prioridade[]).map((p) => <option key={p} value={p}>{PRIORIDADE[p]}</option>)}
              </Selecao>
              <label className="flex items-center gap-1.5 text-[12px] text-muted">
                Prazo +<input type="number" min={0} value={e.dias} onChange={(ev) => mudar(i, { dias: Number(ev.target.value) })} className={`${campo} !w-[64px]`} /> dias
              </label>
            </div>
            <textarea
              rows={Math.max(2, e.checklist.length)}
              value={e.checklist.join("\n")}
              onChange={(ev) => mudar(i, { checklist: ev.target.value.split("\n") })}
              placeholder="Checklist: um item por linha"
              className={`${campo} text-[12.5px]`}
            />
          </div>
        ))}
        <Botao onClick={() => setEtapas([...etapas, { titulo: "", pilar: "cs", dias: etapas[etapas.length - 1]?.dias ?? 0, prioridade: "normal", checklist: [] }])}><Plus size={14} /> Etapa</Botao>
        <div className="flex justify-between gap-2">
          {processo ? <Botao variante="fantasma" onClick={async () => { if (confirm(`Apagar o processo ${processo.nome}?`)) { await excluir(processo.id); fechar(); } }}><Trash2 size={14} /> Apagar</Botao> : <span />}
          <Botao
            variante="primario"
            disabled={!nome.trim() || !etapas.some((e) => e.titulo.trim())}
            onClick={async () => {
              try {
                await salvar(processo?.id ?? null, {
                  nome: nome.trim(),
                  descricao: descricao.trim() || null,
                  etapas: etapas.filter((e) => e.titulo.trim()).map((e) => ({ ...e, titulo: e.titulo.trim(), checklist: e.checklist.map((c) => c.trim()).filter(Boolean) })),
                  ...(processo ? {} : { tipo: "outro" as const, ordem: 9 }),
                });
                fechar();
              } catch (err) {
                d.avisar((err as Error).message);
              }
            }}
          >
            Salvar processo
          </Botao>
        </div>
      </div>
    </Painel>
  );
}
