// Temperatura do cliente: como está a relação, marcada pelo time em poucos cliques.
import { useTabela } from "./tabela";
import { DEMO_IDS } from "./repo";
import { CLIENTES } from "../data/clientes";

export interface Temperatura {
  id: string;
  cliente_id: string;
  nivel: 1 | 2 | 3 | 4 | 5;
  motivo: string | null;
  tarefa_id: string | null;
  autor_id: string | null;
  criado_em: string;
}

export const NIVEIS_TEMP: Record<number, { nome: string; cor: string; dica: string }> = {
  1: { nome: "Crítica", cor: "#c8382e", dica: "Risco de cancelar" },
  2: { nome: "Fria", cor: "#e2701c", dica: "Insatisfeito ou distante" },
  3: { nome: "Morna", cor: "#c89a12", dica: "Neutro, precisa de atenção" },
  4: { nome: "Boa", cor: "#2f9a5d", dica: "Satisfeito" },
  5: { nome: "Ótima", cor: "#2747d6", dica: "Encantado, indica a Vertente" },
};

/** Temperatura vale por 45 dias; depois disso o cliente aparece como "sem leitura". */
export const VALIDADE_DIAS = 45;

function demo(): Temperatura[] {
  const agora = Date.now();
  const mk = (nome: string, nivel: Temperatura["nivel"], motivo: string, dias: number): Temperatura => ({
    id: crypto.randomUUID(), cliente_id: DEMO_IDS.get(nome) ?? nome, nivel, motivo, tarefa_id: null, autor_id: null, criado_em: new Date(agora - dias * 864e5).toISOString(),
  });
  return [
    mk(CLIENTES[1]?.nome ?? "", 2, "Reclamou da qualidade dos leads na última reunião", 3),
    mk(CLIENTES[3]?.nome ?? "", 4, "Gostou do relatório do mês", 8),
    mk(CLIENTES[5]?.nome ?? "", 1, "Pediu para pausar e rever o contrato", 1),
    mk(CLIENTES[0]?.nome ?? "", 5, "Indicou um amigo para a Vertente", 12),
  ];
}

export function useTemperaturas() {
  const t = useTabela<Temperatura>("temperaturas", "id, cliente_id, nivel, motivo, tarefa_id, autor_id, criado_em", demo, { ordem: { coluna: "criado_em", asc: false }, limite: 3000 });
  const atual = (clienteId: string) => {
    const x = t.linhas.filter((l) => l.cliente_id === clienteId).sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
    if (!x) return null;
    const dias = Math.floor((Date.now() - new Date(x.criado_em).getTime()) / 864e5);
    return { ...x, dias, vencida: dias > VALIDADE_DIAS };
  };
  const historico = (clienteId: string) => t.linhas.filter((l) => l.cliente_id === clienteId).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  return { ...t, atual, historico };
}
