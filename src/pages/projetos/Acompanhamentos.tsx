import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarClock, ChevronRight, Hourglass, ListTodo, Send, ThumbsUp, Trophy, Users2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDados } from "../../lib/dados";
import { supabase } from "../../lib/supabase";
import { AGUARDANDO, STATUS_ABERTOS, atrasada, dataCurta, hoje, somarDias, type Registro, type Tarefa } from "../../lib/tipos";
import type { SaudeCliente } from "../../lib/saude";
import { Vazio } from "../../components/ui";
import { Kpi } from "../../components/visual";
import { PainelTarefa } from "../../components/tarefas/PainelTarefa";

interface ReuniaoPendente { id: string; cliente_id: string; data: string; titulo: string | null }
type Filtro = "tudo" | "vertente" | "cliente" | "aprovacao" | "otimizacao" | "comunicar" | "reunioes";

/** Registros abertos de toda a carteira (combinados, conquistas e otimizações sem resultado) e reuniões não enviadas. */
function usePendenciasCarteira() {
  const d = useDados();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [reunioes, setReunioes] = useState<ReuniaoPendente[]>([]);
  useEffect(() => {
    if (!supabase) {
      setRegistros(d.registros.filter((r) => ["conquista", "otimizacao", "combinado"].includes(r.tipo)));
      return;
    }
    supabase
      .from("registros")
      .select("id, cliente_id, tarefa_id, tipo, canal, situacao, acoes, nota, alteracoes, dados, data, autor_id, criado_em")
      .in("tipo", ["conquista", "otimizacao", "combinado"])
      .gte("data", somarDias(hoje(), -120))
      .order("criado_em", { ascending: false })
      .limit(500)
      .then(({ data }) => setRegistros((data ?? []) as Registro[]));
    supabase
      .from("reunioes")
      .select("id, cliente_id, data, titulo")
      .is("enviado_em", null)
      .gte("data", somarDias(hoje(), -30))
      .order("data", { ascending: false })
      .then(({ data, error }) => !error && setReunioes((data ?? []) as ReuniaoPendente[]));
  }, [d.registros]);
  return { registros, reunioes };
}

