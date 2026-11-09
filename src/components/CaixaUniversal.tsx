import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { repo } from "../lib/repo";
import { useDados } from "../lib/dados";
import { useNotas, type Nota } from "../lib/briefing";
import { extrairJson, iaDisponivel, perguntarIA } from "../lib/ia";
import { hoje, somarDias } from "../lib/tipos";
import { Botao, campo } from "./ui";

type TipoItem = "demanda" | "cliente_deve" | "anotacao" | "retorno" | "combinado" | "conquista" | "otimizacao";
const TIPOS: Record<TipoItem, { nome: string; cor: string; dica: string }> = {
  demanda: { nome: "Demanda", cor: "#2747d6", dica: "algo que a Vertente precisa fazer" },
  cliente_deve: { nome: "Cliente deve", cor: "#1aa361", dica: "material, resposta ou aprovação que o cliente precisa mandar" },
  anotacao: { nome: "Anotação", cor: "#64748b", dica: "informação para lembrar, sem ação" },
  retorno: { nome: "Retorno do cliente", cor: "#0891b2", dica: "feedback do cliente (vendas, leads, opinião)" },
  combinado: { nome: "Combinado", cor: "#b45309", dica: "acordo que vale daqui para frente" },
  conquista: { nome: "Conquista", cor: "#db2777", dica: "resultado bom para comunicar ao cliente" },
  otimizacao: { nome: "Otimização", cor: "#7c3aed", dica: "ajuste feito em campanha, com motivo" },
};

interface Item { tipo: TipoItem; cliente_id: string; titulo: string; texto: string; contato?: string; usar: boolean }

/**
 * Caixa de entrada universal: cola qualquer texto (áudio transcrito, mensagem, ideia solta) e a IA separa em itens,
 * sugere o cliente, o tipo e um texto mais claro. Nunca inventa responsável, prazo ou combinado: quem decide é a triagem.
 */
