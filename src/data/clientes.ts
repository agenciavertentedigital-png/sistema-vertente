/**
 * Base de clientes ativos usada só no modo demonstração (sem Supabase).
 * Com o banco conectado, a lista vem da tabela `clientes` (status = ativo).
 */
export type Origem = "Vertente" | "Parceria Marcone";

export interface Cliente {
  nome: string;
  origem: Origem;
  grupo?: string; // agrupa unidades da mesma marca
}

export const CLIENTES: Cliente[] = [
  { nome: "Advocacia Djalmas", origem: "Vertente" },
  { nome: "Agência Vertente Digital", origem: "Vertente" },
  { nome: "CDT Porto Seguro", origem: "Vertente" },
  { nome: "Cecy Lessa", origem: "Vertente" },
  { nome: "Clínica Nobre Fio", origem: "Vertente" },
  { nome: "Espaço Larissa Lemos", origem: "Vertente" },
  { nome: "Essenza Planejados", origem: "Vertente" },
  { nome: "Madalena Brandão", origem: "Vertente" },
  { nome: "Óticas Carol SVA", origem: "Vertente", grupo: "Óticas Carol" },
  { nome: "Terapia de Oração", origem: "Vertente" },
];
