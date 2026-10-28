// Social Media: posts do cronograma de cada cliente.
export type StatusPost = "ideia" | "producao" | "aprovacao" | "ajuste" | "aprovado" | "publicado";
export type Formato = "feed" | "carrossel" | "reels" | "stories";

export interface Post {
  id: string;
  cliente_id: string;
  data: string;
  formato: Formato;
  tema: string;
  legenda: string | null;
  status: StatusPost;
  responsavel_id: string | null;
  link_material: string | null;
  link_publicado: string | null;
  observacoes: string | null;
}

export const STATUS_POST: { id: StatusPost; nome: string; cor: string }[] = [
  { id: "ideia", nome: "Ideia", cor: "#8a93b0" },
  { id: "producao", nome: "Em produção", cor: "#3b6fd8" },
  { id: "aprovacao", nome: "Com o cliente", cor: "#d08a1f" },
  { id: "ajuste", nome: "Ajuste pedido", cor: "#d0453b" },
  { id: "aprovado", nome: "Aprovado", cor: "#8a54c8" },
  { id: "publicado", nome: "Publicado", cor: "#1f9a5a" },
];
export const COR_POST = Object.fromEntries(STATUS_POST.map((s) => [s.id, s.cor])) as Record<StatusPost, string>;
export const NOME_POST = Object.fromEntries(STATUS_POST.map((s) => [s.id, s.nome])) as Record<StatusPost, string>;

export const FORMATOS: { id: Formato; nome: string }[] = [
  { id: "feed", nome: "Feed" },
  { id: "carrossel", nome: "Carrossel" },
  { id: "reels", nome: "Reels" },
  { id: "stories", nome: "Stories" },
];
export const NOME_FORMATO = Object.fromEntries(FORMATOS.map((f) => [f.id, f.nome])) as Record<Formato, string>;

export const CAMPOS_POST = "id, cliente_id, data, formato, tema, legenda, status, responsavel_id, link_material, link_publicado, observacoes";
