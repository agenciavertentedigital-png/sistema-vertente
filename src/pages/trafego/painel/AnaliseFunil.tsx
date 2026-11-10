import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { BrainCircuit, ChevronDown, Copy, Loader2, Sparkles } from "lucide-react";
import { useDados } from "../../../lib/dados";
import { supabase } from "../../../lib/supabase";
import { chamarFuncao } from "../../../lib/tabela";

interface Analise { id: string; inicio: string | null; fim: string | null; texto: string; criado_em: string }

const ETAPAS_ESPERA = ["Lendo o funil e as taxas…", "Comparando com o período anterior…", "Buscando idade, gênero e posicionamentos na Meta…", "Olhando campanhas e criativos…", "Montando o plano de ação…"];

/** Botão "Analisar funil do cliente": a IA lê o dashboard + recortes da Meta e devolve diagnóstico e plano de ação. */
export function AnaliseFunil({ clienteId, ini, fim, montarResumo }: { clienteId: string; ini: string; fim: string; montarResumo: () => Record<string, unknown> }) {
  const d = useDados();
  const [lista, setLista] = useState<Analise[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);
  const [passo, setPasso] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("analises_ia").select("id, inicio, fim, texto, criado_em").eq("cliente_id", clienteId).eq("tipo", "funil").order("criado_em", { ascending: false }).limit(6).then(({ data }) => {
      setLista((data ?? []) as Analise[]);
      if (data?.[0]) setAberta(data[0].id);
    });
  }, [clienteId]);

  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setPasso((p) => Math.min(p + 1, ETAPAS_ESPERA.length - 1)), 6000);
    return () => clearInterval(t);
  }, [rodando]);

  async function analisar() {
    if (!supabase) return d.avisar("A análise com IA funciona só no sistema conectado (fora da prévia).");
    setRodando(true);
    setPasso(0);
    try {
      const r = await chamarFuncao<{ id: string; criado_em: string; texto: string }>("analisar-funil", { cliente_id: clienteId, inicio: ini, fim, resumo: montarResumo() });
      const nova = { id: r.id ?? String(Date.now()), inicio: ini, fim, texto: r.texto, criado_em: r.criado_em };
      setLista((xs) => [nova, ...xs]);
      setAberta(nova.id);
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setRodando(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent-soft via-surface to-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-fg"><BrainCircuit size={22} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold">Análise do funil com IA</h2>
          <p className="text-[12.5px] text-muted">Lê o funil, as taxas e o comparativo, as campanhas, os criativos e o Google, busca idade, gênero, posicionamentos e dispositivos na Meta e devolve onde o funil quebra e o plano da semana.</p>
        </div>
        <button onClick={analisar} disabled={rodando} className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-semibold text-accent-fg shadow-sm transition hover:brightness-110 disabled:opacity-60">
          {rodando ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />} {rodando ? "Analisando…" : "ANALISAR FUNIL DO CLIENTE"}
        </button>
      </div>
      {rodando && <p className="text-[12.5px] text-accent">{ETAPAS_ESPERA[passo]} Pode levar até um minuto.</p>}
      {lista.length > 0 && (
        <div className="flex flex-col gap-2">
          {lista.map((a) => (
            <ItemAnalise key={a.id} a={a} aberta={aberta === a.id} alternar={() => setAberta(aberta === a.id ? null : a.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function ItemAnalise({ a, aberta, alternar }: { a: Analise; aberta: boolean; alternar: () => void }) {
  const d = useDados();
  const html = useMemo(() => (aberta ? DOMPurify.sanitize(marked.parse(a.texto, { async: false, breaks: true }) as string) : ""), [a.texto, aberta]);
  const br = (x: string | null) => (x ? `${x.slice(8, 10)}/${x.slice(5, 7)}` : "");
  return (
    <div className="rounded-xl border border-line bg-surface">
      <button onClick={alternar} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]">
        <Sparkles size={13} className="text-accent" />
        <b>Análise de {new Date(a.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</b>
        <span className="text-muted">período {br(a.inicio)} a {br(a.fim)}</span>
        <ChevronDown size={14} className={`ml-auto text-muted transition-transform ${aberta ? "rotate-180" : ""}`} />
      </button>
      {aberta && (
        <div className="border-t border-line px-4 py-3">
          <div className="md text-[13.5px] leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
          <button onClick={() => { navigator.clipboard?.writeText(a.texto); d.avisar("Análise copiada"); }} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-fg"><Copy size={13} /> Copiar</button>
        </div>
      )}
    </div>
  );
}
