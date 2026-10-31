import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileDown, MessageSquare, NotebookPen, SlidersHorizontal, Thermometer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { repo } from "../lib/repo";
import { useDados } from "../lib/dados";
import { useNotas } from "../lib/briefing";
import { NIVEIS_TEMP, useTemperaturas } from "../lib/temperatura";
import { CANAL, SITUACAO, TIPO_REGISTRO, hoje, type ItemLinha } from "../lib/tipos";
import { Vazio } from "./ui";

/** Uma linha do diário: o que aconteceu, quando e quem fez. */
interface Entrada {
  id: string;
  quando: string; // ISO
  dia: string; // AAAA-MM-DD no fuso de São Paulo
  tipo: "conta" | "registro" | "comentario" | "concluida" | "nota" | "temperatura";
  titulo: string;
  texto?: string;
  detalhes?: string[];
  autor?: string | null;
  cor?: string;
}

const ICONE: Record<Entrada["tipo"], LucideIcon> = {
  conta: SlidersHorizontal,
  registro: NotebookPen,
  comentario: MessageSquare,
  concluida: CheckCircle2,
  nota: NotebookPen,
  temperatura: Thermometer,
};

const diaSP = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const horaSP = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const nomeMes = (mes: string) => {
  const t = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const somarMes = (mes: string, n: number) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const ultimoDia = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
const rotuloDia = (d: string) => {
  const t = new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const fimDeSemana = (d: string) => [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay());

function daLinha(i: ItemLinha): Entrada {
  if (i.tipo === "registro" && i.registro) {
    const r = i.registro;
    const ehConta = r.alteracoes.length > 0 || r.tipo === "otimizacao";
    return {
      id: i.id,
      quando: i.quando,
      dia: r.data,
      tipo: ehConta ? "conta" : "registro",
      titulo: `${TIPO_REGISTRO[r.tipo]}${r.canal ? ` · ${CANAL[r.canal]}` : ""}${r.situacao ? ` · ${SITUACAO[r.situacao]}` : ""}`,
      texto: r.nota ?? undefined,
      detalhes: [
        ...(r.acoes.length ? [r.acoes.join(" · ")] : []),
        ...r.alteracoes.map((a) => `${a.tipo}: ${a.descricao}${a.antes || a.depois ? ` (${a.antes || "—"} → ${a.depois || "—"})` : ""}`),
      ],
      autor: i.autor,
      cor: r.situacao === "problema" ? "var(--bad)" : r.situacao === "atencao" ? "var(--warn)" : ehConta ? "var(--accent)" : undefined,
    };
  }
  if (i.tipo === "comentario") return { id: i.id, quando: i.quando, dia: diaSP(i.quando), tipo: "comentario", titulo: `Comentário em "${i.tarefa}"`, texto: i.texto, autor: i.autor };
  return { id: i.id, quando: i.quando, dia: diaSP(i.quando), tipo: "concluida", titulo: "Tarefa concluída", texto: i.tarefa, autor: i.autor, cor: "var(--ok)" };
}

/**
 * Diário de Bordo: um documento por mês com tudo o que foi feito no cliente,
 * dia útil a dia útil. Junta registros (inclusive alterações na conta de anúncio),
 * comentários das tarefas, tarefas concluídas, anotações e leituras de temperatura.
 */
export function DiarioBordo({ clienteId }: { clienteId: string }) {
  const d = useDados();
  const notas = useNotas();
  const temps = useTemperaturas();
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [itens, setItens] = useState<ItemLinha[] | null>(null);
  const [erro, setErro] = useState("");
  const [soComMovimento, setSoComMovimento] = useState(false);

  const de = `${mes}-01`;
  const ate = ultimoDia(mes);

  const carregar = useCallback(async () => {
    setItens(null);
    setErro("");
    try {
      setItens(await repo.diario(clienteId, de, ate));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o diário.");
      setItens([]);
    }
  }, [clienteId, de, ate]);
  useEffect(() => void carregar(), [carregar]);

  const nomeMembro = (id: string | null) => d.membros.find((m) => m.id === id)?.nome ?? null;

  const entradas = useMemo<Entrada[]>(() => {
    const base = (itens ?? []).map(daLinha);
    const ns = notas.linhas
      .filter((n) => n.cliente_id === clienteId && diaSP(n.criado_em) >= de && diaSP(n.criado_em) <= ate)
      .map<Entrada>((n) => ({ id: `n-${n.id}`, quando: n.criado_em, dia: diaSP(n.criado_em), tipo: "nota", titulo: n.titulo ? `Anotação: ${n.titulo}` : "Anotação", texto: n.texto, autor: nomeMembro(n.autor_id) }));
    const ts = temps.linhas
      .filter((t) => t.cliente_id === clienteId && diaSP(t.criado_em) >= de && diaSP(t.criado_em) <= ate)
      .map<Entrada>((t) => {
        const n = NIVEIS_TEMP[t.nivel];
        return { id: `t-${t.id}`, quando: t.criado_em, dia: diaSP(t.criado_em), tipo: "temperatura", titulo: `Temperatura: ${n?.nome ?? t.nivel}`, texto: t.motivo ?? undefined, autor: nomeMembro(t.autor_id), cor: n?.cor };
      });
    return [...base, ...ns, ...ts].sort((a, b) => a.quando.localeCompare(b.quando));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, notas.linhas, temps.linhas, clienteId, de, ate, d.membros]);

  // Dias do mês até hoje: úteis sempre aparecem; fim de semana só se teve movimento
  const dias = useMemo(() => {
    const h = hoje();
    const lista: string[] = [];
    for (let i = 1; i <= Number(ate.slice(8)); i++) {
      const dia = `${mes}-${String(i).padStart(2, "0")}`;
      if (dia > h) break;
      const tem = entradas.some((e) => e.dia === dia);
      if (tem || (!fimDeSemana(dia) && !soComMovimento)) lista.push(dia);
    }
    return lista.reverse();
  }, [mes, ate, entradas, soComMovimento]);

  const cliente = d.clientes.find((c) => c.id === clienteId);
  const resumo = [
    { n: new Set(entradas.map((e) => e.dia)).size, r: "dias com movimento" },
    { n: entradas.filter((e) => e.tipo === "concluida").length, r: "tarefas concluídas" },
    { n: entradas.filter((e) => e.tipo === "conta").length, r: "ajustes na conta" },
    { n: entradas.filter((e) => e.tipo === "comentario" || e.tipo === "nota" || e.tipo === "registro").length, r: "registros e comentários" },
  ];

  function exportar() {
    const titulo = document.title;
    document.title = `Diário de Bordo - ${cliente?.nome ?? "Cliente"} - ${nomeMes(mes)}`;
    document.body.classList.add("imprimindo-diario");
    const fim = () => {
      document.body.classList.remove("imprimindo-diario");
      document.title = titulo;
      window.removeEventListener("afterprint", fim);
    };
    window.addEventListener("afterprint", fim);
    window.print();
    setTimeout(fim, 1500);
  }

  const futuro = somarMes(mes, 1) > hoje().slice(0, 7);

  return (
    <div className="flex flex-col gap-4">
      <div className="nao-imprimir flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-line bg-surface">
          <button onClick={() => setMes(somarMes(mes, -1))} className="grid h-8 w-8 place-items-center text-muted hover:text-fg" aria-label="Mês anterior"><ChevronLeft size={15} /></button>
          <span className="min-w-[140px] text-center text-[13px] font-medium">{nomeMes(mes)}</span>
          <button onClick={() => setMes(somarMes(mes, 1))} disabled={futuro} className="grid h-8 w-8 place-items-center text-muted hover:text-fg disabled:opacity-30" aria-label="Próximo mês"><ChevronRight size={15} /></button>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          <input type="checkbox" checked={soComMovimento} onChange={(e) => setSoComMovimento(e.target.checked)} className="accent-[rgb(var(--accent-c))]" />
          Só dias com movimento
        </label>
        <button onClick={exportar} disabled={!itens} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg hover:opacity-90 disabled:opacity-50">
          <FileDown size={14} /> Exportar PDF
        </button>
      </div>

      <div id="diario-impressao" className="flex flex-col gap-4">
        <header className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted">Diário de Bordo</p>
          <h2 className="text-[19px] font-semibold">{cliente?.nome} · {nomeMes(mes)}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Tudo o que a Vertente fez neste cliente no mês, dia a dia. Gerado automaticamente pelo sistema.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {resumo.map((x) => (
              <div key={x.r} className="rounded-xl bg-raised px-3 py-2">
                <b className="num block text-[18px]">{x.n}</b>
                <span className="text-[12px] text-muted">{x.r}</span>
              </div>
            ))}
          </div>
        </header>

        {erro && <p className="nao-imprimir rounded-xl border border-bad/30 bg-bad/5 px-3 py-2 text-[13px] text-bad">{erro}</p>}

        {!itens ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="esqueleto h-20 rounded-xl" />)}</div>
        ) : dias.length === 0 ? (
          <Vazio>Nenhum dia para mostrar neste mês.</Vazio>
        ) : (
          <div className="flex flex-col gap-2">{dias.map((dia) => {
            const doDia = entradas.filter((e) => e.dia === dia);
            if (doDia.length === 0)
              return (
                <div key={dia} className="diario-dia flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-2 text-[12.5px] text-muted">
                  <span className="font-medium">{rotuloDia(dia)}</span>
                  <span className="ml-auto">Sem movimentação registrada</span>
                </div>
              );
            return (
              <section key={dia} className="diario-dia rounded-2xl border border-line bg-surface">
                <h3 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[13px] font-semibold">
                  {rotuloDia(dia)}
                  <span className="num ml-auto text-[12px] font-normal text-muted">{doDia.length ? `${doDia.length} registro${doDia.length > 1 ? "s" : ""}` : ""}</span>
                </h3>
                {doDia.length === 0 ? (
                  <p className="px-4 py-3 text-[12.5px] text-muted">Sem movimentação registrada.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {doDia.map((e) => {
                      const I = ICONE[e.tipo];
                      return (
                        <li key={e.id} className="flex gap-3 px-4 py-2.5 text-[13px] leading-snug">
                          <span className="num w-10 shrink-0 pt-px text-[12px] text-muted">{horaSP(e.quando)}</span>
                          <I size={14} className="mt-0.5 shrink-0" style={{ color: e.cor ?? "rgb(var(--muted-c))" }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-medium">{e.titulo}</span>
                              <span className="text-[12px] text-muted">{e.autor ?? ""}</span>
                            </div>
                            {e.detalhes?.map((x, k) => <p key={k} className="text-[12.5px] text-muted">{x}</p>)}
                            {e.texto && <p className="whitespace-pre-wrap break-words">{e.texto}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}</div>
        )}
      </div>
    </div>
  );
}
