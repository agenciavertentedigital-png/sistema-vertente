import { useEffect, useState } from "react";

/**
 * Navegação simples por âncora (#clientes, #trafego…).
 * Quando o sistema for para a Vercel com login, troca-se por react-router
 * sem mudar as páginas.
 */
/** Áreas com endereço próprio (/crm) além da âncora. Só no sistema publicado, não na prévia em arquivo único. */
const CAMINHOS = new Set(["crm"]);
const usaCaminho = () => import.meta.env.MODE !== "preview" && /^https?:$/.test(window.location.protocol);

function lerRota(): string {
  const caminho = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (CAMINHOS.has(caminho) && !window.location.hash) return caminho;
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
      if (usaCaminho() && CAMINHOS.has(r)) history.replaceState(null, "", `/${r}`);
      else if (usaCaminho() && CAMINHOS.has(window.location.pathname.replace(/^\/+|\/+$/g, ""))) history.replaceState(null, "", r === "inicio" ? "/" : `/#${r}`);
      else history.replaceState(null, "", r === "inicio" ? " " : `#${r}`);
    } catch {
      /* ambiente sem history: segue só no estado */
    }
    document.getElementById("area-principal")?.scrollTo({ top: 0 });
  };

  return [rota, ir];
}
