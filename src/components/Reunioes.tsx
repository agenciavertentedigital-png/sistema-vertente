import { Anexos, PdfsPendentes, enviarAnexos } from "./Anexos";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ClipboardList, Copy, ExternalLink, Loader2, Plus, Sparkles, Users2, X } from "lucide-react";
import { useDados } from "../lib/dados";
import { repo } from "../lib/repo";
import { supabase } from "../lib/supabase";
import { chamarFuncao } from "../lib/tabela";
import { STATUS_ABERTOS, dataCurta, hoje } from "../lib/tipos";
import { Botao, Entrada, Selecao, campo } from "./ui";

interface Item { lado: "vertente" | "cliente"; quem: string; texto: string; prazo: string | null; criar?: boolean; responsavel_id?: string }
interface Reuniao { id: string; cliente_id: string; data: string; titulo: string | null; link_transcricao: string | null; resumo: string | null; itens: Item[]; enviado_em: string | null; criado_em: string }

function useReunioes(clienteId: string) {
  const [lista, setLista] = useState<Reuniao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [faltaBanco, setFaltaBanco] = useState(false);
  const recarregar = useCallback(async () => {
    if (!supabase) {
      setCarregando(false);
      return;
    }
    const { data, error } = await supabase.from("reunioes").select("id, cliente_id, data, titulo, link_transcricao, resumo, itens, enviado_em, criado_em").eq("cliente_id", clienteId).order("data", { ascending: false }).limit(30);
    setFaltaBanco(!!error && /reunioes|schema cache/i.test(error.message));
    setLista((data ?? []) as Reuniao[]);
    setCarregando(false);
  }, [clienteId]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { lista, carregando, faltaBanco, recarregar };
}

/** Reuniões do cliente: resumo com IA no modelo da Vertente, itens de ação que viram demandas e pauta da próxima. */
export function Reunioes({ clienteId }: { clienteId: string }) {
  const d = useDados();
  const r = useReunioes(clienteId);
  const [nova, setNova] = useState(false);
  const [pauta, setPauta] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  function montarPauta() {
    const cli = d.cliente(clienteId)?.nome ?? "";
    const abertas = d.tarefas.filter((t) => t.cliente_id === clienteId && STATUS_ABERTOS.includes(t.status) && !t.triagem);
    const ver = abertas.filter((t) => (t.lado ?? "vertente") === "vertente");
    const cli2 = abertas.filter((t) => t.lado === "cliente");
    const ultima = r.lista[0];
    const linhas = [
      `*Pauta — ${cli} | ${hoje().split("-").reverse().slice(0, 2).join("/")}*`,
      "",
      "*1. Feedback de resultados (Vertente → cliente)*",
      "- Pequenas conquistas e resultados da semana",
      "- Ações realizadas e próximos passos",
      "- Taxas de conversão entre as etapas do funil",
      "",
      "*2. Feedback de vendas (cliente → Vertente)*",
      "- Qualificações, vendas e valor vendido",
      "- Objeções e comportamentos percebidos",
      "",
      `*3. Pendências da Vertente (${ver.length})*`,
      ...(ver.length ? ver.map((t) => `- ${t.titulo}${t.prazo ? ` (prazo ${dataCurta(t.prazo)})` : ""}`) : ["- Nada pendente"]),
      "",
      `*4. Pendências do cliente (${cli2.length})*`,
      ...(cli2.length ? cli2.map((t) => `- ${t.titulo}${t.contato_cliente ? ` — ${t.contato_cliente}` : ""}`) : ["- Nada pendente"]),
      ...(ultima ? ["", `*Referência: reunião de ${dataCurta(ultima.data)}*`, ...(ultima.itens ?? []).slice(0, 12).map((i) => `- ${i.texto}`)] : []),
      "",
      "*5. Novos tópicos*",
      "- ",
    ];
    setPauta(linhas.join("\n"));
  }

  if (r.faltaBanco) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3" style={{ boxShadow: "var(--sombra)" }}>
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Users2 size={14} className="text-muted" />
        <h3 className="text-[13px] font-semibold">Reuniões</h3>
        <span className="num text-[12px] text-muted">{r.lista.length}</span>
        <div className="ml-auto flex gap-2">
          <Botao onClick={montarPauta}><ClipboardList size={13} /> Pauta da próxima</Botao>
          <Botao variante="primario" onClick={() => setNova(true)}><Plus size={13} /> Nova reunião</Botao>
        </div>
      </div>
      {r.carregando ? null : r.lista.length === 0 ? (
        <p className="px-1 text-[12.5px] text-muted">Nenhuma reunião registrada. Cole a transcrição do Tactiq em "Nova reunião" e a IA monta o resumo e os itens de ação.</p>
      ) : (
        r.lista.map((x) => (
          <div key={x.id} className="rounded-xl border border-line">
            <button onClick={() => setAberta(aberta === x.id ? null : x.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]">
              <b className="num">{dataCurta(x.data)}</b>
              <span className="min-w-0 flex-1 truncate">{x.titulo ?? "Reunião"}</span>
              <span className="text-[11.5px] text-muted">{(x.itens ?? []).length} itens</span>
              {x.enviado_em ? <span className="rounded-full bg-ok-soft px-2 text-[11px] text-ok">enviado</span> : <span className="rounded-full bg-warn-soft px-2 text-[11px] text-warn">não enviado</span>}
              <ChevronDown size={14} className={`text-muted transition-transform ${aberta === x.id ? "rotate-180" : ""}`} />
            </button>
            {aberta === x.id && (
              <div className="flex flex-col gap-2 border-t border-line p-3">
                <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{x.resumo}</pre>
                <div className="flex flex-wrap gap-2">
                  <Botao onClick={() => { navigator.clipboard?.writeText(x.resumo ?? ""); d.avisar("Resumo copiado. É só colar no grupo."); }}><Copy size={13} /> Copiar para o WhatsApp</Botao>
                  {!x.enviado_em && supabase && <Botao onClick={async () => { await supabase!.from("reunioes").update({ enviado_em: new Date().toISOString() }).eq("id", x.id); r.recarregar(); }}><Check size={13} /> Marcar como enviado</Botao>}
                  {x.link_transcricao && <a href={x.link_transcricao} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 text-[12.5px] text-accent hover:underline"><ExternalLink size={12} /> Transcrição completa</a>}
                </div>
                <Anexos alvo={{ cliente_id: clienteId, reuniao_id: x.id }} coluna="reuniao_id" />
              </div>
            )}
          </div>
        ))
      )}
      {nova && <NovaReuniao clienteId={clienteId} fechar={() => setNova(false)} aoSalvar={r.recarregar} />}
      {pauta !== null && <Janela titulo="Pauta da próxima reunião" fechar={() => setPauta(null)}>
        <textarea value={pauta} onChange={(e) => setPauta(e.target.value)} rows={18} className={`${campo} font-mono !text-[12.5px]`} />
        <div className="mt-3 flex justify-end gap-2"><Botao onClick={() => setPauta(null)}>Fechar</Botao><Botao variante="primario" onClick={() => { navigator.clipboard?.writeText(pauta); d.avisar("Pauta copiada"); }}><Copy size={13} /> Copiar</Botao></div>
      </Janela>}
    </section>
  );
}

function Janela({ titulo, fechar, children, largura = 720 }: { titulo: string; fechar: () => void; children: React.ReactNode; largura?: number }) {
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4 text-fg" onKeyDown={(e) => e.key === "Escape" && fechar()}>
      <div className="anim-entrar absolute inset-0 bg-[rgb(12_14_20/0.35)] backdrop-blur-[2px]" onClick={fechar} />
      <section role="dialog" aria-modal="true" className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ maxWidth: largura, boxShadow: "var(--sombra-flutuante)" }}>
        <header className="flex items-center gap-2 border-b border-line px-4 py-3"><h2 className="text-[15px] font-semibold">{titulo}</h2><button onClick={fechar} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised" aria-label="Fechar"><X size={16} /></button></header>
        <div className="overflow-y-auto p-4">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

function NovaReuniao({ clienteId, fechar, aoSalvar }: { clienteId: string; fechar: () => void; aoSalvar: () => void }) {
  const d = useDados();
  const [pdfs, setPdfs] = useState<File[]>([]);
  const nomeCli = d.cliente(clienteId)?.nome ?? "";
  const carol = d.membros.find((m) => /^carol/i.test(m.nome))?.id ?? d.eu ?? "";
  const [data, setData] = useState(hoje());
  const [link, setLink] = useState("");
  const [transcricao, setTranscricao] = useState("");
  const [titulo, setTitulo] = useState(`Resumo da reunião — ${nomeCli}`);
  const [resumo, setResumo] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [ocupado, setOcupado] = useState("");
  const [salva, setSalva] = useState<string | null>(null);

  async function gerar() {
    setOcupado("ia");
    try {
      const j = await chamarFuncao<{ titulo: string; resumo: string; itens: Item[] }>("reuniao-ia", { cliente_id: clienteId, transcricao, data });
      setTitulo(j.titulo);
      setResumo(j.resumo);
      setItens(j.itens.map((i) => ({ ...i, criar: true, responsavel_id: i.lado === "cliente" ? carol : "" })));
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setOcupado("");
    }
  }
  const muda = (k: number, c: Partial<Item>) => setItens((xs) => xs.map((x, i) => (i === k ? { ...x, ...c } : x)));

  async function salvar() {
    if (!supabase || resumo === null) return;
    setOcupado("salvar");
    try {
      const { data: reu, error } = await supabase.from("reunioes").insert({ cliente_id: clienteId, data, titulo, link_transcricao: link.trim() || null, transcricao: transcricao.trim() || null, resumo, itens: itens.map(({ criar: _c, ...i }) => i) }).select("id").single();
      if (error) throw new Error(error.message);
      const id = (reu as { id: string }).id;
      if (pdfs.length) await enviarAnexos(pdfs, { cliente_id: clienteId, reuniao_id: id });
      let criadas = 0;
      for (const i of itens.filter((x) => x.criar && x.texto.trim())) {
        const semDono = i.lado === "vertente" && !i.responsavel_id;
        await repo.salvarTarefa(null, {
          cliente_id: clienteId,
          titulo: i.texto.trim(),
          pilar: "cs",
          prioridade: "normal",
          prazo: i.prazo,
          responsavel_id: i.responsavel_id || null,
          lado: i.lado,
          contato_cliente: i.lado === "cliente" ? i.quem || null : null,
          status: i.lado === "cliente" ? "aguardando" : "a_fazer",
          aguardando_motivo: i.lado === "cliente" ? "resposta" : null,
          reuniao_id: id,
          triagem: semDono,
        });
        criadas++;
      }
      await d.recarregar();
      aoSalvar();
      setSalva(id);
      d.avisar(`Reunião salva${criadas ? ` e ${criadas} ${criadas === 1 ? "item criado" : "itens criados"}` : ""}`);
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setOcupado("");
    }
  }

  return (
    <Janela titulo={`Nova reunião · ${nomeCli}`} fechar={fechar} largura={900}>
      {salva ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Check size={28} className="text-ok" />
          <p className="text-[14px]">Reunião salva. Os itens da Vertente sem responsável foram para a Caixa de entrada.</p>
          <div className="flex gap-2">
            <Botao variante="primario" onClick={async () => { navigator.clipboard?.writeText(resumo ?? ""); if (supabase) await supabase.from("reunioes").update({ enviado_em: new Date().toISOString() }).eq("id", salva); aoSalvar(); d.avisar("Resumo copiado e marcado como enviado"); fechar(); }}><Copy size={13} /> Copiar para o WhatsApp e marcar enviado</Botao>
            <Botao onClick={fechar}>Fechar</Botao>
          </div>
        </div>
      ) : resumo === null ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
            <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} />
            <Entrada value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link da transcrição no Google Docs (opcional)" />
          </div>
          <textarea value={transcricao} onChange={(e) => setTranscricao(e.target.value)} rows={14} placeholder="Cole aqui a transcrição completa do Tactiq…" className={`${campo} !text-[12.5px]`} />
          <PdfsPendentes arquivos={pdfs} mudar={setPdfs} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button onClick={() => { setResumo(`📌 *RESUMO DA REUNIÃO — ${nomeCli.toUpperCase()} | ${data.split("-").reverse().slice(0, 2).join("/")}*\n\n`); setItens([]); }} className="text-[12.5px] text-muted hover:text-fg">Escrever o resumo eu mesmo</button>
            <Botao variante="primario" onClick={gerar} disabled={ocupado === "ia" || transcricao.trim().length < 200}>{ocupado === "ia" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {ocupado === "ia" ? "Gerando o resumo…" : "Gerar resumo com IA"}</Botao>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <textarea value={resumo} onChange={(e) => setResumo(e.target.value)} rows={22} className={`${campo} !text-[12.5px] leading-relaxed`} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between"><b className="text-[13px]">Itens de ação</b><button onClick={() => setItens((xs) => [...xs, { lado: "vertente", quem: "", texto: "", prazo: null, criar: true, responsavel_id: "" }])} className="text-[12.5px] text-accent">+ item</button></div>
            <p className="text-[11.5px] text-muted">Marcados viram demanda ligada a esta reunião. Os do cliente entram como "aguardando", com quem da Vertente cobra.</p>
            {itens.map((i, k) => (
              <div key={k} className={`flex flex-col gap-1.5 rounded-xl border p-2 ${i.criar ? "border-line" : "border-dashed border-line opacity-60"}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={!!i.criar} onChange={(e) => muda(k, { criar: e.target.checked })} className="accent-[rgb(var(--accent-c))]" />
                  <button onClick={() => muda(k, { lado: i.lado === "vertente" ? "cliente" : "vertente", responsavel_id: i.lado === "vertente" ? carol : "" })} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${i.lado === "vertente" ? "bg-[#2747d6]" : "bg-[#1aa361]"}`}>{i.lado === "vertente" ? "Vertente" : "Cliente"}</button>
                  <input value={i.texto} onChange={(e) => muda(k, { texto: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {i.lado === "cliente" ? <input value={i.quem} onChange={(e) => muda(k, { quem: e.target.value })} placeholder="Quem do cliente" className={`${campo} !py-1 !text-[12px]`} /> : <span />}
                  <Selecao value={i.responsavel_id ?? ""} onChange={(e) => muda(k, { responsavel_id: e.target.value })} className="!py-1 !text-[12px]">
                    <option value="">{i.lado === "cliente" ? "Quem cobra…" : "Sem responsável (triagem)"}</option>
                    {d.membros.map((m) => <option key={m.id} value={m.id}>{i.lado === "cliente" ? `Cobra: ${m.nome}` : m.nome}</option>)}
                  </Selecao>
                  <Entrada type="date" value={i.prazo ?? ""} onChange={(e) => muda(k, { prazo: e.target.value || null })} className="!py-1 !text-[12px]" />
                </div>
              </div>
            ))}
            <div className="mt-2 flex justify-end gap-2 border-t border-line pt-3">
              <Botao onClick={() => setResumo(null)}>Voltar</Botao>
              <Botao variante="primario" onClick={salvar} disabled={ocupado === "salvar" || !resumo.trim()}>{ocupado === "salvar" ? "Salvando…" : `Salvar reunião e criar ${itens.filter((x) => x.criar).length} itens`}</Botao>
            </div>
          </div>
        </div>
      )}
    </Janela>
  );
}
