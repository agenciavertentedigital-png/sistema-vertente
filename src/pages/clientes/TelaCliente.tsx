import { useState } from "react";
import { ArrowLeft, Plus, Repeat } from "lucide-react";
import { useDados } from "../../lib/dados";
import { repo } from "../../lib/repo";
import {
  CANAL,
  DIAS_SEMANA,
  FREQUENCIA,
  PILAR,
  PILARES,
  STATUS_ABERTOS,
  atrasada,
  dataCurta,
  hoje,
  somarDias,
  type Canal,
  type ClienteRotina,
  type Frequencia,
} from "../../lib/tipos";
import { CartaoTarefa } from "../../components/tarefas/CartaoTarefa";
import { PainelTarefa } from "../../components/tarefas/PainelTarefa";
import { NovaTarefa } from "../../components/tarefas/NovaTarefa";
import { Botao, COR_PILAR, Selecao, Vazio } from "../../components/ui";
import { Numero, ordenar } from "./GestaoClientes";
import { LinhaDoTempo } from "../../components/LinhaDoTempo";
import { NumerosDaConta } from "../../components/NumerosDaConta";
import { PontoSituacao } from "../../components/ui";
import { SITUACAO } from "../../lib/tipos";
import { PastaDrive } from "../../components/PastaDrive";
import { AplicarProcesso, ProgressoProcessos, useProcessos } from "./Processos";
import { AtSign, FileText, FolderOpen, ListChecks, MapPin, MessageCircle, Pin, Target } from "lucide-react";
import { BriefingCliente } from "../../components/BriefingCliente";
import { Anotacoes } from "../../components/Anotacoes";
import { completudeBriefing, useBriefings, useNotas } from "../../lib/briefing";
import { useFichas } from "../../lib/cadastro";

type Aba = "tarefas" | "briefing" | "notas" | "linha" | "drive";

