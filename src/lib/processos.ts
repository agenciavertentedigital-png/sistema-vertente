// Processos aplicáveis a um cliente (pré-onboarding, onboarding…): viram tarefas com checklist e prazo.
import { supabase } from "./supabase";
import { repo } from "./repo";
import { somarDias, type Pilar, type Prioridade } from "./tipos";
import PADRAO from "../data/processosPadrao.json";

export interface Etapa {
  titulo: string;
  pilar: Pilar;
  dias: number; // dias após o início
  prioridade: Prioridade;
  checklist: string[];
}
export interface Processo {
  id: string;
  nome: string;
  tipo: "pre_onboarding" | "onboarding" | "outro";
  descricao: string | null;
  etapas: Etapa[];
  ordem: number;
}
export interface ProcessoAplicado {
  id: string;
  processo_id: string | null;
  nome: string;
  cliente_id: string;
  inicio: string;
  criado_em?: string;
}

export const processosDemo = (): Processo[] => (PADRAO as Omit<Processo, "id">[]).map((p, i) => ({ ...p, id: `proc-${i + 1}` }));

/** Prazo útil: se cair no fim de semana, vai para segunda. */
export function prazoUtil(inicio: string, dias: number) {
  let d = somarDias(inicio, dias);
  const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
  if (dow === 6) d = somarDias(d, 2);
  if (dow === 0) d = somarDias(d, 1);
  return d;
}

/** Cria as tarefas do processo para o cliente. Devolve quantas tarefas foram criadas. */
export async function aplicarProcesso(p: Processo, clienteId: string, inicio: string, responsaveis: Partial<Record<Pilar, string | null>>) {
  let aplicadoId: string | null = null;
  if (supabase) {
    const { data, error } = await supabase.from("processos_aplicados").insert({ processo_id: p.id, nome: p.nome, cliente_id: clienteId, inicio }).select("id").single();
    if (error) throw new Error(error.message);
    aplicadoId = (data as { id: string }).id;
  }
  let n = 0;
  for (const e of p.etapas) {
    const id = await repo.salvarTarefa(null, {
      cliente_id: clienteId,
      titulo: `${p.nome} · ${e.titulo}`,
      pilar: e.pilar,
      prioridade: e.prioridade,
      prazo: prazoUtil(inicio, e.dias),
      responsavel_id: responsaveis[e.pilar] ?? null,
      status: "a_fazer",
      ...(aplicadoId ? { processo_aplicado_id: aplicadoId } : {}),
    } as Parameters<typeof repo.salvarTarefa>[1]);
    for (let i = 0; i < e.checklist.length; i++) await repo.adicionarItem(id, e.checklist[i], i);
    n++;
  }
  return n;
}
