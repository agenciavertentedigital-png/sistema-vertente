// Google Ads: conexão OAuth, lista de contas da MCC e sincronização das métricas diárias por campanha.
// Chaves no Vault (tela Integrações): google_ads_mcc, google_ads_client_id, google_ads_client_secret (google_ads_dev_token é opcional:
// desde 09/09/2026 o nível de acesso fica no projeto do Google Cloud dono do OAuth).
// O refresh token (google_ads_refresh_token) é gravado aqui mesmo, quando o admin autoriza no Google.
// Chamadas: GET com ?code (volta do Google) | POST {acao: "conectar" | "contas" | "sincronizar", conta_id?, dias?}
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const VERSAO = Deno.env.get("GOOGLE_ADS_VERSAO") ?? "v24";
const SISTEMA = "https://sistema.agenciavertente.com.br";
const FUNCAO = "https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/google-ads";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
type Json = Record<string, unknown>;

const soDigitos = (s: string) => s.replace(/\D/g, "");
function hojeBR(deslocamento = 0) {
  return new Date(Date.now() - 3 * 3600_000 + deslocamento * 86400_000).toISOString().slice(0, 10);
}

// ---- state assinado (protege o retorno do OAuth): validade de 15 minutos ----
async function assinar(texto: string, chave: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(texto)));
  return btoa(String.fromCharCode(...s)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
}

