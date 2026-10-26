import { useEffect, useState } from "react";

/**
 * Navegação simples por âncora (#clientes, #trafego…).
 * Quando o sistema for para a Vercel com login, troca-se por react-router
 * sem mudar as páginas.
 */
function lerRota(): string {
  const h = window.location.hash.replace(/^#/, "");
  return /^[a-z0-9_-]+$/i.test(h) ? h : "inicio";
}

export function useRota(): [string, (r: string) => void] {
  const [rota, setRota] = useState(lerRota);

  useEffect(() => {
    const onHash = () => setRota(lerRota());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const ir = (r: string) => {
    setRota(r);
    try {
      history.replaceState(null, "", r === "inicio" ? " " : `#${r}`);
    } catch {
      /* ambiente sem history: segue só no estado */
    }
    document.getElementById("area-principal")?.scrollTo({ top: 0 });
  };

  return [rota, ir];
}
