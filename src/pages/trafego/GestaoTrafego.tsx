import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useDados } from "../../lib/dados";
import { CANAL, SITUACAO, STATUS_ABERTOS, dataCurta, diasUteis, hoje, type Canal, type Registro, type Situacao } from "../../lib/tipos";
import { PainelTarefa } from "../../components/tarefas/PainelTarefa";
import { VisaoGeral } from "./VisaoGeral";
import { Contas } from "./Contas";
import { DashboardCliente } from "./DashboardCliente";
import { ListaDashboards } from "./ListaDashboards";
import { useTrafego } from "../../lib/trafego";
import { Botao, COR_SITUACAO, Iniciais, Painel, PontoSituacao, Selecao, Vazio } from "../../components/ui";

const ABAS = [
  { id: "trafego", nome: "Visão geral" },
  { id: "trafego-dashboards", nome: "Dashboards dos clientes" },
  { id: "trafego-saude", nome: "Saúde das contas" },
  { id: "trafego-alteracoes", nome: "Histórico de alterações" },
  { id: "trafego-contas", nome: "Contas" },
];

const PESO: Record<Situacao | "nada", number> = { problema: 0, atencao: 1, nada: 2, ok: 3 };
const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function GestaoTrafego({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const d = useDados();
  const aba = ABAS.some((a) => a.id === rota) ? rota : "trafego";
  const trafego = useTrafego();
  if (rota.startsWith("trafego-cliente-")) return <DashboardCliente key={rota} clienteId={rota.slice("trafego-cliente-".length)} ir={ir} />;
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight">Tráfego</h1>
        </div>
        <Botao variante="fantasma" onClick={() => { d.recarregar(); trafego.recarregar(); }} aria-label="Recarregar a tela">
          <RefreshCw size={14} />
        </Botao>
      </header>
      <div className="-mx-1 overflow-x-auto px-1">
        <div role="tablist" className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1">
          {ABAS.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => ir(a.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] ${aba === a.id ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg"}`}
            >
              {a.nome}
            </button>
          ))}
        </div>
      </div>
      {d.carregando ? (
        <Vazio>Carregando…</Vazio>
      ) : aba === "trafego" ? (
        <VisaoGeral trafego={trafego} ir={ir} />
      ) : aba === "trafego-dashboards" ? (
        <ListaDashboards trafego={trafego} ir={ir} />
      ) : aba === "trafego-saude" ? (
        <Saude ir={ir} />
      ) : aba === "trafego-contas" ? (
        <Contas trafego={trafego} />
      ) : (
        <Alteracoes ir={ir} />
      )}
    </div>
  );
}

interface Linha {
  chave: string;
  clienteId: string;
  cliente: string;
  canal: Canal | null;
  responsavel?: string;
  porDia: Map<string, Registro>;
  ultimo?: Registro;
  tarefaHoje?: string; // revisão aberta de hoje (ou atrasada)
}

