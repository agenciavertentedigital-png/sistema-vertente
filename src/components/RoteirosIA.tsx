import { useState } from "react";
import { BookmarkPlus, Check, ClipboardCopy, Clapperboard, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useDados } from "../lib/dados";
import { briefingEmTexto, useBriefings, useNotas } from "../lib/briefing";
import { extrairJson, iaDisponivel, perguntarIA } from "../lib/ia";

const OBJETIVOS = ["Gerar conversas no WhatsApp", "Vender um produto/serviço", "Autoridade e confiança", "Engajamento e alcance", "Remarketing (quem já conhece)"];
const FORMATOS = ["Reels/TikTok (30 a 45s)", "Anúncio em vídeo (15 a 30s)", "Sequência de stories", "Carrossel", "Vídeo depoimento"];
const ANGULOS = ["Dor", "Desejo", "Prova social", "Bastidores", "Quebra de objeção", "Comparação", "Educativo", "Oferta direta", "História do dono"];
const GATILHOS = ["Escassez", "Urgência", "Prova social", "Autoridade", "Reciprocidade", "Novidade", "Curiosidade", "Garantia"];

interface Roteiro {
  titulo: string;
  angulo: string;
  formato: string;
  gancho: string;
  roteiro: string;
  cta: string;
  legenda?: string;
}

const emTexto = (r: Roteiro) =>
  `${r.titulo}\nFormato: ${r.formato} · Ângulo: ${r.angulo}\n\nGancho (3s): ${r.gancho}\n\nRoteiro:\n${r.roteiro}\n\nCTA: ${r.cta}${r.legenda ? `\n\nLegenda:\n${r.legenda}` : ""}`;

