import { Fragment, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Wallet } from "lucide-react";
import { useDados } from "../../lib/dados";
import { hoje, somarDias } from "../../lib/tipos";
import { STATUS_CONTA, nomeResultado, repoTrafego, useTrafego, type ContaAnuncio, type DiaConta, type LinhaCampanha } from "../../lib/trafego";
import { Botao, Vazio } from "../../components/ui";

export const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v >= 1000 ? 0 : 2 });
const inteiro = (v: number) => Math.round(v).toLocaleString("pt-BR");

type Nivel = "ruim" | "atencao";
interface Alerta {
  nivel: Nivel;
  texto: string;
}

export interface Resumo {
  conta: ContaAnuncio;
  gasto: number;
  gastoAnt: number;
  tipo: string;
  resultados: number;
  custo: number | null;
  custoAnt: number | null;
  ontem: number;
  mediaDia: number;
  serie: number[];
  alertas: Alerta[];
}

function variacao(atual: number, antes: number | null) {
  if (!antes) return null;
  return (atual - antes) / antes;
}

/** Junta os dias de uma conta num período e calcula o resultado principal (tipo com maior investimento). */
export function resumir(conta: ContaAnuncio, dias: DiaConta[], ini: string, fim: string): Resumo {
  const n = Math.round((new Date(`${fim}T12:00:00Z`).getTime() - new Date(`${ini}T12:00:00Z`).getTime()) / 86400000) + 1;
  const iniAnt = somarDias(ini, -n);
  const fimAnt = somarDias(ini, -1);
  const daConta = dias.filter((d) => d.conta_id === conta.id);
  const periodo = daConta.filter((d) => d.data >= ini && d.data <= fim);
  const anterior = daConta.filter((d) => d.data >= iniAnt && d.data <= fimAnt);

  const porTipo = new Map<string, { gasto: number; res: number }>();
  for (const d of periodo) {
    const t = porTipo.get(d.tipo_resultado) ?? { gasto: 0, res: 0 };
    t.gasto += d.gasto;
    t.res += d.resultados;
    porTipo.set(d.tipo_resultado, t);
  }
  const [tipo, principal] = [...porTipo.entries()].sort((a, b) => b[1].gasto - a[1].gasto)[0] ?? ["", { gasto: 0, res: 0 }];
  const ant = anterior.filter((d) => d.tipo_resultado === tipo).reduce((s, d) => ({ gasto: s.gasto + d.gasto, res: s.res + d.resultados }), { gasto: 0, res: 0 });

  const gasto = periodo.reduce((s, d) => s + d.gasto, 0);
  const gastoAnt = anterior.reduce((s, d) => s + d.gasto, 0);
  const serie: number[] = [];
  for (let k = 0; k < n; k++) {
    const dia = somarDias(ini, k);
    serie.push(periodo.filter((d) => d.data === dia).reduce((s, d) => s + d.gasto, 0));
  }
  const ontem = daConta.filter((d) => d.data === somarDias(hoje(), -1)).reduce((s, d) => s + d.gasto, 0);
  const mediaDia = gasto / n;
  const custo = principal.res ? principal.gasto / principal.res : null;
  const custoAnt = ant.res ? ant.gasto / ant.res : null;

  const alertas: Alerta[] = [];
  if (conta.status && conta.status !== "ativa") alertas.push({ nivel: "ruim", texto: STATUS_CONTA[conta.status] ?? conta.status });
  if (conta.saldo !== null && mediaDia > 0) {
    const diasSaldo = conta.saldo / mediaDia;
    if (diasSaldo < 1) alertas.push({ nivel: "ruim", texto: "Saldo acaba hoje" });
    else if (diasSaldo < 3) alertas.push({ nivel: "ruim", texto: `Saldo para ${Math.floor(diasSaldo)} dia${Math.floor(diasSaldo) === 1 ? "" : "s"}` });
    else if (diasSaldo < 7) alertas.push({ nivel: "atencao", texto: `Saldo para ${Math.floor(diasSaldo)} dias` });
  }
  if (conta.status === "ativa" && mediaDia > 1 && ontem === 0) alertas.push({ nivel: "atencao", texto: "Não veiculou ontem" });
  const vc = custo !== null ? variacao(custo, custoAnt) : null;
  if (vc !== null && vc > 0.3 && principal.res >= 3) alertas.push({ nivel: "atencao", texto: `Custo por ${nomeResultado(tipo, false)} subiu ${Math.round(vc * 100)}%` });
  if (conta.erro_sync) alertas.push({ nivel: "atencao", texto: "Erro ao atualizar" });
  if (daConta.length === 0 && conta.status === "ativa") alertas.push({ nivel: "atencao", texto: "Sem dados da Meta ainda" });

  return { conta, gasto, gastoAnt, tipo, resultados: principal.res, custo, custoAnt, ontem, mediaDia, serie, alertas };
}