function Saude({ ir }: { ir: (r: string) => void }) {
  const d = useDados();
  const [tarefa, setTarefa] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Registro | null>(null);
  const dias = useMemo(() => diasUteis(10), []);
  const hj = hoje();

  const linhas = useMemo(() => {
    const revisoes = new Set(d.rotinas.filter((r) => r.nome.toLowerCase().startsWith("revisão")).map((r) => r.id));
    const mapa = new Map<string, Linha>();
    for (const cr of d.clienteRotinas) {
      if (!cr.ativa || !revisoes.has(cr.rotina_id)) continue;
      const chave = `${cr.cliente_id}|${cr.canal ?? ""}`;
      if (mapa.has(chave)) continue;
      const tarefaAberta = d.tarefas
        .filter((t) => t.cliente_rotina_id === cr.id && STATUS_ABERTOS.includes(t.status))
        .sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""))[0];
      mapa.set(chave, {
        chave,
        clienteId: cr.cliente_id,
        cliente: d.cliente(cr.cliente_id)?.nome ?? "Cliente",
        canal: cr.canal,
        responsavel: d.membro(cr.responsavel_id)?.nome,
        porDia: new Map(),
        tarefaHoje: tarefaAberta?.id,
      });
    }
    const regs = d.registros.filter((r) => r.tipo === "revisao" || r.tipo === "otimizacao").sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    for (const r of regs) {
      const l = mapa.get(`${r.cliente_id}|${r.canal ?? ""}`);
      if (!l || !r.situacao) continue;
      l.porDia.set(r.data, r); // o mais recente do dia fica
      l.ultimo = r;
    }
    return [...mapa.values()].sort(
      (a, b) => PESO[a.ultimo?.situacao ?? "nada"] - PESO[b.ultimo?.situacao ?? "nada"] || a.cliente.localeCompare(b.cliente),
    );
  }, [d.rotinas, d.clienteRotinas, d.tarefas, d.registros]); // eslint-disable-line react-hooks/exhaustive-deps

  const conta = (s: Situacao) => linhas.filter((l) => l.ultimo?.situacao === s).length;
  const pendentesHoje = linhas.filter((l) => !l.porDia.has(hj)).length;

  if (linhas.length === 0) return <Vazio>Nenhuma conta com rotina de revisão ativa. Adicione a rotina "Revisão diária" na tela do cliente.</Vazio>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Contador cor="var(--bad)" rotulo="Em problema" valor={conta("problema")} />
        <Contador cor="var(--warn)" rotulo="Em atenção" valor={conta("atencao")} />
        <Contador cor="var(--ok)" rotulo="Tudo certo" valor={conta("ok")} />
        <Contador cor="var(--muted)" rotulo="Sem revisão hoje" valor={pendentesHoje} vazado />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow sticky left-0 z-[1] bg-surface px-3 py-2.5 font-normal">Conta</th>
              <th className="eyebrow px-2 py-2.5 font-normal">Resp.</th>
              {dias.map((dia) => {
                const dt = new Date(`${dia}T12:00:00Z`);
                return (
                  <th key={dia} className={`px-1 py-2 text-center font-normal ${dia === hj ? "text-accent" : "text-muted"}`}>
                    <div className="text-[10.5px] uppercase">{dia === hj ? "hoje" : DIA_CURTO[dt.getUTCDay()]}</div>
                    <div className="num text-[11px]">{dia.slice(8)}</div>
                  </th>
                );
              })}
              <th className="eyebrow px-3 py-2.5 font-normal">Última observação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave} className="border-b border-line last:border-0">
                <td className="sticky left-0 z-[1] max-w-[150px] bg-surface px-3 py-2 sm:max-w-none">
                  <button onClick={() => ir(`cliente-${l.clienteId}`)} className="flex items-center gap-2 text-left">
                    <PontoSituacao situacao={l.ultimo?.situacao ?? null} tamanho={10} />
                    <span className="font-medium hover:text-accent">{l.cliente}</span>
                  </button>
                  <div className="pl-[18px] text-[11.5px] text-muted">{l.canal ? CANAL[l.canal] : "Sem canal"}</div>
                </td>
                <td className="px-2">
                  <Iniciais nome={l.responsavel} />
                </td>
                {dias.map((dia) => {
                  const r = l.porDia.get(dia);
                  const ehHoje = dia === hj;
                  if (r)
                    return (
                      <td key={dia} className="px-1 text-center">
                        <button
                          onClick={() => setDetalhe(r)}
                          title={`${dataCurta(dia)}: ${SITUACAO[r.situacao!]}${r.nota ? ` · ${r.nota}` : ""}`}
                          className="mx-auto grid h-7 w-7 place-items-center rounded-lg hover:bg-raised"
                          aria-label={`${dataCurta(dia)}: ${SITUACAO[r.situacao!]}`}
                        >
                          <span className="h-4 w-4 rounded-md" style={{ background: COR_SITUACAO[r.situacao!] }} />
                        </button>
                      </td>
                    );
                  if (ehHoje && l.tarefaHoje)
                    return (
                      <td key={dia} className="px-1 text-center">
                        <button
                          onClick={() => setTarefa(l.tarefaHoje!)}
                          className="mx-auto grid h-7 w-7 place-items-center rounded-lg border-2 border-dashed border-accent text-[14px] font-semibold leading-none text-accent hover:bg-accent-soft"
                          title="Revisar agora"
                          aria-label={`Revisar ${l.cliente} agora`}
                        >
                          +
                        </button>
                      </td>
                    );
                  return (
                    <td key={dia} className="px-1 text-center">
                      <span className="mx-auto block h-4 w-4 rounded-md border border-line" title={`${dataCurta(dia)}: sem registro`} />
                    </td>
                  );
                })}
                <td className="max-w-[260px] px-3 text-[12px] text-muted">
                  <span className="line-clamp-2">{l.ultimo?.nota ?? (l.ultimo ? l.ultimo.acoes.join(" · ") : "Nenhuma revisão registrada")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-muted">
        Cada quadrado é a revisão do dia. Clique no <span className="font-semibold text-accent">+</span> de hoje para revisar a conta; ao registrar, o quadrado ganha a cor.
        Conta marcada como Problema avisa o time no sininho.
      </p>

      <PainelTarefa id={tarefa} fechar={() => setTarefa(null)} />
      <DetalheRegistro r={detalhe} fechar={() => setDetalhe(null)} />
    </>
  );
}

