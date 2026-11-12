import { supabase } from "./supabase";

/** Recorta a imagem no centro, em quadrado de 320 px, e devolve em WEBP (fica leve e igual em todas as telas). */
async function quadrado(f: File, lado = 320): Promise<Blob> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error("Não consegui abrir essa imagem."));
      i.src = url;
    });
    const m = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = c.height = lado;
    c.getContext("2d")!.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, lado, lado);
    return await new Promise<Blob>((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("Não consegui preparar a foto."))), "image/webp", 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Envia a foto de perfil de um membro do time e grava em membros.foto_url.
 * A própria pessoa grava pela função definir_minha_foto; um administrador pode trocar a foto de qualquer um.
 */
export async function enviarFotoMembro(membroId: string, f: File, propria: boolean): Promise<string> {
  if (!supabase) throw new Error("Sem conexão.");
  if (!/^image\/(png|jpeg|webp|heic|heif)$/.test(f.type)) throw new Error("Use uma foto em JPG, PNG ou WEBP.");
  if (f.size > 15 * 1024 * 1024) throw new Error("A foto passa de 15 MB.");
  const blob = await quadrado(f);
  const caminho = `${membroId}/foto-${Date.now()}.webp`;
  const up = await supabase.storage.from("avatares").upload(caminho, blob, { contentType: "image/webp", upsert: false });
  if (up.error) throw new Error(up.error.message);
  const url = supabase.storage.from("avatares").getPublicUrl(caminho).data.publicUrl;
  const r = propria
    ? await supabase.rpc("definir_minha_foto", { url })
    : await supabase.from("membros").update({ foto_url: url }).eq("id", membroId);
  if (r.error) throw new Error(r.error.message);
  return url;
}

export async function removerFotoMembro(membroId: string, propria: boolean) {
  if (!supabase) return;
  const r = propria
    ? await supabase.rpc("definir_minha_foto", { url: null })
    : await supabase.from("membros").update({ foto_url: null }).eq("id", membroId);
  if (r.error) throw new Error(r.error.message);
}
