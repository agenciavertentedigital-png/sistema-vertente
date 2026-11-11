// Instagram Business dos clientes (via token do usuário do sistema da Meta, com instagram_basic + instagram_manage_insights).
// POST { acao: "disponiveis" }                         → perfis que o token enxerga (e a qual cliente cada um está ligado)
// POST { acao: "vincular", cliente_id, ig_id }         → liga o perfil ao cliente (desvincular: { acao: "desvincular", ig_id })
// POST { acao: "relatorio", cliente_id, ini, fim }     → números do período + anterior, posts, público, seguidores por dia
// POST { acao: "snapshot" } (x-chave-cron)             → guarda o total de seguidores de hoje de cada perfil ligado
// Chamado pelo sistema (login do time) ou pelo servidor (x-chave-cron), inclusive pelo Painel do cliente.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const G = "https://graph.facebook.com/v23.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-chave-cron" };
type Json = Record<string, unknown>;
const somarDias = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const hojeBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const unix = (d: string) => Math.floor(Date.parse(`${d}T03:00:00Z`) / 1000); // meia-noite em Brasília
const dataOk = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const METRICAS = ["reach", "views", "accounts_engaged", "total_interactions", "profile_views", "website_clicks"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (c: Json, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const corpo = (await req.json().catch(() => ({}))) as Json;

  // Quem chama: servidor (chave) ou alguém do time
  const chaveCron = req.headers.get("x-chave-cron");
  let servidor = false;
  if (chaveCron) {
    const { data } = await admin.rpc("validar_chave_cron", { chave: chaveCron });
    if (!data) return responder({ erro: "Chave inválida." }, 401);
    servidor = true;
  } else {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u.user) return responder({ erro: "Faça login de novo no sistema." }, 401);
    const { data: eu } = await admin.from("membros").select("id").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
    if (!eu) return responder({ erro: "Sem acesso." }, 403);
  }

  const token = ((await admin.rpc("ler_token_meta")).data as string | null) ?? "";
  if (!token) return responder({ erro: "Falta o token da Meta em Integrações." }, 412);
  const graph = async (caminho: string, params: Record<string, string> = {}) => {
    const u = new URL(`${G}/${caminho}`);
    for (const [k, v] of Object.entries({ ...params, access_token: token })) u.searchParams.set(k, v);
    const r = await fetch(u);
    const j = (await r.json()) as Json;
    if (!r.ok) throw new Error(String((j.error as Json | undefined)?.message ?? `Instagram respondeu ${r.status}`));
    return j;
  };

  try {
    // ---------- Perfis disponíveis ----------
    if (corpo.acao === "disponiveis" && !servidor) {
      const lista: Json[] = [];
      let prox: string | null = `${G}/me/accounts?fields=name,instagram_business_account{id,username,name,profile_picture_url,followers_count}&limit=100&access_token=${encodeURIComponent(token)}`;
      for (let i = 0; prox && i < 10; i++) {
        const j = (await (await fetch(prox)).json()) as { data?: Json[]; paging?: { next?: string }; error?: Json };
        if (j.error) throw new Error(String(j.error.message));
        for (const p of j.data ?? []) if (p.instagram_business_account) lista.push({ pagina: p.name, ...(p.instagram_business_account as Json) });
        prox = j.paging?.next ?? null;
      }
      const { data: ligados } = await admin.from("instagram_contas").select("ig_id, cliente_id");
      const mapa = new Map(((ligados ?? []) as { ig_id: string; cliente_id: string }[]).map((x) => [x.ig_id, x.cliente_id]));
      const vistos = new Set<string>();
      return responder({ perfis: lista.filter((p) => !vistos.has(String(p.id)) && vistos.add(String(p.id))).map((p) => ({ ...p, cliente_id: mapa.get(String(p.id)) ?? null })) });
    }

    if (corpo.acao === "vincular" && !servidor) {
      const igId = String(corpo.ig_id ?? ""), clienteId = String(corpo.cliente_id ?? "");
      if (!/^\d+$/.test(igId) || !clienteId) return responder({ erro: "Dados incompletos." }, 400);
      const p = await graph(igId, { fields: "username,name,profile_picture_url" });
      const { error } = await admin.from("instagram_contas").upsert({ ig_id: igId, cliente_id: clienteId, username: p.username, nome: p.name ?? null, foto_url: p.profile_picture_url ?? null, ativa: true });
      if (error) throw new Error(error.message);
      return responder({ ok: true });
    }
    if (corpo.acao === "desvincular" && !servidor) {
      const { error } = await admin.from("instagram_contas").delete().eq("ig_id", String(corpo.ig_id ?? ""));
      if (error) throw new Error(error.message);
      return responder({ ok: true });
    }

    // ---------- Foto do dia (seguidores) ----------
    if (corpo.acao === "snapshot") {
      const { data } = await admin.from("instagram_contas").select("ig_id").eq("ativa", true);
      const hoje = hojeBR();
      const regs: Json[] = [];
      for (const c of (data ?? []) as { ig_id: string }[]) {
        try {
          const p = await graph(c.ig_id, { fields: "followers_count,media_count,profile_picture_url" });
          regs.push({ ig_id: c.ig_id, data: hoje, seguidores: p.followers_count ?? 0, publicacoes: p.media_count ?? 0 });
          await admin.from("instagram_contas").update({ foto_url: p.profile_picture_url ?? null }).eq("ig_id", c.ig_id);
        } catch { /* perfil sem acesso: segue */ }
      }
      if (regs.length) await admin.from("instagram_seguidores").upsert(regs, { onConflict: "ig_id,data" });
      return responder({ ok: true, perfis: regs.length });
    }

    // ---------- Relatório do período ----------
    if (corpo.acao === "relatorio") {
      const clienteId = String(corpo.cliente_id ?? "");
      const fim = dataOk(corpo.fim) ? String(corpo.fim) : somarDias(hojeBR(), -1);
      const ini = dataOk(corpo.ini) ? String(corpo.ini) : somarDias(fim, -29);
      const n = Math.max(1, Math.min(400, Math.round((Date.parse(fim) - Date.parse(ini)) / 86400000) + 1));
      const antIni = somarDias(ini, -n), antFim = somarDias(ini, -1);
      const { data: contas } = await admin.from("instagram_contas").select("ig_id, username, nome, foto_url").eq("cliente_id", clienteId).eq("ativa", true);
      const lista = (contas ?? []) as { ig_id: string; username: string; nome: string | null; foto_url: string | null }[];
      if (!lista.length) return responder({ perfis: [], periodo: { ini, fim, antIni, antFim } });

      // Soma as métricas em janelas de até 30 dias (limite da API)
      const totais = async (ig: string, de: string, ate: string) => {
        const soma: Record<string, number> = Object.fromEntries(METRICAS.map((m) => [m, 0]));
        for (let a = de; a <= ate; a = somarDias(a, 30)) {
          const b = somarDias(a, 29) < ate ? somarDias(a, 29) : ate;
          const j = await graph(`${ig}/insights`, { metric: METRICAS.join(","), period: "day", metric_type: "total_value", since: String(unix(a)), until: String(unix(somarDias(b, 1))) });
          for (const x of (j.data as Json[]) ?? []) soma[String(x.name)] = (soma[String(x.name)] ?? 0) + Number((x.total_value as Json | undefined)?.value ?? 0);
        }
        return soma;
      };

      const perfis = await Promise.all(lista.map(async (c) => {
        const out: Json = { ig_id: c.ig_id, username: c.username, nome: c.nome, foto_url: c.foto_url };
        try {
          const [perfil, atual, anterior] = await Promise.all([
            graph(c.ig_id, { fields: "username,name,followers_count,follows_count,media_count,profile_picture_url,biography" }),
            totais(c.ig_id, ini, fim),
            totais(c.ig_id, antIni, antFim).catch(() => null),
          ]);
          Object.assign(out, { seguidores: perfil.followers_count ?? null, seguindo: perfil.follows_count ?? null, publicacoes: perfil.media_count ?? null, foto_url: perfil.profile_picture_url ?? c.foto_url, atual, anterior });

          // Alcance e novos seguidores por dia (a API só dá os últimos 30 dias)
          const limite30 = somarDias(hojeBR(), -30);
          const dIni = ini > limite30 ? ini : limite30;
          if (dIni <= fim) {
            const s = await graph(`${c.ig_id}/insights`, { metric: "reach,follower_count", period: "day", since: String(unix(dIni)), until: String(unix(somarDias(fim, 1))) }).catch(() => ({ data: [] }));
            const serie: Record<string, { alcance?: number; novos?: number }> = {};
            for (const m of (s.data as Json[]) ?? []) for (const v of (m.values as { value: number; end_time: string }[]) ?? []) {
              const dia = somarDias(new Date(Date.parse(v.end_time) - 3 * 3600_000).toISOString().slice(0, 10), -1);
              serie[dia] = { ...serie[dia], [m.name === "reach" ? "alcance" : "novos"]: Number(v.value) };
            }
            out.dias = Object.entries(serie).sort(([a], [b]) => a.localeCompare(b)).map(([data, v]) => ({ data, ...v }));
          }

          // Posts do período, com o desempenho de cada um
          const media = await graph(`${c.ig_id}/media`, { fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count", since: String(unix(ini)), until: String(unix(somarDias(fim, 1))), limit: "50" });
          const posts = ((media.data as Json[]) ?? []).slice(0, 30);
          out.posts = await Promise.all(posts.map(async (p) => {
            const ins: Record<string, number> = {};
            try {
              const j = await graph(`${p.id}/insights`, { metric: "reach,views,saved,shares,total_interactions" });
              for (const x of (j.data as Json[]) ?? []) ins[String(x.name)] = Number(((x.values as { value: number }[]) ?? [])[0]?.value ?? 0);
            } catch { /* tipo sem insights */ }
            return {
              id: p.id, legenda: String(p.caption ?? "").slice(0, 220), tipo: p.media_product_type === "REELS" ? "Reels" : p.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : p.media_type === "VIDEO" ? "Vídeo" : "Imagem",
              link: p.permalink, imagem: p.thumbnail_url ?? p.media_url ?? null, quando: p.timestamp,
              curtidas: Number(p.like_count ?? 0), comentarios: Number(p.comments_count ?? 0),
              alcance: ins.reach ?? null, visualizacoes: ins.views ?? null, salvos: ins.saved ?? null, compartilhamentos: ins.shares ?? null, interacoes: ins.total_interactions ?? null,
            };
          }));

          // Público (seguidores): idade x gênero e cidades
          const pub: Json = {};
          for (const br of ["age", "gender", "city"]) {
            try {
              const j = await graph(`${c.ig_id}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: br });
              const res = (((((j.data as Json[])[0]?.total_value as Json)?.breakdowns as Json[]) ?? [])[0]?.results as { dimension_values: string[]; value: number }[]) ?? [];
              pub[br] = res.map((r) => ({ chave: r.dimension_values[0], valor: r.value })).sort((a, b) => b.valor - a.valor).slice(0, br === "city" ? 8 : 10);
            } catch { /* menos de 100 seguidores: sem público */ }
          }
          out.publico = pub;
        } catch (e) {
          out.erro = (e as Error).message;
        }
        // Seguidores guardados (fotos diárias)
        const { data: hist } = await admin.from("instagram_seguidores").select("data, seguidores").eq("ig_id", c.ig_id).gte("data", antIni).lte("data", fim).order("data");
        out.historico = hist ?? [];
        return out;
      }));
      return responder({ perfis, periodo: { ini, fim, antIni, antFim } });
    }
    return responder({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return responder({ erro: (e as Error).message }, 502);
  }
});
