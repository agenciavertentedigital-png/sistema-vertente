import { PdfsPendentes, enviarAnexos } from "./Anexos";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Check, Copy, Handshake, Hourglass, MessageSquareReply, Plus, Send, SlidersHorizontal, Trophy, Users2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDados } from "../lib/dados";
import { repo } from "../lib/repo";
import { supabase } from "../lib/supabase";
import { AGUARDANDO, PILAR, PILARES, STATUS_ABERTOS, atrasada, dataCurta, hoje, somarDias, type AguardandoMotivo, type Canal, type Pilar, type Registro, type Tarefa } from "../lib/tipos";
import { Botao, Entrada, Rotulo, Selecao, Vazio, campo } from "./ui";
import { PainelTarefa } from "./tarefas/PainelTarefa";
import { Reunioes } from "./Reunioes";

type Form = "vertente" | "cliente" | "retorno" | "combinado" | "conquista" | "otimizacao" | null;

/** Registros do cliente usados no acompanhamento (retornos, combinados, conquistas e otimizações). */
export function useRegistrosCliente(clienteId: string) {
  const d = useDados();
  const [lista, setLista] = useState<Registro[]>([]);
  const recarregar = useCallback(async () => {
    if (!supabase) {
      setLista(d.registros.filter((r) => r.cliente_id === clienteId));
      return;
    }
    const { data } = await supabase
      .from("registros")
      .select("id, cliente_id, tarefa_id, tipo, canal, situacao, acoes, nota, alteracoes, dados, data, autor_id, criado_em")
      .eq("cliente_id", clienteId)
      .in("tipo", ["retorno", "combinado", "conquista", "otimizacao"])
      .order("criado_em", { ascending: false })
      .limit(200);
    setLista((data ?? []) as Registro[]);
  }, [clienteId, d.registros]);
  useEffect(() => { recarregar(); }, [recarregar]);
  async function atualizarDados(r: Registro, novos: Partial<Registro["dados"]>) {
    const dados = { ...r.dados, ...novos };
    setLista((xs) => xs.map((x) => (x.id === r.id ? { ...x, dados } : x)));
    if (supabase) {
      const { error } = await supabase.from("registros").update({ dados }).eq("id", r.id);
      if (error) {
        d.avisar(error.message.includes("row-level") ? "Só quem registrou (ou um administrador) pode mudar este item." : error.message);
        recarregar();
      }
    }
  }
  return { lista, recarregar, atualizarDados };
}

