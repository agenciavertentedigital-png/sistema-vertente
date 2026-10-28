// Relatório ao vivo da Meta para o dashboard de um cliente: totais exatos do período (alcance, frequência),
// campanhas, série diária, período anterior e anúncios com miniatura do criativo.
// Só atende quem é do time (JWT). Token da Meta: segredo META_ACCESS_TOKEN ou Vault (ler_token_meta).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const GRAPH = "https://graph.facebook.com/v23.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
type Json = Record<string, unknown>;

const CAMPOS_BASE = "spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpm,actions,action_values,video_thruplay_watched_actions";

async function graph(caminho: string, params: Record<string, string>, token: string): Promise<Json> {
  const url = new URL(`${GRAPH}/${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const j = (await (await fetch(url)).json()) as Json;
  if (j.error) {
    const e = j.error as { message?: string; code?: number };
    throw Object.assign(new Error(e.message ?? "Erro na API da Meta"), { codigo: e.code });
  }
  return j;
}

async function paginas(caminho: string, params: Record<string, string>, token: string, max = 2000): Promise<Json[]> {
  let j = await graph(caminho, params, token);
  const out = [...((j.data as Json[]) ?? [])];
  let prox = (j.paging as { next?: string } | undefined)?.next;
  while (prox && out.length < max) {
    j = (await (await fetch(prox)).json()) as Json;
    if (j.error) throw new Error((j.error as { message: string }).message);
    out.push(...((j.data as Json[]) ?? []));
    prox = (j.paging as { next?: string } | undefined)?.next;
  }
  return out;
}

/** insights tentando com o campo "results" e, se a API recusar, sem ele. */
async function insights(conta: string, params: Record<string, string>, token: string, comResultados: boolean) {
  if (!comResultados) return paginas(`act_${conta}/insights`, params, token);
  try {
    return await paginas(`act_${conta}/insights`, { ...params, fields: `${params.fields},results` }, token);
  } catch (e) {
    if ((e as { codigo?: number }).codigo !== 100) throw e;
    return paginas(`act_${conta}/insights`, params, token);
  }
}

function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1;
}
function somar(d: string, n: number) {
  return new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Json, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const chave = req.headers.get("x-chave-cron");
  const interno = chave ? (await admin.rpc("validar_chave_cron", { chave })).data === true : false;
  if (!interno) {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u.user) return responder({ erro: "Faça login." }, 401);
    const { data: m } = await admin.from("membros").select("id").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
    // mesmo critério das regras do banco: vínculo pelo usuário ou pelo e-mail do login
    if (!m) return responder({ erro: "Sem acesso." }, 403);
  }

  const token = Deno.env.get("META_ACCESS_TOKEN") || ((await admin.rpc("ler_token_meta")).data as string | null);
  if (!token) return responder({ erro: "Falta o token da Meta." }, 412);

  const { cliente_id, inicio, fim } = (await req.json().catch(() => ({}))) as { cliente_id?: string; inicio?: string; fim?: string };
  if (!cliente_id || !inicio || !fim || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim) || inicio > fim) {
    return responder({ erro: "Informe cliente_id, inicio e fim (AAAA-MM-DD)." }, 400);
  }
  const n = diasEntre(inicio, fim);
  if (n > 400) return responder({ erro: "Período máximo de 400 dias." }, 400);
  const anterior = { since: somar(inicio, -n), until: somar(inicio, -1) };
  const periodo = JSON.stringify({ since: inicio, until: fim });

  const { data: contas, error } = await admin
    .from("contas_anuncio")
    .select("id, conta_id, nome, status, saldo, pre_paga")
    .eq("cliente_id", cliente_id)
    .eq("plataforma", "meta")
    .eq("ativa", true);
  if (error) return responder({ erro: error.message }, 500);

  const resultado = await Promise.all(
    (contas ?? []).map(async (c) => {
      try {
        const [total, totalAnterior, diario, campanhas, anuncios] = await Promise.all([
          insights(c.conta_id, { level: "account", time_range: periodo, fields: CAMPOS_BASE }, token, false),
          insights(c.conta_id, { level: "account", time_range: JSON.stringify(anterior), fields: CAMPOS_BASE }, token, false),
          insights(c.conta_id, { level: "account", time_range: periodo, time_increment: "1", fields: "spend,impressions,inline_link_clicks,actions,action_values", limit: "500" }, token, false),
          insights(
            c.conta_id,
            { level: "campaign", time_range: periodo, fields: `campaign_id,campaign_name,objective,${CAMPOS_BASE}`, limit: "500" },
            token,
            true,
          ),
          insights(
            c.conta_id,
            {
              level: "ad",
              time_range: periodo,
              fields: "ad_id,ad_name,adset_name,campaign_id,campaign_name,objective,spend,impressions,reach,inline_link_clicks,ctr,actions,action_values",
              filtering: JSON.stringify([{ field: "spend", operator: "GREATER_THAN", value: 0 }]),
              sort: "spend_descending",
              limit: "200",
            },
            token,
            true,
          ),
        ]);

        // Status das campanhas
        const camps = await paginas(`act_${c.conta_id}/campaigns`, { fields: "id,effective_status,daily_budget,lifetime_budget", limit: "500" }, token).catch(() => []);
        const statusCamp = Object.fromEntries(camps.map((x) => [String(x.id), { status: x.effective_status, orcamento_dia: x.daily_budget ? Number(x.daily_budget) / 100 : null }]));

        // Criativos dos 30 anúncios com mais investimento
        const top = anuncios.slice(0, 30).map((a) => String(a.ad_id));
        const criativos: Record<string, Json> = {};
        let erroCriativos: string | null = null;
        const camposCriativo = "effective_status,preview_shareable_link,creative{thumbnail_url,image_url,object_type,title,body,video_id,instagram_permalink_url}";
        // Em paralelo, de 10 em 10 (o parâmetro "ids" foi descontinuado pela Meta)
        for (let i = 0; i < top.length; i += 10) {
          await Promise.all(
            top.slice(i, i + 10).map(async (id) => {
              try {
                criativos[id] = await graph(id, { fields: camposCriativo, thumbnail_width: "480", thumbnail_height: "480" }, token);
              } catch (e) {
                erroCriativos = (e as Error).message;
              }
            }),
          );
        }

        return {
          conta: { id: c.id, conta_id: c.conta_id, nome: c.nome, status: c.status, saldo: c.saldo, pre_paga: c.pre_paga },
          total: total[0] ?? null,
          anterior: totalAnterior[0] ?? null,
          diario,
          erro_criativos: erroCriativos,
          campanhas: campanhas.map((x) => ({ ...x, ...(statusCamp[String(x.campaign_id)] ?? {}) })),
          anuncios: anuncios.map((a) => {
            const cr = criativos[String(a.ad_id)] as Json | undefined;
            const creative = (cr?.creative ?? {}) as Json;
            return {
              ...a,
              status: cr?.effective_status ?? null,
              previa: cr?.preview_shareable_link ?? null,
              miniatura: creative.image_url ?? creative.thumbnail_url ?? null,
              tipo_criativo: creative.object_type ?? null,
              titulo: creative.title ?? null,
              texto: creative.body ?? null,
              link_instagram: creative.instagram_permalink_url ?? null,
            };
          }),
        };
      } catch (e) {
        return { conta: { id: c.id, conta_id: c.conta_id, nome: c.nome, status: c.status }, erro: (e as Error).message };
      }
    }),
  );

  return responder({ ok: true, inicio, fim, anterior, contas: resultado });
});
