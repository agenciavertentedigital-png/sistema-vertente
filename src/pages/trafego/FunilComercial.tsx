import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTabela, moedaBR } from "../../lib/tabela";
import { useDados } from "../../lib/dados";

export interface RegistroFunil {
  id: string;
  cliente_id: string;
  inicio: string;
  fim: string;
  atendidos: number | null;
  qualificados: number | null;
  agendamentos: number | null;
  comparecimentos: number | null;
  vendas: number | null;
  faturamento: number | null;
  observacao: string | null;
  criado_em: string;
}

const ETAPAS = [
  { id: "atendidos", nome: "Atendidos" },
  { id: "qualificados", nome: "Qualificados" },
  { id: "agendamentos", nome: "Agendamentos" },
  { id: "comparecimentos", nome: "Compareceram" },
  { id: "vendas", nome: "Vendas" },
] as const;
type IdEtapa = (typeof ETAPAS)[number]["id"];

const COLUNAS = "id, cliente_id, inicio, fim, atendidos, qualificados, agendamentos, comparecimentos, vendas, faturamento, observacao, criado_em";
const dataBR = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "—");

export function useFunilComercial() {
  return useTabela<RegistroFunil>("funil_comercial", COLUNAS, () => [], { ordem: { coluna: "inicio", asc: false }, limite: 2000 });
}

/**
 * Funil comercial: o que acontece depois do contato (dados que o cliente informa).
 * Junta com os contatos e o investimento da Meta no mesmo período para mostrar as taxas de conversão,
 * o custo por venda e o retorno.
 */
