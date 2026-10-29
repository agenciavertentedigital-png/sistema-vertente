// Assistente no grupo do WhatsApp (via Z-API).
// A Z-API chama esta função a cada mensagem recebida (webhook "Ao receber"), com ?chave=<whatsapp_webhook_chave>.
// Só responde no grupo configurado e só para quem está no time (telefone cadastrado em membros.telefone).
// Segredos no Vault: zapi_instancia, zapi_token, zapi_client_token, whatsapp_webhook_chave, whatsapp_grupo (id do grupo).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

type Json = Record<string, unknown>;
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const soDigitos = (t: unknown) => String(t ?? "").replace(/\D/g, "");
/** Telefone brasileiro em 10 dígitos (DDD + número, sem 55 e sem o nono dígito), para comparar. */
const normalizar = (t: unknown) => {
  let d = soDigitos(t);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
  return d.slice(-10);
};
const mesmoTelefone = (a: string, b: string) => Boolean(normalizar(a)) && normalizar(a) === normalizar(b);

async function segredo(admin: SupabaseClient, nome: string) {
  return ((await admin.rpc("ler_segredo", { nome })).data as string | null) ?? null;
}

async function enviar(admin: SupabaseClient, destino: string, texto: string) {
  const [inst, token, cliente] = await Promise.all([segredo(admin, "zapi_instancia"), segredo(admin, "zapi_token"), segredo(admin, "zapi_client_token")]);
  if (!inst || !token) throw new Error("Falta configurar a Z-API (zapi_instancia e zapi_token no Vault).");
  const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${token}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cliente ? { "Client-Token": cliente } : {}) },
    body: JSON.stringify({ phone: destino, message: texto.slice(0, 4000) }),
  });
  if (!r.ok) throw new Error(`Z-API respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function processar(admin: SupabaseClient, msg: Json) {
  const grupo = String(msg.phone ?? "");
  const grupoNome = (msg.chatName as string) ?? null;
  const autorTel = soDigitos(msg.participantPhone);
  const autorNome = (msg.senderName as string) ?? null;
  const texto = String((msg.text as { message?: string } | undefined)?.message ?? "").trim();
  if (!texto) return;

  const grupoConfigurado = await segredo(admin, "whatsapp_grupo");
  if (!grupoConfigurado || grupoConfigurado !== grupo) {
    // Guarda para descobrir o id do grupo na configuração; não responde
    await admin.from("whatsapp_mensagens").insert({ grupo, grupo_nome: grupoNome, autor_telefone: autorTel, autor_nome: autorNome, papel: "ignorada", texto: texto.slice(0, 500) });
    return;
  }
  if (texto.startsWith("//")) return; // conversa entre pessoas, sem chamar a IA

  const { data: time } = await admin.from("membros").select("id, nome, telefone").eq("ativo", true).not("telefone", "is", null);
  const membro = (time ?? []).find((t) => mesmoTelefone(t.telefone as string, autorTel));
  if (!membro) {
    await admin.from("whatsapp_mensagens").insert({ grupo, grupo_nome: grupoNome, autor_telefone: autorTel, autor_nome: autorNome, papel: "ignorada", texto: texto.slice(0, 500) });
    await enviar(admin, grupo, `Oi${autorNome ? `, ${autorNome}` : ""}! Seu número ainda não está ligado ao time no Sistema Vertente, então não posso consultar os dados para você.`);
    return;
  }

  await admin.from("whatsapp_mensagens").insert({ grupo, grupo_nome: grupoNome, membro_id: membro.id, autor_telefone: autorTel, autor_nome: autorNome, papel: "user", texto });

  // Últimas mensagens da mesma pessoa no grupo, para manter o contexto da conversa
  const { data: hist } = await admin
    .from("whatsapp_mensagens")
    .select("papel, texto, criado_em")
    .eq("grupo", grupo)
    .eq("membro_id", membro.id)
    .in("papel", ["user", "assistant"])
    .gte("criado_em", new Date(Date.now() - 6 * 3600_000).toISOString())
    .order("criado_em", { ascending: false })
    .limit(8);
  const mensagens = (hist ?? []).reverse().map((h) => ({ role: h.papel, content: h.texto }));

  const chave = await segredo(admin, "chave_cron_meta");
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/assistente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-chave-cron": chave ?? "" },
    body: JSON.stringify({ membro_id: membro.id, mensagens, canal: "whatsapp" }),
  });
  const j = (await r.json().catch(() => ({}))) as { resposta?: string; erro?: string };
  const resposta = j.resposta ?? `Não consegui responder agora: ${j.erro ?? "erro desconhecido"}`;
  await admin.from("whatsapp_mensagens").insert({ grupo, grupo_nome: grupoNome, membro_id: membro.id, papel: "assistant", texto: resposta });
  await enviar(admin, grupo, `*${String(membro.nome).split(" ")[0]}*\n${resposta}`);
}

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const esperada = await segredo(admin, "whatsapp_webhook_chave");
  const chave = new URL(req.url).searchParams.get("chave");
  if (!esperada || chave !== esperada) return new Response("sem acesso", { status: 403 });

  const msg = (await req.json().catch(() => ({}))) as Json;
  // Só mensagens de texto recebidas em grupos, nunca as enviadas pelo próprio número
  if (msg.fromMe || !msg.isGroup || msg.type !== "ReceivedCallback") return new Response("ok");

  const tarefa = processar(admin, msg).catch((e) => console.error("whatsapp:", (e as Error).message));
  // Responde já para a Z-API e segue processando em segundo plano
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(tarefa);
  else await tarefa;
  return new Response("ok");
});
