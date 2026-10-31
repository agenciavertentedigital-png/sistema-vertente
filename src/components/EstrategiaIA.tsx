import { useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { CAMPOS_BRIEFING } from "../lib/briefing";
import { extrairJson, iaDisponivel, perguntarIA } from "../lib/ia";

/** Campos que a IA escreve na parte "Estratégia da Vertente" do briefing. */
export const CAMPOS_ESTRATEGIA = ["estrategia_atual", "funil_campanhas", "proximos_testes", "pontos_atencao"] as const;
type Estrategia = Record<(typeof CAMPOS_ESTRATEGIA)[number], string>;

const rotulo = (k: string) => CAMPOS_BRIEFING.find((c) => c.chave === k)?.rotulo ?? k;

function montarPedido(cliente: string, clienteId: string, briefing: string) {
  return `Você é o estrategista sênior da Vertente Digital (agência de tráfego pago para negócios locais e digitais).
Crie a ESTRATÉGIA VERTENTE do cliente "${cliente}" (cliente_id ${clienteId}).

Antes de escrever, consulte no banco: os registros e otimizações dos últimos 60 dias deste cliente, o desempenho de tráfego dos últimos 30 dias (se houver conta de anúncio) e as anotações do time sobre ele.

Briefing atual:
${briefing}

Pense no funil de vendas completo (atração → consideração → conversão → pós-venda/recompra), em ofertas, ângulos de criativo, públicos e na verba informada. Seja específico para este negócio e para a cidade/região dele, nada genérico. Escreva em português do Brasil, em tópicos curtos com "- ".

Responda SOMENTE com um JSON válido, sem texto antes ou depois, com estas chaves (texto puro em cada uma):
{
  "estrategia_atual": "posicionamento, oferta principal, canais e lógica da estratégia",
  "funil_campanhas": "campanhas por etapa do funil: objetivo, público, criativo e % da verba",
  "proximos_testes": "3 a 5 testes priorizados com hipótese e como medir",
  "pontos_atencao": "riscos, dependências do cliente e o que acompanhar"
}`;
}

const DEMO: Estrategia = {
  estrategia_atual: "- Posicionar como a opção de confiança da região, com prova social forte\n- Oferta de entrada clara (avaliação/diagnóstico) para gerar conversa no WhatsApp\n- Meta Ads como canal principal; Google Meu Negócio para quem já busca",
  funil_campanhas: "- Topo (20%): vídeos curtos de bastidores e depoimentos, público amplo na cidade\n- Meio (30%): remarketing de quem engajou com carrossel de dúvidas e objeções\n- Fundo (50%): mensagens para o WhatsApp com a oferta de entrada",
  proximos_testes: "- Testar oferta com prazo vs. sem prazo (custo por conversa)\n- Criativo com o dono falando vs. cliente falando\n- Público aberto vs. interesses",
  pontos_atencao: "- Tempo de resposta no WhatsApp (pedir para responder em até 5 min)\n- Enviar fotos e vídeos novos todo mês\n- Acompanhar a taxa de agendamento por conversa",
};

/** Botão + prévia: gera a estratégia com IA e deixa o time aplicar no briefing. O painel vai onde a tela quiser. */
export function useEstrategiaIA({ cliente, clienteId, briefingTexto, aplicar }: { cliente: string; clienteId: string; briefingTexto: string; aplicar: (campos: Partial<Estrategia>) => Promise<void> }) {
  const [estado, setEstado] = useState<"parado" | "gerando" | "pronto">("parado");
  const [res, setRes] = useState<Estrategia | null>(null);
  const [erro, setErro] = useState("");
  const [aplicados, setAplicados] = useState<string[]>([]);

  async function gerar() {
    setEstado("gerando");
    setErro("");
    setAplicados([]);
    try {
      const r = iaDisponivel() ? extrairJson<Estrategia>(await perguntarIA(montarPedido(cliente, clienteId, briefingTexto), "briefing")) : (await new Promise((ok) => setTimeout(ok, 900)), DEMO);
      const limpo = Object.fromEntries(CAMPOS_ESTRATEGIA.map((k) => [k, String(r[k] ?? "").trim()])) as Estrategia;
      if (!CAMPOS_ESTRATEGIA.some((k) => limpo[k])) throw new Error("A IA devolveu a estratégia vazia. Complete mais o briefing e tente de novo.");
      setRes(limpo);
      setEstado("pronto");
    } catch (e) {
      setErro((e as Error).message);
      setEstado("parado");
    }
  }

  async function usar(chaves: string[]) {
    if (!res) return;
    await aplicar(Object.fromEntries(chaves.map((k) => [k, res[k as keyof Estrategia]])));
    setAplicados((a) => [...new Set([...a, ...chaves])]);
  }

  const botao = (
    <>
      <button onClick={gerar} disabled={estado === "gerando"} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-fg px-3 text-[13px] font-medium text-bg hover:opacity-90 disabled:opacity-60">
        {estado === "gerando" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {estado === "gerando" ? "Criando estratégia…" : "Criar Estratégia Vertente"}
      </button>
    </>
  );
  const painel = (
    <>
      {erro && <p className="rounded-lg bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{erro}</p>}
      {estado === "pronto" && res && (
        <div className="anim-entrar rounded-2xl border border-accent/30 bg-accent-soft/50 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Sparkles size={15} className="text-accent" />
            <b className="text-[14px]">Estratégia sugerida pela IA</b>
            <span className="text-[12px] text-muted">Revise antes de aplicar. Nada muda no briefing até você clicar.</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => usar([...CAMPOS_ESTRATEGIA])} className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg hover:opacity-90">Aplicar tudo</button>
              <button onClick={() => setEstado("parado")} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised" aria-label="Fechar"><X size={15} /></button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {CAMPOS_ESTRATEGIA.map((k) => (
              <div key={k} className="flex flex-col gap-1.5 rounded-xl bg-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-semibold">{rotulo(k)}</span>
                  <button onClick={() => usar([k])} disabled={!res[k] || aplicados.includes(k)} className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline disabled:text-ok disabled:no-underline">
                    {aplicados.includes(k) ? <><Check size={12} /> Aplicado</> : "Aplicar"}
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-snug">{res[k] || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
  return { botao, painel };
}
