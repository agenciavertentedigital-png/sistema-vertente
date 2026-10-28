// Sincroniza contas de anúncio da Meta: status, saldo e métricas diárias por campanha.
// Chamada pelo agendamento (cabeçalho x-chave-cron) ou pelo botão "Atualizar agora" (usuário logado do time).
// Token da Meta: segredo META_ACCESS_TOKEN ou 'meta_access_token' no Vault (lido por ler_token_meta). A chave do agendamento também fica no Vault.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const GRAPH = "https://graph.facebook.com/v23.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS: Record<number, string> = {
  1: "ativa",
  2: "desativada",
  3: "pagamento_pendente",
  7: "em_analise",
  8: "pendente_acerto",
  9: "periodo_carencia",
  100: "fechamento_pendente",
  101: "fechada",
  201: "ativa",
  202: "fechada",
};
const STATUS_TEXTO: Record<string, string> = {
  desativada: "foi desativada pela Meta",
  pagamento_pendente: "está com pagamento pendente",
  em_analise: "está em análise de risco",
  pendente_acerto: "está aguardando acerto",
  periodo_carencia: "está no período de carência do pagamento",
  fechamento_pendente: "está com fechamento pendente",
  fechada: "foi fechada",
};

type Json = Record<string, unknown>;

function hojeBR(deslocamento = 0) {
  const d = new Date(Date.now() - 3 * 3600_000 + deslocamento * 86400_000);
  return d.toISOString().slice(0, 10);
}