const STATUS: Record<string, string> = { ENABLED: "ativa", CANCELED: "fechada", SUSPENDED: "desativada", CLOSED: "fechada" };
const CANAL: Record<string, string> = {
  SEARCH: "Pesquisa",
  PERFORMANCE_MAX: "Performance Max",
  DISPLAY: "Display",
  VIDEO: "YouTube",
  DEMAND_GEN: "Demand Gen",
  SHOPPING: "Shopping",
  LOCAL: "Local",
  SMART: "Inteligente",
  MULTI_CHANNEL: "App",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Json, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const voltar = (status: string) => Response.redirect(`${SISTEMA}/#integracoes?google=${encodeURIComponent(status)}`, 302);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const segredo = async (nome: string) => ((await admin.rpc("ler_segredo", { nome })).data as string | null) ?? "";
  const [mcc, devToken, clientId, clientSecret, chaveCronGuardada] = await Promise.all([
    segredo("google_ads_mcc"),
    segredo("google_ads_dev_token"),
    segredo("google_ads_client_id"),
    segredo("google_ads_client_secret"),
    segredo("chave_cron_meta"),
  ]);

  // ---------------- Volta do Google (OAuth) ----------------
  const url = new URL(req.url);
  if (req.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") ?? "";
    if (url.searchParams.get("error")) return voltar("recusado");
    if (!code) return voltar("erro");
    const [ts, assin] = state.split(".");
    if (!ts || !assin || Date.now() - Number(ts) > 15 * 60_000 || assin !== (await assinar(ts, chaveCronGuardada))) return voltar("expirado");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: FUNCAO, grant_type: "authorization_code" }),
    });
    const j = (await r.json()) as Json;
    if (!j.refresh_token) return voltar("sem_refresh");
    const g = await admin.rpc("guardar_segredo_servidor", { nome: "google_ads_refresh_token", valor: String(j.refresh_token) });
    return voltar(g.error ? "erro" : "ok");
  }

  // ---------------- Quem está chamando ----------------
  const chaveCron = req.headers.get("x-chave-cron");
  const porAgendamento = chaveCron ? (await admin.rpc("validar_chave_cron", { chave: chaveCron })).data === true : false;
  let ehAdmin = false;
  if (!porAgendamento) {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = await admin.auth.getUser(jwt);
    if (!data.user) return responder({ erro: "Faça login de novo no sistema." }, 401);
    const { data: m } = await admin.from("membros").select("id").or(`user_id.eq.${data.user.id},email.eq.${(data.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
    if (!m) return responder({ erro: "Sem acesso." }, 403);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    ehAdmin = (await userClient.rpc("integracoes_status")).error === null;
  }

  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; conta_id?: string; dias?: number; cliente_id?: string; inicio?: string; fim?: string };
  const faltando = [!mcc && "ID da MCC", !clientId && "ID do cliente OAuth", !clientSecret && "chave secreta OAuth"].filter(Boolean);

  // ---------------- Conectar: devolve o link de autorização ----------------
  if (corpo.acao === "conectar") {
    if (!ehAdmin) return responder({ erro: "Só administradores conectam integrações." }, 403);
    if (!clientId || !clientSecret) return responder({ erro: "Cole antes o ID do cliente e a chave secreta do OAuth." }, 412);
    const ts = String(Date.now());
    const link = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    link.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: FUNCAO,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/adwords",
      access_type: "offline",
      prompt: "consent",
      state: `${ts}.${await assinar(ts, chaveCronGuardada)}`,
    }).toString();
    return responder({ ok: true, url: link.toString() });
  }

  if (faltando.length) return responder({ erro: `Falta configurar o Google Ads: ${faltando.join(", ")} (Integrações).` }, 412);
  const refresh = await segredo("google_ads_refresh_token");
  if (!refresh) return responder({ erro: "Falta clicar em \"Conectar Google Ads\" em Integrações." }, 412);

  // Access token (vale 1 hora)
  const tk = (await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refresh, grant_type: "refresh_token" }),
  })).json()) as Json;
  if (!tk.access_token) return responder({ erro: `O Google recusou a conexão (${tk.error ?? "token"}). Conecte de novo em Integrações.` }, 401);
  const loginId = soDigitos(mcc);

  async function gaql(customerId: string, query: string): Promise<Json[]> {
    const r = await fetch(`https://googleads.googleapis.com/${VERSAO}/customers/${soDigitos(customerId)}/googleAds:searchStream`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tk.access_token}`, "login-customer-id": loginId, "Content-Type": "application/json", ...(devToken ? { "developer-token": devToken } : {}) },
      body: JSON.stringify({ query }),
    });
    const j = (await r.json().catch(() => null)) as Json[] | Json | null;
    if (!r.ok) {
      const e = (Array.isArray(j) ? j[0] : j) as { error?: { message?: string; details?: { errors?: { message?: string }[] }[] } } | null;
      let msg = e?.error?.details?.[0]?.errors?.[0]?.message ?? e?.error?.message ?? `HTTP ${r.status}`;
      if (/NOT_APPROVED_FOR_PRODUCTION|test accounts|DEVELOPER_TOKEN_NOT_APPROVED/i.test(JSON.stringify(j))) msg = "O projeto do Google Cloud ainda está no nível Teste. Peça o nível Explorer na página da Google Ads API no Cloud Console.";
      throw new Error(msg);
    }
    return (Array.isArray(j) ? j : [j]).flatMap((lote) => ((lote as Json)?.results as Json[]) ?? []);
  }

  try {
    // ---------------- Relatório do cliente (ao vivo) para o dashboard ----------------
    if (corpo.acao === "relatorio") {
      const ini = String(corpo.inicio ?? "");
      const fim = String(corpo.fim ?? "");
      if (!corpo.cliente_id || !/^\d{4}-\d{2}-\d{2}$/.test(ini) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) return responder({ erro: "Período inválido." }, 400);
      const dias = Math.round((Date.parse(fim) - Date.parse(ini)) / 86400000) + 1;
      const antFim = new Date(Date.parse(ini) - 86400000).toISOString().slice(0, 10);
      const antIni = new Date(Date.parse(ini) - dias * 86400000).toISOString().slice(0, 10);
      const { data: contas } = await admin.from("contas_anuncio").select("id, conta_id, nome, status, ultimo_sync").eq("plataforma", "google").eq("ativa", true).eq("cliente_id", corpo.cliente_id);
      const periodo = (a: string, b: string) => `segments.date BETWEEN '${a}' AND '${b}'`;
      const micros = (v: unknown) => Number(v ?? 0) / 1_000_000;
      const met = (m: Json | undefined) => ({
        gasto: micros(m?.costMicros),
        impressoes: Number(m?.impressions ?? 0),
        cliques: Number(m?.clicks ?? 0),
        conversoes: Number(m?.conversions ?? 0),
        valor: Number(m?.conversionsValue ?? 0),
      });
      const somar = (lista: ReturnType<typeof met>[]) => lista.reduce((t, x) => ({ gasto: t.gasto + x.gasto, impressoes: t.impressoes + x.impressoes, cliques: t.cliques + x.cliques, conversoes: t.conversoes + x.conversoes, valor: t.valor + x.valor }), { gasto: 0, impressoes: 0, cliques: 0, conversoes: 0, valor: 0 });
      const seguro = async (cid: string, q: string) => { try { return await gaql(cid, q); } catch (e) { erros.push((e as Error).message); return [] as Json[]; } };
      const erros: string[] = [];
      const atual: ReturnType<typeof met>[] = [];
      const anterior: ReturnType<typeof met>[] = [];
      let parcelaNum = 0, parcelaDen = 0;
      const dia = new Map<string, ReturnType<typeof met>>();
      const campanhas: Json[] = [];
      const acoes = new Map<string, { nome: string; categoria: string; conversoes: number }>();
      const termos: Json[] = [];
      const palavras: Json[] = [];
      const dispositivos = new Map<string, ReturnType<typeof met>>();

      for (const c of contas ?? []) {
        const [tot, ant, dd, camp, ac, st, kw, dv] = await Promise.all([
          seguro(c.conta_id, `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share FROM customer WHERE ${periodo(ini, fim)}`),
          seguro(c.conta_id, `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM customer WHERE ${periodo(antIni, antFim)}`),
          seguro(c.conta_id, `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM customer WHERE ${periodo(ini, fim)}`),
          seguro(c.conta_id, `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share FROM campaign WHERE ${periodo(ini, fim)} AND metrics.impressions > 0`),
          seguro(c.conta_id, `SELECT segments.conversion_action_name, segments.conversion_action_category, metrics.conversions FROM customer WHERE ${periodo(ini, fim)} AND metrics.conversions > 0`),
          seguro(c.conta_id, `SELECT search_term_view.search_term, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE ${periodo(ini, fim)} AND metrics.clicks > 0 ORDER BY metrics.clicks DESC LIMIT 40`),
          seguro(c.conta_id, `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM keyword_view WHERE ${periodo(ini, fim)} AND metrics.impressions > 0 ORDER BY metrics.cost_micros DESC LIMIT 40`),
          seguro(c.conta_id, `SELECT segments.device, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM customer WHERE ${periodo(ini, fim)}`),
        ]);
        for (const l of tot) {
          const m = l.metrics as Json;
          atual.push(met(m));
          const imp = Number(m.impressions ?? 0);
          if (m.searchImpressionShare != null) { parcelaNum += Number(m.searchImpressionShare) * imp; parcelaDen += imp; }
        }
        for (const l of ant) anterior.push(met(l.metrics as Json));
        for (const l of dd) {
          const d = String((l.segments as Json).date);
          dia.set(d, somar([dia.get(d) ?? met(undefined), met(l.metrics as Json)]));
        }
        for (const l of camp) {
          const cp = l.campaign as Json;
          const m = l.metrics as Json;
          campanhas.push({
            id: String(cp.id),
            nome: String(cp.name ?? cp.id),
            status: String(cp.status ?? "").toLowerCase(),
            tipo: CANAL[String(cp.advertisingChannelType)] ?? String(cp.advertisingChannelType ?? ""),
            orcamento_dia: micros((l.campaignBudget as Json | undefined)?.amountMicros),
            ...met(m),
            parcela: m.searchImpressionShare != null ? Number(m.searchImpressionShare) : null,
            perdida_orcamento: m.searchBudgetLostImpressionShare != null ? Number(m.searchBudgetLostImpressionShare) : null,
            perdida_ranking: m.searchRankLostImpressionShare != null ? Number(m.searchRankLostImpressionShare) : null,
          });
        }
        for (const l of ac) {
          const sg = l.segments as Json;
          const nome = String(sg.conversionActionName ?? "Conversão");
          const x = acoes.get(nome) ?? { nome, categoria: String(sg.conversionActionCategory ?? ""), conversoes: 0 };
          x.conversoes += Number((l.metrics as Json).conversions ?? 0);
          acoes.set(nome, x);
        }
        for (const l of st) termos.push({ termo: String((l.searchTermView as Json).searchTerm ?? ""), campanha: String((l.campaign as Json)?.name ?? ""), ...met(l.metrics as Json) });
        for (const l of kw) {
          const cr = l.adGroupCriterion as Json;
          const k = (cr.keyword as Json) ?? {};
          palavras.push({ palavra: String(k.text ?? ""), correspondencia: String(k.matchType ?? "").toLowerCase(), qualidade: (cr.qualityInfo as Json | undefined)?.qualityScore ?? null, ...met(l.metrics as Json) });
        }
        for (const l of dv) {
          const d = String((l.segments as Json).device ?? "OTHER");
          dispositivos.set(d, somar([dispositivos.get(d) ?? met(undefined), met(l.metrics as Json)]));
        }
      }

      return responder({
        ok: true,
        periodo: { inicio: ini, fim, anterior_inicio: antIni, anterior_fim: antFim },
        contas: (contas ?? []).map((c) => ({ id: c.id, conta_id: c.conta_id, nome: c.nome, status: c.status })),
        total: somar(atual),
        anterior: somar(anterior),
        parcela_impressoes: parcelaDen ? parcelaNum / parcelaDen : null,
        dias: [...dia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, m]) => ({ data, ...m })),
        campanhas: campanhas.sort((a, b) => Number(b.gasto) - Number(a.gasto)),
        acoes: [...acoes.values()].sort((a, b) => b.conversoes - a.conversoes),
        termos: termos.sort((a, b) => Number(b.cliques) - Number(a.cliques)).slice(0, 40),
        palavras: palavras.sort((a, b) => Number(b.gasto) - Number(a.gasto)).slice(0, 40),
        dispositivos: [...dispositivos.entries()].map(([d, m]) => ({ dispositivo: d, ...m })).sort((a, b) => b.gasto - a.gasto),
        avisos: [...new Set(erros)].slice(0, 3),
      });
    }

    // ---------------- Contas da MCC (para vincular aos clientes) ----------------
    if (corpo.acao === "contas") {
      const linhas = await gaql(loginId, "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.status, customer_client.manager, customer_client.level FROM customer_client WHERE customer_client.level <= 2");
      const contas = linhas
        .map((l) => l.customerClient as Json)
        .filter((c) => !c.manager)
        .map((c) => ({ id: String(c.id), nome: String(c.descriptiveName ?? c.id), moeda: c.currencyCode ?? null, status: STATUS[String(c.status)] ?? String(c.status ?? "").toLowerCase() }));
      return responder({ ok: true, contas });
    }

    // ---------------- Sincronizar métricas ----------------
    if (corpo.acao === "sincronizar" || !corpo.acao) {
      let consulta = admin.from("contas_anuncio").select("*").eq("plataforma", "google").eq("ativa", true);
      if (corpo.conta_id) consulta = consulta.eq("id", corpo.conta_id);
      const { data: contas, error } = await consulta;
      if (error) throw new Error(error.message);
      const dias = Math.min(Math.max(Number(corpo.dias ?? 30), 1), 90);
      const ini = hojeBR(-dias);
      const fim = hojeBR(0);
      const relatorio: Json[] = [];

      for (const c of contas ?? []) {
        try {
          const info = (await gaql(c.conta_id, "SELECT customer.descriptive_name, customer.currency_code, customer.status FROM customer LIMIT 1"))[0]?.customer as Json | undefined;
          const linhas = await gaql(
            c.conta_id,
            `SELECT segments.date, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${ini}' AND '${fim}' AND metrics.impressions > 0`,
          );
          const regs = linhas.map((l) => {
            const camp = l.campaign as Json;
            const m = l.metrics as Json;
            const conv = Number(m.conversions ?? 0);
            return {
              conta_id: c.id,
              data: (l.segments as Json).date,
              campanha_id: String(camp.id),
              campanha: String(camp.name ?? camp.id),
              objetivo: CANAL[String(camp.advertisingChannelType)] ?? String(camp.advertisingChannelType ?? "").toLowerCase(),
              status_campanha: String(camp.status ?? "").toLowerCase(),
              gasto: Math.round(Number(m.costMicros ?? 0) / 10_000) / 100,
              impressoes: Number(m.impressions ?? 0),
              alcance: 0,
              cliques: Number(m.clicks ?? 0),
              resultados: Math.round(conv * 100) / 100,
              tipo_resultado: "google_conversoes",
              leads: Math.round(conv),
              conversas: 0,
              atualizado_em: new Date().toISOString(),
            };
          });
          for (let i = 0; i < regs.length; i += 500) {
            const up = await admin.from("metricas_diarias").upsert(regs.slice(i, i + 500), { onConflict: "conta_id,data,campanha_id" });
            if (up.error) throw new Error(up.error.message);
          }
          await admin.from("contas_anuncio").update({
            nome: info?.descriptiveName ? String(info.descriptiveName) : c.nome,
            moeda: info?.currencyCode ?? c.moeda,
            status: STATUS[String(info?.status)] ?? c.status,
            ultimo_sync: new Date().toISOString(),
            erro_sync: null,
          }).eq("id", c.id);
          relatorio.push({ conta: c.nome, linhas: regs.length });
        } catch (e) {
          await admin.from("contas_anuncio").update({ erro_sync: (e as Error).message, ultimo_sync: new Date().toISOString() }).eq("id", c.id);
          relatorio.push({ conta: c.nome, erro: (e as Error).message });
        }
      }
      return responder({ ok: true, contas: relatorio });
    }

    return responder({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return responder({ erro: (e as Error).message }, 500);
  }
});
