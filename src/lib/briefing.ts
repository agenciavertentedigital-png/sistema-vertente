// Briefing estratégico (um por cliente) e anotações vinculadas ao cliente.
import secoesJson from "../data/briefingCampos.json";
import { useTabela } from "./tabela";
import { DEMO_IDS } from "./repo";
import { CLIENTES } from "../data/clientes";

export interface CampoBriefing { chave: string; rotulo: string; dica: string; cliente: boolean; grande?: boolean }
export interface SecaoBriefing { secao: string; interna?: boolean; campos: CampoBriefing[] }
export const SECOES_BRIEFING = secoesJson as SecaoBriefing[];
export const CAMPOS_BRIEFING = SECOES_BRIEFING.flatMap((s) => s.campos);

export interface Briefing {
  id: string;
  cliente_id: string;
  campos: Record<string, string>;
  atualizado_em: string;
  atualizado_por: string | null;
  respondido_cliente_em: string | null;
}

export const preenchido = (b: Briefing | undefined, chave: string) => Boolean(b?.campos?.[chave]?.trim());

export function completudeBriefing(b: Briefing | undefined) {
  const total = CAMPOS_BRIEFING.length;
  const feitos = CAMPOS_BRIEFING.filter((c) => preenchido(b, c.chave)).length;
  return { feitos, total, pct: Math.round((feitos / total) * 100) };
}

/** Texto do briefing em Markdown, para copiar ou mandar para a IA. */
export function briefingEmTexto(nome: string, b: Briefing | undefined) {
  const linhas = [`# Briefing estratégico — ${nome}`];
  for (const s of SECOES_BRIEFING) {
    const comValor = s.campos.filter((c) => preenchido(b, c.chave));
    if (!comValor.length) continue;
    linhas.push("", `## ${s.secao}`);
    for (const c of comValor) linhas.push(`**${c.rotulo}:** ${b!.campos[c.chave].trim()}`);
  }
  return linhas.join("\n");
}

function briefingsDemo(): Briefing[] {
  const id = DEMO_IDS.get(CLIENTES.find((c) => c.nome.startsWith("Óticas"))?.nome ?? CLIENTES[0]?.nome ?? "") ?? "demo";
  return [
    {
      id: "b-demo",
      cliente_id: id,
      atualizado_em: new Date().toISOString(),
      atualizado_por: null,
      respondido_cliente_em: null,
      campos: {
        negocio_resumo: "Ótica com 3 lojas no Vale do Aço, foco em óculos de grau com exame de vista no local e parcelamento facilitado.",
        produtos_carro_chefe: "Óculos de grau completos (armação + lentes multifocais), lentes de contato.",
        ticket_medio: "R$ 650",
        area_atendimento: "Ipatinga, Coronel Fabriciano e Timóteo.",
        persona: "Mulheres e homens de 35 a 60 anos, classe B/C, que precisam trocar o grau ou começaram a usar multifocal.",
        objetivo_principal: "Mais agendamentos de exame de vista pelo WhatsApp.",
        metas_90_dias: "300 contatos por mês e 60 vendas atribuídas aos anúncios.",
        verba_midia: "R$ 3.000 por mês",
        kpi_principal: "Custo por contato até R$ 10",
        diferenciais: "Exame de vista no local, entrega rápida, parcelamento em até 10x.",
        estrategia_atual: "Campanha de mensagens para o WhatsApp de cada loja com oferta de exame + condição de parcelamento; remarketing com depoimentos.",
      },
    },
  ];
}

export function useBriefings() {
  return useTabela<Briefing>("briefings", "id, cliente_id, campos, atualizado_em, atualizado_por, respondido_cliente_em", briefingsDemo);
}

// ---------------- Anotações ----------------
export type Etiqueta = "geral" | "estrategia" | "reuniao" | "ideia" | "alinhamento" | "aprendizado" | "pendencia";
export const ETIQUETAS: Record<Etiqueta, { nome: string; cor: string }> = {
  geral: { nome: "Geral", cor: "#64748b" },
  estrategia: { nome: "Estratégia", cor: "#1d4ed8" },
  reuniao: { nome: "Reunião", cor: "#7c3aed" },
  ideia: { nome: "Ideia", cor: "#d97706" },
  alinhamento: { nome: "Alinhamento", cor: "#0891b2" },
  aprendizado: { nome: "Aprendizado", cor: "#16a34a" },
  pendencia: { nome: "Pendência", cor: "#dc2626" },
};

export interface Nota {
  id: string;
  cliente_id: string | null;
  titulo: string | null;
  texto: string;
  etiqueta: Etiqueta;
  fixada: boolean;
  autor_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

function notasDemo(): Nota[] {
  const id = DEMO_IDS.get(CLIENTES.find((c) => c.nome.startsWith("Óticas"))?.nome ?? CLIENTES[0]?.nome ?? "") ?? "demo";
  const agora = Date.now();
  const n = (d: number, o: Partial<Nota>): Nota => ({ id: crypto.randomUUID(), cliente_id: id, titulo: null, texto: "", etiqueta: "geral", fixada: false, autor_id: null, criado_em: new Date(agora - d * 864e5).toISOString(), atualizado_em: new Date(agora - d * 864e5).toISOString(), ...o });
  return [
    n(1, { titulo: "Cliente prefere aprovar criativos por áudio", texto: "A dona responde melhor por áudio no WhatsApp, à noite. Mandar os criativos em um único carrossel.", etiqueta: "alinhamento", fixada: true }),
    n(3, { titulo: "Teste de oferta: exame grátis na compra", texto: "Ideia para novembro: exame grátis na compra do óculos completo. Validar margem com o cliente.", etiqueta: "ideia" }),
    n(6, { titulo: "Depoimentos em vídeo funcionam melhor", texto: "Criativos com depoimento de cliente tiveram custo por contato 35% menor que as fotos de produto.", etiqueta: "aprendizado" }),
    n(9, { texto: "Pedir as fotos novas da loja de Timóteo.", etiqueta: "pendencia" }),
  ];
}

export function useNotas() {
  return useTabela<Nota>("notas", "id, cliente_id, titulo, texto, etiqueta, fixada, autor_id, criado_em, atualizado_em", notasDemo, { ordem: { coluna: "atualizado_em", asc: false } });
}
