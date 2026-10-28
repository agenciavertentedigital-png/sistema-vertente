// Link de cadastro: o cliente abre sem login, vê o nome da empresa e preenche a própria ficha.
// GET ?token=… devolve os dados atuais; POST {token, dados} grava na ficha e avisa o time.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const CAMPOS = ["razao_social", "documento", "contato_nome", "contato_telefone", "contato_email", "endereco", "cidade", "segmento", "instagram", "site", "link_gmn"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const corpo = req.method === "POST" ? ((await req.json().catch(() => ({}))) as { token?: string; dados?: Record<string, unknown> }) : {};
  const token = (new URL(req.url).searchParams.get("token") ?? corpo.token ?? "").trim();
  if (!/^[a-f0-9]{32}$/.test(token)) return responder({ erro: "Link inválido." }, 400);

  const { data: link } = await admin.from("cadastro_links").select("token, cliente_id, expira_em, preenchido_em").eq("token", token).maybeSingle();
  if (!link) return responder({ erro: "Link não encontrado. Peça um novo para a Vertente." }, 404);
  if (new Date(link.expira_em) < new Date()) return responder({ erro: "Este link expirou. Peça um novo para a Vertente." }, 410);

  const { data: cliente } = await admin.from("clientes").select(`nome, ${CAMPOS.join(", ")}`).eq("id", link.cliente_id).single();
  if (!cliente) return responder({ erro: "Cliente não encontrado." }, 404);
  const nomeCliente = (cliente as unknown as { nome: string }).nome;

  if (req.method === "GET" || !corpo.dados) return responder({ ok: true, nome: nomeCliente, dados: cliente, preenchido_em: link.preenchido_em });

  const limpo: Record<string, string | null> = {};
  for (const c of CAMPOS) {
    const v = corpo.dados[c];
    if (typeof v === "string") limpo[c] = v.trim().slice(0, 300) || null;
  }
  const { error } = await admin.from("clientes").update(limpo).eq("id", link.cliente_id);
  if (error) return responder({ erro: "Não foi possível salvar. Tente de novo." }, 500);
  await admin.from("cadastro_links").update({ preenchido_em: new Date().toISOString(), respostas: limpo }).eq("token", token);

  const { data: time } = await admin.from("membros").select("id").eq("ativo", true).eq("acesso", true);
  if (time?.length) {
    await admin.from("notificacoes").insert(time.map((m) => ({ membro_id: m.id, tipo: "alerta", texto: `${nomeCliente} preencheu o cadastro`, cliente_id: link.cliente_id })));
  }
  return responder({ ok: true });
});
