import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Check, Copy, FileText, Loader2, Pencil, Rocket, Sparkles, Trophy } from "lucide-react";
import { useDados } from "../../../lib/dados";
import { supabase } from "../../../lib/supabase";
import { chamarFuncao } from "../../../lib/tabela";

interface Analise { id: string; inicio: string | null; fim: string | null; texto: string; criado_em: string }
interface Conquista { id: string; data: string; nota: string | null }

const ETAPAS = ["Lendo campanhas e resultados do período…", "Comparando campanha a campanha com o período anterior…", "Lendo conjuntos: públicos, orçamentos e segmentação…", "Buscando idade, gênero, posicionamentos e horários na Meta…", "Cruzando mudanças recentes e o funil do cliente…", "Avaliando criativos e sinais de fadiga…", "Montando escala, redução de custos e plano de ação…", "Escrevendo a Análise de Campanhas…"];
const br = (x: string | null) => (x ? `${x.slice(8, 10)}/${x.slice(5, 7)}` : "");

const EXEMPLO: Analise = {
  id: "ex", inicio: null, fim: null, criado_em: new Date().toISOString(),
  texto: "O período foi de **crescimento consistente**: os contatos subiram 32% em relação ao período anterior, com o custo por contato caindo de R$ 7,80 para R$ 5,90.\n\nA campanha de mensagens para o WhatsApp segue como o principal motor de resultados, e os vídeos com depoimentos de clientes foram os criativos que mais geraram conversas.\n\n### Destaques do período\n- 412 contatos no período (+32%)\n- Custo por contato 24% menor\n- Melhor criativo: vídeo de depoimento, com 118 conversas\n- Primeira venda vinda do Google na nova campanha de pesquisa",
};

/** Estado do Gestor Otimizador: roda a IA e guarda a Análise de Campanhas do período. */
export function useGestorOtimizador(clienteId: string, ini: string, fim: string, montarResumo: () => Record<string, unknown>) {
  const d = useDados();
  const [lista, setLista] = useState<Analise[]>(supabase ? [] : [EXEMPLO]);
  const [rodando, setRodando] = useState(false);
  const [passo, setPasso] = useState(0);
  const [conquistas, setConquistas] = useState<Conquista[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("analises_ia").select("id, inicio, fim, texto, criado_em").eq("cliente_id", clienteId).eq("tipo", "campanhas").order("criado_em", { ascending: false }).limit(12)
      .then(({ data }) => setLista((data ?? []) as Analise[]));
  }, [clienteId]);

  useEffect(() => {
    if (!supabase) return setConquistas([{ id: "c1", data: fim, nota: "Cliente fechou 3 vendas vindas do WhatsApp na mesma semana" }, { id: "c2", data: ini, nota: "Recorde de conversas em um único dia" }]);
    supabase.from("registros").select("id, data, nota").eq("cliente_id", clienteId).eq("tipo", "conquista").gte("data", ini).lte("data", fim).order("data", { ascending: false }).limit(12)
      .then(({ data }) => setConquistas(((data ?? []) as Conquista[]).filter((c) => c.nota?.trim())));
  }, [clienteId, ini, fim]);

  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setPasso((p) => Math.min(p + 1, ETAPAS.length - 1)), 12000);
    return () => clearInterval(t);
  }, [rodando]);

  // A do período escolhido; se não houver, a mais recente
  const doPeriodo = lista.find((a) => a.inicio === ini && a.fim === fim);
  const atual = doPeriodo ?? lista[0] ?? null;

  async function rodar() {
    if (!supabase) return d.avisar("O Gestor Otimizador roda só no sistema conectado (fora da prévia).");
    if (rodando) return;
    setRodando(true);
    setPasso(0);
    try {
      const r = await chamarFuncao<{ titulo: string; analise: Analise | null }>("gestor-otimizador", { cliente_id: clienteId, inicio: ini, fim, resumo: montarResumo() });
      if (r.analise) setLista((xs) => [r.analise!, ...xs]);
      d.avisar(`Pronto: “${r.titulo}” salva em Documentos › Anotações › Estratégia, e a Análise de Campanhas está no fim do dashboard.`);
      setTimeout(() => document.getElementById("analise-campanhas")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setRodando(false);
    }
  }

  async function salvarTexto(id: string, texto: string) {
    setLista((xs) => xs.map((a) => (a.id === id ? { ...a, texto } : a)));
    if (!supabase || id === "ex") return;
    const { error } = await supabase.from("analises_ia").update({ texto }).eq("id", id);
    d.avisar(error ? `Não salvou: ${error.message}` : "Análise atualizada");
  }

  return { rodar, rodando, passo, atual, doPeriodo: !!doPeriodo, conquistas, salvarTexto, ini, fim };
}
export type GestorOtimizador = ReturnType<typeof useGestorOtimizador>;

