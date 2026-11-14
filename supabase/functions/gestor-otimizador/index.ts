// Gestor Otimizador (botão "Otimizar" do dashboard): análise COMPLETA de gestor sênior. Lê campanhas, conjuntos
// (público, orçamento, segmentação), criativos, recortes da Meta (idade/gênero, posicionamento, dispositivo, horário),
// período anterior por campanha, mudanças recentes na conta, funil do cliente, Google, conquistas, otimizações e a
// análise anterior — e entrega DUAS coisas:
// (A revisão diária, curta e objetiva, é outra função: agente-trafego.)
//  1) análise completa com melhorias → vira anotação na pasta "Estratégia" do cliente;
//  2) "Análise de Campanhas" positiva (resultados e conquistas) → fica no fim do dashboard (analises_ia tipo 'campanhas').
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { marked } from "npm:marked@14.1.4";

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
      .slice(0, 24);
  };
  const [idadeGenero, posicionamentos, dispositivos, horarios] = await Promise.all([
    juntar("age,gender", (r) => `${r.age} ${r.gender === "female" ? "mulheres" : r.gender === "male" ? "homens" : "indefinido"}`),
    juntar("publisher_platform,platform_position", (r) => `${r.publisher_platform}/${r.platform_position}`),
    juntar("impression_device", (r) => String(r.impression_device)),
    juntar("hourly_stats_aggregated_by_advertiser_time_zone", (r) => String(r.hourly_stats_aggregated_by_advertiser_time_zone ?? "").slice(0, 2) + "h"),
  ]);
  return { idade_genero: idadeGenero, posicionamentos, dispositivos, horarios: horarios.sort((a, b) => a.recorte.localeCompare(b.recorte)) };
}


