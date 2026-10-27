import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { repo, type Dados } from "./repo";
import type { Cliente, Membro } from "./tipos";

interface Contexto extends Dados {
  carregando: boolean;
  erro: string;
  recarregar: () => Promise<void>;
  eu: string | null; // id do membro logado
  cliente: (id: string) => Cliente | undefined;
  membro: (id: string | null) => Membro | undefined;
  aviso: string;
  avisar: (texto: string) => void;
}

const Ctx = createContext<Contexto | null>(null);
const VAZIO: Dados = { clientes: [], membros: [], tarefas: [], rotinas: [], clienteRotinas: [], registros: [], notificacoes: [] };

export function ProvedorDados({ eu, children }: { eu: string | null; children: ReactNode }) {
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const recarregar = useCallback(async () => {
    try {
      setDados(await repo.carregar());
      setErro("");
    } catch (e) {
      setErro(`Não foi possível carregar os dados: ${(e as Error).message}`);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
    // Mantém a tela atualizada com o que o resto do time faz
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [recarregar]);

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso((a) => (a === texto ? "" : a)), 3500);
  }, []);

  const valor = useMemo<Contexto>(() => {
    const porCliente = new Map(dados.clientes.map((c) => [c.id, c]));
    const porMembro = new Map(dados.membros.map((m) => [m.id, m]));
    return {
      ...dados,
      carregando,
      erro,
      recarregar,
      eu,
      cliente: (id) => porCliente.get(id),
      membro: (id) => (id ? porMembro.get(id) : undefined),
      aviso,
      avisar,
    };
  }, [dados, carregando, erro, recarregar, eu, aviso, avisar]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useDados(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDados fora do ProvedorDados");
  return c;
}
