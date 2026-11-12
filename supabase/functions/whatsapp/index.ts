// WhatsApp do sistema: guarda as mensagens dos grupos (clientes, parceria, suporte) e responde como assistente no grupo do time.
// Funciona com a Evolution API (QR code, preferida quando configurada) ou com a Z-API clássica.
// O provedor chama esta função a cada mensagem recebida, com ?chave=<whatsapp_webhook_chave>.
// Um administrador logado chama com { acao: "configurar" } para apontar o webhook da Evolution para cá e ver o status da conexão.
// Segredos no Vault: evolution_url, evolution_apikey, evolution_instancia | zapi_instancia, zapi_token, zapi_client_token;
// whatsapp_webhook_chave, whatsapp_grupo (id do grupo do time).
// Mensagens enviadas pelo próprio número da agência nos grupos de clientes ficam guardadas com papel "agencia"
// (servem para saber se o cliente já foi respondido); no grupo do time elas são ignoradas.
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

async function evolution(admin: SupabaseClient) {
  const [url, apikey, inst] = await Promise.all([segredo(admin, "evolution_url"), segredo(admin, "evolution_apikey"), segredo(admin, "evolution_instancia")]);
  return url && apikey && inst ? { url: url.replace(/\/+$/, ""), apikey, inst: encodeURIComponent(inst) } : null;
}

