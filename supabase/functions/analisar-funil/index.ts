// Analisar funil do cliente: junta o resumo do dashboard (funil, taxas, comparativos, campanhas, criativos, Google)
// com análises mais profundas buscadas na Meta (idade e gênero, posicionamentos) e o contexto estratégico do cliente,
// e pede à IA um diagnóstico com pontos de quebra e sugestões. Guarda a análise em analises_ia.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const GRAPH = "https://graph.facebook.com/v23.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
type Json = Record<string, unknown>;

const n = (v: unknown) => Number(v ?? 0) || 0;
function acao(lista: unknown, ...tipos: string[]) {
  const l = (lista as { action_type: string; value: string }[] | undefined) ?? [];
  for (const t of tipos) {
    const a = l.find((x) => x.action_type === t);
    if (a) return n(a.value);
  }
  return 0;
}
const contatos = (row: Json) => acao(row.actions, "onsite_conversion.messaging_conversation_started_7d") + acao(row.actions, "leadgen_grouped");

async function insights(conta: string, params: Record<string, string>, token: string): Promise<Json[]> {
  const url = new URL(`${GRAPH}/act_${conta}/insights`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const j = (await (await fetch(url)).json()) as Json;
  if (j.error) throw new Error((j.error as { message?: string }).message ?? "Erro na Meta");
  return (j.data as Json[]) ?? [];
}

/** Recortes que o dashboard não mostra: idade e gênero, plataformas e posicionamentos, dispositivo. */
async function aprofundarMeta(contas: string[], inicio: string, fim: string, token: string) {
  const periodo = JSON.stringify({ since: inicio, until: fim });
  const campos = "spend,impressions,inline_link_clicks,actions";
  const juntar = async (breakdowns: string, chave: (r: Json) => string) => {
    const mapa = new Map<string, { gasto: number; impressoes: number; cliques: number; contatos: number }>();
    for (const c of contas) {
      const linhas = await insights(c, { level: "account", time_range: periodo, breakdowns, fields: campos, limit: "200" }, token).catch(() => []);
      for (const r of linhas) {
        const k = chave(r);
        const x = mapa.get(k) ?? { gasto: 0, impressoes: 0, cliques: 0, contatos: 0 };
        x.gasto += n(r.spend);
        x.impressoes += n(r.impressions);
        x.cliques += n(r.inline_link_clicks);
        x.contatos += contatos(r);
        mapa.set(k, x);
      }
    }
    return [...mapa.entries()]
      .map(([k, x]) => ({ recorte: k, ...x, gasto: Math.round(x.gasto * 100) / 100, custo_contato: x.contatos ? Math.round((x.gasto / x.contatos) * 100) / 100 : null, ctr: x.impressoes ? Math.round((x.cliques / x.impressoes) * 10000) / 100 : null }))
      .filter((x) => x.gasto > 0)
      .sort((a, b) => b.gasto - a.gasto)
      .slice(0, 14);
  };
  const [idadeGenero, posicionamentos, dispositivos] = await Promise.all([
    juntar("age,gender", (r) => `${r.age} ${r.gender === "female" ? "mulheres" : r.gender === "male" ? "homens" : "indefinido"}`),
    juntar("publisher_platform,platform_position", (r) => `${r.publisher_platform}/${r.platform_position}`),
    juntar("impression_device", (r) => String(r.impression_device)),
  ]);
  return { idade_genero: idadeGenero, posicionamentos, dispositivos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (c: Json, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u.user) return responder({ erro: "Faça login de novo no sistema." }, 401);
  const { data: membro } = await admin.from("membros").select("id").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
  if (!membro) return responder({ erro: "Sem acesso." }, 403);

  const corpo = (await req.json().catch(() => ({}))) as { cliente_id?: string; inicio?: string; fim?: string; resumo?: Json };
  const { cliente_id, inicio, fim, resumo } = corpo;
  if (!cliente_id || !inicio || !fim || !resumo) return responder({ erro: "Faltam dados para a análise." }, 400);
  const { data: cli } = await admin.from("clientes").select("nome, segmento, cidade").eq("id", cliente_id).maybeSingle();
  if (!cli) return responder({ erro: "Cliente não encontrado." }, 404);

  // Contexto estratégico: ficha e campos principais do briefing
  const { data: br } = await admin.from("briefings").select("campos").eq("cliente_id", cliente_id).maybeSingle();
  const campos = (br?.campos ?? {}) as Record<string, string>;
  const contexto = Object.entries(campos)
    .filter(([k, v]) => v && typeof v === "string" && v.trim() && !/estrategia_vertente/.test(k))
    .map(([k, v]) => `${k}: ${v.slice(0, 600)}`)
    .join("\n")
    .slice(0, 5000);

  // Análises mais profundas na Meta
  let profundo: Json = {};
  const { data: contas } = await admin.from("contas_anuncio").select("conta_id").eq("cliente_id", cliente_id).eq("plataforma", "meta").eq("ativa", true);
  const token = Deno.env.get("META_ACCESS_TOKEN") || ((await admin.rpc("ler_token_meta")).data as string | null);
  if (token && contas?.length) profundo = await aprofundarMeta(contas.map((c) => c.conta_id as string), inicio, fim, token).catch((e) => ({ erro: String(e) }));

  const chave = ((await admin.rpc("ler_segredo", { nome: "openai_api_key" })).data as string | null) ?? "";
  if (!chave) return responder({ erro: "Falta a chave da IA (OpenAI) em Integrações." }, 412);

  const pedido = `Você é o estrategista sênior de tráfego pago e funil comercial da Vertente Digital. Analise o funil completo do cliente "${cli.nome}"${cli.segmento ? ` (${cli.segmento}${cli.cidade ? `, ${cli.cidade}` : ""})` : ""} no período ${inicio} a ${fim}, comparado com o período anterior de mesmo tamanho.

Use SÓ os dados abaixo. Não invente números. Quando um dado faltar (ex.: vendas não lançadas), diga o que precisa ser coletado.

Entregue em português do Brasil, em Markdown, direto ao ponto, para o gestor de tráfego agir na semana:
## Diagnóstico em 3 linhas
## Onde o funil quebra
(etapa por etapa: taxa atual x anterior, o que provavelmente causa a queda — anúncio, público, página/atendimento, comercial — e o tamanho do impacto em vendas ou contatos perdidos)
## O que está funcionando
(campanhas, criativos, públicos, posicionamentos, palavras/termos que trazem contato barato ou venda; com números)
## O que não está funcionando
(onde há dinheiro gasto sem retorno; com números)
## Criativos
(padrões dos melhores e dos piores; o que testar a seguir — ângulos, formatos, ganchos)
## Públicos e posicionamentos
(idade, gênero, plataforma, posicionamento e dispositivo: onde concentrar e onde cortar)
## Google Ads
(só se houver dados: termos, palavras, parcela de impressões, conversões)
## Plano de ação (próximos 7 dias)
(5 a 8 ações priorizadas, cada uma com: o quê, por quê, impacto esperado e quem faz — Vertente ou cliente)
## Dados para pedir ao cliente
(o que falta lançar para fechar a leitura do funil)

Contexto estratégico do cliente (briefing):
${contexto || "(sem briefing preenchido)"}

Dados do dashboard (JSON):
${JSON.stringify(resumo).slice(0, 60000)}

Recortes da Meta no período (JSON):
${JSON.stringify(profundo).slice(0, 15000)}`;

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("ASSISTENTE_MODELO_OPENAI") || "gpt-5.5", input: pedido }),
  });
  const j = (await r.json()) as Json;
  if (!r.ok) return responder({ erro: (j.error as Json | undefined)?.message ?? "A IA não respondeu." }, 502);
  const texto = ((j.output as Json[]) ?? []).filter((o) => o.type === "message").flatMap((o) => (o.content as Json[]) ?? []).map((c) => c.text).join("\n").trim();
  if (!texto) return responder({ erro: "A IA voltou sem texto. Tente de novo." }, 502);

  const { data: salvo } = await admin.from("analises_ia").insert({ cliente_id, tipo: "funil", inicio, fim, texto, autor_id: membro.id }).select("id, criado_em").single();
  return responder({ ok: true, id: salvo?.id ?? null, criado_em: salvo?.criado_em ?? new Date().toISOString(), texto });
});