export function Acompanhamento({ clienteId }: { clienteId: string }) {
  const d = useDados();
  const reg = useRegistrosCliente(clienteId);
  const [form, setForm] = useState<Form>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const abertas = d.tarefas.filter((t) => t.cliente_id === clienteId && STATUS_ABERTOS.includes(t.status) && !t.triagem);
  const ordenar = (a: Tarefa, b: Tarefa) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999");
  const vertente = abertas.filter((t) => (t.lado ?? "vertente") === "vertente").sort(ordenar);
  const cliente = abertas.filter((t) => t.lado === "cliente").sort(ordenar);
  const combinados = reg.lista.filter((r) => r.tipo === "combinado" && !r.dados?.encerrado_em);
  const retornos = reg.lista.filter((r) => r.tipo === "retorno").slice(0, 8);
  const conquistas = reg.lista.filter((r) => r.tipo === "conquista" && !r.dados?.enviado_em);
  const revisar = reg.lista.filter((r) => r.tipo === "otimizacao" && r.dados?.revisar_em && !r.dados?.resultado && r.dados.revisar_em <= somarDias(hoje(), 2));
  const otimizacoes = reg.lista.filter((r) => r.tipo === "otimizacao").slice(0, 6);
  const nome = (id: string | null) => (id ? d.membros.find((m) => m.id === id)?.nome.split(" ")[0] ?? "" : "");

  return (
    <div className="flex flex-col gap-5">
      {/* Atalhos de registro */}
      <div className="flex flex-wrap gap-2">
        <BotaoAcao icone={Plus} onClick={() => setForm("vertente")}>Vertente deve</BotaoAcao>
        <BotaoAcao icone={Hourglass} onClick={() => setForm("cliente")}>Cliente deve</BotaoAcao>
        <BotaoAcao icone={MessageSquareReply} onClick={() => setForm("retorno")}>Retorno do cliente</BotaoAcao>
        <BotaoAcao icone={Handshake} onClick={() => setForm("combinado")}>Combinado</BotaoAcao>
        <BotaoAcao icone={SlidersHorizontal} onClick={() => setForm("otimizacao")}>Otimização</BotaoAcao>
        <BotaoAcao icone={Trophy} onClick={() => setForm("conquista")}>Pequena conquista</BotaoAcao>
      </div>

      {revisar.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-warn/40 bg-warn-soft/40 p-3">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-warn"><CalendarClock size={14} /> Otimizações para anotar o resultado</h3>
          {revisar.map((r) => <ResultadoOtimizacao key={r.id} r={r} salvar={(t) => reg.atualizarDados(r, { resultado: t, resultado_em: hoje() })} />)}
        </section>
      )}

      {/* Quem deve o quê */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Coluna titulo="Vertente deve" sub="Ações, entregas e retornos da agência" cor="#2747d6" qtd={vertente.length}>
          {vertente.length === 0 ? <Vazio>Nada pendente da Vertente.</Vazio> : vertente.map((t) => (
            <LinhaTarefa key={t.id} t={t} abrir={() => setAberta(t.id)} extra={t.responsavel_id ? nome(t.responsavel_id) : "Sem responsável"} />
          ))}
        </Coluna>
        <Coluna titulo="Cliente deve" sub="Materiais, aprovações e respostas, com quem cobra" cor="#1aa361" qtd={cliente.length}>
          {cliente.length === 0 ? <Vazio>Nada pendente do cliente.</Vazio> : cliente.map((t) => (
            <LinhaTarefa key={t.id} t={t} abrir={() => setAberta(t.id)} extra={`${t.contato_cliente ? `${t.contato_cliente} · ` : ""}cobra: ${nome(t.responsavel_id) || "—"}`} />
          ))}
        </Coluna>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bloco titulo="Combinados vigentes" icone={Handshake} qtd={combinados.length}>
          {combinados.length === 0 ? <p className="text-[12.5px] text-muted">Nenhum combinado registrado.</p> : combinados.map((r) => (
            <div key={r.id} className="group flex items-start gap-2 rounded-lg px-1 py-1.5 text-[13px]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <div className="min-w-0 flex-1"><p className="whitespace-pre-wrap">{r.nota}</p><span className="text-[11px] text-muted">{dataCurta(r.data)}</span></div>
              <button onClick={() => reg.atualizarDados(r, { encerrado_em: hoje() })} title="Não vale mais" className="text-[11px] text-muted opacity-0 hover:text-bad group-hover:opacity-100">encerrar</button>
            </div>
          ))}
        </Bloco>
        <Bloco titulo="Retornos do cliente" icone={MessageSquareReply} qtd={retornos.length}>
          {retornos.length === 0 ? <p className="text-[12.5px] text-muted">Nenhum retorno registrado.</p> : retornos.map((r) => (
            <div key={r.id} className="rounded-lg px-1 py-1.5 text-[13px]"><p className="line-clamp-3 whitespace-pre-wrap">{r.nota}</p><span className="text-[11px] text-muted">{dataCurta(r.data)} · {nome(r.autor_id)}</span></div>
          ))}
        </Bloco>
        <Bloco titulo="Para comunicar" icone={Send} qtd={conquistas.length}>
          {conquistas.length === 0 ? <p className="text-[12.5px] text-muted">Nenhuma conquista esperando envio. A Carol envia toda semana.</p> : (
            <>
              {conquistas.map((r) => (
                <div key={r.id} className="flex items-start gap-2 rounded-lg px-1 py-1.5 text-[13px]"><Trophy size={13} className="mt-0.5 shrink-0 text-[#f2b705]" /><p className="min-w-0 flex-1 whitespace-pre-wrap">{r.nota}</p></div>
              ))}
              <div className="mt-1 flex gap-2">
                <Botao onClick={() => { navigator.clipboard?.writeText(textoConquistas(d.cliente(clienteId)?.nome ?? "", conquistas)); d.avisar("Mensagem das conquistas copiada"); }}><Copy size={13} /> Copiar mensagem</Botao>
                <Botao onClick={async () => { for (const r of conquistas) await reg.atualizarDados(r, { enviado_em: new Date().toISOString() }); d.avisar("Conquistas marcadas como enviadas"); }}><Check size={13} /> Marcar enviadas</Botao>
              </div>
            </>
          )}
        </Bloco>
      </div>

      <Bloco titulo="Últimas otimizações" icone={SlidersHorizontal} qtd={otimizacoes.length}>
        {otimizacoes.length === 0 ? <p className="text-[12.5px] text-muted">Nenhuma otimização registrada. As alterações feitas na Meta já aparecem sozinhas no Diário de Bordo; aqui fica o porquê.</p> : (
          <div className="grid gap-2 md:grid-cols-2">{otimizacoes.map((r) => <CartaoOtimizacao key={r.id} r={r} autor={nome(r.autor_id)} />)}</div>
        )}
      </Bloco>

      <Reunioes clienteId={clienteId} />

      {form && <FormRapido tipo={form} clienteId={clienteId} fechar={() => setForm(null)} aoSalvar={reg.recarregar} />}
      {aberta && <PainelTarefa id={aberta} fechar={() => setAberta(null)} />}
    </div>
  );
}