/** Central de Acompanhamentos: tudo o que está em aberto entre a Vertente e os clientes, numa tela só. */
export function Acompanhamentos({ saude, ir }: { saude: SaudeCliente[]; ir: (r: string) => void }) {
  const d = useDados();
  const p = usePendenciasCarteira();
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [quem, setQuem] = useState<string>("todos");
  const [aberta, setAberta] = useState<string | null>(null);

  const doTime = (t: Tarefa) => quem === "todos" || t.responsavel_id === quem;
  const abertas = d.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status) && !t.triagem && t.cliente_id && d.cliente(t.cliente_id)?.nome !== "Agência Vertente Digital" && doTime(t));
  const vertente = abertas.filter((t) => (t.lado ?? "vertente") === "vertente" && (atrasada(t) || (t.prazo ?? "9999") <= somarDias(hoje(), 2)) && !/^revis[aã]o di[aá]ria/i.test(t.titulo));
  const cliente = abertas.filter((t) => t.lado === "cliente" && t.aguardando_motivo !== "aprovacao");
  const aprovacao = abertas.filter((t) => t.aguardando_motivo === "aprovacao" || (t.status === "aguardando" && t.lado !== "cliente" && /aprova/i.test(t.titulo)));
  const doAutor = (r: Registro) => quem === "todos" || r.autor_id === quem;
  const otimizacoes = p.registros.filter((r) => r.tipo === "otimizacao" && r.dados?.revisar_em && !r.dados?.resultado && r.dados.revisar_em <= hoje() && doAutor(r));
  const comunicar = p.registros.filter((r) => r.tipo === "conquista" && !r.dados?.enviado_em);
  const reunioes = p.reunioes;
  const atencao = saude.filter((s) => s.nota < 75);

  // Agrupa por cliente, na ordem de quem tem mais coisa pendente
  const grupos = useMemo(() => {
    const mapa = new Map<string, { t: Tarefa[]; c: Tarefa[]; a: Tarefa[]; o: Registro[]; q: Registro[]; r: ReuniaoPendente[] }>();
    const g = (id: string) => mapa.get(id) ?? (mapa.set(id, { t: [], c: [], a: [], o: [], q: [], r: [] }), mapa.get(id)!);
    const usa = (f: Filtro) => filtro === "tudo" || filtro === f;
    if (usa("vertente")) vertente.forEach((x) => g(x.cliente_id!).t.push(x));
    if (usa("cliente")) cliente.forEach((x) => g(x.cliente_id!).c.push(x));
    if (usa("aprovacao")) aprovacao.forEach((x) => g(x.cliente_id!).a.push(x));
    if (usa("otimizacao")) otimizacoes.forEach((x) => x.cliente_id && g(x.cliente_id).o.push(x));
    if (usa("comunicar")) comunicar.forEach((x) => x.cliente_id && g(x.cliente_id).q.push(x));
    if (usa("reunioes")) reunioes.forEach((x) => g(x.cliente_id).r.push(x));
    const nota = new Map(saude.map((s) => [s.clienteId, s.nota]));
    return [...mapa.entries()]
      .map(([id, v]) => ({ id, ...v, total: v.t.length + v.c.length + v.a.length + v.o.length + v.q.length + v.r.length, nota: nota.get(id) ?? null }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.t.filter(atrasada).length - a.t.filter(atrasada).length || b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, quem, d.tarefas, p.registros, p.reunioes, saude]);

  const nome = (id: string | null) => (id ? d.membros.find((m) => m.id === id)?.nome.split(" ")[0] ?? "" : "");
  const dias = (iso?: string) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);
  const k = (f: Filtro) => ({ onClick: () => setFiltro(filtro === f ? "tudo" : f), ativo: filtro === f });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-muted">Ver de</span>
        {[{ id: "todos", nome: "Todo o time" }, ...d.membros.map((m) => ({ id: m.id, nome: m.id === d.eu ? `${m.nome.split(" ")[0]} (eu)` : m.nome.split(" ")[0] }))].map((m) => (
          <button key={m.id} onClick={() => setQuem(m.id)} className={`rounded-full border px-3 py-1 text-[12.5px] ${quem === m.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:text-fg"}`}>{m.nome}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Vertente deve" valor={vertente.length} detalhe={`${vertente.filter(atrasada).length} atrasadas, até 48h`} tom={vertente.some(atrasada) ? "bad" : "neutro"} icone={ListTodo} {...k("vertente")} />
        <Kpi rotulo="Cobrar do cliente" valor={cliente.length} detalhe="materiais e respostas" tom={cliente.length ? "warn" : "ok"} icone={Hourglass} {...k("cliente")} />
        <Kpi rotulo="Aprovações" valor={aprovacao.length} detalhe="aguardando o cliente" tom={aprovacao.length ? "warn" : "ok"} icone={ThumbsUp} {...k("aprovacao")} />
        <Kpi rotulo="Otimizações" valor={otimizacoes.length} detalhe="anotar o resultado" tom={otimizacoes.length ? "warn" : "ok"} icone={CalendarClock} {...k("otimizacao")} />
        <Kpi rotulo="Para comunicar" valor={comunicar.length} detalhe="conquistas da semana" tom="accent" icone={Trophy} {...k("comunicar")} />
        <Kpi rotulo="Reuniões" valor={reunioes.length} detalhe="resumo não enviado" tom={reunioes.length ? "warn" : "ok"} icone={Send} {...k("reunioes")} />
      </div>

      {atencao.length > 0 && filtro === "tudo" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px]">
          <Users2 size={14} className="text-muted" />
          <b>Clientes em atenção:</b>
          {atencao.slice(0, 10).map((s) => (
            <button key={s.clienteId} onClick={() => ir(`cliente-${s.clienteId}`)} className="rounded-full px-2 py-0.5 hover:bg-raised" style={{ color: s.nota < 50 ? "var(--bad)" : "var(--warn)" }}>
              {d.cliente(s.clienteId)?.nome} <span className="num">{s.nota}</span>{s.pior ? <span className="text-muted"> · {s.pior.nome}</span> : null}
            </button>
          ))}
        </div>
      )}

      {grupos.length === 0 ? (
        <Vazio>Nada em aberto {filtro !== "tudo" ? "neste filtro" : ""}. Tudo em dia por aqui.</Vazio>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {grupos.map((g) => (
            <section key={g.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3" style={{ boxShadow: "var(--sombra)" }}>
              <button onClick={() => ir(`cliente-${g.id}`)} className="group flex items-center gap-2 px-1 text-left">
                <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{d.cliente(g.id)?.nome ?? "Cliente"}</h3>
                {g.nota !== null && <span className="num text-[12px]" style={{ color: g.nota < 50 ? "var(--bad)" : g.nota < 75 ? "var(--warn)" : "var(--ok)" }}>saúde {g.nota}</span>}
                <ChevronRight size={14} className="text-muted group-hover:text-fg" />
              </button>
              <Bloco titulo="Vertente deve" cor="#2747d6" itens={g.t.map((t) => (
                <Linha key={t.id} onClick={() => setAberta(t.id)} texto={t.titulo} meta={`${nome(t.responsavel_id) || "sem responsável"} · ${dataCurta(t.prazo)}`} alerta={atrasada(t)} />
              ))} />
              <Bloco titulo="Cobrar do cliente" cor="#1aa361" itens={g.c.map((t) => (
                <Linha key={t.id} onClick={() => setAberta(t.id)} texto={t.titulo} meta={`${t.contato_cliente ? `${t.contato_cliente} · ` : ""}${t.aguardando_motivo ? AGUARDANDO[t.aguardando_motivo] + " · " : ""}cobra: ${nome(t.responsavel_id) || "—"} · há ${dias(t.criado_em)}d`} alerta={dias(t.criado_em) > 5} />
              ))} />
              <Bloco titulo="Aprovações" cor="#b45309" itens={g.a.map((t) => (
                <Linha key={t.id} onClick={() => setAberta(t.id)} texto={t.titulo} meta={`${t.contato_cliente ? `${t.contato_cliente} · ` : ""}há ${dias(t.criado_em)}d`} alerta={dias(t.criado_em) > 3} />
              ))} />
              <Bloco titulo="Otimizações para anotar o resultado" cor="#7c3aed" itens={g.o.map((r) => (
                <Linha key={r.id} onClick={() => ir(`cliente-${g.id}`)} texto={r.dados?.motivo || r.nota || "Otimização"} meta={`revisar desde ${dataCurta(r.dados?.revisar_em ?? null)} · ${nome(r.autor_id)}`} />
              ))} />
              <Bloco titulo="Para comunicar" cor="#db2777" itens={g.q.map((r) => (
                <Linha key={r.id} onClick={() => ir(`cliente-${g.id}`)} texto={r.nota || "Conquista"} meta={dataCurta(r.data)} />
              ))} />
              <Bloco titulo="Resumo de reunião não enviado" cor="#0891b2" itens={g.r.map((r) => (
                <Linha key={r.id} onClick={() => ir(`cliente-${g.id}`)} texto={r.titulo ?? "Reunião"} meta={dataCurta(r.data)} alerta />
              ))} />
            </section>
          ))}
        </div>
      )}
      <PainelTarefa id={aberta} fechar={() => setAberta(null)} />
    </div>
  );
}

function Bloco({ titulo, cor, itens }: { titulo: string; cor: string; itens: ReactNode[] }) {
  if (!itens.length) return null;
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 px-1 pb-0.5 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: cor }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} /> {titulo} <span className="num font-normal text-muted">{itens.length}</span>
      </div>
      {itens}
    </div>
  );
}

function Linha({ texto, meta, alerta, onClick }: { texto: string; meta: string; alerta?: boolean; onClick: () => void; icone?: LucideIcon }) {
  return (
    <button onClick={onClick} className="flex items-baseline gap-2 rounded-lg px-2 py-1 text-left text-[13px] hover:bg-raised">
      <span className="min-w-0 flex-1 truncate">{texto}</span>
      <span className={`shrink-0 text-[11.5px] ${alerta ? "text-bad" : "text-muted"}`}>{meta}</span>
    </button>
  );
}
