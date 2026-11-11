// Gestor Otimizador: com o período escolhido no dashboard do cliente, a IA lê campanhas, públicos, criativos,
// recortes da Meta, Google, conquistas e otimizações recentes e entrega DUAS coisas:
//  1) análise completa com melhorias → vira anotação na pasta "Estratégia" do cliente;
//  2) "Análise de Campanhas" positiva (resultados e conquistas) → fica no fim do dashboard (analises_ia tipo 'campanhas').
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

const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (c: Json, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u.user) return responder({ erro: "Faça login de novo no sistema." }, 401);
  const { data: membro } = await admin.from("membros").select("id").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
  if (!membro) return responder({ erro: "Sem acesso." }, 403);

  const { cliente_id, inicio, fim, resumo } = (await req.json().catch(() => ({}))) as { cliente_id?: string; inicio?: string; fim?: string; resumo?: Json };
  if (!cliente_id || !inicio || !fim || !resumo) return responder({ erro: "Faltam dados para a análise." }, 400);
  const { data: cli } = await admin.from("clientes").select("nome, segmento, cidade").eq("id", cliente_id).maybeSingle();
  if (!cli) return responder({ erro: "Cliente não encontrado." }, 404);

  const [{ data: br }, { data: contas }, { data: regs }] = await Promise.all([
    admin.from("briefings").select("campos").eq("cliente_id", cliente_id).maybeSingle(),
    admin.from("contas_anuncio").select("conta_id").eq("cliente_id", cliente_id).eq("plataforma", "meta").eq("ativa", true),
    admin.from("registros").select("tipo, data, nota, acoes").eq("cliente_id", cliente_id).in("tipo", ["conquista", "otimizacao"]).gte("data", inicio).lte("data", fim).order("data").limit(60),
  ]);
  const campos = (br?.campos ?? {}) as Record<string, string>;
  const contexto = Object.entries(campos).filter(([, v]) => v && typeof v === "string" && v.trim()).map(([k, v]) => `${k}: ${v.slice(0, 600)}`).join("\n").slice(0, 5000);
  const conquistas = ((regs ?? []) as { tipo: string; data: string; nota: string | null }[]).filter((r) => r.tipo === "conquista" && r.nota?.trim()).map((r) => `${dataBR(r.data)}: ${r.nota}`);
  const otimizacoes = ((regs ?? []) as { tipo: string; data: string; nota: string | null; acoes: string[] | null }[]).filter((r) => r.tipo === "otimizacao").map((r) => `${dataBR(r.data)}: ${[...(r.acoes ?? []), r.nota].filter(Boolean).join("; ")}`).slice(-25);

  let profundo: Json = {};
  const token = Deno.env.get("META_ACCESS_TOKEN") || ((await admin.rpc("ler_token_meta")).data as string | null);
  if (token && contas?.length) profundo = await aprofundarMeta(contas.map((c) => c.conta_id as string), inicio, fim, token).catch((e) => ({ erro: String(e) }));

  const chave = ((await admin.rpc("ler_segredo", { nome: "openai_api_key" })).data as string | null) ?? "";
  if (!chave) return responder({ erro: "Falta a chave da IA (OpenAI) em Integrações." }, 412);

  const pedido = `Você é o GESTOR OTIMIZADOR da Vertente Digital, gestor de tráfego sênior. Cliente: "${cli.nome}"${cli.segmento ? ` (${cli.segmento}${cli.cidade ? `, ${cli.cidade}` : ""})` : ""}. Período: ${dataBR(inicio)} a ${dataBR(fim)}, comparado com o período anterior de mesmo tamanho.

Use SÓ os dados abaixo. Não invente números. Português do Brasil, Markdown.
ESTILO: curto, simples e objetivo. Frases curtas, bullets de uma linha, sem introduções, sem repetir números, sem jargão desnecessário. Só o que muda decisão. Se uma seção não tiver nada relevante, omita a seção.

Entregue DUAS PARTES, exatamente com estes marcadores em linhas próprias:

===ESTRATEGIA===
(Documento interno para o time. Máximo de ~250 palavras no total.)
## Resumo
(2 linhas: como foi o período e o número principal x período anterior)
## O que funciona
(até 3 bullets: campanha, público ou criativo que traz resultado barato, com o número)
## O que corrigir
(até 3 bullets: onde há dinheiro gasto sem retorno ou piora relevante, com o número)
## Próximas ações
(3 a 5 ações numeradas, por prioridade, uma linha cada: o quê + por quê + quem faz — Vertente ou cliente)

===CLIENTE===
(Texto "Análise de Campanhas" para o dashboard, que pode ser mostrado ao cliente. Máximo de ~120 palavras. Tom POSITIVO, profissional e honesto, linguagem simples para quem não é da área. 1 parágrafo curto sobre o resultado do período, citando pequenas conquistas se houver, e depois "### Destaques do período" com 3 bullets curtos com números. Se algo piorou, no máximo 1 frase como próximo passo de melhoria. Sem críticas ao cliente e sem expor problemas internos.)

Contexto do cliente (briefing):
${contexto || "(sem briefing preenchido)"}

Pequenas conquistas registradas no período:
${conquistas.join("\n") || "(nenhuma registrada)"}

Otimizações feitas pela Vertente no período:
${otimizacoes.join("\n") || "(nenhuma registrada)"}

Dados do dashboard (campanhas, anúncios com conjunto/público, diário, Google, funil) em JSON:
${JSON.stringify(resumo).slice(0, 60000)}

Recortes da Meta (idade e gênero, posicionamentos, dispositivos) em JSON:
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
  const iE = texto.indexOf("===ESTRATEGIA==="), iC = texto.indexOf("===CLIENTE===");
  const estrategia = (iE >= 0 ? texto.slice(iE + 16, iC > iE ? iC : undefined) : iC > 0 ? texto.slice(0, iC) : texto).trim();
  const positiva = (iC >= 0 ? texto.slice(iC + 13, iE > iC ? iE : undefined) : "").trim();

  // 1) Anotação na pasta "Estratégia" do cliente
  let { data: pasta } = await admin.from("pastas").select("id").eq("cliente_id", cliente_id).is("pai_id", null).ilike("nome", "estrat%").limit(1).maybeSingle();
  if (!pasta) pasta = (await admin.from("pastas").insert({ cliente_id, nome: "Estratégia", ordem: 0 }).select("id").single()).data;
  const titulo = `Gestor Otimizador · ${dataBR(inicio).slice(0, 5)} a ${dataBR(fim)}`;
  const { data: nota, error: eNota } = await admin.from("notas").insert({ cliente_id, titulo, texto: estrategia, etiqueta: "estrategia", autor_id: membro.id, pasta_id: pasta?.id ?? null }).select("id").single();
  if (eNota) return responder({ erro: `Não salvei a anotação: ${eNota.message}` }, 500);

  // 2) Análise de Campanhas (positiva) no dashboard
  let analise: Json | null = null;
  if (positiva) {
    const { data } = await admin.from("analises_ia").insert({ cliente_id, tipo: "campanhas", inicio, fim, texto: positiva, autor_id: membro.id }).select("id, inicio, fim, texto, criado_em").single();
    analise = data as Json | null;
  }
  return responder({ ok: true, nota_id: nota?.id, pasta: "Estratégia", titulo, analise });
});