async function graph(caminho: string, params: Record<string, string>, token: string): Promise<Json> {
  const url = new URL(`${GRAPH}/${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const r = await fetch(url);
  const j = (await r.json()) as Json;
  if (j.error) {
    const e = j.error as { message?: string; code?: number };
    throw Object.assign(new Error(e.message ?? "Erro na API da Meta"), { codigo: e.code });
  }
  return j;
}

async function todasPaginas(caminho: string, params: Record<string, string>, token: string): Promise<Json[]> {
  let j = await graph(caminho, params, token);
  const linhas = [...((j.data as Json[]) ?? [])];
  let proxima = (j.paging as { next?: string } | undefined)?.next;
  while (proxima) {
    const r = await fetch(proxima);
    j = (await r.json()) as Json;
    if (j.error) throw new Error((j.error as { message: string }).message);
    linhas.push(...((j.data as Json[]) ?? []));
    proxima = (j.paging as { next?: string } | undefined)?.next;
  }
  return linhas;
}

function acao(acoes: unknown, ...tipos: string[]): number {
  if (!Array.isArray(acoes)) return 0;
  for (const t of tipos) {
    const a = acoes.find((x: { action_type: string }) => x.action_type === t);
    if (a) return Number(a.value) || 0;
  }
  return 0;
}

/** Resultado como o Gerenciador mostra; se a API não trouxer, deduz pelo objetivo. */
function resultado(linha: Json): { valor: number; tipo: string | null } {
  const r = linha.results as { indicator?: string; values?: { value: string }[] }[] | undefined;
  if (Array.isArray(r) && r[0]?.indicator) {
    return { valor: Number(r[0].values?.[0]?.value ?? 0) || 0, tipo: r[0].indicator.replace(/^[a-z_]+:/, "") };
  }
  const a = linha.actions;
  switch (linha.objective) {
    case "OUTCOME_LEADS":
    case "LEAD_GENERATION":
      return { valor: acao(a, "lead", "onsite_conversion.lead_grouped"), tipo: "lead" };
    case "OUTCOME_SALES":
    case "CONVERSIONS":
      return { valor: acao(a, "purchase", "offsite_conversion.fb_pixel_purchase"), tipo: "purchase" };
    case "OUTCOME_TRAFFIC":
    case "LINK_CLICKS":
      return { valor: Number(linha.inline_link_clicks ?? 0), tipo: "link_click" };
    case "OUTCOME_AWARENESS":
    case "REACH":
      return { valor: Number(linha.reach ?? 0), tipo: "reach" };
    default: {
      const conversas = acao(a, "onsite_conversion.messaging_conversation_started_7d");
      if (conversas) return { valor: conversas, tipo: "onsite_conversion.messaging_conversation_started_7d" };
      return { valor: acao(a, "post_engagement"), tipo: "post_engagement" };
    }
  }
}

function lerSaldo(texto: string | undefined): number | null {
  if (!texto) return null;
  const m = texto.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Json, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ---- Quem está chamando ----
  const chaveCron = req.headers.get("x-chave-cron");
  const porAgendamento = chaveCron ? (await admin.rpc("validar_chave_cron", { chave: chaveCron })).data === true : false;
  if (!porAgendamento) {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = await admin.auth.getUser(jwt);
    if (!data.user) return responder({ erro: "Faça login para atualizar." }, 401);
    const { data: m } = await admin.from("membros").select("id").eq("user_id", data.user.id).eq("ativo", true).eq("acesso", true).maybeSingle();
    if (!m) return responder({ erro: "Sem acesso." }, 403);
  }

  // Token: segredo da função ou, se não houver, o cofre (Vault) do banco
  const token = Deno.env.get("META_ACCESS_TOKEN") || ((await admin.rpc("ler_token_meta")).data as string | null);
  if (!token) return responder({ erro: "Falta o token da Meta (meta_access_token no Vault do Supabase)." }, 412);

  const corpo = (await req.json().catch(() => ({}))) as { conta_id?: string; dias?: number };
  let consulta = admin.from("contas_anuncio").select("*, cliente:clientes(nome)").eq("plataforma", "meta").eq("ativa", true);
  if (corpo.conta_id) consulta = consulta.eq("id", corpo.conta_id);
  const { data: contas, error } = await consulta;
  if (error) return responder({ erro: error.message }, 500);

  const { data: time } = await admin.from("membros").select("id").eq("ativo", true).eq("acesso", true);
  const avisar = async (texto: string, clienteId: string) => {
    if (!time?.length) return;
    await admin.from("notificacoes").insert(time.map((m) => ({ membro_id: m.id, tipo: "alerta", texto, cliente_id: clienteId })));
  };

  const relatorio: Json[] = [];
  for (const c of contas ?? []) {
    const nomeCliente = (c.cliente as { nome: string } | null)?.nome ?? c.nome;
    try {
      // ---- Conta: status e saldo ----
      // Saldo e forma de pagamento exigem acesso maior; com "Ver desempenho" busca só o básico
      const info = await graph(`act_${c.conta_id}`, {
        fields: "name,account_status,disable_reason,currency,is_prepay_account,balance,amount_spent,spend_cap,funding_source_details",
      }, token).catch((e) => {
        if (![10, 200].includes((e as { codigo?: number }).codigo ?? 0)) throw e;
        return graph(`act_${c.conta_id}`, { fields: "name,account_status,disable_reason,currency,amount_spent" }, token);
      });
      const status = STATUS[Number(info.account_status)] ?? `codigo_${info.account_status}`;
      const fonte = info.funding_source_details as { display_string?: string } | undefined;
      const prePaga = Boolean(info.is_prepay_account);
      const saldo = prePaga ? lerSaldo(fonte?.display_string) : null;

      // ---- Métricas por campanha e dia ----
      const dias = corpo.dias ?? (c.ultimo_sync ? 3 : 30);
      const periodo = JSON.stringify({ since: hojeBR(-(dias - 1)), until: hojeBR() });
      const base = { level: "campaign", time_increment: "1", time_range: periodo, limit: "500" };
      const campos = "campaign_id,campaign_name,objective,spend,impressions,reach,inline_link_clicks,actions";
      let linhas: Json[];
      try {
        linhas = await todasPaginas(`act_${c.conta_id}/insights`, { ...base, fields: `${campos},results` }, token);
      } catch (e) {
        if ((e as { codigo?: number }).codigo !== 100) throw e;
        linhas = await todasPaginas(`act_${c.conta_id}/insights`, { ...base, fields: campos }, token);
      }
      const statusCamp = new Map<string, string>();
      const camps = await todasPaginas(`act_${c.conta_id}/campaigns`, { fields: "id,effective_status", limit: "500" }, token).catch(() => []);
      for (const x of camps) statusCamp.set(String(x.id), String(x.effective_status));

      const registros = linhas.map((l) => {
        const r = resultado(l);
        return {
          conta_id: c.id,
          data: String(l.date_start),
          campanha_id: String(l.campaign_id),
          campanha: String(l.campaign_name),
          objetivo: (l.objective as string) ?? null,
          status_campanha: statusCamp.get(String(l.campaign_id)) ?? null,
          gasto: Number(l.spend ?? 0),
          impressoes: Number(l.impressions ?? 0),
          alcance: Number(l.reach ?? 0),
          cliques: Number(l.inline_link_clicks ?? 0),
          resultados: r.valor,
          tipo_resultado: r.tipo,
          // Leads de verdade: formulário (lead_grouped) ou pixel. O "lead" genérico da Meta conta conversas de WhatsApp também.
          leads: acao(l.actions, "onsite_conversion.lead_grouped") + acao(l.actions, "offsite_conversion.fb_pixel_lead"),
          conversas: acao(l.actions, "onsite_conversion.messaging_conversation_started_7d"),
          atualizado_em: new Date().toISOString(),
        };
      });
      if (registros.length) {
        const { error: e2 } = await admin.from("metricas_diarias").upsert(registros, { onConflict: "conta_id,data,campanha_id" });
        if (e2) throw new Error(e2.message);
      }

      // ---- Avisos ----
      const mudancas: Json = {};
      if (status !== "ativa" && c.alerta_status_enviado !== status) {
        await avisar(`${nomeCliente} · a conta ${c.nome} ${STATUS_TEXTO[status] ?? `mudou de status (${status})`}`, c.cliente_id);
        mudancas.alerta_status_enviado = status;
      } else if (status === "ativa" && c.alerta_status_enviado && c.alerta_status_enviado !== "ativa") {
        mudancas.alerta_status_enviado = "ativa";
      }
      if (saldo !== null && status === "ativa" && c.alerta_saldo_em !== hojeBR()) {
        const { data: ult } = await admin.from("metricas_diarias").select("gasto").eq("conta_id", c.id).gte("data", hojeBR(-7)).lt("data", hojeBR());
        const media = (ult ?? []).reduce((s, x) => s + Number(x.gasto), 0) / 7;
        if (media > 0 && saldo < media * 3) {
          const diasRestantes = Math.max(0, Math.floor(saldo / media));
          await avisar(`${nomeCliente} · saldo baixo na conta ${c.nome}: R$ ${saldo.toFixed(2).replace(".", ",")} (dá para cerca de ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"})`, c.cliente_id);
          mudancas.alerta_saldo_em = hojeBR();
        }
      }

      await admin.from("contas_anuncio").update({
        nome: String(info.name ?? c.nome),
        moeda: (info.currency as string) ?? c.moeda,
        status,
        motivo_bloqueio: Number(info.disable_reason) ? String(info.disable_reason) : null,
        pre_paga: prePaga,
        saldo,
        saldo_texto: fonte?.display_string ?? null,
        limite_gasto: info.spend_cap && info.spend_cap !== "0" ? Number(info.spend_cap) / 100 : null,
        gasto_total: info.amount_spent ? Number(info.amount_spent) / 100 : null,
        ultimo_sync: new Date().toISOString(),
        erro_sync: null,
        ...mudancas,
      }).eq("id", c.id);
      relatorio.push({ conta: c.nome, status, linhas: registros.length });
    } catch (e) {
      const msg = (e as Error).message;
      await admin.from("contas_anuncio").update({ erro_sync: msg }).eq("id", c.id);
      relatorio.push({ conta: c.nome, erro: msg });
    }
  }
  return responder({ ok: true, contas: relatorio });
});
