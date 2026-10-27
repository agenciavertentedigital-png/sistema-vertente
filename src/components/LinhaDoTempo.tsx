import { useCallback, useEffect, useRef, useState, type TextareaHTMLAttributes } from "react";
import { CheckCircle2, Gavel, MessageSquare, NotebookPen, SlidersHorizontal, Users2, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { repo } from "../lib/repo";
import { useDados } from "../lib/dados";
import { CANAL, SITUACAO, TIPO_REGISTRO, hoje, somarDias, type ItemLinha, type TipoRegistro } from "../lib/tipos";
import { Botao, COR_SITUACAO, Vazio, campo } from "./ui";

/** Textarea que sugere o time ao digitar @. */
export function CampoMencao({ valor, mudar, ...props }: { valor: string; mudar: (v: string) => void } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const { membros } = useDados();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const antes = valor.slice(0, cursor);
  const m = antes.match(/@([\p{L}]*)$/u);
  const sugestoes = m ? membros.filter((x) => x.nome.toLowerCase().startsWith(m[1].toLowerCase())).slice(0, 5) : [];

  function inserir(nome: string) {
    const primeiro = nome.split(" ")[0];
    const inicio = antes.replace(/@([\p{L}]*)$/u, `@${primeiro} `);
    const novo = inicio + valor.slice(cursor);
    mudar(novo);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(inicio.length, inicio.length);
      setCursor(inicio.length);
    });
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        {...props}
        value={valor}
        onChange={(e) => {
          mudar(e.target.value);
          setCursor(e.target.selectionStart);
        }}
        onKeyUp={(e) => setCursor(e.currentTarget.selectionStart)}
        onClick={(e) => setCursor(e.currentTarget.selectionStart)}
        className={`${campo} resize-y ${props.className ?? ""}`}
      />
      {sugestoes.length > 0 && (
        <div className="absolute left-2 top-full z-10 mt-1 flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          {sugestoes.map((s) => (
            <button key={s.id} type="button" onMouseDown={(e) => { e.preventDefault(); inserir(s.nome); }} className="rounded-lg px-2.5 py-1 text-[12.5px] hover:bg-accent-soft hover:text-accent">
              @{s.nome.split(" ")[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Destaca @menções no texto. */
export function TextoComMencoes({ texto }: { texto: string }) {
  const partes = texto.split(/(@[\p{L}]+)/u);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith("@") ? (
          <span key={i} className="rounded bg-accent-soft px-1 font-medium text-accent">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

const TIPOS_NOVOS: { tipo: TipoRegistro; nome: string }[] = [
  { tipo: "nota", nome: "Nota" },
  { tipo: "reuniao", nome: "Reunião" },
  { tipo: "decisao", nome: "Decisão" },
];

const ICONE: Record<TipoRegistro, LucideIcon> = {
  revisao: Eye,
  otimizacao: SlidersHorizontal,
  reuniao: Users2,
  nota: NotebookPen,
  decisao: Gavel,
  daily: Users2,
  weekly: Users2,
};

function rotuloDia(dia: string) {
  if (dia === hoje()) return "Hoje";
  if (dia === somarDias(hoje(), -1)) return "Ontem";
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
}

export function LinhaDoTempo({ clienteId }: { clienteId: string }) {
  const d = useDados();
  const [itens, setItens] = useState<ItemLinha[] | null>(null);
  const [tipo, setTipo] = useState<TipoRegistro>("nota");
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState<"tudo" | "trafego" | "conversas">("tudo");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setItens(await repo.linhaDoTempo(clienteId));
    } catch (e) {
      d.avisar((e as Error).message);
      setItens([]);
    }
  }, [clienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    carregar();
  }, [carregar, d.registros.length]);

  async function publicar() {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await repo.registrar({ cliente_id: clienteId, tipo, nota: texto.trim() });
      setTexto("");
      await Promise.all([carregar(), d.recarregar()]);
      d.avisar(texto.includes("@") ? "Publicado. Quem foi mencionado recebe no sininho." : "Publicado na linha do tempo");
    } catch (e) {
      d.avisar(`Não foi possível publicar: ${(e as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  const visiveis = (itens ?? []).filter((i) =>
    filtro === "tudo" ? true : filtro === "trafego" ? i.tipo === "registro" && (i.registro!.tipo === "revisao" || i.registro!.tipo === "otimizacao") : i.tipo === "comentario" || (i.tipo === "registro" && ["nota", "reuniao", "decisao"].includes(i.registro!.tipo)),
  );
  const porDia = new Map<string, ItemLinha[]>();
  for (const i of visiveis) {
    const dia = i.registro?.data ?? new Date(i.quando).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    porDia.set(dia, [...(porDia.get(dia) ?? []), i]);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1">
        <div role="tablist" className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1">
          {([["tudo", "Tudo"], ["trafego", "Revisões e otimizações"], ["conversas", "Notas e conversas"]] as const).map(([v, n]) => (
            <button key={v} role="tab" aria-selected={filtro === v} onClick={() => setFiltro(v)} className={`whitespace-nowrap rounded-lg px-3 py-1 text-[12.5px] ${filtro === v ? "bg-raised font-medium text-fg" : "text-muted hover:text-fg"}`}>
              {n}
            </button>
          ))}
        </div>
        {itens === null ? (
          <Vazio>Carregando…</Vazio>
        ) : porDia.size === 0 ? (
          <Vazio>Nada por aqui ainda. Revisões, otimizações, notas e comentários do cliente aparecem nesta linha do tempo.</Vazio>
        ) : (
          [...porDia.entries()].map(([dia, lista]) => (
            <section key={dia} className="flex flex-col gap-2">
              <h3 className="eyebrow first-letter:uppercase">{rotuloDia(dia)}</h3>
              <ol className="relative flex flex-col gap-2 border-l border-line pl-4">
                {lista.map((i) => (
                  <ItemTimeline key={`${i.tipo}-${i.id}`} i={i} />
                ))}
              </ol>
            </section>
          ))
        )}
      </div>

      <aside className="order-1 flex flex-col gap-2 self-start rounded-2xl border border-line bg-surface p-3 lg:sticky lg:top-0 lg:order-2">
        <div className="flex gap-1">
          {TIPOS_NOVOS.map((t) => (
            <button key={t.tipo} onClick={() => setTipo(t.tipo)} aria-pressed={tipo === t.tipo} className={`flex-1 rounded-lg px-2 py-1 text-[12.5px] ${tipo === t.tipo ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-raised"}`}>
              {t.nome}
            </button>
          ))}
        </div>
        <CampoMencao id="linha-texto" rows={4} valor={texto} mudar={setTexto} placeholder={tipo === "reuniao" ? "O que foi falado e combinado na reunião" : tipo === "decisao" ? "O que ficou decidido" : "Escreva para o time. Use @Nome para avisar alguém"} />
        <Botao variante="primario" disabled={!texto.trim() || salvando} onClick={publicar}>
          {salvando ? "Publicando…" : "Publicar"}
        </Botao>
      </aside>
    </div>
  );
}

function ItemTimeline({ i }: { i: ItemLinha }) {
  const hora = new Date(i.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  let Icone: LucideIcon = MessageSquare;
  let titulo = "";
  let cor = "var(--muted)";
  let corpo: React.ReactNode = null;

  if (i.tipo === "registro" && i.registro) {
    const r = i.registro;
    Icone = ICONE[r.tipo];
    titulo = `${TIPO_REGISTRO[r.tipo]}${r.canal ? ` · ${CANAL[r.canal]}` : ""}${r.situacao ? ` · ${SITUACAO[r.situacao]}` : ""}`;
    if (r.situacao) cor = COR_SITUACAO[r.situacao];
    else if (r.tipo === "decisao") cor = "var(--accent)";
    corpo = (
      <>
        {r.acoes.length > 0 && <div className="text-muted">{r.acoes.join(" · ")}</div>}
        {r.alteracoes.map((a, k) => (
          <div key={k}>
            <span className="text-[11.5px] font-semibold uppercase text-muted">{a.tipo}</span> {a.descricao}
            {(a.antes || a.depois) && <span className="num text-muted"> ({a.antes || "—"} → {a.depois || "—"})</span>}
          </div>
        ))}
        {r.nota && <p className="whitespace-pre-wrap"><TextoComMencoes texto={r.nota} /></p>}
      </>
    );
  } else if (i.tipo === "comentario") {
    titulo = `Comentário em "${i.tarefa}"`;
    corpo = <p className="whitespace-pre-wrap"><TextoComMencoes texto={i.texto ?? ""} /></p>;
  } else {
    Icone = CheckCircle2;
    cor = "var(--ok)";
    titulo = "Tarefa concluída";
    corpo = <p>{i.tarefa}</p>;
  }

  return (
    <li className="relative">
      <span className="absolute -left-[25px] top-2.5 grid h-[17px] w-[17px] place-items-center rounded-full bg-bg">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
      </span>
      <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] leading-snug">
        <div className="mb-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
          <Icone size={13} />
          <span className="font-medium text-fg">{titulo}</span>
          <span className="ml-auto num">{hora} · {i.autor ?? "Alguém"}</span>
        </div>
        {corpo}
      </div>
    </li>
  );
}

