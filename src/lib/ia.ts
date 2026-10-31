import { supabase } from "./supabase";
import { chamarFuncao } from "./tabela";

/**
 * Pede algo ao Assistente IA (a mesma função do chat, com acesso de leitura ao banco
 * e às permissões de quem está logado) e devolve o texto da resposta.
 */
export async function perguntarIA(pergunta: string, pagina = "sistema"): Promise<string> {
  const r = await chamarFuncao<{ resposta: string }>("assistente", { mensagens: [{ role: "user", content: pergunta }], pagina });
  return r.resposta ?? "";
}

/** Pega o primeiro objeto/array JSON de um texto (a IA às vezes embrulha em ```json). */
export function extrairJson<T>(texto: string): T {
  const limpo = texto.replace(/```(?:json)?/gi, "").trim();
  const ini = limpo.search(/[[{]/);
  const fimObj = limpo.lastIndexOf("}");
  const fimArr = limpo.lastIndexOf("]");
  const fim = Math.max(fimObj, fimArr);
  if (ini < 0 || fim < ini) throw new Error("A IA não devolveu no formato esperado. Tente de novo.");
  return JSON.parse(limpo.slice(ini, fim + 1)) as T;
}

export const iaDisponivel = () => !!supabase;