function Variacao({ v, inverso }: { v: number | null; inverso?: boolean }) {
  if (v === null || !isFinite(v) || Math.abs(v) < 0.005) return <span className="text-muted">—</span>;
  const bom = inverso ? v < 0 : v > 0;
  return (
    <span className={`num text-[11.5px] font-medium ${bom ? "text-ok" : "text-bad"}`}>
      {v > 0 ? "▲" : "▼"} {Math.abs(Math.round(v * 100))}%
    </span>
  );
}

function Barras({ serie }: { serie: number[] }) {
  const max = Math.max(...serie, 1);
  return (
    <svg width={serie.length * 5} height={24} className="block" aria-hidden>
      {serie.map((v, i) => {
        const h = v ? Math.max(2, (v / max) * 22) : 1;
        return <rect key={i} x={i * 5} y={24 - h} width={3.5} height={h} rx={1} fill={v ? "var(--accent)" : "var(--line)"} opacity={i === serie.length - 1 ? 1 : 0.55} />;
      })}
    </svg>
  );
}

function quandoAtualizou(iso: string | null) {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function VisaoGeral({ trafego, ir }: { trafego: ReturnType<typeof useTrafego>; ir: (r: string) => void }) {
  const d = useDados();
  const [periodo, setPeriodo] = useState<7 | 30>(7);
  const [aberta, setAberta] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const fim = somarDias(hoje(), -1);
  const ini = somarDias(fim, -(periodo - 1));

  const resumos = useMemo(
    () =>
      trafego.contas
        .filter((c) => c.ativa)
        .map((c) => resumir(c, trafego.dias, ini, fim))
        .sort((a, b) => {
          const pa = a.alertas.some((x) => x.nivel === "ruim") ? 0 : a.alertas.length ? 1 : 2;
          const pb = b.alertas.some((x) => x.nivel === "ruim") ? 0 : b.alertas.length ? 1 : 2;
          return pa - pb || b.gasto - a.gasto;
        }),
    [trafego.contas, trafego.dias, ini, fim],
  );

  const total = resumos.reduce((s, r) => s + r.gasto, 0);
  const totalAnt = resumos.reduce((s, r) => s + r.gastoAnt, 0);
  const noPeriodo = trafego.dias.filter((x) => x.data >= ini && x.data <= fim && resumos.some((r) => r.conta.id === x.conta_id));
  const conversas = noPeriodo.reduce((s, x) => s + x.conversas, 0);
  const leads = noPeriodo.reduce((s, x) => s + x.leads, 0);
  const comAlerta = resumos.filter((r) => r.alertas.length).length;
  const ultimo = trafego.contas.map((c) => c.ultimo_sync).filter(Boolean).sort().pop() ?? null;
  const nuncaSincronizou = trafego.contas.length > 0 && !ultimo;
  const ultimoDia = trafego.dias.map((x) => x.data).sort().pop();

  async function atualizar() {
    setAtualizando(true);
    try {
      d.avisar(await repoTrafego.sincronizar());
      await trafego.recarregar();
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setAtualizando(false);
    }
  }

  if (trafego.carregando) return <Vazio>Carregando contas…</Vazio>;
  if (trafego.erro) return <Vazio>Não foi possível carregar: {trafego.erro}</Vazio>;
  if (trafego.contas.length === 0) return <Vazio>Nenhuma conta de anúncio vinculada. Vincule na aba Contas.</Vazio>;

  return (
    <>
      {nuncaSincronizou && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-warn bg-warn-soft px-4 py-3 text-[13px]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1 leading-snug">
            {ultimoDia ? (
              <>
                <strong>Números carregados até {new Date(`${ultimoDia}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}, sem atualização automática ainda.</strong> Saldo e status
                das contas também esperam o token. Quando ele for salvo no Supabase, tudo passa a atualizar sozinho às 7h, 12h e 17h.
              </>
            ) : (
              <>
                <strong>Falta conectar a Meta.</strong> As {trafego.contas.length} contas já estão vinculadas aos clientes. Assim que o token da Meta for salvo no Supabase,
                os números dos últimos 30 dias entram aqui e passam a atualizar sozinhos às 7h, 12h e 17h.
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1">
          {([7, 30] as const).map((p) => (
            <button key={p} role="tab" aria-selected={periodo === p} onClick={() => setPeriodo(p)} className={`rounded-lg px-3 py-1 text-[12.5px] ${periodo === p ? "bg-raised font-medium text-fg" : "text-muted hover:text-fg"}`}>
              Últimos {p} dias
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted">
          {ultimo ? `Atualizado ${quandoAtualizou(ultimo)}` : "Atualização automática desligada"}
          <Botao onClick={atualizar} disabled={atualizando}>
            <RefreshCw size={14} className={atualizando ? "animate-spin" : ""} /> {atualizando ? "Buscando na Meta…" : "Atualizar agora"}
          </Botao>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cartao rotulo={`Investimento (${periodo} dias)`} valor={moeda(total)} extra={<Variacao v={variacao(total, totalAnt)} />} />
        <Cartao rotulo="Conversas iniciadas" valor={inteiro(conversas)} />
        <Cartao rotulo="Leads" valor={inteiro(leads)} />
        <Cartao rotulo="Contas com alerta" valor={String(comAlerta)} alerta={comAlerta > 0} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[920px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {["Conta", "Alertas", "Investimento", "Por dia", "Resultado principal", "Custo por resultado", "Ontem", "Saldo"].map((h, i) => (
                <th key={h} className={`eyebrow px-3 py-2.5 font-normal ${i === 0 ? "sticky left-0 z-[1] bg-surface" : ""} ${i >= 2 && i !== 3 && i !== 4 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumos.map((r) => {
              const cliente = d.cliente(r.conta.cliente_id)?.nome ?? "Cliente";
              const expandida = aberta === r.conta.id;
              return (
                <Fragment key={r.conta.id}>
                  <tr className={`border-b border-line ${expandida ? "bg-raised/40" : ""}`}>
                    <td className="sticky left-0 z-[1] max-w-[220px] bg-surface px-3 py-2.5">
                      <button onClick={() => setAberta(expandida ? null : r.conta.id)} className="flex items-start gap-1.5 text-left" aria-expanded={expandida}>
                        {expandida ? <ChevronDown size={15} className="mt-0.5 shrink-0 text-muted" /> : <ChevronRight size={15} className="mt-0.5 shrink-0 text-muted" />}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{cliente}</span>
                          <span className="block truncate text-[11.5px] text-muted">{r.conta.nome}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {r.alertas.length === 0 ? (
                          <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11.5px] text-ok">Tudo certo</span>
                        ) : (
                          r.alertas.map((a) => (
                            <span key={a.texto} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ${a.nivel === "ruim" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}>{a.texto}</span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 text-right">
                      <div className="num font-medium">{moeda(r.gasto)}</div>
                      <Variacao v={variacao(r.gasto, r.gastoAnt)} />
                    </td>
                    <td className="px-3"><Barras serie={r.serie} /></td>
                    <td className="px-3">
                      {r.resultados ? (
                        <span><span className="num font-medium">{inteiro(r.resultados)}</span> <span className="text-muted">{nomeResultado(r.tipo, r.resultados !== 1)}</span></span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 text-right">
                      <div className="num font-medium">{r.custo !== null ? moeda(r.custo) : "—"}</div>
                      <Variacao v={r.custo !== null ? variacao(r.custo, r.custoAnt) : null} inverso />
                    </td>
                    <td className={`num px-3 text-right ${r.ontem === 0 && r.mediaDia > 1 ? "font-semibold text-warn" : ""}`}>{moeda(r.ontem)}</td>
                    <td className="px-3 text-right">
                      {r.conta.saldo !== null ? (
                        <span className="num flex items-center justify-end gap-1"><Wallet size={13} className="text-muted" />{moeda(r.conta.saldo)}</span>
                      ) : (
                        <span className="text-[11.5px] text-muted">{r.conta.pre_paga === false ? "Cartão" : "—"}</span>
                      )}
                    </td>
                  </tr>
                  {expandida && (
                    <tr className="border-b border-line bg-raised/40">
                      <td colSpan={8} className="px-3 pb-3 pt-1">
                        <Campanhas conta={r.conta} ini={ini} fim={fim} />
                        <div className="mt-2 flex gap-4">
                          <button onClick={() => ir(`trafego-cliente-${r.conta.cliente_id}`)} className="text-[12.5px] font-medium text-accent">Abrir dashboard de {cliente}</button>
                          <button onClick={() => ir(`cliente-${r.conta.cliente_id}`)} className="text-[12.5px] text-muted hover:text-fg">Tarefas do cliente</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-muted">
        Período até ontem, comparado com os {periodo} dias anteriores. Resultado principal é o tipo de resultado com mais investimento na conta.
        Clique numa conta para ver as campanhas.
      </p>
    </>
  );
}

function Cartao({ rotulo, valor, extra, alerta }: { rotulo: string; valor: string; extra?: React.ReactNode; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${alerta ? "border-warn bg-warn-soft" : "border-line bg-surface"}`}>
      <div className="flex items-baseline gap-2">
        <span className={`num text-[22px] font-medium leading-none ${alerta ? "text-warn" : ""}`}>{valor}</span>
        {extra}
      </div>
      <div className="mt-1 text-[12px] text-muted">{rotulo}</div>
    </div>
  );
}

const STATUS_CAMPANHA: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CAMPAIGN_PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  DELETED: "Excluída",
  WITH_ISSUES: "Com problemas",
  IN_PROCESS: "Em processamento",
  PENDING_BILLING_INFO: "Aguardando pagamento",
};

function Campanhas({ conta, ini, fim }: { conta: ContaAnuncio; ini: string; fim: string }) {
  const [linhas, setLinhas] = useState<LinhaCampanha[] | null>(null);
  useEffect(() => {
    setLinhas(null);
    repoTrafego.campanhas(conta.id, ini, fim).then(setLinhas, () => setLinhas([]));
  }, [conta.id, ini, fim]);

  if (!linhas) return <p className="py-2 text-[12.5px] text-muted">Carregando campanhas…</p>;
  const porCampanha = new Map<string, { nome: string; status: string | null; tipo: string | null; gasto: number; res: number; cliques: number; impressoes: number }>();
  for (const l of linhas) {
    const c = porCampanha.get(l.campanha_id) ?? { nome: l.campanha, status: l.status_campanha, tipo: l.tipo_resultado, gasto: 0, res: 0, cliques: 0, impressoes: 0 };
    c.gasto += l.gasto;
    c.res += l.resultados;
    c.cliques += l.cliques;
    c.impressoes += l.impressoes;
    porCampanha.set(l.campanha_id, c);
  }
  const lista = [...porCampanha.values()].filter((c) => c.gasto > 0).sort((a, b) => b.gasto - a.gasto);
  if (lista.length === 0) return <p className="py-2 text-[12.5px] text-muted">Nenhuma campanha com investimento no período.</p>;
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="text-left text-muted">
          <th className="py-1.5 pr-2 font-normal">Campanha</th>
          <th className="px-2 font-normal">Status</th>
          <th className="px-2 text-right font-normal">Investimento</th>
          <th className="px-2 text-right font-normal">Resultados</th>
          <th className="px-2 text-right font-normal">Custo</th>
          <th className="px-2 text-right font-normal">CTR link</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((c) => (
          <tr key={c.nome} className="border-t border-line">
            <td className="max-w-[360px] truncate py-1.5 pr-2">{c.nome}</td>
            <td className="px-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${c.status === "ACTIVE" ? "bg-ok-soft text-ok" : "bg-raised text-muted"}`}>{STATUS_CAMPANHA[c.status ?? ""] ?? c.status ?? "—"}</span>
            </td>
            <td className="num px-2 text-right">{moeda(c.gasto)}</td>
            <td className="num px-2 text-right">{inteiro(c.res)} <span className="text-muted">{nomeResultado(c.tipo, c.res !== 1)}</span></td>
            <td className="num px-2 text-right">{c.res ? moeda(c.gasto / c.res) : "—"}</td>
            <td className="num px-2 text-right">{c.impressoes ? `${((c.cliques / c.impressoes) * 100).toFixed(2).replace(".", ",")}%` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