/** Conjuntos de anúncios ativos/recentes com público, orçamento e otimização + números do período. */
async function conjuntosMeta(contas: string[], inicio: string, fim: string, token: string) {
  const periodo = JSON.stringify({ since: inicio, until: fim });
  const saida: Json[] = [];
  for (const c of contas) {
    const url = new URL(`${GRAPH}/act_${c}/adsets`);
    url.searchParams.set("fields", "name,effective_status,daily_budget,lifetime_budget,optimization_goal,bid_strategy,destination_type,campaign{name,objective,daily_budget,lifetime_budget},targeting{age_min,age_max,genders,geo_locations,flexible_spec,custom_audiences,excluded_custom_audiences,targeting_automation,publisher_platforms}");
    url.searchParams.set("filtering", JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED"] }]));
    url.searchParams.set("limit", "60");
    url.searchParams.set("access_token", token);
    const j = (await (await fetch(url)).json().catch(() => ({}))) as Json;
    const conf = new Map(((j.data as Json[]) ?? []).map((a) => [String(a.id), a]));
    const nums = await insights(c, { level: "adset", time_range: periodo, fields: "adset_id,adset_name,spend,impressions,reach,frequency,inline_link_clicks,actions,cpm", limit: "200" }, token).catch(() => []);
    for (const r of nums) {
      const a = (conf.get(String(r.adset_id)) ?? {}) as Json;
      const t = (a.targeting ?? {}) as Json;
      const geo = (t.geo_locations ?? {}) as Json;
      const cont = contatos(r);
      saida.push({
        conjunto: r.adset_name, campanha: (a.campaign as Json | undefined)?.name, objetivo: (a.campaign as Json | undefined)?.objective, status: a.effective_status,
        orcamento_dia: a.daily_budget ? n(a.daily_budget) / 100 : (a.campaign as Json | undefined)?.daily_budget ? n((a.campaign as Json).daily_budget) / 100 + " (CBO)" : null,
        otimizacao: a.optimization_goal, lance: a.bid_strategy, destino: a.destination_type,
        publico: {
          idade: t.age_min ? `${t.age_min}-${t.age_max ?? "65+"}` : null, generos: t.genders ?? "todos",
          local: [...((geo.cities as Json[]) ?? []).map((x) => `${x.name}${x.radius ? ` +${x.radius}${x.distance_unit === "kilometer" ? "km" : "mi"}` : ""}`), ...((geo.regions as Json[]) ?? []).map((x) => x.name), ...((geo.custom_locations as Json[]) ?? []).map((x) => `raio ${x.radius}${x.distance_unit === "kilometer" ? "km" : "mi"}`)].slice(0, 8),
          interesses: ((t.flexible_spec as Json[]) ?? []).flatMap((f) => Object.values(f).flat() as Json[]).map((x) => x?.name).filter(Boolean).slice(0, 12),
          personalizados: ((t.custom_audiences as Json[]) ?? []).map((x) => x.name).slice(0, 6),
          excluidos: ((t.excluded_custom_audiences as Json[]) ?? []).map((x) => x.name).slice(0, 6),
          advantage: (t.targeting_automation as Json | undefined)?.advantage_audience ? "Advantage+ público ligado" : null,
        },
        gasto: Math.round(n(r.spend) * 100) / 100, alcance: n(r.reach), frequencia: Math.round(n(r.frequency) * 100) / 100, cpm: Math.round(n(r.cpm) * 100) / 100,
        cliques: n(r.inline_link_clicks), ctr: n(r.impressions) ? Math.round((n(r.inline_link_clicks) / n(r.impressions)) * 10000) / 100 : null,
        contatos: cont, custo_contato: cont ? Math.round((n(r.spend) / cont) * 100) / 100 : null,
      });
    }
  }
  return saida.sort((a, b) => n(b.gasto) - n(a.gasto)).slice(0, 30);
}

/** Campanhas no período anterior (para comparar campanha a campanha). */
async function campanhasAnteriores(contas: string[], inicio: string, fim: string, token: string) {
  const periodo = JSON.stringify({ since: inicio, until: fim });
  const saida: Json[] = [];
  for (const c of contas) {
    const nums = await insights(c, { level: "campaign", time_range: periodo, fields: "campaign_name,spend,impressions,frequency,inline_link_clicks,actions", limit: "100" }, token).catch(() => []);
    for (const r of nums) {
      const cont = contatos(r);
      saida.push({ campanha: r.campaign_name, gasto: Math.round(n(r.spend) * 100) / 100, contatos: cont, custo_contato: cont ? Math.round((n(r.spend) / cont) * 100) / 100 : null, ctr: n(r.impressions) ? Math.round((n(r.inline_link_clicks) / n(r.impressions)) * 10000) / 100 : null, frequencia: Math.round(n(r.frequency) * 100) / 100 });
    }
  }
  return saida.filter((x) => n(x.gasto) > 0).sort((a, b) => n(b.gasto) - n(a.gasto)).slice(0, 25);
}

const somarDias = (d: string, k: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };

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

  // Período anterior de mesmo tamanho
  const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) + 1;
  const antFim = somarDias(inicio, -1), antIni = somarDias(inicio, -dias);

  let profundo: Json = {};
  let conjuntos: Json[] = [];
  let anteriores: Json[] = [];
  const token = Deno.env.get("META_ACCESS_TOKEN") || ((await admin.rpc("ler_token_meta")).data as string | null);
  if (token && contas?.length) {
    const ids = contas.map((c) => c.conta_id as string);
    [profundo, conjuntos, anteriores] = await Promise.all([
      aprofundarMeta(ids, inicio, fim, token).catch((e) => ({ erro: String(e) })),
      conjuntosMeta(ids, inicio, fim, token).catch(() => []),
      campanhasAnteriores(ids, antIni, antFim, token).catch(() => []),
    ]);
  }

  // Mudanças feitas na conta (Meta) do período anterior até agora, e a última análise do Otimizador
  const [{ data: mudancas }, { data: ultima }] = await Promise.all([
    admin.from("meta_atividades").select("quando, evento_texto, objeto_nome").eq("cliente_id", cliente_id).eq("automatico", false).gte("quando", `${antIni}T00:00:00-03:00`).order("quando", { ascending: false }).limit(40),
    admin.from("notas").select("titulo, texto, criado_em").eq("cliente_id", cliente_id).ilike("titulo", "Gestor Otimizador%").order("criado_em", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const listaMudancas = ((mudancas ?? []) as { quando: string; evento_texto: string | null; objeto_nome: string | null }[]).map((m) => `${dataBR(m.quando.slice(0, 10))}: ${m.evento_texto ?? ""}${m.objeto_nome ? ` — ${m.objeto_nome}` : ""}`);

  const chave = ((await admin.rpc("ler_segredo", { nome: "openai_api_key" })).data as string | null) ?? "";
  if (!chave) return responder({ erro: "Falta a chave da IA (OpenAI) em Integrações." }, 412);

  const pedido = `Você é o GESTOR OTIMIZADOR da Vertente Digital: um gestor de tráfego sênior (Meta Ads e Google Ads) especialista em negócios locais, fazendo uma análise PROFUNDA de otimização para o time da agência.
Cliente: "${cli.nome}"${cli.segmento ? ` (${cli.segmento}${cli.cidade ? `, ${cli.cidade}` : ""})` : ""}. Período: ${dataBR(inicio)} a ${dataBR(fim)} (${dias} dias), comparado com ${dataBR(antIni)} a ${dataBR(antFim)}.

REGRAS
- Use SÓ os dados abaixo. Nunca invente números. Quando um dado faltar, diga o que conferir no Gerenciador.
- Seja específico: cite campanha, conjunto, público ou anúncio pelo nome e sempre com o número que sustenta a conclusão.
- Pense como dono do resultado do cliente: o objetivo é mais contatos/vendas pelo menor custo, sem perder volume.
- Considere o objetivo de cada campanha (mensagens, cadastro, tráfego, reconhecimento, vendas): não compare custo de objetivos diferentes como se fossem iguais.
- Leve em conta as mudanças recentes: algo alterado há menos de 3–5 dias pode estar em aprendizado; não recomende mexer de novo sem motivo.
- Benchmarks de referência para negócio local (use com bom senso): CTR de link 1%+ bom, abaixo de 0,6% fraco; frequência acima de 3 em 7–14 dias indica saturação; CPM muito acima do período anterior indica leilão caro ou público estreito.
- Português do Brasil, Markdown com títulos, bullets e tabelas quando ajudar. Direto, mas COMPLETO. Sem enrolação e sem introdução genérica.

Entregue DUAS PARTES, exatamente com estes marcadores em linhas próprias:

===ESTRATEGIA===
(Documento interno completo para o time.)
## 1. Diagnóstico geral
Nota de 0 a 10 para a conta no período e por quê. Tabela com os principais números (investimento, contatos/resultados, custo por resultado, CTR, CPM, frequência) — atual x anterior x variação. 2–3 linhas de leitura.
## 2. Mudanças recentes e impacto
O que foi alterado (lista de mudanças e otimizações registradas) e o efeito visível nos números depois de cada mudança. O que ainda está em aprendizado. Se houver análise anterior do Otimizador, diga o que dela foi feito e o que ficou pendente.
## 3. Funil do cliente
Etapa a etapa (impressão → clique → contato → atendimento/venda, conforme os dados do funil e valores lançados): taxas de passagem, onde está o maior vazamento e se o problema é de anúncio, de oferta/página ou de atendimento comercial do cliente.
## 4. Campanhas por objetivo
Para cada campanha relevante: objetivo, investimento, resultado, custo, comparação com o período anterior e veredito (escalar / manter / ajustar / pausar), com o motivo.
## 5. Públicos e segmentação
O que cada conjunto está segmentando (idade, local, interesses, personalizados, Advantage+) e qual performa melhor. Leitura de idade/gênero, posicionamentos, dispositivos e horários. Sugira 3 a 5 PÚBLICOS NOVOS para testar (interesses, lookalike/semelhante de quem conversou ou comprou, remarketing de engajamento/vídeo/visitantes, raio/local), explicando para qual campanha e por quê.
## 6. Criativos
Melhores e piores anúncios com números (CTR, custo por resultado). Sinais de fadiga (frequência alta, CTR caindo). Sugira 3 ideias de criativos novos com ângulo e gancho para este negócio.
## 7. Problemas encontrados
Tudo o que está desperdiçando dinheiro ou travando resultado, por gravidade (🔴 alta, 🟡 média), com o valor gasto sem retorno quando possível.
## 8. Escala
Onde colocar mais verba e como: quanto aumentar (ex.: +20–30% a cada 3 dias), duplicar conjunto vencedor, abrir novo público, expandir raio/posicionamento, CBO x ABO. Diga o limite de segurança (quando parar de escalar).
## 9. Redução de custos
Cortes e ajustes que baixam o custo por resultado: pausar anúncios/conjuntos ruins, excluir posicionamentos, idades ou horários caros, ajustar lance/otimização, palavras negativas no Google. Estime a economia quando os dados permitirem.
## 10. Google Ads
(Só se houver dados do Google) parcela de impressões, perda por orçamento/ranking, termos de pesquisa bons e ruins, palavras negativas sugeridas, ajustes de lance.
## 11. Plano de ação
Tabela priorizada: # | Ação | Por quê (com número) | Impacto esperado (alto/médio/baixo) | Quem (Vertente ou cliente) | Quando (hoje / esta semana / próximo ciclo).
De 6 a 12 ações, das mais urgentes para as menos.
## 12. O que acompanhar
Os 3–5 números a vigiar nos próximos dias e o gatilho de cada um (ex.: "se o custo por conversa passar de R$ X, pausar o conjunto Y").

Omita uma seção só se não houver nenhum dado para ela (diga em 1 linha o que falta).

===CLIENTE===
(Texto "Análise de Campanhas" para o dashboard, que pode ser mostrado ao cliente. Máximo de ~150 palavras. Tom POSITIVO, profissional e honesto, linguagem simples para quem não é da área. 1 parágrafo curto sobre o resultado do período, citando pequenas conquistas se houver, e depois "### Destaques do período" com 3 a 4 bullets curtos com números. Se algo piorou, no máximo 1 frase como próximo passo de melhoria. Sem críticas ao cliente e sem expor problemas internos.)

DADOS

Contexto do cliente (briefing / ficha estratégica):
${contexto || "(sem briefing preenchido)"}

Pequenas conquistas registradas no período:
${conquistas.join("\n") || "(nenhuma registrada)"}

Otimizações registradas pela Vertente no período:
${otimizacoes.join("\n") || "(nenhuma registrada)"}

Mudanças feitas na conta da Meta (desde o início do período anterior):
${listaMudancas.join("\n").slice(0, 5000) || "(nenhuma encontrada)"}

Última análise do Gestor Otimizador${ultima ? ` (${(ultima as { titulo: string }).titulo})` : ""}:
${ultima ? String((ultima as { texto: string }).texto ?? "").slice(0, 4000) : "(nenhuma anterior)"}

Dados do dashboard (funil, indicadores atual x anterior, campanhas, anúncios com conjunto/texto, diário, Google) em JSON:
${JSON.stringify(resumo).slice(0, 60000)}

Conjuntos de anúncios da Meta (público, orçamento, otimização e números do período) em JSON:
${JSON.stringify(conjuntos).slice(0, 25000)}

Campanhas da Meta no período anterior (para comparar) em JSON:
${JSON.stringify(anteriores).slice(0, 8000)}

Recortes da Meta no período (idade e gênero, posicionamentos, dispositivos, horários) em JSON:
${JSON.stringify(profundo).slice(0, 15000)}`;

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("ASSISTENTE_MODELO_OPENAI") || "gpt-5.5", input: pedido, reasoning: { effort: "medium" } }),
  });
  let j = (await r.json()) as Json;
  if (!r.ok && /reasoning/i.test(String((j.error as Json | undefined)?.message ?? ""))) {
    const r2 = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: Deno.env.get("ASSISTENTE_MODELO_OPENAI") || "gpt-5.5", input: pedido }) });
    j = (await r2.json()) as Json;
    if (!r2.ok) return responder({ erro: (j.error as Json | undefined)?.message ?? "A IA não respondeu." }, 502);
  } else if (!r.ok) return responder({ erro: (j.error as Json | undefined)?.message ?? "A IA não respondeu." }, 502);
  const texto = ((j.output as Json[]) ?? []).filter((o) => o.type === "message").flatMap((o) => (o.content as Json[]) ?? []).map((c) => c.text).join("\n").trim();
  if (!texto) return responder({ erro: "A IA voltou sem texto. Tente de novo." }, 502);
  const iE = texto.indexOf("===ESTRATEGIA==="), iC = texto.indexOf("===CLIENTE===");
  const estrategia = (iE >= 0 ? texto.slice(iE + 16, iC > iE ? iC : undefined) : iC > 0 ? texto.slice(0, iC) : texto).trim();
  const positiva = (iC >= 0 ? texto.slice(iC + 13, iE > iC ? iE : undefined) : "").trim();

  // 1) Anotação na pasta "Estratégia" do cliente
  let { data: pasta } = await admin.from("pastas").select("id").eq("cliente_id", cliente_id).is("pai_id", null).ilike("nome", "estrat%").limit(1).maybeSingle();
  if (!pasta) pasta = (await admin.from("pastas").insert({ cliente_id, nome: "Estratégia", ordem: 0 }).select("id").single()).data;
  const titulo = `Gestor Otimizador · ${dataBR(inicio).slice(0, 5)} a ${dataBR(fim)}`;
  const { data: nota, error: eNota } = await admin.from("notas").insert({ cliente_id, titulo, texto: estrategia, conteudo: await marked.parse(estrategia, { gfm: true }), etiqueta: "estrategia", autor_id: membro.id, pasta_id: pasta?.id ?? null }).select("id").single();
  if (eNota) return responder({ erro: `Não salvei a anotação: ${eNota.message}` }, 500);

  // 2) Análise de Campanhas (positiva) no dashboard
  let analise: Json | null = null;
  if (positiva) {
    const { data } = await admin.from("analises_ia").insert({ cliente_id, tipo: "campanhas", inicio, fim, texto: positiva, autor_id: membro.id }).select("id, inicio, fim, texto, criado_em").single();
    analise = data as Json | null;
  }
  return responder({ ok: true, nota_id: nota?.id, pasta: "Estratégia", titulo, analise });
});