function Chips({ opcoes, valor, mudar, multi }: { opcoes: string[]; valor: string[]; mudar: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const sel = valor.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={sel}
            onClick={() => mudar(multi ? (sel ? valor.filter((x) => x !== o) : [...valor, o]) : [o])}
            className={`rounded-full border px-2.5 py-1 text-[12.5px] ${sel ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted hover:border-line-forte hover:text-fg"}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Gerador de roteiros de conteúdo com IA, usando o briefing do cliente. Os bons ficam salvos nas anotações. */
export function RoteirosIA({ clienteId }: { clienteId: string }) {
  const d = useDados();
  const briefings = useBriefings();
  const notas = useNotas();
  const cliente = d.cliente(clienteId);
  const [objetivo, setObjetivo] = useState([OBJETIVOS[0]]);
  const [formato, setFormato] = useState([FORMATOS[0]]);
  const [angulos, setAngulos] = useState<string[]>(["Dor", "Prova social", "Bastidores"]);
  const [gatilhos, setGatilhos] = useState<string[]>(["Prova social"]);
  const [extra, setExtra] = useState("");
  const [qtd, setQtd] = useState(3);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<Roteiro[]>([]);
  const [salvos, setSalvos] = useState<number[]>([]);

  const salvosAntes = notas.linhas.filter((n) => n.cliente_id === clienteId && n.titulo?.startsWith("Roteiro:"));

  async function gerar() {
    setGerando(true);
    setErro("");
    setSalvos([]);
    const b = briefings.linhas.find((x) => x.cliente_id === clienteId);
    const pedido = `Você é o roteirista de conteúdo e anúncios da Vertente Digital. Crie ${qtd} roteiros diferentes para "${cliente?.nome}".

Briefing do cliente:
${b ? briefingEmTexto(cliente?.nome ?? "", b) : "(briefing ainda vazio: use o que souber do cliente no banco, como anotações e registros)"}

Objetivo: ${objetivo[0]}
Formato: ${formato[0]}
Ângulos (use um diferente em cada roteiro): ${angulos.join(", ") || "livre"}
Gatilhos mentais para usar: ${gatilhos.join(", ") || "livre"}
${extra.trim() ? `Pedido do time: ${extra.trim()}` : ""}

Regras: linguagem do público do cliente, nada genérico, gancho forte nos 3 primeiros segundos, cenas com o que aparece e o que é falado, CTA claro. Português do Brasil.
Responda SOMENTE com um JSON válido: um array de objetos com as chaves "titulo", "angulo", "formato", "gancho", "roteiro" (cenas numeradas, uma por linha), "cta" e "legenda".`;
    try {
      const r = iaDisponivel()
        ? extrairJson<Roteiro[]>(await perguntarIA(pedido, "roteiros"))
        : (await new Promise((ok) => setTimeout(ok, 900)),
          Array.from({ length: qtd }, (_, i) => ({
            titulo: ["O erro que quase todo mundo comete", "Um dia aqui por dentro", "O que nossos clientes dizem"][i % 3],
            angulo: angulos[i % Math.max(1, angulos.length)] ?? "Dor",
            formato: formato[0],
            gancho: ["Você está perdendo clientes por causa disso…", "Ninguém mostra essa parte…", "Ela chegou desconfiada. Olha como saiu:"][i % 3],
            roteiro: "1. Close no rosto, falando direto para a câmera\n2. Corte para o problema acontecendo\n3. Mostra a solução na prática\n4. Resultado e depoimento rápido",
            cta: "Chama no WhatsApp e agenda a sua avaliação",
            legenda: "Salva esse vídeo e manda para quem precisa ver 👇",
          })));
      if (!Array.isArray(r) || !r.length) throw new Error("A IA não devolveu roteiros. Tente de novo.");
      setLista(r);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  async function salvar(i: number) {
    const r = lista[i];
    try {
      await notas.salvar(null, { cliente_id: clienteId, titulo: `Roteiro: ${r.titulo}`, texto: emTexto(r), etiqueta: "ideia", fixada: false, autor_id: d.eu, atualizado_em: new Date().toISOString() });
      setSalvos((s) => [...s, i]);
      d.avisar("Roteiro salvo nas anotações do cliente");
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  const copiar = (t: string) => navigator.clipboard?.writeText(t).then(() => d.avisar("Copiado"), () => d.avisar("Não consegui copiar"));

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <Clapperboard size={16} className="text-accent" />
          <h2 className="text-[15px] font-semibold">Roteiros de conteúdo</h2>
          <span className="text-[12px] text-muted">A IA usa o briefing do cliente</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-1.5"><span className="text-[12.5px] font-medium">Objetivo</span><Chips opcoes={OBJETIVOS} valor={objetivo} mudar={setObjetivo} /></div>
          <div className="flex flex-col gap-1.5"><span className="text-[12.5px] font-medium">Formato</span><Chips opcoes={FORMATOS} valor={formato} mudar={setFormato} /></div>
          <div className="flex flex-col gap-1.5"><span className="text-[12.5px] font-medium">Ângulos</span><Chips opcoes={ANGULOS} valor={angulos} mudar={setAngulos} multi /></div>
          <div className="flex flex-col gap-1.5"><span className="text-[12.5px] font-medium">Gatilhos</span><Chips opcoes={GATILHOS} valor={gatilhos} mudar={setGatilhos} multi /></div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[12.5px] font-medium">Algo a mais? (opcional)</span>
            <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ex.: promoção de Black Friday, foco no produto X, gravar só com celular" className="h-9 rounded-lg border border-line bg-bg px-3 text-[13px] outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] font-medium">Quantos</span>
            <select value={qtd} onChange={(e) => setQtd(Number(e.target.value))} className="h-9 rounded-lg border border-line bg-bg px-2 text-[13px]">
              {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <button onClick={gerar} disabled={gerando} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-fg hover:opacity-90 disabled:opacity-60">
            {gerando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {gerando ? "Escrevendo…" : "Gerar roteiros"}
          </button>
        </div>
        {erro && <p className="text-[12.5px] text-bad">{erro}</p>}
      </section>

      {gerando && <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: qtd }, (_, i) => <div key={i} className="esqueleto h-56 rounded-2xl" />)}</div>}

      {!gerando && lista.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {lista.map((r, i) => (
            <article key={i} className="anim-entrar flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap gap-1.5 text-[11.5px]">
                <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">{r.angulo}</span>
                <span className="rounded-full bg-raised px-2 py-0.5 text-muted">{r.formato}</span>
              </div>
              <h3 className="text-[15px] font-semibold leading-snug">{r.titulo}</h3>
              <p className="rounded-lg bg-raised px-3 py-2 text-[13px]"><span className="text-[12px] font-semibold text-muted">Gancho: </span>{r.gancho}</p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{r.roteiro}</p>
              <p className="text-[13px]"><span className="text-[12px] font-semibold text-muted">CTA: </span>{r.cta}</p>
              {r.legenda && <p className="whitespace-pre-wrap border-t border-line pt-2 text-[12.5px] text-muted">{r.legenda}</p>}
              <div className="mt-auto flex gap-2 pt-1">
                <button onClick={() => salvar(i)} disabled={salvos.includes(i)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12.5px] hover:border-accent hover:text-accent disabled:border-ok disabled:text-ok">
                  {salvos.includes(i) ? <><Check size={13} /> Salvo</> : <><BookmarkPlus size={13} /> Salvar</>}
                </button>
                <button onClick={() => copiar(emTexto(r))} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12.5px] hover:border-line-forte"><ClipboardCopy size={13} /> Copiar</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {salvosAntes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-muted">Roteiros salvos ({salvosAntes.length})</h3>
          {salvosAntes.map((n) => (
            <details key={n.id} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
              <summary className="flex cursor-pointer items-center gap-2 font-medium">
                <span className="flex-1 truncate">{n.titulo?.replace(/^Roteiro:\s*/, "")}</span>
                <span className="text-[12px] font-normal text-muted">{new Date(n.criado_em).toLocaleDateString("pt-BR")}</span>
              </summary>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{n.texto}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => copiar(n.texto)} className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"><ClipboardCopy size={12} /> Copiar</button>
                <button onClick={() => notas.excluir(n.id)} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-bad"><Trash2 size={12} /> Excluir</button>
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
