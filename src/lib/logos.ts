import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Logos dos clientes (clientes.logo_url). Se a coluna ainda não existir, fica tudo sem logo. */
export function useLogos() {
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [disponivel, setDisponivel] = useState(Boolean(supabase));
  const carregar = useCallback(async () => {
    if (!supabase) return;
    const r = await supabase.from("clientes").select("id, logo_url").not("logo_url", "is", null);
    if (r.error) return setDisponivel(false);
    setLogos(Object.fromEntries((r.data as { id: string; logo_url: string }[]).map((x) => [x.id, x.logo_url])));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(clienteId: string, f: File) {
    if (!supabase) throw new Error("Sem conexão.");
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) throw new Error("Use PNG, JPG, WEBP ou SVG.");
    if (f.size > 2 * 1024 * 1024) throw new Error("A logo passa de 2 MB.");
    const ext = f.name.split(".").pop()?.toLowerCase() || "png";
    const caminho = `${clienteId}/logo-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("logos").upload(caminho, f, { contentType: f.type, upsert: false });
    if (up.error) throw new Error(/bucket/i.test(up.error.message) ? "Falta aplicar a atualização do banco das logos." : up.error.message);
    const url = supabase.storage.from("logos").getPublicUrl(caminho).data.publicUrl;
    const u = await supabase.from("clientes").update({ logo_url: url }).eq("id", clienteId);
    if (u.error) throw new Error(u.error.message);
    setLogos((l) => ({ ...l, [clienteId]: url }));
  }
  async function remover(clienteId: string) {
    if (!supabase) return;
    const u = await supabase.from("clientes").update({ logo_url: null }).eq("id", clienteId);
    if (u.error) throw new Error(u.error.message);
    setLogos(({ [clienteId]: _, ...resto }) => resto);
  }
  return { logos, enviar, remover, disponivel, carregar };
}

/** Cor estável a partir do nome (para o monograma quando não há logo). */
export function corDoNome(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 42%)`;
}

export function iniciaisCliente(nome: string) {
  const p = nome.replace(/^(CA\d*|Dra?\.?|Loja|Clínica)\s+/i, "").split(/\s+/).filter((x) => x.length > 2 || /^[A-Z]/.test(x));
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || nome.slice(0, 2).toUpperCase();
}