export function FunilComercial({ clienteId, ini, fim, contatos, gasto }: { clienteId: string; ini: string; fim: string; contatos: number; gasto: number }) {
  const d = useDados();
  const t = useFunilComercial();
  const [abrir, setAbrir] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const doCliente = t.linhas.filter((r) => r.cliente_id === clienteId);
  // Entram no período os lançamentos que cabem inteiros dentro dele
  const noPeriodo = doCliente.filter((r) => r.inicio >= ini && r.fim <= fim);
  const soma = (k: IdEtapa | "faturamento") => noPeriodo.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const tem = (k: IdEtapa) => noPeriodo.some((r) => r[k] !== null);
  const fat = soma("faturamento");
  const vendas = soma("vendas");

  const etapas = [{ nome: "Contatos (Meta)", valor: contatos }, ...ETAPAS.filter((e) => tem(e.id)).map((e) => ({ nome: e.nome, valor: soma(e.id) }))];

  async function salvar() {
    const n = (k: string) => (form[k]?.trim() ? Number(form[k].replace(/\./g, "").replace(",", ".")) : null);
    const inicio = form.inicio || ini;
    const fimF = form.fim || fim;
    if (inicio > fimF) return d.avisar("A data inicial precisa ser antes da final");
    setSalvando(true);
    try {
      await t.salvar(null, {
        cliente_id: clienteId,
        inicio,
        fim: fimF,
        atendidos: n("atendidos"),
        qualificados: n("qualificados"),
        agendamentos: n("agendamentos"),
        comparecimentos: n("comparecimentos"),
        vendas: n("vendas"),
        faturamento: n("faturamento"),
        observacao: form.observacao?.trim() || null,
      });
      setForm({});
      setAbrir(false);
      d.avisar("Números do funil salvos");
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const campo = "h-9 w-full rounded-lg border border-line bg-bg px-2.5 text-[13px] outline-none focus:border-accent";

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">Funil comercial</h2>
          <p className="text-[12.5px] text-muted">Depois do contato: números que o cliente informa. Entram os lançamentos dentro de {dataBR(ini)} a {dataBR(fim)}.</p>
        </div>
        <button onClick={() => { setAbrir((a) => !a); setForm({ inicio: ini, fim }); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] hover:border-accent hover:text-accent">
          <Plus size={14} /> Lançar números
        </button>
      </div>

      {t.erro && <p className="text-[12.5px] text-bad">Funil indisponível: {t.erro}</p>}

      {abrir && (
        <div className="anim-entrar flex flex-col gap-3 rounded-xl bg-raised p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-[12px] text-muted">De<input type="date" value={form.inicio ?? ini} onChange={(e) => setForm({ ...form, inicio: e.target.value })} className={campo} /></label>
            <label className="flex flex-col gap-1 text-[12px] text-muted">Até<input type="date" value={form.fim ?? fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} className={campo} /></label>
            {ETAPAS.map((e) => (
              <label key={e.id} className="flex flex-col gap-1 text-[12px] text-muted">{e.nome}<input inputMode="numeric" value={form[e.id] ?? ""} onChange={(ev) => setForm({ ...form, [e.id]: ev.target.value })} placeholder="—" className={campo} /></label>
            ))}
            <label className="flex flex-col gap-1 text-[12px] text-muted">Faturamento (R$)<input inputMode="decimal" value={form.faturamento ?? ""} onChange={(e) => setForm({ ...form, faturamento: e.target.value })} placeholder="—" className={campo} /></label>
          </div>
          <input value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Observação (ex.: fonte: planilha do cliente, só leads da Meta)" className={campo} />
          <div className="flex gap-2">
            <button onClick={salvar} disabled={salvando || !ETAPAS.some((e) => form[e.id]?.trim()) && !form.faturamento?.trim()} className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg disabled:opacity-40">{salvando ? "Salvando…" : "Salvar"}</button>
            <button onClick={() => setAbrir(false)} className="h-8 rounded-lg px-3 text-[12.5px] text-muted hover:text-fg">Cancelar</button>
          </div>
          <p className="text-[12px] text-muted">Preencha só o que o cliente tiver. Dá para lançar por semana ou por mês.</p>
        </div>
      )}

      {noPeriodo.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-3 text-[12.5px] text-muted">
          Nenhum número lançado neste período. Peça ao cliente quantos atendeu, agendou e vendeu e lance aqui para ver a conversão real.
        </p>
      ) : (
        <>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${etapas.length}, minmax(0, 1fr))` }}>
            {etapas.map((e, i) => (
              <div key={e.nome} className="min-w-0 rounded-xl bg-raised px-3 py-2">
                <span className="block truncate text-[11.5px] text-muted">{e.nome}</span>
                <b className="num block text-[18px]">{e.valor.toLocaleString("pt-BR")}</b>
                {i > 0 && <span className="num text-[11.5px] text-accent">{pct(e.valor, etapas[i - 1].valor)} da etapa anterior</span>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Num rotulo="Conversão contato → venda" valor={vendas ? pct(vendas, contatos) : "—"} />
            <Num rotulo="Custo por venda" valor={vendas && gasto ? moedaBR(gasto / vendas) : "—"} />
            <Num rotulo="Faturamento" valor={fat ? moedaBR(fat, 0) : "—"} />
            <Num rotulo="Retorno (ROAS)" valor={fat && gasto ? `${(fat / gasto).toFixed(1).replace(".", ",")}x` : "—"} destaque={fat > 0 && gasto > 0 && fat / gasto >= 3} />
          </div>
        </>
      )}

      {doCliente.length > 0 && (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer text-muted">Lançamentos ({doCliente.length})</summary>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {doCliente.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
                <span className="num font-medium">{dataBR(r.inicio)} a {dataBR(r.fim)}</span>
                <span className="text-muted">
                  {ETAPAS.filter((e) => r[e.id] !== null).map((e) => `${e.nome} ${r[e.id]}`).join(" · ")}
                  {r.faturamento ? ` · ${moedaBR(Number(r.faturamento), 0)}` : ""}
                </span>
                {r.observacao && <span className="basis-full text-muted">{r.observacao}</span>}
                <button onClick={() => t.excluir(r.id)} className="ml-auto text-muted hover:text-bad" aria-label="Excluir lançamento"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Num({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <b className={`num block text-[16px] ${destaque ? "text-ok" : ""}`}>{valor}</b>
      <span className="text-[11.5px] text-muted">{rotulo}</span>
    </div>
  );
}