export function TelaCliente({ clienteId, ir }: { clienteId: string; ir: (r: string) => void }) {
  const d = useDados();
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [aba, setAbaEstado] = useState<Aba>(() => {
    try {
      return (localStorage.getItem("vertente.aba-cliente") as Aba) || "tarefas";
    } catch {
      return "tarefas";
    }
  });
  const setAba = (a: Aba) => {
    setAbaEstado(a);
    try {
      localStorage.setItem("vertente.aba-cliente", a);
    } catch {
      /* sem armazenamento */
    }
  };
  const briefings = useBriefings();
  const notas = useNotas();
  const { fichas } = useFichas();
  const [aplicar, setAplicar] = useState(false);
  const proc = useProcessos();
  const c = d.cliente(clienteId);

  if (d.carregando) return <Vazio>Carregando…</Vazio>;
  if (!c)
    return (
      <Vazio>
        Cliente não encontrado. <button className="text-accent" onClick={() => ir("clientes-carteira")}>Voltar para a carteira</button>
      </Vazio>
    );

  const doCliente = d.tarefas.filter((t) => t.cliente_id === c.id);
  const abertas = doCliente.filter((t) => STATUS_ABERTOS.includes(t.status));
  const visiveis = (verConcluidas ? doCliente : abertas).slice().sort(ordenar);
  const pilaresUsados = PILARES.filter((p) => p !== "interno" || visiveis.some((t) => t.pilar === "interno"));
  const feitas7 = doCliente.filter((t) => t.status === "feita" && t.concluida_em && t.concluida_em.slice(0, 10) >= somarDias(hoje(), -7)).length;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      <button onClick={() => ir("clientes-carteira")} className="flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} /> Carteira
      </button>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">{c.origem === "parceria_marcone" ? "Parceria Marcone" : "Cliente Vertente"}</div>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight">{c.nome}</h1>
          <Atalhos ficha={fichas.find((f) => f.id === c.id)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao onClick={() => setAplicar(true)}><ListChecks size={14} /> Aplicar onboarding</Botao>
          <Botao onClick={() => ir(`trafego-cliente-${c.id}`)}>Dashboard de tráfego</Botao>
          <Botao onClick={() => setVerConcluidas((v) => !v)}>{verConcluidas ? "Esconder concluídas" : "Ver concluídas (30 dias)"}</Botao>
          <Botao variante="primario" onClick={() => setNova(true)}>
            <Plus size={14} /> Nova tarefa
          </Botao>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo="Abertas" valor={abertas.length} />
        <Numero rotulo="Atrasadas" valor={abertas.filter((t) => atrasada(t)).length} alerta={abertas.some((t) => atrasada(t))} />
        <Numero rotulo="Rotinas ativas" valor={d.clienteRotinas.filter((r) => r.cliente_id === c.id && r.ativa).length} />
        <Numero rotulo="Concluídas em 7 dias" valor={feitas7} />
      </div>

      <ResumoEstrategico
        b={briefings.linhas.find((x) => x.cliente_id === c.id)}
        fixadas={notas.linhas.filter((n) => n.cliente_id === c.id && n.fixada).map((n) => n.titulo || n.texto)}
        ir={setAba}
      />

      <ProgressoProcessos clienteId={c.id} aplicados={proc.aplicados.linhas} />

      <NumerosDaConta clienteId={c.id} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
          {([["tarefas", "Tarefas e rotinas"], ["briefing", "Briefing"], ["notas", "Anotações"], ["linha", "Linha do tempo"], ["drive", "Pasta no Drive"]] as const).map(([v, n]) => (
            <button key={v} role="tab" aria-selected={aba === v} onClick={() => setAba(v)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] ${aba === v ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg"}`}>
              {n}
            </button>
          ))}
        </div>
        <SaudeResumo clienteId={c.id} />
      </div>

      {aba === "briefing" ? (
        <BriefingCliente clienteId={c.id} />
      ) : aba === "notas" ? (
        <Anotacoes clienteId={c.id} />
      ) : aba === "linha" ? (
        <LinhaDoTempo clienteId={c.id} />
      ) : aba === "drive" ? (
        <PastaDrive clienteId={c.id} />
      ) : (
      <>
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[880px] gap-3" style={{ gridTemplateColumns: `repeat(${pilaresUsados.length}, minmax(0, 1fr))` }}>
          {pilaresUsados.map((p) => {
            const lista = visiveis.filter((t) => t.pilar === p);
            return (
              <section key={p} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-raised p-2.5">
                <h2 className="flex items-center gap-2 px-1 text-[13px] font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: COR_PILAR[p] }} />
                  {PILAR[p]} <span className="num font-normal text-muted">{lista.length}</span>
                </h2>
                {lista.map((t) => (
                  <CartaoTarefa key={t.id} tarefa={t} abrir={setAberta} mostrarCliente={false} />
                ))}
                {lista.length === 0 && <p className="px-1 py-3 text-[12px] text-muted">Nada aberto.</p>}
              </section>
            );
          })}
        </div>
      </div>

      <RotinasDoCliente clienteId={c.id} />
      </>
      )}

      <PainelTarefa id={aberta} fechar={() => setAberta(null)} />
      <NovaTarefa aberto={nova} fechar={() => setNova(false)} clienteFixo={c.id} aoCriar={setAberta} />
      {aplicar && <AplicarProcesso processos={proc.processos.linhas} clienteId={c.id} fechar={() => setAplicar(false)} aoAplicar={() => proc.aplicados.recarregar()} />}
    </div>
  );
}

function RotinasDoCliente({ clienteId }: { clienteId: string }) {
  const d = useDados();
  const [adicionando, setAdicionando] = useState(false);
  const lista = d.clienteRotinas
    .filter((r) => r.cliente_id === clienteId)
    .sort((a, b) => (nomeRotina(a) + (a.canal ?? "")).localeCompare(nomeRotina(b) + (b.canal ?? "")));

  function nomeRotina(cr: ClienteRotina) {
    return d.rotinas.find((r) => r.id === cr.rotina_id)?.nome ?? "";
  }

  async function salvar(id: string | null, campos: Partial<ClienteRotina>) {
    try {
      await repo.salvarClienteRotina(id, campos);
      await d.recarregar();
      d.avisar(id ? "Rotina atualizada" : "Rotina adicionada. A primeira tarefa sai no próximo dia previsto.");
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Repeat size={15} /> Rotinas do cliente
        </h2>
        <Botao onClick={() => setAdicionando((v) => !v)}>
          <Plus size={14} /> Adicionar rotina
        </Botao>
      </div>
      {adicionando && <NovaRotinaCliente clienteId={clienteId} salvar={async (c) => { await salvar(null, c); setAdicionando(false); }} />}
      {lista.length === 0 ? (
        <Vazio>Nenhuma rotina para este cliente.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {["Rotina", "Canal", "Responsável", "Frequência", "Dia", "Última", "Ativa"].map((h) => (
                  <th key={h} className="eyebrow px-3 py-2.5 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((cr) => (
                <tr key={cr.id} className={`border-b border-line last:border-0 ${cr.ativa ? "" : "opacity-50"}`}>
                  <td className="px-3 py-2 font-medium">{nomeRotina(cr)}</td>
                  <td className="px-3 text-muted">{cr.canal ? CANAL[cr.canal] : "—"}</td>
                  <td className="px-3">
                    <Selecao id={`cr-resp-${cr.id}`} value={cr.responsavel_id ?? ""} onChange={(e) => salvar(cr.id, { responsavel_id: e.target.value || null })} aria-label="Responsável">
                      <option value="">Ninguém</option>
                      {d.membros.map((m) => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </Selecao>
                  </td>
                  <td className="px-3">
                    <Selecao id={`cr-freq-${cr.id}`} value={cr.frequencia} onChange={(e) => salvar(cr.id, { frequencia: e.target.value as Frequencia })} aria-label="Frequência">
                      {Object.entries(FREQUENCIA).map(([v, n]) => (
                        <option key={v} value={v}>{n}</option>
                      ))}
                    </Selecao>
                  </td>
                  <td className="px-3">
                    <SeletorDia cr={cr} salvar={(c) => salvar(cr.id, c)} />
                  </td>
                  <td className="num whitespace-nowrap px-3 text-muted">{cr.ultima_data ? dataCurta(cr.ultima_data) : "—"}</td>
                  <td className="px-3">
                    <input
                      id={`cr-ativa-${cr.id}`}
                      type="checkbox"
                      checked={cr.ativa}
                      onChange={(e) => salvar(cr.id, { ativa: e.target.checked })}
                      className="h-4 w-4 accent-[var(--accent)]"
                      aria-label="Rotina ativa"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SeletorDia({ cr, salvar }: { cr: Pick<ClienteRotina, "id" | "frequencia" | "dia_semana" | "dia_mes">; salvar: (c: Partial<ClienteRotina>) => void }) {
  if (cr.frequencia === "diaria") return <span className="text-muted">Dias úteis</span>;
  if (cr.frequencia === "mensal")
    return (
      <Selecao id={`cr-dia-${cr.id}`} value={cr.dia_mes ?? 1} onChange={(e) => salvar({ dia_mes: Number(e.target.value) })} aria-label="Dia do mês">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>Dia {n}</option>
        ))}
      </Selecao>
    );
  return (
    <Selecao id={`cr-dia-${cr.id}`} value={cr.dia_semana ?? 1} onChange={(e) => salvar({ dia_semana: Number(e.target.value) })} aria-label="Dia da semana">
      {DIAS_SEMANA.slice(1, 6).map((n, i) => (
        <option key={n} value={i + 1}>{n}</option>
      ))}
    </Selecao>
  );
}

function NovaRotinaCliente({ clienteId, salvar }: { clienteId: string; salvar: (c: Partial<ClienteRotina>) => Promise<void> }) {
  const d = useDados();
  const ativas = d.rotinas.filter((r) => r.ativa);
  const [rotinaId, setRotinaId] = useState(ativas[0]?.id ?? "");
  const rotina = d.rotinas.find((r) => r.id === rotinaId);
  const [canal, setCanal] = useState<Canal | "">("");
  const [resp, setResp] = useState(d.eu ?? "");
  const [freq, setFreq] = useState<Frequencia>(rotina?.frequencia_padrao ?? "semanal");
  const [diaSemana, setDiaSemana] = useState(1);
  const [diaMes, setDiaMes] = useState(1);
  return (
    <form
      className="grid grid-cols-2 gap-2 rounded-xl border border-accent bg-surface p-3 md:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        salvar({
          cliente_id: clienteId,
          rotina_id: rotinaId,
          canal: canal || null,
          responsavel_id: resp || null,
          frequencia: freq,
          dia_semana: freq === "semanal" || freq === "quinzenal" ? diaSemana : null,
          dia_mes: freq === "mensal" ? diaMes : null,
        });
      }}
    >
      <Selecao
        id="ncr-rotina"
        value={rotinaId}
        onChange={(e) => {
          setRotinaId(e.target.value);
          setFreq(d.rotinas.find((r) => r.id === e.target.value)?.frequencia_padrao ?? "semanal");
        }}
        className="col-span-2"
        aria-label="Rotina"
      >
        {ativas.map((r) => (
          <option key={r.id} value={r.id}>{r.nome}</option>
        ))}
      </Selecao>
      <Selecao id="ncr-canal" value={canal} onChange={(e) => setCanal(e.target.value as Canal | "")} aria-label="Canal">
        <option value="">Sem canal</option>
        {Object.entries(CANAL).map(([v, n]) => (
          <option key={v} value={v}>{n}</option>
        ))}
      </Selecao>
      <Selecao id="ncr-resp" value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
        <option value="">Ninguém</option>
        {d.membros.map((m) => (
          <option key={m.id} value={m.id}>{m.nome}</option>
        ))}
      </Selecao>
      <Selecao id="ncr-freq" value={freq} onChange={(e) => setFreq(e.target.value as Frequencia)} aria-label="Frequência">
        {Object.entries(FREQUENCIA).map(([v, n]) => (
          <option key={v} value={v}>{n}</option>
        ))}
      </Selecao>
      <SeletorDia
        cr={{ id: "nova", frequencia: freq, dia_semana: diaSemana, dia_mes: diaMes }}
        salvar={(c) => {
          if (c.dia_semana) setDiaSemana(c.dia_semana);
          if (c.dia_mes) setDiaMes(c.dia_mes);
        }}
      />
      <Botao variante="primario" type="submit" className="col-span-2 md:col-span-6 md:justify-self-end">
        Adicionar
      </Botao>
    </form>
  );
}

/** Última situação registrada de cada canal do cliente. */
function SaudeResumo({ clienteId }: { clienteId: string }) {
  const d = useDados();
  const ultimos = new Map<string, (typeof d.registros)[number]>();
  for (const r of d.registros
    .filter((r) => r.cliente_id === clienteId && r.situacao && (r.tipo === "revisao" || r.tipo === "otimizacao"))
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em)))
    ultimos.set(r.canal ?? "", r);
  if (ultimos.size === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {[...ultimos.entries()].map(([canal, r]) => (
        <span key={canal} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px]" title={r.nota ?? ""}>
          <PontoSituacao situacao={r.situacao} />
          {canal ? CANAL[canal as Canal] : "Conta"}: <strong className="font-medium">{SITUACAO[r.situacao!]}</strong>
          <span className="text-muted">· {dataCurta(r.data)}</span>
        </span>
      ))}
    </div>
  );
}

/** Atalhos da ficha: contato, Instagram, cidade e pasta do Drive. */
function Atalhos({ ficha }: { ficha?: import("../../lib/cadastro").Ficha }) {
  if (!ficha) return null;
  const tel = ficha.contato_telefone?.replace(/\D/g, "");
  const ig = ficha.instagram?.replace(/^@/, "").trim();
  const itens = [
    ficha.segmento || ficha.cidade ? { icone: MapPin, texto: [ficha.segmento, ficha.cidade].filter(Boolean).join(" · ") } : null,
    tel ? { icone: MessageCircle, texto: ficha.contato_nome ? `${ficha.contato_nome.split(" ")[0]} no WhatsApp` : "WhatsApp", href: `https://wa.me/${tel.length <= 11 ? "55" + tel : tel}` } : null,
    ig ? { icone: AtSign, texto: ig, href: `https://instagram.com/${ig}` } : null,
    ficha.pasta_drive ? { icone: FolderOpen, texto: "Pasta no Drive", href: ficha.pasta_drive } : null,
  ].filter(Boolean) as { icone: typeof MapPin; texto: string; href?: string }[];
  if (!itens.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-muted">
      {itens.map((i) =>
        i.href ? (
          <a key={i.texto} href={i.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-accent"><i.icone size={13} /> {i.texto}</a>
        ) : (
          <span key={i.texto} className="inline-flex items-center gap-1"><i.icone size={13} /> {i.texto}</span>
        ),
      )}
    </div>
  );
}

/** Faixa com o essencial do briefing e as notas fixadas, sempre visível na tela do cliente. */
function ResumoEstrategico({ b, fixadas, ir }: { b?: import("../../lib/briefing").Briefing; fixadas: string[]; ir: (a: Aba) => void }) {
  const comp = completudeBriefing(b);
  const v = (k: string) => b?.campos?.[k]?.trim();
  const itens = [
    { rotulo: "Objetivo", texto: v("objetivo_principal") },
    { rotulo: "KPI", texto: v("kpi_principal") },
    { rotulo: "Verba", texto: v("verba_midia") },
  ];
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
      <button onClick={() => ir("briefing")} className="flex flex-col gap-2 rounded-2xl bg-surface p-4 text-left hover:ring-1 hover:ring-accent/30 sm:flex-row sm:items-center sm:gap-5" style={{ boxShadow: "var(--sombra)" }}>
        <div className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent"><Target size={17} /></span>
          <div>
            <div className="text-[13px] font-semibold">Briefing</div>
            <div className={`num text-[12px] ${comp.pct >= 80 ? "text-ok" : comp.pct >= 40 ? "text-warn" : "text-muted"}`}>{comp.pct}% preenchido</div>
          </div>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          {itens.map((i) => (
            <div key={i.rotulo} className="min-w-0">
              <div className="text-[11.5px] text-muted">{i.rotulo}</div>
              <div className={`truncate text-[13px] ${i.texto ? "font-medium" : "text-muted"}`}>{i.texto || "Definir no briefing"}</div>
            </div>
          ))}
        </div>
      </button>
      <button onClick={() => ir("notas")} className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-left hover:ring-1 hover:ring-accent/30 lg:w-[300px]" style={{ boxShadow: "var(--sombra)" }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{fixadas.length ? <Pin size={16} /> : <FileText size={16} />}</span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{fixadas.length ? `${fixadas.length} nota${fixadas.length > 1 ? "s" : ""} fixada${fixadas.length > 1 ? "s" : ""}` : "Anotações"}</div>
          <div className="truncate text-[12px] text-muted">{fixadas[0] ?? "Combinados, ideias e aprendizados"}</div>
        </div>
      </button>
    </div>
  );
}
