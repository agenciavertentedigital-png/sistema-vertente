// Link de cadastro: o cliente abre sem login, vê o nome da empresa e preenche a própria ficha.
// GET ?token=… devolve os dados atuais; POST {token, dados} grava na ficha e avisa o time.
// Links do tipo "novo_cliente" (sem cliente ainda) criam o cliente no sistema com os dados enviados.
// Links do tipo "briefing" leem e gravam as perguntas do briefing que o cliente pode responder (nunca a parte interna).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const CAMPOS_BRIEFING = ["negocio_resumo", "produtos_carro_chefe", "ticket_medio", "area_atendimento", "sazonalidade", "persona", "dores_desejos", "objecoes", "diferenciais", "concorrentes", "tom_de_voz", "restricoes", "objetivo_principal", "metas_90_dias", "verba_midia", "atendimento_leads", "processo_venda", "conversao", "historico_marketing", "funcionou", "materiais"];
const CAMPOS = ["razao_social", "documento", "contato_nome", "contato_telefone", "contato_email", "endereco", "cidade", "segmento", "instagram", "site", "link_gmn"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const corpo = req.method === "POST" ? ((await req.json().catch(() => ({}))) as { token?: string; dados?: Record<string, unknown> }) : {};
  const token = (new URL(req.url).searchParams.get("token") ?? corpo.token ?? "").trim();
  if (!/^[a-f0-9]{32}$/.test(token)) return responder({ erro: "Link inválido." }, 400);

  const { data: link } = await admin.from("cadastro_links").select("token, cliente_id, expira_em, preenchido_em, tipo").eq("token", token).maybeSingle();
  if (!link) return responder({ erro: "Link não encontrado. Peça um novo para a Vertente." }, 404);
  if (new Date(link.expira_em) < new Date()) return responder({ erro: "Este link expirou. Peça um novo para a Vertente." }, 410);

  // Link de cliente novo: ainda não existe cadastro; ao enviar, o cliente é criado no sistema
  if (link.tipo === "novo_cliente" && !link.cliente_id) {
    if (req.method === "GET" || !corpo.dados) return responder({ ok: true, tipo: "novo_cliente", nome: "", dados: {}, preenchido_em: null });
    const nomeNovo = typeof corpo.dados.nome === "string" ? corpo.dados.nome.trim().slice(0, 120) : "";
    if (nomeNovo.length < 2) return responder({ erro: "Informe o nome da empresa." }, 400);
    const novo: Record<string, string | null> = { nome: nomeNovo };
    for (const c of CAMPOS) {
      const v = corpo.dados[c];
      if (typeof v === "string") novo[c] = v.trim().slice(0, 300) || null;
    }
    // trava o link antes de criar, para dois envios ao mesmo tempo não criarem dois clientes
    const { data: trava } = await admin.from("cadastro_links").update({ preenchido_em: new Date().toISOString() }).eq("token", token).is("cliente_id", null).is("preenchido_em", null).select("token");
    if (!trava?.length) return responder({ erro: "Este cadastro já foi enviado. Se precisar corrigir algo, fale com a Vertente." }, 409);
    const { data: criado, error } = await admin.from("clientes").insert({ ...novo, status: "ativo", origem: "vertente" }).select("id").single();
    if (error || !criado) {
      await admin.from("cadastro_links").update({ preenchido_em: null }).eq("token", token);
      return responder({ erro: "Não foi possível salvar. Tente de novo." }, 500);
    }
    await admin.from("cadastro_links").update({ cliente_id: criado.id, tipo: "cadastro", respostas: novo }).eq("token", token);
    // guarda o nome no apelido para a lista de links continuar mostrando que foi um cliente novo
    await admin.from("cadastro_links").update({ apelido: nomeNovo }).eq("token", token).is("apelido", null);
    const { data: time } = await admin.from("membros").select("id").eq("ativo", true).eq("acesso", true);
    if (time?.length) {
      await admin.from("notificacoes").insert(time.map((m) => ({ membro_id: m.id, tipo: "alerta", texto: `Novo cliente cadastrado pelo link: ${nomeNovo}`, cliente_id: criado.id })));
    }
    return responder({ ok: true, novo: true });
  }

  const { data: cliente } = await admin.from("clientes").select(`nome, ${CAMPOS.join(", ")}`).eq("id", link.cliente_id).single();
  if (!cliente) return responder({ erro: "Cliente não encontrado." }, 404);
  const nomeCliente = (cliente as unknown as { nome: string }).nome;

  if (link.tipo === "briefing") {
    const { data: b } = await admin.from("briefings").select("id, campos").eq("cliente_id", link.cliente_id).maybeSingle();
    const atuais = (b?.campos ?? {}) as Record<string, string>;
    if (req.method === "GET" || !corpo.dados) {
      return responder({ ok: true, tipo: "briefing", nome: nomeCliente, dados: Object.fromEntries(CAMPOS_BRIEFING.map((c) => [c, atuais[c] ?? ""])), preenchido_em: link.preenchido_em });
    }
    const respostas: Record<string, string> = {};
    for (const c of CAMPOS_BRIEFING) {
      const v = corpo.dados[c];
      if (typeof v === "string") respostas[c] = v.trim().slice(0, 3000);
    }
    const campos = { ...atuais, ...respostas };
    const agora = new Date().toISOString();
    const r = b
      ? await admin.from("briefings").update({ campos, respondido_cliente_em: agora }).eq("id", b.id)
      : await admin.from("briefings").insert({ cliente_id: link.cliente_id, campos, respondido_cliente_em: agora });
    if (r.error) return responder({ erro: "Não foi possível salvar. Tente de novo." }, 500);
    await admin.from("cadastro_links").update({ preenchido_em: agora, respostas }).eq("token", token);
    const { data: time } = await admin.from("membros").select("id").eq("ativo", true).eq("acesso", true);
    if (time?.length) {
      await admin.from("notificacoes").insert(time.map((m) => ({ membro_id: m.id, tipo: "alerta", texto: `${nomeCliente} respondeu o briefing`, cliente_id: link.cliente_id })));
    }
    return responder({ ok: true });
  }

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
