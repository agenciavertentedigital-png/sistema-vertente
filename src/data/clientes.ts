/**
 * Base inicial de clientes (Fase 0).
 * Na Fase 0 completa, esta lista passa a vir da tabela `clientes` no Supabase.
 */
export type Origem = "Vertente" | "Parceria Marcone";

export interface Cliente {
  nome: string;
  origem: Origem;
  grupo?: string; // agrupa unidades da mesma marca
}

export const CLIENTES: Cliente[] = [
  { nome: "Clínica Nobre Fio", origem: "Vertente" },
  { nome: "Agência Vertente Digital", origem: "Vertente" },
  { nome: "Óticas Carol SVA - Ipatinga", origem: "Vertente", grupo: "Óticas Carol" },
  { nome: "Óticas Carol Santa Maria", origem: "Vertente", grupo: "Óticas Carol" },
  { nome: "Óticas Carol RJ - Bangu Shopping", origem: "Vertente", grupo: "Óticas Carol" },
  { nome: "Óticas Carol - West Shopping", origem: "Vertente", grupo: "Óticas Carol" },
  { nome: "Óticas Carol - Carioca Shopping", origem: "Vertente", grupo: "Óticas Carol" },
  { nome: "Óticas Carol - Bangu Centro", origem: "Vertente", grupo: "Óticas Carol" },
  { nome: "Espaço Larissa Lemos", origem: "Vertente" },
  { nome: "Lourdes Samora", origem: "Vertente" },
  { nome: "Madalena Brandão", origem: "Vertente" },
  { nome: "Cecy Lessa", origem: "Vertente" },
  { nome: "CDT Porto Seguro", origem: "Vertente" },
  { nome: "Tríade Fibra", origem: "Parceria Marcone" },
  { nome: "Apple Mania", origem: "Parceria Marcone" },
  { nome: "Ital'in House", origem: "Parceria Marcone" },
  { nome: "Gildomar Baterias", origem: "Parceria Marcone" },
  { nome: "Dra Marcela Galli", origem: "Parceria Marcone" },
  { nome: "Aloísio Gás", origem: "Parceria Marcone" },
  { nome: "Plus Sain", origem: "Parceria Marcone" },
];
