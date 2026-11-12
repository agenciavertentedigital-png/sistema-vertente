import { CompartilharPainel } from "../../components/CompartilharPainel";
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
  type Canal,
  type ClienteRotina,
  type Frequencia,
} from "../../lib/tipos";
import { CartaoTarefa } from "../../components/tarefas/CartaoTarefa";
import { PainelTarefa } from "../../components/tarefas/PainelTarefa";
import { NovaTarefa } from "../../components/tarefas/NovaTarefa";
import { Botao, COR_PILAR, Selecao, Vazio } from "../../components/ui";
import { SeletorOrdem, comparador, useOrdem } from "../../lib/ordenacao";
import { LinhaDoTempo } from "../../components/LinhaDoTempo";
import { PontoSituacao } from "../../components/ui";
import { SITUACAO } from "../../lib/tipos";
import { RoteirosIA } from "../../components/RoteirosIA";
import { AcessosCliente } from "../../components/AcessosCliente";
import { Acompanhamento } from "../../components/Acompanhamento";
import { FichaEstrategica } from "../../components/FichaEstrategica";
import { DiarioBordo } from "../../components/DiarioBordo";
import { PastaDrive } from "../../components/PastaDrive";
import { AplicarProcesso, ProgressoProcessos, useProcessos } from "./Processos";
import { AtSign, BarChart3, FileText, FolderOpen, HardDrive, KeyRound, ListChecks, MapPin, MessageCircle, Paperclip, Target } from "lucide-react";
import { Anexos } from "../../components/Anexos";
import { Reunioes } from "../../components/Reunioes";
import { BriefingCliente } from "../../components/BriefingCliente";
import { MarcarTemperatura, SeloTemperatura } from "../../components/Temperatura";
import { Anotacoes } from "../../components/Anotacoes";
import { useFichas } from "../../lib/cadastro";

type Aba = "acompanhamento" | "tarefas" | "documentos" | "historico";
type SubDoc = "notas" | "arquivos" | "briefing" | "roteiros" | "acessos" | "drive";
type SubHist = "diario" | "reunioes" | "linha";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "acompanhamento", nome: "Acompanhamento" },
  { id: "tarefas", nome: "Tarefas e rotinas" },
  { id: "documentos", nome: "Documentos" },
  { id: "historico", nome: "Histórico" },
];
const SUB_DOC: { id: SubDoc; nome: string; icone: typeof FileText }[] = [
  { id: "notas", nome: "Anotações", icone: FolderOpen },
  { id: "arquivos", nome: "Arquivos (PDF)", icone: Paperclip },
  { id: "briefing", nome: "Briefing e estratégia", icone: Target },
  { id: "roteiros", nome: "Roteiros", icone: FileText },
  { id: "acessos", nome: "Acessos e links", icone: KeyRound },
  { id: "drive", nome: "Pasta no Drive", icone: HardDrive },
];
const SUB_HIST: { id: SubHist; nome: string }[] = [
  { id: "diario", nome: "Diário de Bordo" },
  { id: "reunioes", nome: "Reuniões" },
  { id: "linha", nome: "Linha do tempo" },
];
function lembrar<T extends string>(chave: string, padrao: T, validos: readonly T[]) {
  try { const v = localStorage.getItem(chave) as T | null; return v && validos.includes(v) ? v : padrao; } catch { return padrao; }
}
function guardar(chave: string, v: string) { try { localStorage.setItem(chave, v); } catch { /* sem armazenamento */ } }

