import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Membro {
  id: string;
  nome: string;
  email: string;
  papel: "admin" | "gestor" | "cs" | "visualizador";
}

export type EstadoSessao =
  | { tipo: "carregando" }
  | { tipo: "demonstracao" }
  | { tipo: "deslogado" }
  | { tipo: "sem-acesso"; email: string }
  | { tipo: "logado"; membro: Membro };

/** Sessão do usuário + vínculo com a tabela `membros` (quem é do time). */
export function useSessao(): EstadoSessao {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [estado, setEstado] = useState<EstadoSessao>(
    supabase ? { tipo: "carregando" } : { tipo: "demonstracao" },
  );

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || sessao === undefined) return;
    if (sessao === null) {
      setEstado({ tipo: "deslogado" });
      return;
    }
    const email = sessao.user.email ?? "";
    supabase
      .from("membros")
      .select("id, nome, email, papel")
      .eq("ativo", true)
      .ilike("email", email)
      .maybeSingle()
      .then(({ data }) => {
        setEstado(data ? { tipo: "logado", membro: data as Membro } : { tipo: "sem-acesso", email });
      });
  }, [sessao]);

  return estado;
}

export async function sair() {
  await supabase?.auth.signOut();
}