async function enviar(admin: SupabaseClient, destino: string, texto: string) {
  const evo = await evolution(admin);
  if (evo) {
    const r = await fetch(`${evo.url}/message/sendText/${evo.inst}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evo.apikey },
      body: JSON.stringify({ number: destino, text: texto.slice(0, 4000) }),
    });
    if (!r.ok) throw new Error(`Evolution respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return;
  }
  const [inst, token, cliente] = await Promise.all([segredo(admin, "zapi_instancia"), segredo(admin, "zapi_token"), segredo(admin, "zapi_client_token")]);
  if (!inst || !token) throw new Error("Falta configurar o WhatsApp em Integrações.");
  const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${token}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cliente ? { "Client-Token": cliente } : {}) },
    body: JSON.stringify({ phone: destino, message: texto.slice(0, 4000) }),
  });
  if (!r.ok) throw new Error(`Z-API respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

/** Nome do grupo: o que já conhecemos ou, na Evolution, consulta uma vez. */
async function nomeDoGrupo(admin: SupabaseClient, grupo: string, informado: string | null) {
  if (informado) return informado;
  const { data } = await admin.from("whatsapp_grupos").select("nome").eq("grupo", grupo).maybeSingle();
  if (data?.nome) return data.nome as string;
  const evo = await evolution(admin);
  if (!evo) return null;
  const r = await fetch(`${evo.url}/group/findGroupInfos/${evo.inst}?groupJid=${encodeURIComponent(grupo)}`, { headers: { apikey: evo.apikey } }).catch(() => null);
  const j = r && r.ok ? ((await r.json().catch(() => null)) as { subject?: string } | null) : null;
  return j?.subject ?? null;
}

interface Recebida { id: string | null; grupo: string; grupoNome: string | null; autorTel: string; autorNome: string | null; texto: string; deMim: boolean }

/** Lê o webhook da Evolution (messages.upsert) ou da Z-API (ReceivedCallback); só mensagens de grupo. */
function lerWebhook(corpo: Json): Recebida | null {
  if (typeof corpo.event === "string") {
    if (!/messages[._]upsert/i.test(corpo.event)) return null;
    const d = (Array.isArray(corpo.data) ? corpo.data[0] : corpo.data) as Json | undefined;
    const key = (d?.key ?? {}) as Json;
    const jid = String(key.remoteJid ?? "");
    if (!jid.endsWith("@g.us")) return null;
    const m = (d?.message ?? {}) as Json;
    const texto = String(m.conversation ?? (m.extendedTextMessage as Json | undefined)?.text ?? (m.imageMessage as Json | undefined)?.caption ?? (m.videoMessage as Json | undefined)?.caption ?? "").trim()
      || (m.audioMessage ? "[áudio]" : m.imageMessage ? "[imagem]" : m.documentMessage ? `[documento] ${(m.documentMessage as Json).fileName ?? ""}`.trim() : m.videoMessage ? "[vídeo]" : "");
    const participante = String(key.participantAlt ?? key.participant ?? d?.participant ?? "");
    return { id: key.id ? String(key.id) : null, grupo: jid, grupoNome: null, autorTel: soDigitos(participante.split("@")[0]), autorNome: (d?.pushName as string) ?? null, texto, deMim: Boolean(key.fromMe) };
  }
  if (!corpo.isGroup || corpo.type !== "ReceivedCallback") return null;
  return {
    id: corpo.messageId ? String(corpo.messageId) : null,
    grupo: String(corpo.phone ?? ""),
    grupoNome: (corpo.chatName as string) ?? null,
    autorTel: soDigitos(corpo.participantPhone),
    autorNome: (corpo.senderName as string) ?? null,
    texto: String((corpo.text as { message?: string } | undefined)?.message ?? "").trim(),
    deMim: Boolean(corpo.fromMe),
  };
}

async function processar(admin: SupabaseClient, msg: Recebida) {
  const { grupo, autorTel, autorNome, texto } = msg;
  if (!texto) return;
  const grupoConfigurado = await segredo(admin, "whatsapp_grupo");
  if (msg.deMim && grupoConfigurado === grupo) return; // respostas e avisos do próprio sistema no grupo do time
  const grupoNome = await nomeDoGrupo(admin, grupo, msg.grupoNome);
  // Todo grupo novo entra na lista para ser ligado a um cliente em Integrações
  await admin.from("whatsapp_grupos").upsert({ grupo, ...(grupoNome ? { nome: grupoNome } : {}), atualizado_em: new Date().toISOString() }, { onConflict: "grupo", ignoreDuplicates: false });

  if (msg.deMim) {
    // Mensagem enviada pelo número da agência num grupo de cliente: guarda para saber que o cliente foi respondido
    await admin.from("whatsapp_mensagens").insert({ msg_id: msg.id, grupo, grupo_nome: grupoNome, autor_telefone: autorTel, autor_nome: "Vertente (número da agência)", papel: "agencia", texto: texto.slice(0, 4000) });
    return;
  }

  if (!grupoConfigurado || grupoConfigurado !== grupo) {
    // Grupos de clientes, parceria e suporte: guarda a conversa (base do resumo diário e dos pedidos sugeridos); não responde
    await admin.from("whatsapp_mensagens").insert({ msg_id: msg.id, grupo, grupo_nome: grupoNome, autor_telefone: autorTel, autor_nome: autorNome, papel: "grupo", texto: texto.slice(0, 4000) });
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

  const { error: dup } = await admin.from("whatsapp_mensagens").insert({ msg_id: msg.id, grupo, grupo_nome: grupoNome, membro_id: membro.id, autor_telefone: autorTel, autor_nome: autorNome, papel: "user", texto });
  if (dup) return; // webhook repetido

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

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

/** Administrador: aponta o webhook da Evolution para esta função e devolve o estado da conexão. */
async function configurar(admin: SupabaseClient, req: Request) {
  const responder = (c: Json, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u.user) return responder({ erro: "Faça login de novo." }, 401);
  const { data: m } = await admin.from("membros").select("papel").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).limit(1).maybeSingle();
  if (m?.papel !== "admin") return responder({ erro: "Só administradores." }, 403);
  const evo = await evolution(admin);
  if (!evo) return responder({ erro: "Salve o endereço, a chave e o nome da instância da Evolution primeiro." }, 412);
  const chave = await segredo(admin, "whatsapp_webhook_chave");
  const destino = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp?chave=${chave}`;
  const estado = await fetch(`${evo.url}/instance/connectionState/${evo.inst}`, { headers: { apikey: evo.apikey } }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) })).catch((e) => ({ ok: false, j: { erro: String(e) } }));
  if (!estado.ok) return responder({ erro: `Não consegui falar com a Evolution (${JSON.stringify(estado.j).slice(0, 160)}). Confira o endereço, a chave e o nome da instância.` }, 502);
  const w = await fetch(`${evo.url}/webhook/set/${evo.inst}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: evo.apikey },
    body: JSON.stringify({ webhook: { enabled: true, url: destino, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } }),
  });
  if (!w.ok) return responder({ erro: `A Evolution recusou o webhook: ${(await w.text()).slice(0, 200)}` }, 502);
  const conexao = ((estado.j as Json).instance as Json | undefined)?.state ?? (estado.j as Json).state ?? "desconhecido";
  return responder({ ok: true, conexao });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const chave = new URL(req.url).searchParams.get("chave");
  const corpo = (await req.json().catch(() => ({}))) as Json;
  if (!chave && corpo.acao === "configurar") return configurar(admin, req);

  const esperada = await segredo(admin, "whatsapp_webhook_chave");
  if (!esperada || chave !== esperada) return new Response("sem acesso", { status: 403 });

  const msg = lerWebhook(corpo);
  if (!msg) return new Response("ok");
  const tarefa = processar(admin, msg).catch((e) => console.error("whatsapp:", (e as Error).message));
  // Responde já para o provedor e segue processando em segundo plano
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(tarefa);
  else await tarefa;
  return new Response("ok");
});
