// Painel do cliente (público, com senha). Nada de login do sistema: o cliente entra com o link + senha
// e recebe um passe assinado de 12 horas. Só devolve dados daquele cliente.
// POST { acao: "entrar", slug, senha }            → { token, cliente }
// POST { acao: "dados", token, ini, fim, mes }     → tráfego do período + diário do mês + conquistas
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
type Json = Record<string, unknown>;
const HORAS = 12;

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
async function assinar(texto: string, chave: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(`portal:${chave}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(texto))));
}
const dataOk = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const somarDias = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const hojeBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (c: Json, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return responder({ erro: "Método não aceito." }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const chave = ((await admin.rpc("ler_segredo", { nome: "chave_cron_meta" })).data as string | null) ?? "";
  if (!chave) return responder({ erro: "Painel indisponível." }, 503);
  const corpo = (await req.json().catch(() => ({}))) as Json;

  const dadosCliente = async (id: string) => {
    const { data } = await admin.from("clientes").select("nome, logo_url").eq("id", id).maybeSingle();
    return data as { nome: string; logo_url: string | null } | null;
  };

  // ---------- Entrar ----------
  if (corpo.acao === "entrar") {
    const slug = String(corpo.slug ?? "").toLowerCase().trim();
    const senha = String(corpo.senha ?? "");
    if (!slug || !senha || senha.length > 200) return responder({ erro: "Informe a senha." }, 400);
    const r = await admin.rpc("portal_entrar", { p_slug: slug, p_senha: senha });
    if (r.error) return responder({ erro: /bloqueado/.test(r.error.message) ? "Muitas tentativas. Aguarde 15 minutos e tente de novo." : "Não foi possível entrar agora." }, /bloqueado/.test(r.error.message) ? 429 : 500);
    if (!r.data) { await new Promise((ok) => setTimeout(ok, 600)); return responder({ erro: "Senha incorreta." }, 401); }
    const id = String(r.data);
    const exp = String(Date.now() + HORAS * 3600_000);
    const token = `${id}.${exp}.${await assinar(`${id}.${exp}`, chave)}`;
    return responder({ token, cliente: await dadosCliente(id) });
  }

  // ---------- Dados ----------
  if (corpo.acao === "dados") {
    const [id, exp, sig] = String(corpo.token ?? "").split(".");
    if (!id || !exp || !sig || Number(exp) < Date.now() || sig !== (await assinar(`${id}.${exp}`, chave))) return responder({ erro: "Sessão expirada. Entre de novo." }, 401);
    const { data: portal } = await admin.from("portal_clientes").select("ativo, mostrar").eq("cliente_id", id).maybeSingle();
    if (!portal || !(portal as { ativo: boolean }).ativo) return responder({ erro: "Este painel foi desativado." }, 403);
    const mostrar = { trafego: true, diario: true, conquistas: true, ...((portal as { mostrar: Json }).mostrar ?? {}) } as Record<string, boolean>;

    const fim = dataOk(corpo.fim) ? String(corpo.fim) : somarDias(hojeBR(), -1);
    const ini = dataOk(corpo.ini) ? String(corpo.ini) : somarDias(fim, -29);
    const n = Math.max(1, Math.min(400, Math.round((Date.parse(fim) - Date.parse(ini)) / 86400000) + 1));
    const antIni = somarDias(ini, -n), antFim = somarDias(ini, -1);
    const mes = typeof corpo.mes === "string" && /^\d{4}-\d{2}$/.test(corpo.mes) ? corpo.mes : hojeBR().slice(0, 7);
    const [a, m] = mes.split("-").map(Number);
    const mesIni = `${mes}-01`, mesFim = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);

    const saida: Json = { cliente: await dadosCliente(id), mostrar, periodo: { ini, fim, antIni, antFim }, mes };

    // Tráfego (Meta + Google, do banco sincronizado 3x ao dia)
    if (mostrar.trafego) {
      const { data: contas } = await admin.from("contas_anuncio").select("id, plataforma").eq("cliente_id", id).eq("ativa", true);
      const plat = new Map(((contas ?? []) as { id: string; plataforma: string }[]).map((c) => [c.id, c.plataforma]));
      type L = { conta_id: string; data: string; campanha: string; gasto: number; impressoes: number; cliques: number; resultados: number; leads: number; conversas: number; tipo_resultado: string | null };
      let linhas: L[] = [];
      if (plat.size) {
        const { data } = await admin.from("metricas_diarias").select("conta_id, data, campanha, gasto, impressoes, cliques, resultados, leads, conversas, tipo_resultado").in("conta_id", [...plat.keys()]).gte("data", antIni).lte("data", fim).limit(20000);
        linhas = (data ?? []) as L[];
      }
      const contatosDe = (l: L) => plat.get(l.conta_id) === "google" ? Number(l.resultados) : Number(l.conversas) + Number(l.leads) + (/contact|lead/.test(l.tipo_resultado ?? "") && !Number(l.leads) ? Number(l.resultados) : 0);
      const soma = (ls: L[]) => ls.reduce((s, l) => ({ gasto: s.gasto + Number(l.gasto), impressoes: s.impressoes + Number(l.impressoes), cliques: s.cliques + Number(l.cliques), contatos: s.contatos + contatosDe(l) }), { gasto: 0, impressoes: 0, cliques: 0, contatos: 0 });
      const atual = linhas.filter((l) => l.data >= ini), anterior = linhas.filter((l) => l.data < ini);
      const porPlat = (p: string) => ({ atual: soma(atual.filter((l) => plat.get(l.conta_id) === p)), anterior: soma(anterior.filter((l) => plat.get(l.conta_id) === p)) });
      const dias = Array.from({ length: n }, (_, k) => { const d = somarDias(ini, k); const s = soma(atual.filter((l) => l.data === d)); return { data: d, gasto: Math.round(s.gasto * 100) / 100, contatos: s.contatos }; });
      const camp = new Map<string, { nome: string; plataforma: string; gasto: number; contatos: number; cliques: number }>();
      for (const l of atual) {
        const k = `${l.conta_id}|${l.campanha}`;
        const c = camp.get(k) ?? { nome: l.campanha, plataforma: plat.get(l.conta_id) ?? "meta", gasto: 0, contatos: 0, cliques: 0 };
        c.gasto += Number(l.gasto); c.contatos += contatosDe(l); c.cliques += Number(l.cliques);
        camp.set(k, c);
      }
      saida.trafego = {
        plataformas: [...new Set(plat.values())],
        total: { atual: soma(atual), anterior: soma(anterior) },
        meta: porPlat("meta"),
        google: porPlat("google"),
        dias,
        campanhas: [...camp.values()].filter((c) => c.gasto > 0).sort((x, y) => y.gasto - x.gasto).slice(0, 8),
      };
    }

    // Diário de Bordo do mês (só o que vai para o cliente)
    if (mostrar.diario) {
      const ts0 = `${mesIni}T00:00:00-03:00`, ts1 = `${somarDias(mesFim, 1)}T00:00:00-03:00`;
      const [rg, tf, mt] = await Promise.all([
        admin.from("registros").select("id, tipo, canal, data, nota, acoes, alteracoes, criado_em").eq("cliente_id", id).gte("data", mesIni).lte("data", mesFim).in("tipo", ["otimizacao", "reuniao", "conquista", "combinado"]).order("criado_em"),
        admin.from("tarefas").select("id, titulo, concluida_em, pilar, lado").eq("cliente_id", id).eq("status", "feita").gte("concluida_em", ts0).lt("concluida_em", ts1).order("concluida_em"),
        admin.from("meta_atividades").select("id, quando, evento_texto, evento, objeto_tipo, objeto_nome, automatico").eq("cliente_id", id).eq("automatico", false).gte("quando", ts0).lt("quando", ts1).order("quando").limit(300),
      ]);
      const diaSP = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
      const TIPO: Record<string, string> = { otimizacao: "Otimização", reuniao: "Reunião", conquista: "Conquista", combinado: "Combinado" };
      const OBJ: Record<string, string> = { CAMPAIGN: "campanha", AD_SET: "conjunto", AD: "anúncio", CAMPAIGN_GROUP: "campanha", ACCOUNT: "conta" };
      type R = { id: string; tipo: string; canal: string | null; data: string; nota: string | null; acoes: string[]; alteracoes: { tipo: string; descricao: string }[]; criado_em: string };
      type T = { id: string; titulo: string; concluida_em: string; pilar: string; lado: string | null };
      type M = { id: string; quando: string; evento_texto: string | null; evento: string; objeto_tipo: string | null; objeto_nome: string | null };
      const itens = [
        ...((rg.data ?? []) as R[]).filter((r) => r.tipo !== "conquista").map((r) => ({
          id: `r-${r.id}`, dia: r.data, quando: r.criado_em, tipo: r.tipo,
          titulo: `${TIPO[r.tipo] ?? r.tipo}${r.canal ? ` · ${r.canal === "google" ? "Google Ads" : "Meta Ads"}` : ""}`,
          texto: r.nota ?? "",
          detalhes: [...(r.acoes?.length ? [r.acoes.join(" · ")] : []), ...(r.alteracoes ?? []).map((x) => `${x.tipo}: ${x.descricao}`)],
        })),
        ...((tf.data ?? []) as T[]).filter((t) => !["interno", "cs"].includes(t.pilar) && t.lado !== "cliente" && !/^revis[aã]o/i.test(t.titulo)).map((t) => ({
          id: `t-${t.id}`, dia: diaSP(t.concluida_em), quando: t.concluida_em, tipo: "entrega", titulo: "Entrega concluída", texto: t.titulo, detalhes: [] as string[],
        })),
        ...((mt.data ?? []) as M[]).map((x) => ({
          id: `m-${x.id}`, dia: diaSP(x.quando), quando: x.quando, tipo: "ajuste", titulo: `Ajuste na Meta · ${x.evento_texto ?? x.evento}`,
          texto: [x.objeto_tipo ? OBJ[x.objeto_tipo] ?? "" : "", x.objeto_nome ? `"${x.objeto_nome}"` : ""].filter(Boolean).join(" "), detalhes: [] as string[],
        })),
      ].sort((p, q) => q.quando.localeCompare(p.quando));
      saida.diario = itens;
    }

    // Instagram (resumo do mesmo período, pela função instagram com a chave do servidor)
    if (mostrar.instagram !== false) {
      const { count } = await admin.from("instagram_contas").select("ig_id", { count: "exact", head: true }).eq("cliente_id", id).eq("ativa", true);
      if (count) {
        try {
          const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/instagram`, { method: "POST", headers: { "Content-Type": "application/json", "x-chave-cron": chave }, body: JSON.stringify({ acao: "relatorio", cliente_id: id, ini, fim }) });
          const j = (await r.json()) as { perfis?: Json[] };
          saida.instagram = (j.perfis ?? []).filter((p) => !p.erro).map((p) => ({
            username: p.username, foto_url: p.foto_url, seguidores: p.seguidores, atual: p.atual, anterior: p.anterior,
            novos: ((p.dias as { novos?: number }[] | undefined) ?? []).reduce((s, x) => s + (x.novos ?? 0), 0),
            posts: ((p.posts as { alcance: number | null; curtidas: number }[] | undefined) ?? []).sort((x, y) => (y.alcance ?? y.curtidas) - (x.alcance ?? x.curtidas)).slice(0, 4),
          }));
        } catch { /* Instagram fora do ar: o painel segue sem ele */ }
      }
    }

    // Pequenas conquistas (últimos 6 meses)
    if (mostrar.conquistas) {
      const { data } = await admin.from("registros").select("id, data, nota").eq("cliente_id", id).eq("tipo", "conquista").gte("data", somarDias(hojeBR(), -183)).order("data", { ascending: false }).limit(30);
      saida.conquistas = ((data ?? []) as { id: string; data: string; nota: string | null }[]).filter((c) => c.nota?.trim());
    }
    return responder(saida);
  }

  return responder({ erro: "Ação desconhecida." }, 400);
});