export function CaixaUniversal({ clienteInicial, fechar }: { clienteInicial: string; fechar: () => void }) {
  const d = useDados();
  const notas = useNotas();
  const [bruto, setBruto] = useState("");
  const [itens, setItens] = useState<Item[] | null>(null);
  const [ocupado, setOcupado] = useState<"" | "ia" | "salvar">("");
  const clientes = d.clientes;

  async function organizar() {
    if (!bruto.trim()) return;
    if (!iaDisponivel()) {
      setItens([{ tipo: "demanda", cliente_id: clienteInicial, titulo: bruto.trim().split("\n")[0].slice(0, 120), texto: bruto.trim(), usar: true }]);
      return;
    }
    setOcupado("ia");
    try {
      const lista = clientes.map((c) => c.nome).join(" | ");
      const pedido = `Você organiza a caixa de entrada da Vertente Digital (agência de tráfego pago). Separe o texto abaixo em itens independentes e classifique cada um.

Tipos possíveis:
${(Object.keys(TIPOS) as TipoItem[]).map((t) => `- ${t}: ${TIPOS[t].dica}`).join("\n")}

Clientes (use o nome exatamente como está, ou "" se não der para saber): ${lista}
${clienteInicial ? `Contexto: a pessoa estava na página do cliente "${d.cliente(clienteInicial)?.nome}".` : ""}

Regras:
- Não invente responsável, prazo, valor ou combinado que não está escrito.
- "titulo": curto e claro, começando com verbo quando for ação (até 90 caracteres).
- "texto": o conteúdo reescrito de forma clara e completa, sem perder nenhuma informação do original.
- "contato": só para cliente_deve, quem do cliente (se foi dito).
- Português do Brasil.

Responda SÓ com JSON: {"itens":[{"tipo":"demanda","cliente":"","titulo":"","texto":"","contato":""}]}

Texto:
<<<
${bruto.trim().slice(0, 8000)}
>>>`;
      const r = extrairJson<{ itens: { tipo: string; cliente: string; titulo: string; texto: string; contato?: string }[] }>(await perguntarIA(pedido, "caixa-universal"));
      const achar = (nome: string) => clientes.find((c) => c.nome.toLowerCase() === (nome ?? "").toLowerCase())?.id ?? "";
      setItens(
        (r.itens ?? []).map((i) => ({
          tipo: (i.tipo in TIPOS ? i.tipo : "demanda") as TipoItem,
          cliente_id: achar(i.cliente) || clienteInicial,
          titulo: String(i.titulo ?? "").trim(),
          texto: String(i.texto ?? "").trim(),
          contato: i.contato ? String(i.contato) : undefined,
          usar: true,
        })),
      );
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setOcupado("");
    }
  }

  const muda = (k: number, c: Partial<Item>) => setItens((xs) => xs!.map((x, i) => (i === k ? { ...x, ...c } : x)));
  const precisaCliente = (t: TipoItem) => t !== "demanda" && t !== "anotacao";

  async function salvar() {
    if (!itens) return;
    const escolhidos = itens.filter((i) => i.usar && (i.titulo.trim() || i.texto.trim()));
    const semCliente = escolhidos.find((i) => precisaCliente(i.tipo) && !i.cliente_id);
    if (semCliente) return d.avisar(`Escolha o cliente de "${semCliente.titulo || semCliente.texto.slice(0, 40)}".`);
    setOcupado("salvar");
    try {
      for (const i of escolhidos) {
        const titulo = i.titulo.trim() || i.texto.trim().slice(0, 90);
        if (i.tipo === "demanda" || i.tipo === "cliente_deve") {
          await repo.salvarTarefa(null, {
            cliente_id: i.cliente_id || undefined,
            titulo,
            descricao: i.texto.trim() && i.texto.trim() !== titulo ? i.texto.trim() : null,
            pilar: "cs",
            prioridade: "normal",
            prazo: null,
            responsavel_id: null,
            lado: i.tipo === "cliente_deve" ? "cliente" : "vertente",
            contato_cliente: i.tipo === "cliente_deve" ? i.contato?.trim() || null : null,
            status: i.tipo === "cliente_deve" ? "aguardando" : "a_fazer",
            aguardando_motivo: i.tipo === "cliente_deve" ? "resposta" : null,
            triagem: true,
          });
        } else if (i.tipo === "anotacao") {
          await notas.salvar(null, { titulo: i.titulo.trim() || null, texto: i.texto.trim() || titulo, etiqueta: "geral", cliente_id: i.cliente_id || null, fixada: false, autor_id: d.eu } as Partial<Nota>);
        } else {
          await repo.registrar({
            cliente_id: i.cliente_id,
            tipo: i.tipo,
            nota: i.texto.trim() || titulo,
            dados: i.tipo === "otimizacao" ? { motivo: titulo, revisar_em: somarDias(hoje(), 7) } : {},
          });
        }
      }
      await d.recarregar();
      d.avisar(`${escolhidos.length} ${escolhidos.length === 1 ? "item salvo" : "itens salvos"}. Demandas foram para a triagem.`);
      fechar();
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setOcupado("");
    }
  }

  if (!itens)
    return (
      <div className="flex flex-col gap-3" onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && organizar()}>
        <textarea
          autoFocus
          value={bruto}
          onChange={(e) => setBruto(e.target.value)}
          rows={8}
          placeholder="Despeje aqui: uma mensagem do cliente, um áudio transcrito, várias ideias soltas… A IA separa em itens e sugere cliente e tipo."
          className={`${campo} !text-[13.5px]`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11.5px] text-muted">Nada é salvo antes de você conferir. Ctrl+Enter organiza.</span>
          <Botao variante="primario" onClick={organizar} disabled={!bruto.trim() || ocupado === "ia"}>
            {ocupado === "ia" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} {ocupado === "ia" ? "Organizando…" : "Organizar com IA"}
          </Botao>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12px] text-muted"><Sparkles size={12} className="mr-1 inline text-accent" />A IA separou {itens.length} {itens.length === 1 ? "item" : "itens"}. Confira cliente e tipo; responsável e prazo ficam para a triagem.</p>
      <div className="flex max-h-[55dvh] flex-col gap-2 overflow-y-auto">
        {itens.map((i, k) => (
          <div key={k} className={`flex flex-col gap-1.5 rounded-xl border p-2.5 ${i.usar ? "border-line" : "border-dashed border-line opacity-55"}`}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={i.usar} onChange={(e) => muda(k, { usar: e.target.checked })} className="accent-[rgb(var(--accent-c))]" />
              <input value={i.titulo} onChange={(e) => muda(k, { titulo: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[13.5px] font-medium outline-none" />
            </div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(TIPOS) as TipoItem[]).map((t) => (
                <button key={t} onClick={() => muda(k, { tipo: t })} className={`rounded-full px-2 py-0.5 text-[11px] ${i.tipo === t ? "font-semibold text-white" : "bg-raised text-muted hover:text-fg"}`} style={i.tipo === t ? { background: TIPOS[t].cor } : undefined}>
                  {TIPOS[t].nome}
                </button>
              ))}
            </div>
            <div className="grid gap-1.5 sm:grid-cols-[1fr_1fr]">
              <select value={i.cliente_id} onChange={(e) => muda(k, { cliente_id: e.target.value })} className={`${campo} !py-1 !text-[12.5px] ${precisaCliente(i.tipo) && !i.cliente_id ? "!border-warn" : ""}`}>
                <option value="">{precisaCliente(i.tipo) ? "Qual cliente?" : "Sem cliente (interno)"}</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              {i.tipo === "cliente_deve" ? <input value={i.contato ?? ""} onChange={(e) => muda(k, { contato: e.target.value })} placeholder="Quem do cliente" className={`${campo} !py-1 !text-[12.5px]`} /> : <span />}
            </div>
            <textarea value={i.texto} onChange={(e) => muda(k, { texto: e.target.value })} rows={2} className={`${campo} !text-[12.5px]`} />
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-2 border-t border-line pt-3">
        <Botao onClick={() => setItens(null)}>Voltar ao texto</Botao>
        <div className="flex gap-2">
          <Botao onClick={fechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={salvar} disabled={ocupado === "salvar" || !itens.some((i) => i.usar)}>{ocupado === "salvar" ? "Salvando…" : `Salvar ${itens.filter((i) => i.usar).length}`}</Botao>
        </div>
      </div>
    </div>
  );
}
