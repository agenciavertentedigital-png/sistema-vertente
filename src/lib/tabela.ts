import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Acesso simples a uma tabela do Supabase (ou a uma lista em memória no modo demonstração).
 * Usado pelos módulos GMN, Social Media, Financeiro e Contratos.
 */
const memoria = new Map<string, Record<string, unknown>[]>();
const ouvintes = new Map<string, Set<() => void>>();
function avisarMudanca(nome: string) {
  ouvintes.get(nome)?.forEach((f) => f());
}

export interface OpcoesTabela {
  ordem?: { coluna: string; asc?: boolean };
  /** filtro simples coluna >= valor */
  desde?: { coluna: string; valor: string };
  limite?: number;
}

export function useTabela<T extends { id: string }>(nome: string, colunas: string, demo: () => T[], opcoes: OpcoesTabela = {}) {
  const [linhas, setLinhas] = useState<T[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const chaveOpcoes = JSON.stringify(opcoes);

  const recarregar = useCallback(async () => {
    if (!supabase) {
      if (!memoria.has(nome)) memoria.set(nome, demo() as unknown as Record<string, unknown>[]);
      setLinhas([...(memoria.get(nome) as unknown as T[])]);
      setCarregando(false);
      return;
    }
    const o = JSON.parse(chaveOpcoes) as OpcoesTabela;
    let q = supabase.from(nome).select(colunas);
    if (o.desde) q = q.gte(o.desde.coluna, o.desde.valor);
    if (o.ordem) q = q.order(o.ordem.coluna, { ascending: o.ordem.asc ?? true });
    if (o.limite) q = q.limit(o.limite);
    const { data, error } = await q;
    if (error) setErro(error.message);
    else {
      setErro("");
      setLinhas((data ?? []) as unknown as T[]);
    }
    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, colunas, chaveOpcoes]);

  useEffect(() => {
    recarregar();
    const s = ouvintes.get(nome) ?? new Set();
    s.add(recarregar);
    ouvintes.set(nome, s);
    return () => {
      s.delete(recarregar);
    };
  }, [nome, recarregar]);

  const salvar = useCallback(
    async (id: string | null, campos: Partial<T>): Promise<string> => {
      if (!supabase) {
        const lista = memoria.get(nome) ?? [];
        if (id) memoria.set(nome, lista.map((l) => (l.id === id ? { ...l, ...campos } : l)));
        else {
          id = crypto.randomUUID();
          memoria.set(nome, [...lista, { id, criado_em: new Date().toISOString(), ...campos }]);
        }
        avisarMudanca(nome);
        return id;
      }
      if (id) {
        const { error } = await supabase.from(nome).update(campos).eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from(nome).insert(campos).select("id").single();
        if (error) throw new Error(error.message);
        id = (data as { id: string }).id;
      }
      avisarMudanca(nome);
      return id;
    },
    [nome],
  );

  const excluir = useCallback(
    async (id: string) => {
      if (!supabase) {
        memoria.set(nome, (memoria.get(nome) ?? []).filter((l) => l.id !== id));
      } else {
        const { error } = await supabase.from(nome).delete().eq("id", id);
        if (error) throw new Error(error.message);
      }
      avisarMudanca(nome);
    },
    [nome],
  );

  return { linhas, carregando, erro, recarregar, salvar, excluir };
}

/** Chama uma função do servidor (Edge Function) com o login atual. */
export async function chamarFuncao<T>(nome: string, corpo: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error("Disponível só com o sistema conectado (fora da prévia).");
  const { data, error } = await supabase.functions.invoke(nome, { body: corpo });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) msg = ((await ctx.json()) as { erro?: string }).erro ?? msg;
    } catch {
      /* mantém a mensagem original */
    }
    throw new Error(msg);
  }
  if ((data as { erro?: string })?.erro) throw new Error((data as { erro: string }).erro);
  return data as T;
}

export const moedaBR = (v: number | null | undefined, casas = 2) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
