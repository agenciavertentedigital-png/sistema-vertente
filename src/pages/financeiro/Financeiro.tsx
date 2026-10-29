import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, History, Plus, Sparkles, Trash2, Wallet } from "lucide-react";
import { useDados } from "../../lib/dados";
import { moedaBR, useTabela } from "../../lib/tabela";
import { hoje } from "../../lib/tipos";
import { supabase } from "../../lib/supabase";
import { useFichas } from "../../lib/cadastro";
import { CAMPOS_LANCAMENTO, CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, FORMAS, SERVICOS, origemReceita, situacao, type Lancamento } from "../../lib/financeiro";
import { demoLancamentos } from "../../data/modulosDemo";
import { Botao, Entrada, Painel, Rotulo, Selecao, Vazio, campo } from "../../components/ui";
import { Abas, Barras, Cabecalho, Kpi, Selo, nomeMes, somarMeses } from "../../components/visual";

type Aba = "financeiro" | "financeiro-historico" | "financeiro-receber" | "financeiro-despesas" | "financeiro-mensalidades";
const COR_SIT = { pago: "var(--ok)", atrasado: "var(--bad)", aberto: "var(--warn)" } as const;
const NOME_SIT = { pago: "Pago", atrasado: "Atrasado", aberto: "Em aberto" } as const;

