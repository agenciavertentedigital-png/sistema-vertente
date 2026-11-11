// Agente Gestor de Tráfego (IA): faz as Revisões diárias como um membro do time.
// A cada rodada pega até 4 revisões abertas do agente (prazo até hoje), analisa os números da Meta/Google
// guardados no sistema, comenta o checklist com análise e ideias, registra a revisão (ok/atenção/problema)
// e conclui a tarefa (a próxima da rotina nasce sozinha).
// POST { } com x-chave-cron  → rodada agendada
// POST { tarefa_id }          → um administrador roda uma revisão agora (login do sistema)
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-chave-cron" };
type Json = Record<string, unknown>;
export const EMAIL_AGENTE = "agente.trafego@agenciavertente.com.br";
const somarDias = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const hojeBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (c: Json, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const corpo = (await req.json().catch(() => ({}))) as Json;

  // Quem chama
  const chaveCron = req.headers.get("x-chave-cron");
  if (chaveCron) {
    const { data } = await admin.rpc("validar_chave_cron", { chave: chaveCron });
    if (!data) return responder({ erro: "Chave inválida." }, 401);
  } else {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u.user) return responder({ erro: "Faça login de novo no sistema." }, 401);
    const { data: eu } = await admin.from("membros").select("id, papel").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
    if (!eu || (eu as { papel: string }).papel !== "admin") return responder({ erro: "Só administradores rodam o agente manualmente." }, 403);
    if (!corpo.tarefa_id) return responder({ erro: "Informe a tarefa." }, 400);
  }

  const { data: agente } = await admin.from("membros").select("id, nome").eq("email", EMAIL_AGENTE).maybeSingle();
  if (!agente) return responder({ erro: "O Agente de Tráfego ainda não foi cadastrado." }, 412);
  const chaveIA = ((await admin.rpc("ler_segredo", { nome: "openai_api_key" })).data as string | null) ?? "";
  if (!chaveIA) return responder({ erro: "Falta a chave da OpenAI em Integrações." }, 412);
  const hoje = hojeBR();

  // Revisões a fazer (pega e marca como "Fazendo" para nenhuma outra rodada pegar a mesma)
  const { data: rotina } = await admin.from("rotinas").select("id").ilike("nome", "revis%di%").limit(1).maybeSingle();
  let alvo: { id: string; cliente_id: string; titulo: string }[] = [];
  if (corpo.tarefa_id) {
    const { data } = await admin.from("tarefas").select("id, cliente_id, titulo").eq("id", String(corpo.tarefa_id)).in("status", ["a_fazer", "fazendo"]).limit(1);
    alvo = (data ?? []) as typeof alvo;
  } else {
    const { data: crs } = await admin.from("cliente_rotinas").select("id").eq("rotina_id", (rotina as { id: string } | null)?.id ?? "").eq("ativa", true);
    const ids = ((crs ?? []) as { id: string }[]).map((x) => x.id);
    if (ids.length) {
      const { data } = await admin.from("tarefas").select("id, cliente_id, titulo, status, atualizado_em")
        .in("cliente_rotina_id", ids).eq("responsavel_id", (agente as { id: string }).id).lte("prazo", hoje).in("status", ["a_fazer", "fazendo"]).order("prazo").limit(12);
      const vinte = Date.now() - 20 * 60_000;
      alvo = ((data ?? []) as { id: string; cliente_id: string; titulo: string; status: string; atualizado_em?: string }[])
        .filter((t) => t.status === "a_fazer" || (t.atualizado_em && Date.parse(t.atualizado_em) < vinte)).slice(0, 4);
    }
  }
  if (!alvo.length) return responder({ ok: true, feitas: 0 });
  await admin.from("tarefas").update({ status: "fazendo" }).in("id", alvo.map((t) => t.id));

  const resultados = await Promise.all(alvo.map((t) => revisar(t).catch((e) => ({ tarefa: t.id, erro: (e as Error).message }))));
  return responder({ ok: true, feitas: resultados.filter((r) => !("erro" in r)).length, resultados });

  // ------------------------------------------------------------------
  async function revisar(t: { id: string; cliente_id: string; titulo: string }) {
    const agenteId = (agente as { id: string }).id;
    const [{ data: cli }, { data: contas }, { data: check }, { data: brief }] = await Promise.all([
      admin.from("clientes").select("nome").eq("id", t.cliente_id).maybeSingle(),
      admin.from("contas_anuncio").select("id, nome, plataforma, status, motivo_bloqueio, pre_paga, saldo, saldo_texto, limite_gasto, gasto_total, ultimo_sync").eq("cliente_id", t.cliente_id).eq("ativa", true),
      admin.from("tarefa_checklist").select("id, texto, ordem").eq("tarefa_id", t.id).order("ordem"),
      admin.from("briefings").select("campos").eq("cliente_id", t.cliente_id).maybeSingle(),
    ]);
    const nome = (cli as { nome: string } | null)?.nome ?? "Cliente";
    type Conta = { id: string; nome: string; plataforma: string; status: string | null; motivo_bloqueio: string | null; pre_paga: boolean | null; saldo: number | null; saldo_texto: string | null; limite_gasto: number | null; gasto_total: number | null; ultimo_sync: string | null };
    const lista = (contas ?? []) as Conta[];
    const itens = (check ?? []) as { id: string; texto: string }[];
    const campos = ((brief as { campos?: Record<string, unknown> } | null)?.campos ?? {}) as Record<string, unknown>;
    const ficha = typeof campos.ficha_estrategica === "string" ? String(campos.ficha_estrategica).slice(0, 2500) : "";
    const objetivo = ["objetivo_campanhas", "kpi", "objetivo", "meta_principal"].map((k) => campos[k]).filter(Boolean).join(" · ").slice(0, 600);

    // Números: ontem, últimos 7 dias e os 7 anteriores, por campanha
    const ontem = somarDias(hoje, -1), ini7 = somarDias(hoje, -7), ini14 = somarDias(hoje, -14);
    type L = { conta_id: string; data: string; campanha: string; objetivo: string | null; status_campanha: string | null; gasto: number; impressoes: number; cliques: number; resultados: number; tipo_resultado: string | null; leads: number; conversas: number };
    let linhas: L[] = [];
    if (lista.length) {
      const { data } = await admin.from("metricas_diarias").select("conta_id, data, campanha, objetivo, status_campanha, gasto, impressoes, cliques, resultados, tipo_resultado, leads, conversas").in("conta_id", lista.map((c) => c.id)).gte("data", ini14).lte("data", ontem).limit(20000);
      linhas = (data ?? []) as L[];
    }
    const plat = new Map(lista.map((c) => [c.id, c.plataforma]));
    const contatos = (l: L) => (plat.get(l.conta_id) === "google" ? Number(l.resultados) : Number(l.conversas) + Number(l.leads) + (/contact|lead/.test(l.tipo_resultado ?? "") && !Number(l.leads) ? Number(l.resultados) : 0));
    const soma = (ls: L[]) => { const s = ls.reduce((a, l) => ({ gasto: a.gasto + Number(l.gasto), impressoes: a.impressoes + Number(l.impressoes), cliques: a.cliques + Number(l.cliques), contatos: a.contatos + contatos(l) }), { gasto: 0, impressoes: 0, cliques: 0, contatos: 0 }); return { ...s, gasto: Math.round(s.gasto * 100) / 100, cpr: s.contatos ? Math.round((s.gasto / s.contatos) * 100) / 100 : null, ctr: s.impressoes ? Math.round((s.cliques / s.impressoes) * 10000) / 100 : null }; };
    const periodo = (de: string, ate: string) => linhas.filter((l) => l.data >= de && l.data <= ate);
    const camp = new Map<string, L[]>();
    for (const l of periodo(ini7, ontem)) camp.set(`${plat.get(l.conta_id)}|${l.campanha}`, [...(camp.get(`${plat.get(l.conta_id)}|${l.campanha}`) ?? []), l]);
    const campanhas = [...camp.entries()].map(([k, ls]) => ({ campanha: k.split("|")[1], plataforma: k.split("|")[0], objetivo: ls[0].objetivo, status: ls[ls.length - 1].status_campanha, ultimos7: soma(ls), ontem: soma(ls.filter((l) => l.data === ontem)) })).sort((a, b) => b.ultimos7.gasto - a.ultimos7.gasto).slice(0, 15);
    const dados = {
      cliente: nome, hoje, ontem,
      contas: lista.map((c) => ({ nome: c.nome, plataforma: c.plataforma, status: c.status, motivo_bloqueio: c.motivo_bloqueio, pre_paga: c.pre_paga, saldo: c.saldo, saldo_texto: c.saldo_texto, limite_gasto: c.limite_gasto, gasto_total: c.gasto_total, ultima_sincronizacao: c.ultimo_sync })),
      total: { ontem: soma(periodo(ontem, ontem)), anteontem: soma(periodo(somarDias(ontem, -1), somarDias(ontem, -1))), ultimos7: soma(periodo(ini7, ontem)), anteriores7: soma(periodo(ini14, somarDias(ini7, -1))) },
      gasto_por_dia_7d: Array.from({ length: 7 }, (_, k) => { const d = somarDias(ini7, k); return { data: d, ...soma(periodo(d, d)) }; }),
      campanhas,
    };

    // Ajustes recentes feitos na Meta (para não sugerir o que já foi feito)
    const { data: ajustes } = await admin.from("meta_atividades").select("quando, evento_texto, objeto_nome").eq("cliente_id", t.cliente_id).eq("automatico", false).gte("quando", `${ini7}T00:00:00-03:00`).order("quando", { ascending: false }).limit(15);

    const pedido = `Você é o Agente Gestor de Tráfego da Vertente Digital (agência de tráfego pago em Minas Gerais). Faça a REVISÃO DIÁRIA do cliente "${nome}" como um gestor sênior faria, de forma objetiva, em português do Brasil.

Checklist da revisão (responda item a item, na mesma ordem):
${itens.map((i, k) => `${k + 1}. ${i.texto}`).join("\n") || "1. Saúde da conta\n2. Campanhas ativas\n3. Métricas principais\n4. Gastos e saldo\n5. Anúncios"}

Contexto do cliente: ${objetivo || "(sem objetivo no briefing)"}
${ficha ? `Ficha estratégica: ${ficha}` : ""}

Dados (Meta e Google guardados pelo sistema; "contatos" = conversas + leads na Meta, conversões no Google; cpr = custo por contato; ctr em %):
${JSON.stringify(dados).slice(0, 30000)}

Ajustes feitos pelo time na Meta nos últimos 7 dias: ${JSON.stringify(ajustes ?? []).slice(0, 3000)}

Regras:
- Não invente números: use só os dados acima. Se faltar dado (ex.: anúncios individuais), diga o que conferir no Gerenciador.
- Conta pré-paga com saldo para menos de ~3 dias do gasto médio = atenção. Conta bloqueada, sem veicular ontem com campanhas ativas, ou custo por contato 40%+ pior que a média de 7 dias = problema ou atenção conforme a gravidade.
- Ideias de melhoria: práticas, específicas para estas campanhas (orçamento, público, criativo, oferta, horário, posicionamento), no máximo 4.

Responda SÓ com JSON neste formato:
{"situacao":"ok|atencao|problema","resumo":"1 a 2 frases","checklist":[{"item":"texto do item","ok":true,"obs":"o que viu, com números"}],"analise":"3 a 6 linhas","ideias":["..."],"alerta":"vazio ou o que o time precisa saber hoje"}`;

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${chaveIA}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("ASSISTENTE_MODELO_OPENAI") || "gpt-5.5", input: pedido }),
    });
    const j = (await r.json()) as Json;
    if (!r.ok) { await admin.from("tarefas").update({ status: "a_fazer" }).eq("id", t.id); throw new Error(String((j.error as Json | undefined)?.message ?? "A IA não respondeu.")); }
    const texto = ((j.output as Json[]) ?? []).filter((o) => o.type === "message").flatMap((o) => (o.content as Json[]) ?? []).map((c) => c.text).join("\n");
    let rev: { situacao?: string; resumo?: string; checklist?: { item: string; ok: boolean; obs: string }[]; analise?: string; ideias?: string[]; alerta?: string };
    try { rev = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1)); } catch { rev = { situacao: "atencao", resumo: "Não consegui estruturar a análise; texto bruto abaixo.", analise: texto.slice(0, 1500) }; }
    const situacao = ["ok", "atencao", "problema"].includes(rev.situacao ?? "") ? rev.situacao! : "atencao";
    const sinal = situacao === "ok" ? "🟢 Tudo certo" : situacao === "atencao" ? "🟡 Ponto de atenção" : "🔴 Problema";
    const tot = dados.total;
    const comentario = [
      `🤖 Revisão diária do Agente de Tráfego · ${hoje.split("-").reverse().join("/")}`,
      `${sinal} — ${rev.resumo ?? ""}`,
      "",
      `Ontem: ${brl(tot.ontem.gasto)} · ${tot.ontem.contatos} contatos${tot.ontem.cpr ? ` · ${brl(tot.ontem.cpr)}/contato` : ""}`,
      `7 dias: ${brl(tot.ultimos7.gasto)} · ${tot.ultimos7.contatos} contatos${tot.ultimos7.cpr ? ` · ${brl(tot.ultimos7.cpr)}/contato` : ""} (7 anteriores: ${tot.anteriores7.contatos} contatos${tot.anteriores7.cpr ? `, ${brl(tot.anteriores7.cpr)}/contato` : ""})`,
      "",
      "Checklist:",
      ...(rev.checklist ?? []).map((c) => `${c.ok ? "✅" : "⚠️"} ${c.item}: ${c.obs}`),
      "",
      rev.analise ? `Análise: ${rev.analise}` : "",
      ...(rev.ideias?.length ? ["", "Ideias de melhoria:", ...rev.ideias.map((i) => `💡 ${i}`)] : []),
      rev.alerta ? `\n⚠️ Para o time: ${rev.alerta}` : "",
    ].filter((x) => x !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();

    await admin.from("tarefa_comentarios").insert({ tarefa_id: t.id, autor_id: agenteId, texto: comentario });
    if (itens.length) await admin.from("tarefa_checklist").update({ feito: true }).eq("tarefa_id", t.id);
    await admin.from("registros").insert({
      cliente_id: t.cliente_id, tarefa_id: t.id, tipo: "revisao", canal: lista.some((c) => c.plataforma === "meta") ? "meta" : lista.length ? "google" : null,
      situacao, acoes: ["Revisão automática do Agente de Tráfego"], nota: [rev.resumo, rev.alerta].filter(Boolean).join(" ") || null,
      dados: { agente: true, ideias: rev.ideias ?? [] }, data: hoje, autor_id: agenteId,
    });
    await admin.from("tarefas").update({ status: "feita" }).eq("id", t.id);
    return { tarefa: t.id, cliente: nome, situacao };
  }
});