const textoConquistas = (cliente: string, lista: Registro[]) =>
  `🏆 *Pequenas conquistas da semana — ${cliente}*\n\n${lista.map((r) => `✅ ${r.nota}`).join("\n")}\n\nSeguimos juntos! 🚀`;

function BotaoAcao({ icone: I, onClick, children }: { icone: LucideIcon; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium hover:border-accent hover:text-accent">
      <I size={14} /> {children}
    </button>
  );
}

function Coluna({ titulo, sub, cor, qtd, children }: { titulo: string; sub: string; cor: string; qtd: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3" style={{ boxShadow: "var(--sombra)" }}>
      <div className="flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
        <h3 className="text-[14px] font-semibold">{titulo}</h3>
        <span className="num text-[12px] text-muted">{qtd}</span>
        <span className="ml-auto hidden text-[11.5px] text-muted sm:inline">{sub}</span>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function Bloco({ titulo, icone: I, qtd, children }: { titulo: string; icone: LucideIcon; qtd: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3" style={{ boxShadow: "var(--sombra)" }}>
      <h3 className="mb-1 flex items-center gap-2 px-1 text-[13px] font-semibold"><I size={14} className="text-muted" /> {titulo} <span className="num font-normal text-muted">{qtd}</span></h3>
      {children}
    </section>
  );
}

function LinhaTarefa({ t, abrir, extra }: { t: Tarefa; abrir: () => void; extra: string }) {
  const atraso = atrasada(t);
  return (
    <button onClick={abrir} className="flex items-start gap-2 rounded-xl px-2 py-2 text-left hover:bg-raised">
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${t.status === "fazendo" ? "bg-accent" : t.status === "aguardando" ? "bg-warn" : "bg-line-forte"}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] leading-snug">{t.titulo}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted">
          <span>{extra}</span>
          {t.aguardando_motivo && <span className="rounded-full bg-warn-soft px-1.5 text-warn">aguardando {AGUARDANDO[t.aguardando_motivo].toLowerCase()}</span>}
          {t.reuniao_id && <span className="inline-flex items-center gap-0.5"><Users2 size={11} /> reunião</span>}
        </span>
      </span>
      {t.prazo && <span className={`shrink-0 text-[11.5px] ${atraso ? "font-semibold text-bad" : "text-muted"}`}>{dataCurta(t.prazo)}</span>}
    </button>
  );
}

function CartaoOtimizacao({ r, autor }: { r: Registro; autor: string }) {
  const x = r.dados ?? {};
  return (
    <div className="rounded-xl border border-line p-3 text-[12.5px]">
      <div className="mb-1 flex items-center gap-2 text-[11.5px] text-muted">{dataCurta(r.data)} · {autor}{r.canal && ` · ${r.canal === "meta" ? "Meta" : "Google"}`}</div>
      <p className="whitespace-pre-wrap text-[13px]">{r.nota}</p>
      <dl className="mt-1.5 grid gap-0.5">
        {x.motivo && <div><dt className="inline text-muted">Motivo: </dt><dd className="inline">{x.motivo}</dd></div>}
        {x.hipotese && <div><dt className="inline text-muted">Hipótese: </dt><dd className="inline">{x.hipotese}</dd></div>}
        {x.esperado && <div><dt className="inline text-muted">Esperado: </dt><dd className="inline">{x.esperado}</dd></div>}
        {x.resultado ? <div className="text-ok"><dt className="inline">Resultado: </dt><dd className="inline">{x.resultado}</dd></div> : x.revisar_em && <div className="text-muted">Revisar em {dataCurta(x.revisar_em)}</div>}
      </dl>
    </div>
  );
}

function ResultadoOtimizacao({ r, salvar }: { r: Registro; salvar: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-2.5 text-[12.5px] sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1"><b>{dataCurta(r.data)}</b> · {r.nota}{r.dados?.esperado && <span className="text-muted"> · esperado: {r.dados.esperado}</span>}</div>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="O que aconteceu?" className={`${campo} sm:!w-[260px]`} />
      <Botao variante="primario" disabled={!t.trim()} onClick={() => salvar(t.trim())}>Salvar</Botao>
    </div>
  );
}

/** Pop-up de registro rápido do acompanhamento. */
function FormRapido({ tipo, clienteId, fechar, aoSalvar }: { tipo: Exclude<Form, null>; clienteId: string; fechar: () => void; aoSalvar: () => void }) {
  const d = useDados();
  const [texto, setTexto] = useState("");
  const [prazo, setPrazo] = useState("");
  const [resp, setResp] = useState(d.eu ?? "");
  const [contato, setContato] = useState("");
  const [motivoAg, setMotivoAg] = useState<AguardandoMotivo | "">(tipo === "cliente" ? "material" : "");
  const [pilar, setPilar] = useState<Pilar>("trafego");
  const [canal, setCanal] = useState<Canal>("meta");
  const [motivo, setMotivo] = useState("");
  const [hipotese, setHipotese] = useState("");
  const [esperado, setEsperado] = useState("");
  const [revisar, setRevisar] = useState(somarDias(hoje(), 7));
  const [salvando, setSalvando] = useState(false);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const titulos: Record<Exclude<Form, null>, string> = {
    vertente: "Vertente deve",
    cliente: "Cliente deve",
    retorno: "Retorno do cliente",
    combinado: "Novo combinado",
    conquista: "Pequena conquista",
    otimizacao: "Otimização",
  };
  const dicas: Record<Exclude<Form, null>, string> = {
    vertente: "Ex.: Enviar 3 roteiros de novembro",
    cliente: "Ex.: Enviar fotos de antes e depois para o Drive",
    retorno: "Ex.: Aprovou o vídeo do Dr. Wesley; pediu para trocar a música",
    combinado: "Ex.: Campanhas de novembro sem foco em desconto, comunicação institucional",
    conquista: "Ex.: Custo por contato caiu 22% na semana com os novos criativos",
    otimizacao: "Ex.: Pausei 3 anúncios com CTR baixo e subi 2 criativos novos no conjunto de remarketing",
  };

  async function salvar() {
    if (!texto.trim()) return d.avisar("Escreva o texto.");
    setSalvando(true);
    try {
      if (tipo === "vertente" || tipo === "cliente") {
        const idTarefa = await repo.salvarTarefa(null, {
          cliente_id: clienteId,
          titulo: texto.trim(),
          pilar,
          prioridade: "normal",
          prazo: prazo || null,
          responsavel_id: resp || null,
          lado: tipo,
          contato_cliente: tipo === "cliente" ? contato.trim() || null : null,
          status: tipo === "cliente" ? "aguardando" : "a_fazer",
          aguardando_motivo: tipo === "cliente" && motivoAg ? motivoAg : null,
        });
        if (pdfs.length) await enviarAnexos(pdfs, { cliente_id: clienteId, tarefa_id: idTarefa });
        await d.recarregar();
      } else {
        const idReg = await repo.registrar({
          cliente_id: clienteId,
          tipo,
          nota: texto.trim(),
          canal: tipo === "otimizacao" ? canal : null,
          dados: tipo === "otimizacao" ? { motivo: motivo.trim() || undefined, hipotese: hipotese.trim() || undefined, esperado: esperado.trim() || undefined, revisar_em: revisar || undefined } : {},
        });
        if (idReg && pdfs.length) await enviarAnexos(pdfs, { cliente_id: clienteId, registro_id: idReg });
        aoSalvar();
      }
      d.avisar("Registrado");
      fechar();
    } catch (e) {
      d.avisar((e as Error).message.includes("registros_tipo_check") ? "Falta aplicar a atualização do banco desta etapa." : (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4 text-fg">
      <div className="anim-entrar absolute inset-0 bg-[rgb(12_14_20/0.35)] backdrop-blur-[2px]" onClick={fechar} />
      <section role="dialog" aria-modal="true" className="relative flex max-h-[90dvh] w-full max-w-[520px] flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-4" style={{ boxShadow: "var(--sombra-flutuante)" }} onKeyDown={(e) => { if (e.key === "Escape") fechar(); if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) salvar(); }}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-semibold">{titulos[tipo]} · {d.cliente(clienteId)?.nome}</h2><button onClick={fechar} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised" aria-label="Fechar"><X size={16} /></button></div>
        <div className="flex flex-col gap-3">
          <textarea autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} rows={tipo === "otimizacao" ? 3 : 2} placeholder={dicas[tipo]} className={`${campo} !text-[14px]`} />
          <PdfsPendentes arquivos={pdfs} mudar={setPdfs} />
          {(tipo === "vertente" || tipo === "cliente") && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tipo === "cliente" && <Rotulo texto="Quem do cliente"><Entrada value={contato} onChange={(e) => setContato(e.target.value)} placeholder="Ex.: Polyanne / Gestão" /></Rotulo>}
              {tipo === "cliente" && (
                <Rotulo texto="Aguardando">
                  <Selecao value={motivoAg} onChange={(e) => setMotivoAg(e.target.value as AguardandoMotivo)}>{(Object.keys(AGUARDANDO) as AguardandoMotivo[]).map((k) => <option key={k} value={k}>{AGUARDANDO[k]}</option>)}</Selecao>
                </Rotulo>
              )}
              <Rotulo texto={tipo === "cliente" ? "Quem da Vertente cobra" : "Responsável"}>
                <Selecao value={resp} onChange={(e) => setResp(e.target.value)}><option value="">—</option>{d.membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</Selecao>
              </Rotulo>
              <Rotulo texto="Prazo"><Entrada type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Rotulo>
              <Rotulo texto="Pilar"><Selecao value={pilar} onChange={(e) => setPilar(e.target.value as Pilar)}>{PILARES.map((p) => <option key={p} value={p}>{PILAR[p]}</option>)}</Selecao></Rotulo>
            </div>
          )}
          {tipo === "otimizacao" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Rotulo texto="Motivo (por que mexeu)"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="CPL subiu 30% na semana" /></Rotulo>
              <Rotulo texto="Hipótese"><Entrada value={hipotese} onChange={(e) => setHipotese(e.target.value)} placeholder="Criativos saturados (frequência 3,2)" /></Rotulo>
              <Rotulo texto="Resultado esperado"><Entrada value={esperado} onChange={(e) => setEsperado(e.target.value)} placeholder="Voltar CPL para até R$ 12" /></Rotulo>
              <Rotulo texto="Revisar o resultado em"><Entrada type="date" value={revisar} onChange={(e) => setRevisar(e.target.value)} /></Rotulo>
              <Rotulo texto="Plataforma"><Selecao value={canal} onChange={(e) => setCanal(e.target.value as Canal)}><option value="meta">Meta</option><option value="google">Google</option></Selecao></Rotulo>
            </div>
          )}
          {tipo === "otimizacao" && <p className="text-[11.5px] text-muted">As alterações feitas no Gerenciador entram sozinhas no Diário. No dia da revisão você recebe um lembrete para anotar o resultado.</p>}
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Botao onClick={fechar}>Cancelar</Botao>
            <Botao variante="primario" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