export function TelaCliente({ clienteId, ir }: { clienteId: string; ir: (r: string) => void }) {
  const d = useDados();
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [aba, setAbaEstado] = useState<Aba>(() => lembrar("vertente.cli.aba", "acompanhamento", ABAS.map((a) => a.id)));
  const [subDoc, setSubDocEstado] = useState<SubDoc>(() => lembrar("vertente.cli.doc", "notas", SUB_DOC.map((a) => a.id)));
  const [subHist, setSubHistEstado] = useState<SubHist>(() => lembrar("vertente.cli.hist", "diario", SUB_HIST.map((a) => a.id)));
  const setAba = (a: Aba) => { setAbaEstado(a); guardar("vertente.cli.aba", a); };
  const setSubDoc = (a: SubDoc) => { setSubDocEstado(a); guardar("vertente.cli.doc", a); };
  const setSubHist = (a: SubHist) => { setSubHistEstado(a); guardar("vertente.cli.hist", a); };
  const { fichas } = useFichas();
  const [aplicar, setAplicar] = useState(false);
  const proc = useProcessos();
  const c = d.cliente(clienteId);
  const [ordem, setOrdem] = useOrdem("cliente");

  if (d.carregando) return <Vazio>Carregando…</Vazio>;
  if (!c)
    return (
      <Vazio>
        Cliente não encontrado. <button className="text-accent" onClick={() => ir("clientes-carteira")}>Voltar para a carteira</button>
      </Vazio>
    );

  const doCliente = d.tarefas.filter((t) => t.cliente_id === c.id);
  const abertas = doCliente.filter((t) => STATUS_ABERTOS.includes(t.status));
  const atrasadas = abertas.filter((t) => atrasada(t)).length;
  const visiveis = (verConcluidas ? doCliente : abertas).slice().sort(comparador(ordem));
  // Pilares que nem todo cliente usa (CRM, Comercial, Interno) só aparecem quando há tarefas neles
  const pilaresUsados = PILARES.filter((p) => !["crm", "comercial", "interno"].includes(p) || visiveis.some((t) => t.pilar === p));

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      <header className="flex flex-col gap-3">
        <button onClick={() => ir("clientes-carteira")} className="flex w-fit items-center gap-1.5 text-[12.5px] text-muted hover:text-fg">
          <ArrowLeft size={13} /> Carteira
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{c.nome}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
              <span>{c.origem === "parceria_marcone" ? "Parceria Marcone" : "Cliente Vertente"}</span>
              <span><b className="num text-fg">{abertas.length}</b> abertas</span>
              {atrasadas > 0 && <span className="text-bad"><b className="num">{atrasadas}</b> atrasadas</span>}
              <SaudeResumo clienteId={c.id} />
            </div>
            <Atalhos ficha={fichas.find((f) => f.id === c.id)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <details className="relative">
              <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] hover:border-line-forte [&::-webkit-details-marker]:hidden">
                Temperatura <SeloTemperatura clienteId={c.id} vazio="definir" />
              </summary>
              <div className="absolute right-0 z-30 mt-1 rounded-xl border border-line bg-surface p-2 shadow-lg"><MarcarTemperatura clienteId={c.id} compacto /></div>
            </details>
            <Botao onClick={() => ir(`trafego-cliente-${c.id}`)}><BarChart3 size={14} /> Dashboard</Botao>
            <CompartilharPainel clienteId={c.id} />
            <Botao variante="primario" onClick={() => setNova(true)}><Plus size={14} /> Nova tarefa</Botao>
          </div>
        </div>
        <nav role="tablist" className="abas-linha -mb-1 flex gap-6 overflow-x-auto border-b border-line">
          {ABAS.map((a) => (
            <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)} className={`whitespace-nowrap border-b-2 pb-2.5 text-[14px] font-medium ${aba === a.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}>
              {a.nome}
            </button>
          ))}
        </nav>
      </header>

      {aba === "acompanhamento" && <Acompanhamento clienteId={c.id} />}

      {aba === "documentos" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {SUB_DOC.map((x) => (
              <button key={x.id} onClick={() => setSubDoc(x.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] ${subDoc === x.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted hover:text-fg"}`}>
                <x.icone size={13} /> {x.nome}
              </button>
            ))}
          </div>
          {subDoc === "notas" ? <Anotacoes clienteId={c.id} />
            : subDoc === "arquivos" ? <div className="rounded-2xl border border-line bg-surface p-4"><Anexos alvo={{ cliente_id: c.id }} coluna="cliente_id" titulo="Arquivos do cliente (PDF)" /><p className="mt-2 text-[12px] text-muted">Contratos, apresentações e materiais. Aparecem aqui também os PDFs anexados em tarefas, notas e reuniões do cliente.</p></div>
            : subDoc === "briefing" ? <div className="flex flex-col gap-4"><FichaEstrategica clienteId={c.id} abrirBriefing={() => document.getElementById("briefing-inicio")?.scrollIntoView({ behavior: "smooth" })} /><div id="briefing-inicio"><BriefingCliente clienteId={c.id} /></div></div>
            : subDoc === "roteiros" ? <RoteirosIA clienteId={c.id} />
            : subDoc === "acessos" ? <AcessosCliente clienteId={c.id} />
            : <PastaDrive clienteId={c.id} />}
        </div>
      )}

      {aba === "historico" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {SUB_HIST.map((x) => (
              <button key={x.id} onClick={() => setSubHist(x.id)} className={`rounded-full border px-3 py-1.5 text-[12.5px] ${subHist === x.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted hover:text-fg"}`}>{x.nome}</button>
            ))}
          </div>
          {subHist === "diario" ? <DiarioBordo clienteId={c.id} /> : subHist === "reunioes" ? <Reunioes clienteId={c.id} /> : <LinhaDoTempo clienteId={c.id} />}
        </div>
      )}

      {aba === "tarefas" && (
      <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <SeletorOrdem ordem={ordem} mudar={setOrdem} />
        <Botao variante="fantasma" onClick={() => setVerConcluidas((v) => !v)}>{verConcluidas ? "Esconder concluídas" : "Ver concluídas (30 dias)"}</Botao>
      </div>
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

      <details className="rounded-2xl border border-line bg-surface px-4 py-3">
        <summary className="cursor-pointer text-[13px] font-semibold">Processos e onboarding <span className="font-normal text-muted">· aplicados uma vez, viram tarefas</span></summary>
        <div className="mt-3 flex flex-col gap-3">
          <ProgressoProcessos clienteId={c.id} aplicados={proc.aplicados.linhas} />
          <Botao onClick={() => setAplicar(true)} className="w-fit"><ListChecks size={14} /> Aplicar um processo (onboarding)</Botao>
        </div>
      </details>
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
