import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, Eye, EyeOff, Megaphone, Trophy, ChevronRight, FileDown, MessageSquare, NotebookPen, SlidersHorizontal, Thermometer } from "lucide-react";
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
  tipo: "conta" | "registro" | "comentario" | "concluida" | "nota" | "temperatura" | "meta";
  automatico?: boolean;
  /** tipo do registro de origem (otimizacao, conquista, revisao…) */
  regTipo?: string;
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
  meta: Megaphone,
};

const OBJETO_META: Record<string, string> = {
  ACCOUNT: "Conta",
  CAMPAIGN_GROUP: "Campanha",
  CAMPAIGN: "Conjunto de anúncios",
  ADGROUP: "Anúncio",
  AD: "Anúncio",
  CREATIVE: "Criativo",
  AD_CREATIVE: "Criativo",
  AUDIENCE: "Público",
  CUSTOM_AUDIENCE: "Público",
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Valor antigo/novo da Meta em texto legível (orçamentos vêm em centavos). */
function valorMeta(evento: string, v: string | null) {
  if (v === null) return null;
  if (/budget|spend_cap|bid/.test(evento) && /^\d+$/.test(v)) return brl(Number(v) / 100);
  try {
    const j = JSON.parse(v) as Record<string, unknown>;
    if (j && typeof j === "object") {
      const n = j.new_value ?? j.value ?? j.amount ?? j.name;
      if (n !== undefined && n !== null) return /budget/.test(evento) && typeof n === "number" ? brl(n / 100) : String(n);
      return Object.entries(j).slice(0, 3).map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : x}`).join(", ");
    }
  } catch {
    /* texto simples */
  }
  return v.length > 120 ? `${v.slice(0, 120)}…` : v;
}

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
      regTipo: r.tipo,
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
  if (i.tipo === "meta" && i.meta) {
    const m = i.meta;
    const antes = valorMeta(m.evento, m.antes);
    const depois = valorMeta(m.evento, m.depois);
    const objeto = m.objeto_tipo ? OBJETO_META[m.objeto_tipo] ?? m.objeto_tipo.toLowerCase() : null;
    return {
      id: i.id,
      quando: i.quando,
      dia: diaSP(i.quando),
      tipo: "meta",
      automatico: m.automatico,
      titulo: `Meta Ads · ${m.evento_texto ?? m.evento}`,
      texto: [objeto, m.objeto_nome ? `"${m.objeto_nome}"` : null].filter(Boolean).join(" ") || undefined,
      detalhes: [
        ...(antes || depois ? [antes && depois ? `${antes} → ${depois}` : depois ?? `antes: ${antes}`] : []),
        ...(m.conta ? [`Conta ${m.conta}${m.app && m.app !== "Ads Manager" ? ` · via ${m.app}` : ""}`] : []),
      ],
      autor: i.autor,
      cor: m.automatico ? undefined : "#1877f2",
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
  const [verAutomaticos, setVerAutomaticos] = useState(false);
  const [paraCliente, setParaCliente] = useState(false);
  const chaveOcultos = `vertente.diario-oculto.${clienteId}.${mes}`;
  const [ocultos, setOcultos] = useState<string[]>([]);
  useEffect(() => {
    try {
      setOcultos(JSON.parse(localStorage.getItem(chaveOcultos) ?? "[]") as string[]);
    } catch {
      setOcultos([]);
    }
  }, [chaveOcultos]);
  const alternarOculto = (id: string) => {
    const novo = ocultos.includes(id) ? ocultos.filter((x) => x !== id) : [...ocultos, id];
    setOcultos(novo);
    try {
      localStorage.setItem(chaveOcultos, JSON.stringify(novo));
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  };

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
    const base = (itens ?? []).map(daLinha).filter((e) => verAutomaticos || !e.automatico);
    const ns = notas.linhas
      .filter((n) => n.cliente_id === clienteId && diaSP(n.criado_em) >= de && diaSP(n.criado_em) <= ate)
      .map<Entrada>((n) => ({ id: `n-${n.id}`, quando: n.criado_em, dia: diaSP(n.criado_em), tipo: "nota", titulo: n.titulo ? `Anotação: ${n.titulo}` : "Anotação", texto: n.texto, autor: nomeMembro(n.autor_id) }));
    const ts = temps.linhas
      .filter((t) => t.cliente_id === clienteId && diaSP(t.criado_em) >= de && diaSP(t.criado_em) <= ate)
      .map<Entrada>((t) => {
        const n = NIVEIS_TEMP[t.nivel];
        return { id: `t-${t.id}`, quando: t.criado_em, dia: diaSP(t.criado_em), tipo: "temperatura", titulo: `Temperatura: ${n?.nome ?? t.nivel}`, texto: t.motivo ?? undefined, autor: nomeMembro(t.autor_id), cor: n?.cor };
      });
    const todas = [...base, ...ns, ...ts].sort((a, b) => a.quando.localeCompare(b.quando));
    if (!paraCliente) return todas;
    // Versão do cliente: só entregas e ajustes; sem anotações internas, temperatura, comentários e checagens de rotina
    return todas
      .filter((e) => e.tipo === "concluida" || e.tipo === "conta" || (e.tipo === "meta" && !e.automatico) || (e.tipo === "registro" && ["otimizacao", "reuniao", "conquista", "combinado"].includes(e.regTipo ?? "")))
      .filter((e) => !(e.tipo === "concluida" && /^(revis[aã]o di[aá]ria|daily|weekly)/i.test(e.texto ?? "")))
      .map((e) => (e.tipo === "registro" || e.tipo === "conta" ? { ...e, titulo: e.titulo.replace(/ · (Tudo certo|Atenção|Problema)$/, "") } : e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, notas.linhas, temps.linhas, clienteId, de, ate, d.membros, verAutomaticos, paraCliente]);
  const visiveis = paraCliente ? entradas.filter((e) => !ocultos.includes(e.id)) : entradas;
  const conquistas = entradas.filter((e) => e.regTipo === "conquista");

  // Dias do mês até hoje: úteis sempre aparecem; fim de semana só se teve movimento
  const dias = useMemo(() => {
    const h = hoje();
    const lista: string[] = [];
    for (let i = 1; i <= Number(ate.slice(8)); i++) {
      const dia = `${mes}-${String(i).padStart(2, "0")}`;
      if (dia > h) break;
      const tem = entradas.some((e) => e.dia === dia);
      if (tem || (!fimDeSemana(dia) && !soComMovimento && !paraCliente)) lista.push(dia);
    }
    return lista.reverse();
  }, [mes, ate, entradas, soComMovimento, paraCliente]);

  const cliente = d.clientes.find((c) => c.id === clienteId);
  const resumo = [
    { n: new Set(visiveis.map((e) => e.dia)).size, r: "dias com movimento" },
    { n: visiveis.filter((e) => e.tipo === "concluida").length, r: paraCliente ? "entregas concluídas" : "tarefas concluídas" },
    { n: visiveis.filter((e) => e.tipo === "conta" || (e.tipo === "meta" && !e.automatico)).length, r: "ajustes nas contas" },
    paraCliente
      ? { n: conquistas.filter((e) => !ocultos.includes(e.id)).length, r: "pequenas conquistas" }
      : { n: visiveis.filter((e) => e.tipo === "comentario" || e.tipo === "nota" || e.tipo === "registro").length, r: "registros e comentários" },
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
        <label className="flex items-center gap-2 text-[12.5px] text-muted" title="Cobranças, início de entrega e revisões feitas pela própria Meta">
          <input type="checkbox" checked={verAutomaticos} onChange={(e) => setVerAutomaticos(e.target.checked)} className="accent-[rgb(var(--accent-c))]" />
          Mostrar eventos automáticos da Meta
        </label>
        <button onClick={() => setParaCliente(!paraCliente)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] ${paraCliente ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:text-fg"}`}>
          {paraCliente ? <Eye size={14} /> : <EyeOff size={14} />} Versão do cliente
        </button>
        <button onClick={exportar} disabled={!itens} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg hover:opacity-90 disabled:opacity-50">
          <FileDown size={14} /> Exportar PDF
        </button>
      </div>

      <div id="diario-impressao" className="flex flex-col gap-4">
        <header className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted">Diário de Bordo</p>
          <h2 className="text-[19px] font-semibold">{cliente?.nome} · {nomeMes(mes)}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{paraCliente ? "O que a Vertente Digital fez pelo seu negócio neste mês: entregas, otimizações e ajustes nas campanhas, dia a dia." : "Tudo o que a Vertente fez neste cliente no mês, dia a dia, incluindo as alterações feitas nas contas de anúncio da Meta. Gerado automaticamente pelo sistema."}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {resumo.map((x) => (
              <div key={x.r} className="rounded-xl bg-raised px-3 py-2">
                <b className="num block text-[18px]">{x.n}</b>
                <span className="text-[12px] text-muted">{x.r}</span>
              </div>
            ))}
          </div>
        </header>

        {paraCliente && <p className="nao-imprimir -mt-2 rounded-xl bg-accent-soft px-3 py-2 text-[12.5px] text-accent">Versão do cliente: anotações internas, temperatura, comentários e checagens de rotina ficam de fora. Clique no olho de um item para tirá-lo também; o PDF sai como está na tela.</p>}
        {paraCliente && conquistas.filter((e) => !ocultos.includes(e.id)).length > 0 && (
          <section className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="mb-2 flex items-center gap-2 text-[14px] font-semibold"><Trophy size={15} className="text-warn" /> Pequenas conquistas do mês</h3>
            <ul className="flex flex-col gap-1 text-[13px]">{conquistas.filter((e) => !ocultos.includes(e.id)).map((e) => <li key={e.id}>• {e.texto ?? e.titulo}</li>)}</ul>
          </section>
        )}
        {erro && <p className="nao-imprimir rounded-xl border border-bad/30 bg-bad/5 px-3 py-2 text-[13px] text-bad">{erro}</p>}

        {!itens ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="esqueleto h-20 rounded-xl" />)}</div>
        ) : dias.length === 0 ? (
          <Vazio>Nenhum dia para mostrar neste mês.</Vazio>
        ) : (
          <div className="flex flex-col gap-2">{dias.map((dia) => {
            const doDia = entradas.filter((e) => e.dia === dia && (!paraCliente || e.regTipo !== "conquista"));
            const doDiaVis = paraCliente ? doDia.filter((e) => !ocultos.includes(e.id)) : doDia;
            if (doDia.length === 0)
              return (
                <div key={dia} className="diario-dia flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-2 text-[12.5px] text-muted">
                  <span className="font-medium">{rotuloDia(dia)}</span>
                  <span className="ml-auto">Sem movimentação registrada</span>
                </div>
              );
            return (
              <section key={dia} className={`diario-dia rounded-2xl border border-line bg-surface ${paraCliente && doDiaVis.length === 0 ? "nao-imprimir opacity-50" : ""}`}>
                <h3 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[13px] font-semibold">
                  {rotuloDia(dia)}
                  <span className="num ml-auto text-[12px] font-normal text-muted">{doDiaVis.length ? `${doDiaVis.length} registro${doDiaVis.length > 1 ? "s" : ""}` : ""}</span>
                </h3>
                {doDia.length === 0 ? (
                  <p className="px-4 py-3 text-[12.5px] text-muted">Sem movimentação registrada.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {doDia.map((e) => {
                      const I = ICONE[e.tipo];
                      const oculto = paraCliente && ocultos.includes(e.id);
                      return (
                        <li key={e.id} className={`flex gap-3 px-4 py-2.5 text-[13px] leading-snug ${oculto ? "nao-imprimir opacity-40" : ""}`}>
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
                          {paraCliente && (
                            <button onClick={() => alternarOculto(e.id)} className="nao-imprimir shrink-0 self-start text-muted hover:text-fg" title={oculto ? "Mostrar na versão do cliente" : "Tirar da versão do cliente"} aria-label={oculto ? "Mostrar" : "Ocultar"}>
                              {oculto ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          )}
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