/** Botão do cabeçalho do dashboard. */
export function BotaoGestorOtimizador({ g }: { g: GestorOtimizador }) {
  return (
    <button onClick={g.rodar} disabled={g.rodando} title="A IA analisa campanhas, públicos e criativos do período, salva a estratégia nas anotações do cliente e escreve a Análise de Campanhas"
      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[linear-gradient(120deg,#0e1a52,#2747d6)] px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-70">
      {g.rodando ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
      {g.rodando ? "Otimizando…" : "Gestor Otimizador"}
    </button>
  );
}

/** Faixa de progresso enquanto a IA trabalha. */
export function ProgressoOtimizador({ g }: { g: GestorOtimizador }) {
  if (!g.rodando) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-[13px] text-accent">
      <Loader2 size={16} className="animate-spin" />
      <span className="min-w-0 flex-1"><b>Gestor Otimizador trabalhando</b> · {ETAPAS[g.passo]}</span>
      <span className="text-[12px] opacity-80">até 1 a 2 min</span>
    </div>
  );
}

/** Bloco final do dashboard: Análise de Campanhas (tom positivo) + pequenas conquistas do período. */
export function AnaliseCampanhas({ g }: { g: GestorOtimizador }) {
  const d = useDados();
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const a = g.atual;
  const html = useMemo(() => (a ? DOMPurify.sanitize(marked.parse(a.texto, { async: false, breaks: true }) as string) : ""), [a]);

  return (
    <section id="analise-campanhas" className="scroll-mt-4 overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-[linear-gradient(120deg,rgba(14,26,82,0.06),rgba(39,71,214,0.10))] px-5 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#0e1a52] text-white"><Sparkles size={19} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold">Análise de Campanhas</h2>
          <p className="text-[12.5px] text-muted">
            {a ? (a.inicio ? `Período ${br(a.inicio)} a ${br(a.fim)} · escrita em ${new Date(a.criado_em).toLocaleDateString("pt-BR")}` : "Exemplo") : "Clique em Gestor Otimizador para gerar a análise do período."}
            {a && !g.doPeriodo && a.inicio && <span className="text-warn"> · é de outro período; rode de novo para este</span>}
          </p>
        </div>
        {a && !editando && (
          <div className="flex gap-1">
            <button onClick={() => { setRascunho(a.texto); setEditando(true); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-muted hover:bg-raised hover:text-fg"><Pencil size={13} /> Editar</button>
            <button onClick={() => { navigator.clipboard?.writeText(a.texto); d.avisar("Análise copiada"); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-muted hover:bg-raised hover:text-fg"><Copy size={13} /> Copiar</button>
          </div>
        )}
        {!a && <BotaoGestorOtimizador g={g} />}
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {!a ? (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-6 text-[13px] text-muted">
              <FileText size={18} /> Ainda sem análise. O Gestor Otimizador lê campanhas, públicos e criativos do período, guarda a estratégia completa nas anotações do cliente (pasta Estratégia) e escreve aqui um resumo positivo dos resultados.
            </div>
          ) : editando ? (
            <div className="flex flex-col gap-2">
              <textarea value={rascunho} onChange={(e) => setRascunho(e.target.value)} rows={Math.min(24, Math.max(8, rascunho.split("\n").length + 2))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-accent" />
              <div className="flex gap-2">
                <button onClick={async () => { await g.salvarTexto(a.id, rascunho.trim()); setEditando(false); }} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-[13px] font-semibold text-accent-fg"><Check size={14} /> Salvar</button>
                <button onClick={() => setEditando(false)} className="h-9 rounded-xl px-3 text-[13px] text-muted hover:bg-raised">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="md text-[14px] leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>

        <aside className="flex flex-col gap-2 rounded-2xl bg-ok-soft p-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ok"><Trophy size={15} /> Pequenas conquistas</div>
          {g.conquistas.length === 0 ? (
            <p className="text-[12.5px] text-muted">Nenhuma registrada neste período. Registre em Acompanhamento › Pequena conquista e ela entra aqui e na próxima análise.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {g.conquistas.map((c) => (
                <li key={c.id} className="rounded-xl bg-surface px-3 py-2 text-[12.5px] leading-snug shadow-sm">
                  <span className="mr-1 font-semibold text-ok">{br(c.data)}</span>{c.nota}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
