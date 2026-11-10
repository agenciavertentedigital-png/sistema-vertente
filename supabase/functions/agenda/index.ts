// Google Agenda no Planejador (somente leitura): cada pessoa conecta a própria conta do Google
// e o Planejador mostra os compromissos para não marcar tarefa por cima.
// GET  ?code&state            → volta do Google: guarda o acesso no cofre (google_agenda_<membro_id>)
// POST { acao: "conectar" }   → link de autorização para quem está logado
// POST { acao: "eventos", inicio, fim, membro_id? } → compromissos (de outra pessoa do time só aparece "Ocupado")
// POST { acao: "desconectar" }
// Usa o mesmo cliente OAuth do Google Ads (google_ads_client_id / google_ads_client_secret).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const SISTEMA = "https://sistema.agenciavertente.com.br";
const FUNCAO = "https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/agenda";
const ESCOPO = "openid email https://www.googleapis.com/auth/calendar.readonly";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
type Json = Record<string, unknown>;

async function assinar(texto: string, chave: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(texto)));
  return btoa(String.fromCharCode(...s)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (c: Json, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const voltar = (s: string) => Response.redirect(`${SISTEMA}/#planejador?agenda=${encodeURIComponent(s)}`, 302);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const segredo = async (nome: string) => ((await admin.rpc("ler_segredo", { nome })).data as string | null) ?? "";
  const [clientId, clientSecret, chaveAssinatura] = await Promise.all([segredo("google_ads_client_id"), segredo("google_ads_client_secret"), segredo("chave_cron_meta")]);

  // ---------- Volta do Google ----------
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("error")) return voltar("recusado");
    const code = url.searchParams.get("code");
    const [membroId, ts, assin] = (url.searchParams.get("state") ?? "").split(".");
    if (!code || !membroId || !ts || Date.now() - Number(ts) > 15 * 60_000 || assin !== (await assinar(`${membroId}.${ts}`, chaveAssinatura))) return voltar("expirado");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: FUNCAO, grant_type: "authorization_code" }),
    });
    const j = (await r.json()) as Json;
    if (!j.refresh_token) return voltar("sem_refresh");
    let email: string | null = null;
    try {
      const p = String(j.id_token ?? "").split(".")[1];
      email = p ? (JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))) as { email?: string }).email ?? null : null;
    } catch { /* sem e-mail */ }
    const g = await admin.rpc("guardar_segredo_servidor", { nome: `google_agenda_${membroId}`, valor: String(j.refresh_token) });
    if (g.error) return voltar("erro");
    await admin.from("agenda_conexoes").upsert({ membro_id: membroId, email, conectado_em: new Date().toISOString() });
    return voltar("ok");
  }

  // ---------- Quem chama ----------
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u.user) return responder({ erro: "Faça login de novo no sistema." }, 401);
  const { data: eu } = await admin.from("membros").select("id").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
  if (!eu) return responder({ erro: "Sem acesso." }, 403);
  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; inicio?: string; fim?: string; membro_id?: string };

  if (corpo.acao === "conectar") {
    if (!clientId || !clientSecret) return responder({ erro: "Falta o cliente OAuth do Google em Integrações." }, 412);
    const ts = String(Date.now());
    const link = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    link.search = new URLSearchParams({ client_id: clientId, redirect_uri: FUNCAO, response_type: "code", scope: ESCOPO, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: `${eu.id}.${ts}.${await assinar(`${eu.id}.${ts}`, chaveAssinatura)}` }).toString();
    return responder({ ok: true, url: link.toString() });
  }

  if (corpo.acao === "desconectar") {
    await admin.rpc("guardar_segredo_servidor", { nome: `google_agenda_${eu.id}`, valor: "" });
    await admin.from("agenda_conexoes").delete().eq("membro_id", eu.id);
    return responder({ ok: true });
  }

  if (corpo.acao === "eventos") {
    const alvo = corpo.membro_id || eu.id;
    const proprio = alvo === eu.id;
    const refresh = await segredo(`google_agenda_${alvo}`);
    if (!refresh) return responder({ conectado: false, eventos: [] });
    const tk = (await (await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refresh, grant_type: "refresh_token" }),
    })).json()) as Json;
    if (!tk.access_token) return responder({ conectado: false, erro: "A conexão com a agenda expirou. Conecte de novo.", eventos: [] });
    const ini = new Date(`${corpo.inicio}T00:00:00-03:00`).toISOString();
    const fim = new Date(`${corpo.fim}T23:59:59-03:00`).toISOString();
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.search = new URLSearchParams({ timeMin: ini, timeMax: fim, singleEvents: "true", orderBy: "startTime", maxResults: "250" }).toString();
    const r = await fetch(url, { headers: { Authorization: `Bearer ${tk.access_token}` } });
    const j = (await r.json()) as Json;
    if (!r.ok) {
      const m = String((j.error as Json | undefined)?.message ?? "");
      return responder({ conectado: true, erro: /has not been used|disabled/i.test(m) ? "A Google Calendar API não está ativada no projeto do Google Cloud." : m || "A agenda não respondeu.", eventos: [] });
    }
    const eventos = ((j.items as Json[]) ?? [])
      .filter((e) => e.status !== "cancelled" && (e.transparency as string) !== "transparent")
      .filter((e) => !((e.attendees as Json[] | undefined) ?? []).some((a) => a.self && a.responseStatus === "declined"))
      .map((e) => {
        const s = e.start as Json;
        const f = e.end as Json;
        const diaTodo = !s?.dateTime;
        return { id: e.id, titulo: proprio ? String(e.summary ?? "(sem título)") : "Ocupado", inicio: String(s?.dateTime ?? s?.date), fim: String(f?.dateTime ?? f?.date), dia_todo: diaTodo, link: proprio ? (e.hangoutLink ?? e.htmlLink ?? null) : null };
      });
    return responder({ conectado: true, eventos });
  }

  return responder({ erro: "Ação desconhecida." }, 400);
});
