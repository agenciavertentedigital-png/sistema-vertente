import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { CLIENTES, type Origem } from "../data/clientes";

export interface ClienteLinha {
  nome: string;
  origem: Origem;
  grupo?: string;
  servicos: string[];
  responsavel?: string;
}

const ORIGEM: Record<string, Origem> = { vertente: "Vertente", parceria_marcone: "Parceria Marcone" };

interface LinhaBanco {
  nome: string;
  origem: string;
  marca: string | null;
  responsavel: { nome: string } | null;
  cliente_servicos: { servicos: { nome: string } | null }[];
}

/** Clientes ativos: do Supabase quando conectado, da base local no modo demonstração. */
export function useClientes() {
  const [clientes, setClientes] = useState<ClienteLinha[]>(
    supabase ? [] : CLIENTES.map((c) => ({ ...c, servicos: [] })),
  );
  const [carregando, setCarregando] = useState(Boolean(supabase));
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("clientes")
      .select("nome, origem, marca, responsavel:membros(nome), cliente_servicos(servicos(nome))")
      .eq("status", "ativo")
      .order("nome")
      .then(({ data, error }) => {
        setCarregando(false);
        if (error) {
          setErro("Não foi possível carregar os clientes. Tente atualizar a página.");
          return;
        }
        setClientes(
          ((data ?? []) as unknown as LinhaBanco[]).map((c) => ({
            nome: c.nome,
            origem: ORIGEM[c.origem] ?? "Vertente",
            grupo: c.marca ?? undefined,
            responsavel: c.responsavel?.nome,
            servicos: c.cliente_servicos.map((s) => s.servicos?.nome).filter((n): n is string => Boolean(n)),
          })),
        );
      });
  }, []);

  return { clientes, carregando, erro };
}