export function Financeiro({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const d = useDados();
  const aba = (["financeiro-historico", "financeiro-receber", "financeiro-despesas", "financeiro-mensalidades"].includes(rota) ? rota : "financeiro") as Aba;
  const [mes, setMes] = useState(hoje().slice(0, 7) + "-01");
  const lanc = useTabela<Lancamento>("lancamentos", CAMPOS_LANCAMENTO, demoLancamentos, { desde: { coluna: "competencia", valor: "2024-01-01" }, ordem: { coluna: "vencimento" } });
  const fichas = useFichas();
  const [editando, setEditando] = useState<Partial<Lancamento> | null>(null);

  const linhas = useMemo(() => lanc.linhas.map((l) => ({ ...l, valor: Number(l.valor) })), [lanc.linhas]);
  // Abre no mês mais recente com lançamentos quando o mês atual ainda está vazio
  const ajustado = useRef(false);
  useEffect(() => {
    if (ajustado.current || lanc.carregando || !linhas.length) return;
    ajustado.current = true;
    if (!linhas.some((l) => l.competencia.slice(0, 7) === mes.slice(0, 7))) {
      setMes(linhas.reduce((m, l) => (l.competencia > m ? l.competencia : m), linhas[0].competencia));
    }
  }, [lanc.carregando, linhas, mes]);
  const nomeReceita = (l: Lancamento) => (l.cliente_id ? d.cliente(l.cliente_id)?.nome ?? fichas.fichas.find((f) => f.id === l.cliente_id)?.nome : null) ?? origemReceita(l.descricao);
  const doMes = linhas.filter((l) => l.competencia.slice(0, 7) === mes.slice(0, 7));
  const receitas = doMes.filter((l) => l.tipo === "receita");
  const despesas = doMes.filter((l) => l.tipo === "despesa");
  const soma = (ls: Lancamento[]) => ls.reduce((s, l) => s + l.valor, 0);
  const mrr = fichas.fichas.filter((f) => f.status === "ativo").reduce((s, f) => s + fichas.mensalidade(f.id), 0);
  const recebido = soma(receitas.filter((l) => l.pago_em));
  const atrasadoTotal = linhas.filter((l) => l.tipo === "receita" && situacao(l) === "atrasado");
  const resultado = soma(receitas) - soma(despesas);
  const margem = soma(receitas) ? resultado / soma(receitas) : null;
  const clientesPagantes = fichas.fichas.filter((f) => f.status === "ativo" && fichas.mensalidade(f.id) > 0).length;

  const doze = Array.from({ length: 12 }, (_, i) => somarMeses(mes, i - 11));
  const serie = doze.map((m) => {
    const ls = linhas.filter((l) => l.competencia.slice(0, 7) === m.slice(0, 7));
    return {
      rotulo: nomeMes(m, true),
      valores: [
        { nome: "Receitas", valor: soma(ls.filter((l) => l.tipo === "receita")), cor: "#1d34a0" },
        { nome: "Despesas", valor: soma(ls.filter((l) => l.tipo === "despesa")), cor: "#b8c0d8" },
      ],
    };
  });

  async function gerarMensalidades() {
    try {
      if (supabase) {
        const { data, error } = await supabase.rpc("gerar_mensalidades", { mes });
        if (error) throw new Error(error.message);
        d.avisar(data ? `${data} mensalidades criadas` : "As mensalidades deste mês já existem");
        lanc.recarregar();
      } else {
        let n = 0;
        for (const f of fichas.fichas) {
          const v = fichas.mensalidade(f.id);
          if (!v || receitas.some((r) => r.cliente_id === f.id && r.categoria === "Mensalidade")) continue;
          n++;
          await lanc.salvar(null, { tipo: "receita", cliente_id: f.id, descricao: `Mensalidade ${f.nome}`, categoria: "Mensalidade", valor: v, competencia: mes, vencimento: `${mes.slice(0, 8)}${String(f.dia_vencimento ?? 10).padStart(2, "0")}`, pago_em: null, forma: f.forma_pagamento, observacoes: null });
        }
        d.avisar(n ? `${n} mensalidades criadas` : "As mensalidades deste mês já existem");
      }
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  async function copiarDespesas() {
    const anterior = linhas.filter((l) => l.tipo === "despesa" && l.competencia.slice(0, 7) === somarMeses(mes, -1).slice(0, 7));
    let n = 0;
    for (const l of anterior) {
      if (despesas.some((x) => x.descricao === l.descricao)) continue;
      n++;
      await lanc.salvar(null, { tipo: "despesa", cliente_id: null, descricao: l.descricao, categoria: l.categoria, valor: l.valor, competencia: mes, vencimento: `${mes.slice(0, 8)}${l.vencimento.slice(8, 10)}`, pago_em: null, forma: l.forma, observacoes: null });
    }
    d.avisar(n ? `${n} despesas copiadas do mês anterior` : "Nada novo para copiar");
  }

  const pagar = (l: Lancamento) => lanc.salvar(l.id, { pago_em: l.pago_em ? null : hoje() });

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <Cabecalho
        icone={Wallet}
        rotulo="Fase 5 · Gerencial"
        titulo="Financeiro"
        descricao="Mensalidades, recebimentos, despesas e resultado da agência. Só administradores veem esta área."
        acoes={
          <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
            <Botao variante="fantasma" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior"><ChevronLeft size={16} /></Botao>
            <span className="min-w-[150px] text-center text-[13.5px] font-semibold">{nomeMes(mes)}</span>
            <Botao variante="fantasma" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês"><ChevronRight size={16} /></Botao>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi rotulo="MRR contratado" valor={moedaBR(mrr, 0)} detalhe={`${clientesPagantes} clientes · ticket ${moedaBR(clientesPagantes ? mrr / clientesPagantes : 0, 0)}`} tom="accent" onClick={() => ir("financeiro-mensalidades")} />
        <Kpi rotulo="Receitas do mês" valor={moedaBR(soma(receitas), 0)} detalhe={`${moedaBR(recebido, 0)} já recebido`} />
        <Kpi rotulo="A receber" valor={moedaBR(soma(receitas.filter((l) => situacao(l) === "aberto")), 0)} tom="warn" onClick={() => ir("financeiro-receber")} />
        <Kpi rotulo="Em atraso" valor={moedaBR(soma(atrasadoTotal), 0)} detalhe={`${atrasadoTotal.length} cobranças`} tom={atrasadoTotal.length ? "bad" : "ok"} onClick={() => ir("financeiro-receber")} />
        <Kpi rotulo="Despesas do mês" valor={moedaBR(soma(despesas), 0)} onClick={() => ir("financeiro-despesas")} />
        <Kpi rotulo="Resultado do mês" valor={moedaBR(resultado, 0)} detalhe={margem === null ? "—" : `margem ${Math.round(margem * 100)}%`} tom={resultado >= 0 ? "ok" : "bad"} />
      </div>
      <Abas<Aba>
        abas={[
          { id: "financeiro", nome: "Visão do mês" },
          { id: "financeiro-historico", nome: "Histórico completo" },
          { id: "financeiro-receber", nome: "Recebimentos", contador: atrasadoTotal.length },
          { id: "financeiro-despesas", nome: "Despesas" },
          { id: "financeiro-mensalidades", nome: "Mensalidades por cliente" },
        ]}
        ativa={aba}
        mudar={ir}
      />
      {lanc.erro && <Vazio>{lanc.erro.includes("permission") ? "Só administradores acessam o financeiro." : lanc.erro}</Vazio>}
      {lanc.carregando || fichas.carregando ? (
        <Vazio>Carregando…</Vazio>
      ) : aba === "financeiro" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Receitas x despesas · 12 meses</h2>
              <div className="flex gap-3 text-[11.5px] text-muted">
                <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#1d34a0]" /> Receitas</span>
                <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#b8c0d8]" /> Despesas</span>
              </div>
            </div>
            <div className="mt-4"><Barras dados={serie} formatar={(v) => moedaBR(v, 0)} altura={170} /></div>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-[15px] font-semibold">Para onde vai o dinheiro</h2>
            <Distribuicao itens={CATEGORIAS_DESPESA.map((c) => ({ nome: c, valor: soma(despesas.filter((l) => l.categoria === c)) })).filter((x) => x.valor)} total={soma(despesas)} />
          </section>
          <section className="rounded-2xl border border-line bg-surface p-4 lg:col-span-2">
            <h2 className="text-[15px] font-semibold">Receita por cliente no mês</h2>
            <Distribuicao
              itens={[...new Set(receitas.map(nomeReceita))].map((nome) => ({ nome, valor: soma(receitas.filter((r) => nomeReceita(r) === nome)) })).sort((a, b) => b.valor - a.valor)}
              total={soma(receitas)}
              colunas
            />
          </section>
        </div>
      ) : aba === "financeiro-historico" ? (
        <Historico linhas={linhas} abrirMes={(m) => { setMes(m); ir("financeiro"); }} nomeReceita={nomeReceita} />
      ) : aba === "financeiro-receber" ? (
        <Lista
          titulo="Recebimentos"
          acoes={
            <>
              <Botao onClick={gerarMensalidades}><Sparkles size={14} /> Gerar mensalidades de {nomeMes(mes, true)}</Botao>
              <Botao variante="primario" onClick={() => setEditando({ tipo: "receita", competencia: mes, vencimento: hoje(), categoria: "Mensalidade" })}><Plus size={14} /> Receita</Botao>
            </>
          }
          linhas={[...atrasadoTotal.filter((l) => l.competencia.slice(0, 7) !== mes.slice(0, 7)), ...receitas]}
          nomeCliente={(id) => d.cliente(id ?? "")?.nome ?? fichas.fichas.find((f) => f.id === id)?.nome}
          pagar={pagar}
          abrir={setEditando}
          vazio="Nenhuma receita neste mês. Cadastre as mensalidades por cliente e clique em Gerar mensalidades."
        />
      ) : aba === "financeiro-despesas" ? (
        <Lista
          titulo="Despesas"
          acoes={
            <>
              <Botao onClick={copiarDespesas}><Copy size={14} /> Copiar do mês anterior</Botao>
              <Botao variante="primario" onClick={() => setEditando({ tipo: "despesa", competencia: mes, vencimento: hoje(), categoria: "Ferramentas" })}><Plus size={14} /> Despesa</Botao>
            </>
          }
          linhas={despesas}
          nomeCliente={() => undefined}
          pagar={pagar}
          abrir={setEditando}
          vazio="Nenhuma despesa neste mês."
        />
      ) : (
        <Mensalidades fichas={fichas} />
      )}
      {editando && <EditorLancamento l={editando} fechar={() => setEditando(null)} lanc={lanc} />}
    </div>
  );
}

function Distribuicao({ itens, total, colunas }: { itens: { nome: string; valor: number }[]; total: number; colunas?: boolean }) {
  if (!itens.length) return <p className="mt-3 text-[13px] text-muted">Sem lançamentos neste mês.</p>;
  const max = Math.max(...itens.map((i) => i.valor));
  return (
    <ul className={`mt-3 grid gap-x-6 gap-y-2.5 ${colunas ? "sm:grid-cols-2" : ""}`}>
      {itens.map((i) => (
        <li key={i.nome} className="text-[12.5px]">
          <div className="flex justify-between gap-2">
            <span className="truncate">{i.nome}</span>
            <span className="num shrink-0 font-medium">{moedaBR(i.valor, 0)} <span className="text-muted">· {total ? Math.round((i.valor / total) * 100) : 0}%</span></span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-raised">
            <div className="h-2 rounded-full bg-accent" style={{ width: `${(i.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Lista({ titulo, acoes, linhas, nomeCliente, pagar, abrir, vazio }: { titulo: string; acoes: React.ReactNode; linhas: Lancamento[]; nomeCliente: (id: string | null) => string | undefined; pagar: (l: Lancamento) => void; abrir: (l: Lancamento) => void; vazio: string }) {
  const [filtro, setFiltro] = useState<"todos" | "aberto" | "atrasado" | "pago">("todos");
  const vis = linhas.filter((l) => filtro === "todos" || situacao(l) === filtro).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold">{titulo}</h2>
          <div className="flex gap-1">
            {(["todos", "aberto", "atrasado", "pago"] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-2.5 py-0.5 text-[12px] ${filtro === f ? "bg-accent text-accent-fg" : "bg-raised text-muted hover:text-fg"}`}>
                {f === "todos" ? "Todos" : NOME_SIT[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">{acoes}</div>
      </div>
      {vis.length === 0 ? (
        <div className="mt-3"><Vazio>{vazio}</Vazio></div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-muted">
                <th className="py-2 font-medium">Vencimento</th>
                <th className="py-2 font-medium">Descrição</th>
                <th className="py-2 font-medium">Categoria</th>
                <th className="py-2 text-right font-medium">Valor</th>
                <th className="py-2 pl-4 font-medium">Situação</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {vis.map((l) => {
                const s = situacao(l);
                return (
                  <tr key={l.id} className="cursor-pointer hover:bg-raised/60" onClick={() => abrir(l)}>
                    <td className="num py-2.5">{l.vencimento.slice(8, 10)}/{l.vencimento.slice(5, 7)}</td>
                    <td className="py-2.5">
                      <div className="font-medium">{nomeCliente(l.cliente_id) ?? l.descricao}</div>
                      {nomeCliente(l.cliente_id) && <div className="text-[11.5px] text-muted">{l.descricao}</div>}
                    </td>
                    <td className="py-2.5 text-muted">{l.categoria}</td>
                    <td className="num py-2.5 text-right font-semibold">{moedaBR(l.valor)}</td>
                    <td className="py-2.5 pl-4"><Selo cor={COR_SIT[s]}>{NOME_SIT[s]}{l.pago_em ? ` ${l.pago_em.slice(8, 10)}/${l.pago_em.slice(5, 7)}` : ""}</Selo></td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          pagar(l);
                        }}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[12px] ${l.pago_em ? "border-line text-muted" : "border-ok text-ok hover:bg-ok-soft"}`}
                      >
                        <Check size={13} /> {l.pago_em ? "Desfazer" : "Marcar pago"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Mensalidades({ fichas }: { fichas: ReturnType<typeof useFichas> }) {
  const d = useDados();
  const ativos = fichas.fichas.filter((f) => f.status === "ativo");
  const total = ativos.reduce((s, f) => s + fichas.mensalidade(f.id), 0);
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Mensalidades por cliente</h2>
        <span className="text-[13px] text-muted">Total contratado: <b className="num text-fg">{moedaBR(total)}</b> / mês</span>
      </div>
      <p className="text-[12px] text-muted">Marque os serviços e o valor de cada um. O botão "Gerar mensalidades" usa estes valores e o dia de vencimento.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead>
            <tr className="text-left text-[11.5px] text-muted">
              <th className="py-2 font-medium">Cliente</th>
              {Object.values(SERVICOS).map((s) => <th key={s} className="py-2 font-medium">{s}</th>)}
              <th className="py-2 font-medium">Vence dia</th>
              <th className="py-2 font-medium">Forma</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ativos.map((f) => (
              <tr key={f.id}>
                <td className="py-2 pr-2 font-medium">{f.nome}</td>
                {Object.keys(SERVICOS).map((cod) => {
                  const s = fichas.servicos.find((x) => x.cliente_id === f.id && x.servico_codigo === cod);
                  return (
                    <td key={cod} className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        step={50}
                        defaultValue={s?.valor_mensal ?? ""}
                        placeholder="—"
                        onBlur={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          if ((v ?? null) === (s?.valor_mensal ?? null)) return;
                          fichas.salvarServico(f.id, cod, v, v !== null).catch((err) => d.avisar(err.message));
                        }}
                        className={`${campo} num !w-[100px] ${s ? "border-accent" : ""}`}
                      />
                    </td>
                  );
                })}
                <td className="py-2 pr-2">
                  <input type="number" min={1} max={31} defaultValue={f.dia_vencimento ?? ""} placeholder="10" onBlur={(e) => fichas.salvarFicha(f.id, { dia_vencimento: e.target.value ? Number(e.target.value) : null }).catch((err) => d.avisar(err.message))} className={`${campo} num !w-[64px]`} />
                </td>
                <td className="py-2 pr-2">
                  <select defaultValue={f.forma_pagamento ?? ""} onChange={(e) => fichas.salvarFicha(f.id, { forma_pagamento: e.target.value || null })} className={`${campo} !w-auto`}>
                    <option value="">—</option>
                    {FORMAS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </td>
                <td className="num py-2 text-right font-semibold">{fichas.mensalidade(f.id) ? moedaBR(fichas.mensalidade(f.id)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EditorLancamento({ l, fechar, lanc }: { l: Partial<Lancamento>; fechar: () => void; lanc: ReturnType<typeof useTabela<Lancamento>> }) {
  const d = useDados();
  const [f, setF] = useState<Partial<Lancamento>>(l);
  const set = (c: Partial<Lancamento>) => setF({ ...f, ...c });
  const receita = f.tipo === "receita";
  async function salvar() {
    if (!f.descricao?.trim() && !f.cliente_id) return;
    const { id, ...campos } = f;
    try {
      await lanc.salvar(id ?? null, {
        ...campos,
        descricao: f.descricao?.trim() || `Mensalidade ${d.cliente(f.cliente_id ?? "")?.nome ?? ""}`,
        competencia: `${(f.competencia ?? f.vencimento ?? hoje()).slice(0, 7)}-01`,
        valor: Number(f.valor ?? 0),
      });
      fechar();
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }
  return (
    <Painel aberto fechar={fechar} titulo={`${l.id ? "Editar" : "Nova"} ${receita ? "receita" : "despesa"}`} largura={460}>
      <div className="flex flex-col gap-3.5">
        {receita && (
          <Rotulo texto="Cliente">
            <Selecao value={f.cliente_id ?? ""} onChange={(e) => set({ cliente_id: e.target.value || null })}>
              <option value="">Sem cliente (avulso)</option>
              {d.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Selecao>
          </Rotulo>
        )}
        <Rotulo texto="Descrição"><Entrada value={f.descricao ?? ""} onChange={(e) => set({ descricao: e.target.value })} /></Rotulo>
        <div className="grid grid-cols-2 gap-3">
          <Rotulo texto="Valor (R$)"><Entrada type="number" step="0.01" value={f.valor ?? ""} onChange={(e) => set({ valor: Number(e.target.value) })} /></Rotulo>
          <Rotulo texto="Categoria">
            <Selecao value={f.categoria ?? ""} onChange={(e) => set({ categoria: e.target.value })}>
              {(receita ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map((c) => <option key={c}>{c}</option>)}
            </Selecao>
          </Rotulo>
          <Rotulo texto="Vencimento"><Entrada type="date" value={f.vencimento ?? ""} onChange={(e) => set({ vencimento: e.target.value })} /></Rotulo>
          <Rotulo texto="Mês de referência"><Entrada type="month" value={(f.competencia ?? "").slice(0, 7)} onChange={(e) => set({ competencia: `${e.target.value}-01` })} /></Rotulo>
          <Rotulo texto="Pago em"><Entrada type="date" value={f.pago_em ?? ""} onChange={(e) => set({ pago_em: e.target.value || null })} /></Rotulo>
          <Rotulo texto="Forma">
            <Selecao value={f.forma ?? ""} onChange={(e) => set({ forma: e.target.value || null })}>
              <option value="">—</option>
              {FORMAS.map((x) => <option key={x}>{x}</option>)}
            </Selecao>
          </Rotulo>
        </div>
        <Rotulo texto="Observações"><textarea rows={2} value={f.observacoes ?? ""} onChange={(e) => set({ observacoes: e.target.value || null })} className={campo} /></Rotulo>
        <div className="flex justify-between">
          {l.id ? <Botao variante="fantasma" onClick={async () => { await lanc.excluir(l.id!); fechar(); }}><Trash2 size={14} /> Apagar</Botao> : <span />}
          <Botao variante="primario" onClick={salvar}>Salvar</Botao>
        </div>
      </div>
    </Painel>
  );
}

// ------------------------------------------------------------------
// Histórico completo, mês a mês
// ------------------------------------------------------------------
function Historico({ linhas, abrirMes, nomeReceita }: { linhas: Lancamento[]; abrirMes: (m: string) => void; nomeReceita: (l: Lancamento) => string }) {
  const meses = [...new Set(linhas.map((l) => l.competencia.slice(0, 7)))].sort();
  if (!meses.length) return <Vazio>Nenhum lançamento ainda.</Vazio>;
  const soma = (ls: Lancamento[]) => ls.reduce((s, l) => s + l.valor, 0);
  const porMes = meses.map((m) => {
    const ls = linhas.filter((l) => l.competencia.startsWith(m));
    const ent = soma(ls.filter((l) => l.tipo === "receita"));
    const sai = soma(ls.filter((l) => l.tipo === "despesa"));
    return { m, ent, sai, res: ent - sai, margem: ent ? (ent - sai) / ent : null };
  });
  const totEnt = porMes.reduce((s, x) => s + x.ent, 0);
  const totSai = porMes.reduce((s, x) => s + x.sai, 0);
  const melhor = [...porMes].sort((a, b) => b.ent - a.ent)[0];
  const positivos = porMes.filter((x) => x.res >= 0).length;
  const ult3 = porMes.slice(-3).reduce((s, x) => s + x.ent, 0) / Math.min(3, porMes.length);
  const ant3 = porMes.slice(-6, -3).reduce((s, x) => s + x.ent, 0) / Math.max(1, Math.min(3, porMes.length - 3));
  const maxV = Math.max(...porMes.map((x) => Math.max(x.ent, x.sai)), 1);
  const H = 190;
  const receitasTop = [...new Set(linhas.filter((l) => l.tipo === "receita").map(nomeReceita))]
    .map((nome) => ({ nome, valor: soma(linhas.filter((l) => l.tipo === "receita" && nomeReceita(l) === nome)) }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);
  const categorias = CATEGORIAS_DESPESA.map((c) => ({ nome: c, valor: soma(linhas.filter((l) => l.tipo === "despesa" && l.categoria === c)) })).filter((x) => x.valor).sort((a, b) => b.valor - a.valor);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icone={History} rotulo={`Faturado em ${meses.length} meses`} valor={moedaBR(totEnt, 0)} detalhe={`${nomeMes(meses[0] + "-01", true)} a ${nomeMes(meses[meses.length - 1] + "-01", true)}`} tom="accent" />
        <Kpi rotulo="Média mensal de entrada" valor={moedaBR(totEnt / meses.length, 0)} detalhe={`saída média ${moedaBR(totSai / meses.length, 0)}`} />
        <Kpi rotulo="Resultado acumulado" valor={moedaBR(totEnt - totSai, 0)} detalhe={`margem ${totEnt ? Math.round(((totEnt - totSai) / totEnt) * 100) : 0}%`} tom={totEnt - totSai >= 0 ? "ok" : "bad"} />
        <Kpi rotulo="Melhor mês" valor={moedaBR(melhor.ent, 0)} detalhe={nomeMes(melhor.m + "-01")} tom="ok" />
        <Kpi rotulo="Meses no positivo" valor={`${positivos} de ${meses.length}`} detalhe={ant3 ? `entrada últimos 3 meses ${ult3 >= ant3 ? "▲" : "▼"} ${Math.abs(Math.round(((ult3 - ant3) / ant3) * 100))}%` : undefined} tom={positivos >= meses.length / 2 ? "ok" : "warn"} />
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Entradas, saídas e resultado · mês a mês</h2>
          <div className="flex gap-3 text-[11.5px] text-muted">
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#1d34a0]" /> Entradas</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#b8c0d8]" /> Saídas</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-ok" /> Resultado positivo</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-bad" /> negativo</span>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="flex items-end gap-1.5" style={{ minWidth: meses.length * 38, height: H + 64 }}>
            {porMes.map((x) => (
              <button key={x.m} onClick={() => abrirMes(x.m + "-01")} title={`${nomeMes(x.m + "-01")}\nEntradas ${moedaBR(x.ent)}\nSaídas ${moedaBR(x.sai)}\nResultado ${moedaBR(x.res)}`} className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg pt-1 hover:bg-raised">
                <span className={`num text-[10px] font-semibold ${x.res >= 0 ? "text-ok" : "text-bad"}`}>{x.res >= 0 ? "+" : "−"}{Math.abs(x.res / 1000).toFixed(1).replace(".", ",")}k</span>
                <div className="flex w-full items-end justify-center gap-0.5" style={{ height: H }}>
                  <div className="w-full max-w-[14px] rounded-t" style={{ height: Math.max(2, (x.ent / maxV) * H), background: "#1d34a0" }} />
                  <div className="w-full max-w-[14px] rounded-t" style={{ height: Math.max(2, (x.sai / maxV) * H), background: "#b8c0d8" }} />
                </div>
                <span className={`h-2 w-2 rounded-full ${x.res >= 0 ? "bg-ok" : "bg-bad"}`} />
                <span className="text-[10px] leading-tight text-muted">{nomeMes(x.m + "-01", true)}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[11.5px] text-muted">Clique num mês para abrir os lançamentos dele.</p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Quem mais trouxe receita no período</h2>
          <Distribuicao itens={receitasTop} total={totEnt} />
        </section>
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-[15px] font-semibold">Despesas por categoria no período</h2>
          <Distribuicao itens={categorias} total={totSai} />
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Tabela mês a mês</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-muted">
                <th className="py-2 font-medium">Mês</th>
                <th className="py-2 text-right font-medium">Entradas</th>
                <th className="py-2 text-right font-medium">Saídas</th>
                <th className="py-2 text-right font-medium">Resultado</th>
                <th className="py-2 text-right font-medium">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...porMes].reverse().map((x) => (
                <tr key={x.m} className="cursor-pointer hover:bg-raised/60" onClick={() => abrirMes(x.m + "-01")}>
                  <td className="py-2 font-medium">{nomeMes(x.m + "-01")}</td>
                  <td className="num py-2 text-right">{moedaBR(x.ent)}</td>
                  <td className="num py-2 text-right">{moedaBR(x.sai)}</td>
                  <td className={`num py-2 text-right font-semibold ${x.res >= 0 ? "text-ok" : "text-bad"}`}>{moedaBR(x.res)}</td>
                  <td className={`num py-2 text-right ${x.res >= 0 ? "text-ok" : "text-bad"}`}>{x.margem === null ? "—" : `${(x.margem * 100).toFixed(1).replace(".", ",")}%`}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line font-semibold">
                <td className="py-2">Total</td>
                <td className="num py-2 text-right">{moedaBR(totEnt)}</td>
                <td className="num py-2 text-right">{moedaBR(totSai)}</td>
                <td className={`num py-2 text-right ${totEnt - totSai >= 0 ? "text-ok" : "text-bad"}`}>{moedaBR(totEnt - totSai)}</td>
                <td className="num py-2 text-right">{totEnt ? `${(((totEnt - totSai) / totEnt) * 100).toFixed(1).replace(".", ",")}%` : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
