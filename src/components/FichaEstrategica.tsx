import { useState } from "react";
import { Compass, Loader2, Pencil, Sparkles } from "lucide-react";
import { useDados } from "../lib/dados";
import { briefingEmTexto, useBriefings, useNotas, type Briefing } from "../lib/briefing";
import { extrairJson, iaDisponivel, perguntarIA } from "../lib/ia";
import { Botao, campo } from "./ui";

export interface Ficha { oferta: string; publico: string; persona: string; comunicacao: string; objetivo: string; prioridades: string; gerada_em?: string }
const CAMPOS: [keyof Ficha, string, string][] = [
  ["objetivo", "Objetivo atual", "O que estamos buscando agora, com número se houver"],
  ["oferta", "Oferta", "O que vendemos e a condição que mais converte"],
  ["publico", "Público", "Quem, onde e faixa"],
  ["persona", "Persona", "Quem decide, dores e desejos"],
  ["comunicacao", "Comunicação", "Tom, ângulos e o que evitar"],
  ["prioridades", "Prioridades", "As 2 ou 3 frentes desta fase"],
];

export function lerFicha(b?: Briefing): Ficha | null {
  try {
    const t = b?.campos?.ficha_estrategica;
    return t ? (JSON.parse(t) as Ficha) : null;
  } catch {
    return null;
  }
}

/** Ficha estratégica resumida, no topo do cliente: gerada pela IA a partir do briefing e das notas, sempre editável. */
export function FichaEstrategica({ clienteId, abrirBriefing }: { clienteId: string; abrirBriefing: () => void }) {
  const d = useDados();
  const tb = useBriefings();
  const notas = useNotas();
  const b = tb.linhas.find((x) => x.cliente_id === clienteId);
  const ficha = lerFicha(b);
  const [editando, setEditando] = useState<Ficha | null>(null);
  const [gerando, setGerando] = useState(false);
  const nome = d.cliente(clienteId)?.nome ?? "";

  async function salvar(f: Ficha) {
    const campos = { ...(b?.campos ?? {}), ficha_estrategica: JSON.stringify(f) };
    await tb.salvar(b?.id ?? null, { cliente_id: clienteId, campos, atualizado_por: d.eu });
  }

  async function gerar() {
    if (!iaDisponivel()) return d.avisar("A IA funciona só no sistema conectado (fora da prévia).");
    setGerando(true);
    try {
      const fixadas = notas.linhas.filter((n) => n.cliente_id === clienteId).slice(0, 8).map((n) => `- ${n.titulo ? n.titulo + ": " : ""}${(n.texto ?? "").slice(0, 400)}`);
      const pedido = `Monte a FICHA ESTRATÉGICA RESUMIDA do cliente "${nome}" da Vertente Digital, para o time bater o olho e lembrar do essencial.
Use só o que está abaixo; quando faltar informação, escreva "A definir". Português do Brasil, frases curtas e diretas (no máximo 2 linhas por campo), sem markdown.

${briefingEmTexto(nome, b)}
${fixadas.length ? `\nAnotações do cliente:\n${fixadas.join("\n")}` : ""}

Responda SÓ com JSON: {"objetivo":"","oferta":"","publico":"","persona":"","comunicacao":"","prioridades":""}`;
      const f = extrairJson<Ficha>(await perguntarIA(pedido, "ficha-estrategica"));
      const nova: Ficha = { ...f, gerada_em: new Date().toISOString() };
      await salvar(nova);
      setEditando(nova);
      d.avisar("Ficha estratégica gerada. Revise e ajuste o que precisar.");
    } catch (e) {
      d.avisar((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  if (editando) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4" style={{ boxShadow: "var(--sombra)" }}>
        <div className="flex items-center gap-2"><Compass size={16} className="text-accent" /><b className="text-[13.5px]">Ficha estratégica</b></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CAMPOS.map(([k, rotulo, dica]) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-muted">{rotulo}</span>
              <textarea value={(editando[k] as string) ?? ""} onChange={(e) => setEditando({ ...editando, [k]: e.target.value })} placeholder={dica} rows={3} className={`${campo} !text-[12.5px]`} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao onClick={gerar} disabled={gerando}>{gerando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Gerar de novo com IA</Botao>
          <Botao onClick={() => setEditando(null)}>Cancelar</Botao>
          <Botao variante="primario" onClick={async () => { await salvar(editando); setEditando(null); }}>Salvar ficha</Botao>
        </div>
      </section>
    );
  }

  if (!ficha) {
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line bg-surface px-4 py-3" style={{ boxShadow: "var(--sombra)" }}>
        <Compass size={16} className="text-accent" />
        <div className="min-w-0 flex-1">
          <b className="text-[13px]">Ficha estratégica</b>
          <p className="text-[12.5px] text-muted">Oferta, público, persona, comunicação, objetivo e prioridades num cartão só. A IA monta a partir do briefing e das anotações.</p>
        </div>
        <Botao onClick={() => setEditando({ oferta: "", publico: "", persona: "", comunicacao: "", objetivo: "", prioridades: "" })}><Pencil size={13} /> Escrever</Botao>
        <Botao variante="primario" onClick={gerar} disabled={gerando}>{gerando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {gerando ? "Gerando…" : "Gerar com IA"}</Botao>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4" style={{ boxShadow: "var(--sombra)" }}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-soft text-accent"><Compass size={16} /></span>
        <b className="text-[13.5px]">Ficha estratégica</b>
        <div className="ml-auto flex gap-1">
          <button onClick={abrirBriefing} className="rounded-lg px-2 py-1 text-[12px] text-muted hover:bg-raised hover:text-fg">Briefing completo</button>
          <button onClick={() => setEditando(ficha)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-muted hover:bg-raised hover:text-fg"><Pencil size={12} /> Editar</button>
        </div>
      </div>
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPOS.map(([k, rotulo]) => (
          <div key={k} className="min-w-0">
            <div className="text-[11.5px] font-medium text-muted">{rotulo}</div>
            <div className={`text-[13px] leading-snug ${ficha[k] && ficha[k] !== "A definir" ? "" : "text-muted"}`}>{(ficha[k] as string) || "A definir"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