function Contador({ cor, rotulo, valor, vazado }: { cor: string; rotulo: string; valor: number; vazado?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="h-3.5 w-3.5 shrink-0 rounded-md" style={vazado ? { border: `2px dashed ${cor}` } : { background: cor }} />
      <div>
        <div className="num text-[22px] font-medium leading-none">{valor}</div>
        <div className="mt-1 text-[12px] text-muted">{rotulo}</div>
      </div>
    </div>
  );
}

export function DetalheRegistro({ r, fechar }: { r: Registro | null; fechar: () => void }) {
  const d = useDados();
  return (
    <Painel aberto={Boolean(r)} fechar={fechar} titulo={r ? `${d.cliente(r.cliente_id)?.nome ?? "Cliente"} · ${dataCurta(r.data)}` : ""} largura={460}>
      {r && <CorpoRegistro r={r} />}
    </Painel>
  );
}

export function CorpoRegistro({ r }: { r: Registro }) {
  const d = useDados();
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="flex items-center gap-2">
        <PontoSituacao situacao={r.situacao} tamanho={12} />
        <span className="font-semibold">{r.situacao ? SITUACAO[r.situacao] : "Registro"}</span>
        <span className="text-muted">
          {r.tipo === "revisao" ? "Revisão" : "Otimização"}
          {r.canal ? ` · ${CANAL[r.canal]}` : ""} · {d.membro(r.autor_id)?.nome ?? "Alguém"}
        </span>
      </div>
      {r.acoes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.acoes.map((a) => (
            <span key={a} className="rounded-full bg-raised px-2.5 py-0.5 text-[12px]">{a}</span>
          ))}
        </div>
      )}
      {r.alteracoes.length > 0 && <TabelaAlteracoes r={r} />}
      {r.nota && <p className="whitespace-pre-wrap rounded-lg bg-raised px-3 py-2 leading-relaxed">{r.nota}</p>}
    </div>
  );
}

function TabelaAlteracoes({ r }: { r: Registro }) {
  return (
    <ul className="flex flex-col gap-1">
      {r.alteracoes.map((a, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-raised px-3 py-1.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{a.tipo}</span>
          <span>{a.descricao}</span>
          {(a.antes || a.depois) && (
            <span className="num ml-auto text-[12px]">
              <span className="text-muted line-through">{a.antes || "—"}</span> → <span className="font-semibold">{a.depois || "—"}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Alteracoes({ ir }: { ir: (r: string) => void }) {
  const d = useDados();
  const [cliente, setCliente] = useState("");
  const [canal, setCanal] = useState("");
  const lista = d.registros
    .filter((r) => r.tipo === "otimizacao" && (!cliente || r.cliente_id === cliente) && (!canal || r.canal === canal))
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const clientes = [...new Set(d.registros.filter((r) => r.tipo === "otimizacao").map((r) => r.cliente_id))]
    .map((id) => ({ id, nome: d.cliente(id)?.nome ?? "Cliente" }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Selecao id="alt-cliente" aria-label="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} className="!w-auto">
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </Selecao>
        <Selecao id="alt-canal" aria-label="Canal" value={canal} onChange={(e) => setCanal(e.target.value)} className="!w-auto">
          <option value="">Todos os canais</option>
          {Object.entries(CANAL).map(([v, n]) => (
            <option key={v} value={v}>{n}</option>
          ))}
        </Selecao>
      </div>
      {lista.length === 0 ? (
        <Vazio>Nenhuma otimização registrada nos últimos 40 dias. Elas aparecem aqui quando alguém conclui uma tarefa de Otimização.</Vazio>
      ) : (
        <ol className="flex flex-col gap-3">
          {lista.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-surface p-4" style={{ borderLeft: `3px solid ${r.situacao ? COR_SITUACAO[r.situacao] : "var(--line)"}` }}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <button onClick={() => ir(`cliente-${r.cliente_id}`)} className="font-semibold hover:text-accent">
                  {d.cliente(r.cliente_id)?.nome ?? "Cliente"}
                </button>
                <span className="num text-[12px] text-muted">
                  {dataCurta(r.data)} · {r.canal ? CANAL[r.canal] : "—"} · {d.membro(r.autor_id)?.nome ?? "Alguém"}
                </span>
              </div>
              <TabelaAlteracoes r={r} />
              {r.nota && <p className="mt-2 whitespace-pre-wrap text-[13px] text-muted">{r.nota}</p>}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
