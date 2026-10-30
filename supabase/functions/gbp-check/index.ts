// GBP Check próprio: busca empresas no Google (Places API New), lê os dados públicos do perfil
// e calcula a grade de ranking local (posição da empresa numa busca feita de vários pontos ao redor dela).
// Chave: segredo GOOGLE_PLACES_KEY ou 'google_places_key' no Vault (lido por ler_segredo). Só o time acessa.
// Análise completa e grade "Maps real": DataForSEO (dataforseo_login / dataforseo_senha no Vault), cobrado por consulta.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
type Json = Record<string, unknown>;

const CAMPOS_DETALHE = [
  "id", "displayName", "formattedAddress", "location", "primaryType", "primaryTypeDisplayName", "types",
  "rating", "userRatingCount", "nationalPhoneNumber", "websiteUri", "googleMapsUri", "regularOpeningHours",
  "editorialSummary", "photos", "reviews", "businessStatus",
].join(",");

async function places(caminho: string, chave: string, campos: string, corpo?: Json): Promise<Json> {
  const r = await fetch(`https://places.googleapis.com/v1/${caminho}`, {
    method: corpo ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": chave, "X-Goog-FieldMask": campos, "Accept-Language": "pt-BR" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = (await r.json()) as Json;
  if (j.error) throw new Error((j.error as { message?: string }).message ?? "Erro na API do Google");
  return j;
}

type Dfs = { auth: string };
/** Chamada à DataForSEO. Devolve a primeira tarefa e o custo. */
async function dfs(c: Dfs, caminho: string, corpo?: Json[]): Promise<{ tarefa: Json; custo: number }> {
  const r = await fetch(`https://api.dataforseo.com/v3/${caminho}`, {
    method: corpo ? "POST" : "GET",
    headers: { Authorization: `Basic ${c.auth}`, "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = (await r.json().catch(() => ({}))) as Json;
  if (j.status_code !== 20000) throw new Error(`DataForSEO: ${j.status_message ?? r.status}`);
  const tarefa = ((j.tasks as Json[]) ?? [])[0] ?? {};
  return { tarefa, custo: Number(j.cost ?? 0) };
}
const itens = (t: Json) => (((t.result as Json[]) ?? [])[0]?.items as Json[]) ?? [];
const pronta = (t: Json) => t.status_code === 20000;

function resumoInfo(i: Json) {
  const wt = (i.work_time as { work_hours?: { timetable?: Record<string, unknown> | null } } | null)?.work_hours?.timetable;
  const attrs = i.attributes as { available_attributes?: Record<string, string[]> } | null;
  return {
    titulo: i.title ?? null,
    categoria: i.category ?? null,
    categorias_adicionais: (i.additional_categories as string[] | null) ?? [],
    descricao: i.description ?? null,
    telefone: i.phone ?? null,
    site: i.url ?? null,
    nota: (i.rating as Json | null)?.value ?? null,
    avaliacoes: (i.rating as Json | null)?.votes_count ?? null,
    distribuicao: i.rating_distribution ?? null,
    fotos: i.total_photos ?? null,
    reivindicado: i.is_claimed ?? null,
    perguntas: i.questions_and_answers_count ?? null,
    tem_horario: Boolean(wt && Object.keys(wt).length),
    atributos: attrs?.available_attributes ? Object.values(attrs.available_attributes).flat().length : 0,
    servicos: Array.isArray(i.services) ? (i.services as unknown[]).length : 0,
    temas: i.place_topics ?? null,
    imagem: i.main_image ?? null,
    lat: i.latitude ?? null,
    lng: i.longitude ?? null,
  };
}

/** Desloca um ponto em km (norte/leste). */
function deslocar(lat: number, lng: number, norteKm: number, lesteKm: number) {
  return { lat: lat + norteKm / 111.32, lng: lng + lesteKm / (111.32 * Math.cos((lat * Math.PI) / 180)) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Json, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u.user) return responder({ erro: "Sua sessão expirou. Saia e entre de novo no sistema." }, 401);
  const { data: m } = await admin.from("membros").select("id").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
  if (!m) return responder({ erro: "Sem acesso." }, 403);

  const chave = Deno.env.get("GOOGLE_PLACES_KEY") || ((await admin.rpc("ler_segredo", { nome: "google_places_key" })).data as string | null);
  if (!chave) return responder({ erro: "Falta conectar a API do Google (chave google_places_key no Vault do Supabase)." }, 412);

  const corpo = (await req.json().catch(() => ({}))) as Json;

  // DataForSEO (opcional)
  const [dl, ds] = await Promise.all([admin.rpc("ler_segredo", { nome: "dataforseo_login" }), admin.rpc("ler_segredo", { nome: "dataforseo_senha" })]);
  const dfsCred: Dfs | null = dl.data && ds.data ? { auth: btoa(`${dl.data}:${ds.data}`) } : null;
  const exigirDfs = () => {
    if (!dfsCred) throw new Error("Falta conectar a DataForSEO (Integrações).");
    return dfsCred;
  };
  try {
    if (corpo.acao === "saldo") {
      const c = exigirDfs();
      const { tarefa } = await dfs(c, "appendix/user_data");
      const money = (((tarefa.result as Json[]) ?? [])[0]?.money as Json) ?? {};
      return responder({ ok: true, saldo: money.balance ?? null });
    }

    if (corpo.acao === "completo") {
      const c = exigirDfs();
      const placeId = String(corpo.place_id ?? "");
      if (!placeId) return responder({ erro: "Perfil sem ligação com o Google." }, 400);
      const base = { location_name: "Brazil", language_code: "pt" };
      const [info, rev, upd] = await Promise.all([
        dfs(c, "business_data/google/my_business_info/live", [{ keyword: `place_id:${placeId}`, ...base }]),
        dfs(c, "business_data/google/reviews/task_post", [{ place_id: placeId, ...base, depth: 50, sort_by: "newest", priority: 2 }]),
        dfs(c, "business_data/google/my_business_updates/task_post", [{ keyword: `place_id:${placeId}`, ...base, depth: 20, priority: 2 }]),
      ]);
      const item = itens(info.tarefa)[0];
      if (!item) return responder({ erro: "A DataForSEO não encontrou este perfil." }, 404);
      return responder({
        ok: true,
        info: resumoInfo(item),
        tarefas: { avaliacoes: rev.tarefa.id, postagens: upd.tarefa.id },
        custo: info.custo + rev.custo + upd.custo,
      });
    }

    if (corpo.acao === "completo_resultado") {
      const c = exigirDfs();
      const [rev, upd] = await Promise.all([
        dfs(c, `business_data/google/reviews/task_get/${encodeURIComponent(String(corpo.avaliacoes))}`),
        dfs(c, `business_data/google/my_business_updates/task_get/${encodeURIComponent(String(corpo.postagens))}`),
      ]);
      if (!pronta(rev.tarefa) || !pronta(upd.tarefa)) return responder({ ok: true, pronto: false });
      const avaliacoes = itens(rev.tarefa).map((x) => ({
        nota: (x.rating as Json | null)?.value ?? null,
        texto: x.review_text ?? null,
        autor: x.profile_name ?? null,
        data: x.timestamp ?? null,
        respondida: Boolean(x.owner_answer),
        resposta_data: x.owner_timestamp ?? null,
      }));
      const postagens = itens(upd.tarefa).map((x) => ({ data: x.timestamp ?? null, texto: (x.post_text ?? x.snippet ?? null) as string | null, imagem: x.images_url ?? null, link: x.url ?? null }));
      return responder({ ok: true, pronto: true, avaliacoes, postagens, custo: rev.custo + upd.custo });
    }

    if (corpo.acao === "buscar") {
      const j = await places("places:searchText", chave, "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.primaryTypeDisplayName", {
        textQuery: String(corpo.texto ?? ""),
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 8,
      });
      return responder({ ok: true, resultados: j.places ?? [] });
    }

    if (corpo.acao === "detalhes") {
      const j = await places(`places/${encodeURIComponent(String(corpo.place_id))}`, chave, CAMPOS_DETALHE);
      return responder({ ok: true, perfil: j });
    }

    if (corpo.acao === "grade") {
      const palavra = String(corpo.palavra ?? "").trim();
      const placeId = String(corpo.place_id ?? "");
      const tamanho = Math.min(7, Math.max(3, Number(corpo.tamanho ?? 5)));
      const passo = Math.min(5, Math.max(0.3, Number(corpo.passo_km ?? 1)));
      if (!palavra || !placeId) return responder({ erro: "Informe a palavra e o perfil." }, 400);
      const base = await places(`places/${encodeURIComponent(placeId)}`, chave, "id,location");
      const { latitude, longitude } = base.location as { latitude: number; longitude: number };
      const meio = (tamanho - 1) / 2;
      const pontos: { linha: number; coluna: number; lat: number; lng: number }[] = [];
      for (let i = 0; i < tamanho; i++)
        for (let k = 0; k < tamanho; k++) {
          const p = deslocar(latitude, longitude, (meio - i) * passo, (k - meio) * passo);
          pontos.push({ linha: i, coluna: k, ...p });
        }
      if (corpo.fonte === "maps") {
        const c = exigirDfs();
        const zoom = passo <= 0.5 ? 16 : passo <= 1 ? 15 : passo <= 2 ? 14 : 13;
        let custo = 0;
        const resultado = await Promise.all(
          pontos.map(async (p) => {
            try {
              const r = await dfs(c, "serp/google/maps/live/advanced", [{ keyword: palavra, location_coordinate: `${p.lat.toFixed(6)},${p.lng.toFixed(6)},${zoom}z`, language_code: "pt", depth: 20 }]);
              custo += r.custo;
              const lista = itens(r.tarefa).filter((x) => x.type === "maps_search");
              const achado = lista.find((x) => x.place_id === placeId);
              return { ...p, posicao: achado ? Number(achado.rank_group) : null, primeiro: (lista[0]?.title as string) ?? null };
            } catch {
              return { ...p, posicao: null, primeiro: null };
            }
          }),
        );
        return responder({ ok: true, fonte: "maps", centro: { lat: latitude, lng: longitude }, tamanho, passo_km: passo, pontos: resultado, custo });
      }
      const resultado = await Promise.all(
        pontos.map(async (p) => {
          const j = await places("places:searchText", chave, "places.id,places.displayName", {
            textQuery: palavra,
            languageCode: "pt-BR",
            regionCode: "BR",
            pageSize: 20,
            locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: Math.max(500, passo * 700) } },
          }).catch(() => ({ places: [] }));
          const lista = (j.places as { id: string; displayName?: { text: string } }[]) ?? [];
          const pos = lista.findIndex((x) => x.id === placeId);
          return { ...p, posicao: pos >= 0 ? pos + 1 : null, primeiro: lista[0]?.displayName?.text ?? null };
        }),
      );
      return responder({ ok: true, centro: { lat: latitude, lng: longitude }, tamanho, passo_km: passo, pontos: resultado });
    }

    return responder({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return responder({ erro: (e as Error).message }, 502);
  }
});
