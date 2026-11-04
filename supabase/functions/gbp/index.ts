// Perfil da Empresa no Google (API oficial) para as fichas que a agência gerencia:
// monitoramento de todas as fichas, categorias, resposta de avaliação com IA e evolução mensal (até 18 meses).
// Usa a mesma conexão OAuth do Google Ads (google_ads_client_id / secret / refresh_token no Vault).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
type Json = Record<string, unknown>;
function hojeBR(deslocamento = 0) {
  return new Date(Date.now() - 3 * 3600_000 + deslocamento * 86400_000).toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Json, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const segredo = async (nome: string) => ((await admin.rpc("ler_segredo", { nome })).data as string | null) ?? "";

  const chaveCron = req.headers.get("x-chave-cron");
  const porAgendamento = chaveCron ? (await admin.rpc("validar_chave_cron", { chave: chaveCron })).data === true : false;
  if (!porAgendamento) {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = await admin.auth.getUser(jwt);
    if (!data.user) return responder({ erro: "Faça login de novo no sistema." }, 401);
    const { data: m } = await admin.from("membros").select("id").or(`user_id.eq.${data.user.id},email.eq.${(data.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
    if (!m) return responder({ erro: "Sem acesso." }, 403);
  }

  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; place_id?: string; busca?: string; empresa?: string; autor?: string; nota?: number; texto?: string; tom?: string; meses?: number; id?: string; tema?: string; tipo?: string };
  const [clientId, clientSecret, refresh] = await Promise.all([segredo("google_ads_client_id"), segredo("google_ads_client_secret"), segredo("google_ads_refresh_token")]);

  // A resposta com IA não precisa do Google
  if (corpo.acao !== "gbp_ia_resposta" && corpo.acao !== "gbp_post_ia") {
    if (!clientId || !clientSecret || !refresh) return responder({ erro: "Conecte o Google em Integrações." }, 412);
  }
  const semGoogle = corpo.acao === "gbp_ia_resposta" || corpo.acao === "gbp_post_ia";
  const tk = semGoogle ? {} as Json : (await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refresh, grant_type: "refresh_token" }),
  })).json()) as Json;
  if (!semGoogle && !tk.access_token) return responder({ erro: "O Google recusou a conexão. Reconecte em Integrações." }, 401);

  async function gapi(u: string, init?: RequestInit): Promise<Json> {
    const r = await fetch(u, { ...init, headers: { Authorization: `Bearer ${tk.access_token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const j = (await r.json().catch(() => ({}))) as Json;
    if (!r.ok) {
      const e = (j.error as { message?: string; status?: string } | undefined);
      if (r.status === 403 && /scope|insufficient/i.test(e?.message ?? "")) throw new Error("Falta autorizar o Google Meu Negócio: clique em Reconectar Google em Integrações.");
      throw new Error(e?.message ?? `HTTP ${r.status}`);
    }
    return j;
  }
  async function locais() {
    const contas: Json[] = [];
    let pg = "";
    do {
      const j = await gapi(`https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20${pg ? `&pageToken=${pg}` : ""}`);
      contas.push(...((j.accounts as Json[]) ?? []));
      pg = String(j.nextPageToken ?? "");
    } while (pg);
    const lista: Json[] = [];
    for (const c of contas) {
      let p2 = "";
      do {
        const j = await gapi(`https://mybusinessbusinessinformation.googleapis.com/v1/${c.name}/locations?pageSize=100&readMask=name,title,storefrontAddress,metadata,websiteUri,phoneNumbers${p2 ? `&pageToken=${p2}` : ""}`);
        for (const l of (j.locations as Json[]) ?? []) {
          const md = (l.metadata as Json) ?? {};
          const end = (l.storefrontAddress as Json) ?? {};
          lista.push({
            conta: c.name,
            conta_nome: c.accountName,
            local: l.name,
            nome: l.title,
            place_id: md.placeId ?? null,
            maps: md.mapsUri ?? null,
            cidade: end.locality ?? null,
            site: l.websiteUri ?? null,
          });
        }
        p2 = String(j.nextPageToken ?? "");
      } while (p2);
    }
    return lista;
  }

  // ---------------- Monitoramento de todas as fichas gerenciadas ----------------
  if (corpo.acao === "gbp_monitor") {
    try {
      const todos = await locais();
      const NOTA: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
      const fichas = await Promise.all(todos.map(async (l) => {
        const localId = String(l.local).split("/")[1];
        const [rev, posts, vom, det] = await Promise.all([
          gapi(`https://mybusiness.googleapis.com/v4/${l.conta}/locations/${localId}/reviews?pageSize=50&orderBy=updateTime%20desc`).catch((e) => ({ erro: e.message } as Json)),
          gapi(`https://mybusiness.googleapis.com/v4/${l.conta}/locations/${localId}/localPosts?pageSize=10`).catch((e) => ({ erro: e.message } as Json)),
          gapi(`https://mybusinessverifications.googleapis.com/v1/locations/${localId}/VoiceOfMerchantState`).catch(() => ({} as Json)),
          gapi(`https://mybusinessbusinessinformation.googleapis.com/v1/locations/${localId}?readMask=openInfo,profile,categories,regularHours,specialHours,serviceItems,phoneNumbers,websiteUri`).catch(() => ({} as Json)),
        ]);
        const reviews = ((rev.reviews as Json[]) ?? []).map((r) => ({
          id: r.name,
          autor: (r.reviewer as Json | undefined)?.displayName ?? "Anônimo",
          nota: NOTA[String(r.starRating)] ?? null,
          texto: r.comment ?? "",
          data: r.createTime,
          resposta: (r.reviewReply as Json | undefined)?.comment ?? null,
        }));
        const ps = ((posts.localPosts as Json[]) ?? []).map((p) => ({ data: p.createTime, tipo: p.topicType, texto: String(p.summary ?? "").slice(0, 200), estado: p.state, url: p.searchUrl ?? null }));
        const cats = (det.categories as Json | undefined) ?? {};
        return {
          ...l,
          media: rev.averageRating ?? null,
          total_avaliacoes: rev.totalReviewCount ?? null,
          sem_resposta: reviews.filter((r) => !r.resposta).length,
          ultima_avaliacao: reviews[0]?.data ?? null,
          avaliacoes: reviews,
          ultima_postagem: ps.map((p) => String(p.data)).sort().pop() ?? null,
          postagens: ps,
          status: (det.openInfo as Json | undefined)?.status ?? null,
          verificada: vom.hasVoiceOfMerchant ?? null,
          problema: (vom.complyWithGuidelines as Json | undefined)?.recommendationReason ?? (vom.resolveOwnershipConflict ? "Conflito de propriedade" : vom.verify ? "Precisa verificar" : vom.waitForVoiceOfMerchant ? "Aguardando o Google" : null),
          descricao: (det.profile as Json | undefined)?.description ?? null,
          categoria: (cats.primaryCategory as Json | undefined)?.displayName ?? null,
          categorias_extras: ((cats.additionalCategories as Json[]) ?? []).map((c) => c.displayName),
          tem_horario: !!det.regularHours,
          servicos: ((det.serviceItems as Json[]) ?? []).length,
          erros: [rev.erro, posts.erro].filter(Boolean),
        };
      }));
      return responder({ ok: true, fichas });
    } catch (e) {
      return responder({ erro: (e as Error).message }, 500);
    }
  }

  // ---------------- Categorias do Google (busca) ----------------
  if (corpo.acao === "gbp_categorias") {
    try {
      const b = String(corpo.busca ?? "").trim().replace(/"/g, "");
      if (b.length < 2) return responder({ ok: true, categorias: [] });
      const j = await gapi(`https://mybusinessbusinessinformation.googleapis.com/v1/categories?regionCode=BR&languageCode=pt-BR&view=BASIC&pageSize=50&filter=${encodeURIComponent(`displayName="${b}"`)}`);
      return responder({ ok: true, categorias: ((j.categories as Json[]) ?? []).map((c) => ({ id: c.name, nome: c.displayName })) });
    } catch (e) {
      return responder({ erro: (e as Error).message }, 500);
    }
  }

  // ---------------- Resposta de avaliação sugerida pela IA ----------------
  if (corpo.acao === "gbp_ia_resposta") {
    const chave = await segredo("openai_api_key");
    if (!chave) return responder({ erro: "Falta a chave da IA (OpenAI) em Integrações." }, 412);
    const nota = Number(corpo.nota ?? 5);
    const pedido = `Escreva a resposta do dono da empresa "${corpo.empresa ?? ""}" para esta avaliação no Google.
Autor: ${corpo.autor ?? "cliente"} · Nota: ${nota} de 5
Avaliação: ${String(corpo.texto ?? "").trim() || "(sem texto, só a nota)"}

Regras: português do Brasil, ${corpo.tom || "cordial e profissional"}, de 2 a 4 frases, chame a pessoa pelo primeiro nome, agradeça, cite algo específico do que ela escreveu quando houver, inclua de forma natural o serviço/cidade da empresa se fizer sentido, sem emojis em excesso e sem prometer nada que a empresa não possa cumprir. ${nota <= 3 ? "Como a nota é baixa: peça desculpas sem se defender, mostre que vai melhorar e convide para conversar por um canal privado." : ""} Responda só com o texto da resposta.`;
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("ASSISTENTE_MODELO_OPENAI") || "gpt-5.5", input: pedido }),
    });
    const j = (await r.json()) as Json;
    if (!r.ok) return responder({ erro: (j.error as Json | undefined)?.message ?? "A IA não respondeu." }, 502);
    const texto = ((j.output as Json[]) ?? []).filter((o) => o.type === "message").flatMap((o) => (o.content as Json[]) ?? []).map((c) => c.text).join("\n").trim();
    return responder({ ok: true, texto });
  }

  // ---------------- Evolução mensal (até 18 meses) para comparar períodos ----------------
  if (corpo.acao === "gbp_evolucao") {
    try {
      const todos = await locais();
      const loc = todos.find((l) => l.place_id && l.place_id === corpo.place_id);
      if (!loc) return responder({ ok: true, encontrado: false });
      const localId = String(loc.local).split("/")[1];
      const meses = Math.min(Math.max(Number(corpo.meses ?? 18), 2), 18);
      const fimD = new Date(hojeBR(-1) + "T12:00:00Z");
      const iniD = new Date(Date.UTC(fimD.getUTCFullYear(), fimD.getUTCMonth() - (meses - 1), 1));
      const METRICAS = ["CALL_CLICKS", "WEBSITE_CLICKS", "BUSINESS_DIRECTION_REQUESTS", "BUSINESS_CONVERSATIONS", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "BUSINESS_IMPRESSIONS_DESKTOP_MAPS"];
      const q = new URLSearchParams();
      for (const m of METRICAS) q.append("dailyMetrics", m);
      q.set("dailyRange.startDate.year", String(iniD.getUTCFullYear())); q.set("dailyRange.startDate.month", String(iniD.getUTCMonth() + 1)); q.set("dailyRange.startDate.day", "1");
      q.set("dailyRange.endDate.year", String(fimD.getUTCFullYear())); q.set("dailyRange.endDate.month", String(fimD.getUTCMonth() + 1)); q.set("dailyRange.endDate.day", String(fimD.getUTCDate()));
      const perf = await gapi(`https://businessprofileperformance.googleapis.com/v1/locations/${localId}:fetchMultiDailyMetricsTimeSeries?${q}`);
      const porMes = new Map<string, Record<string, number>>();
      for (const grupo of (perf.multiDailyMetricTimeSeries as Json[]) ?? []) {
        for (const serie of (grupo.dailyMetricTimeSeries as Json[]) ?? []) {
          const metrica = String(serie.dailyMetric);
          for (const v of (((serie.timeSeries as Json)?.datedValues as Json[]) ?? [])) {
            const d = v.date as { year: number; month: number };
            const k = `${d.year}-${String(d.month).padStart(2, "0")}`;
            const linha = porMes.get(k) ?? {};
            linha[metrica] = (linha[metrica] ?? 0) + Number(v.value ?? 0);
            porMes.set(k, linha);
          }
        }
      }
      return responder({ ok: true, encontrado: true, meses: [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, m]) => ({ mes, ...m })) });
    } catch (e) {
      return responder({ erro: (e as Error).message }, 500);
    }
  }



  // ---------------- Análise completa de uma ficha gerenciada (dados do dono, API oficial) ----------------
  if (corpo.acao === "gbp_analise") {
    try {
      const todos = await locais();
      const loc = todos.find((l) => l.place_id && l.place_id === corpo.place_id);
      if (!loc) return responder({ ok: true, encontrado: false });
      const localId = String(loc.local).split("/")[1];
      const base4 = `https://mybusiness.googleapis.com/v4/${loc.conta}/locations/${localId}`;
      const avisos: string[] = [];
      const seguro = async (u: string) => { try { return await gapi(u); } catch (e) { avisos.push((e as Error).message.split(". ")[0]); return {} as Json; } };
      const todasPaginas = async (u: string, campo: string, max: number) => {
        const lista: Json[] = [];
        let pg = "";
        let total: unknown = null;
        let extra: Json = {};
        do {
          const j = await seguro(`${u}${u.includes("?") ? "&" : "?"}pageSize=${campo === "reviews" ? 50 : 100}${pg ? `&pageToken=${pg}` : ""}`);
          lista.push(...((j[campo] as Json[]) ?? []));
          total = j.totalMediaItemCount ?? j.totalReviewCount ?? total;
          if (campo === "reviews") extra = { media: j.averageRating ?? null };
          pg = String(j.nextPageToken ?? "");
        } while (pg && lista.length < max);
        return { lista, total, extra };
      };

      const fimD = new Date(hojeBR(-1) + "T12:00:00Z");
      const iniD = new Date(Date.UTC(fimD.getUTCFullYear(), fimD.getUTCMonth() - 17, 1));
      const METRICAS = ["CALL_CLICKS", "WEBSITE_CLICKS", "BUSINESS_DIRECTION_REQUESTS", "BUSINESS_CONVERSATIONS", "BUSINESS_BOOKINGS", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "BUSINESS_IMPRESSIONS_DESKTOP_MAPS"];
      const q = new URLSearchParams();
      for (const m of METRICAS) q.append("dailyMetrics", m);
      q.set("dailyRange.startDate.year", String(iniD.getUTCFullYear())); q.set("dailyRange.startDate.month", String(iniD.getUTCMonth() + 1)); q.set("dailyRange.startDate.day", "1");
      q.set("dailyRange.endDate.year", String(fimD.getUTCFullYear())); q.set("dailyRange.endDate.month", String(fimD.getUTCMonth() + 1)); q.set("dailyRange.endDate.day", String(fimD.getUTCDate()));

      const [det, attrs, vom, midia, midiaCli, rev, posts, perf] = await Promise.all([
        seguro(`https://mybusinessbusinessinformation.googleapis.com/v1/locations/${localId}?readMask=name,title,phoneNumbers,categories,storefrontAddress,websiteUri,regularHours,specialHours,serviceArea,openInfo,metadata,profile,serviceItems,moreHours,latlng`),
        seguro(`https://mybusinessbusinessinformation.googleapis.com/v1/locations/${localId}/attributes`),
        seguro(`https://mybusinessverifications.googleapis.com/v1/locations/${localId}/VoiceOfMerchantState`),
        todasPaginas(`${base4}/media`, "mediaItems", 300),
        todasPaginas(`${base4}/media/customers`, "mediaItems", 300),
        todasPaginas(`${base4}/reviews?orderBy=updateTime%20desc`, "reviews", 1000),
        todasPaginas(`${base4}/localPosts`, "localPosts", 200),
        seguro(`https://businessprofileperformance.googleapis.com/v1/locations/${localId}:fetchMultiDailyMetricsTimeSeries?${q}`),
      ]);

      const NOTA: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
      const m = (x: Json) => ({
        formato: x.mediaFormat,
        categoria: (x.locationAssociation as Json | undefined)?.category ?? null,
        data: x.createTime,
        largura: (x.dimensions as Json | undefined)?.widthPixels ?? null,
        altura: (x.dimensions as Json | undefined)?.heightPixels ?? null,
        url: x.thumbnailUrl ?? x.googleUrl ?? null,
        visualizacoes: (x.insights as Json | undefined)?.viewCount ?? null,
      });
      const dias: Json[] = [];
      const porDia = new Map<string, Record<string, number>>();
      for (const grupo of (perf.multiDailyMetricTimeSeries as Json[]) ?? []) {
        for (const serie of (grupo.dailyMetricTimeSeries as Json[]) ?? []) {
          const metrica = String(serie.dailyMetric);
          for (const v of (((serie.timeSeries as Json)?.datedValues as Json[]) ?? [])) {
            const d = v.date as { year: number; month: number; day: number };
            const k = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
            const linha = porDia.get(k) ?? {};
            linha[metrica] = Number(v.value ?? 0);
            porDia.set(k, linha);
          }
        }
      }
      for (const [data, v] of [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b))) dias.push({ data, ...v });

      return responder({
        ok: true,
        encontrado: true,
        coletado_em: new Date().toISOString(),
        local: loc,
        ficha: {
          nome: det.title ?? loc.nome,
          descricao: (det.profile as Json | undefined)?.description ?? null,
          categoria: ((det.categories as Json | undefined)?.primaryCategory as Json | undefined)?.displayName ?? null,
          categorias_extras: (((det.categories as Json | undefined)?.additionalCategories as Json[]) ?? []).map((c) => c.displayName),
          telefone: (det.phoneNumbers as Json | undefined)?.primaryPhone ?? null,
          site: det.websiteUri ?? null,
          endereco: det.storefrontAddress ?? null,
          horario: det.regularHours ?? null,
          horario_especial: det.specialHours ?? null,
          mais_horarios: det.moreHours ?? null,
          servicos: ((det.serviceItems as Json[]) ?? []).map((s) => ((s.structuredServiceItem as Json | undefined)?.serviceTypeId ?? (s.freeFormServiceItem as Json | undefined)?.label ?? s)),
          fundacao: (det.openInfo as Json | undefined)?.openingDate ?? null,
          status: (det.openInfo as Json | undefined)?.status ?? null,
          maps: (det.metadata as Json | undefined)?.mapsUri ?? loc.maps,
          tem_mensagens: (det.metadata as Json | undefined)?.hasVoiceOfMerchant ?? null,
          atributos: ((attrs.attributes as Json[]) ?? []).map((a) => ({ nome: a.name, valores: a.values ?? null, urls: a.uriValues ?? null })),
          verificada: vom.hasVoiceOfMerchant ?? null,
          problema: (vom.complyWithGuidelines as Json | undefined)?.recommendationReason ?? null,
        },
        midia_dono: midia.lista.map(m),
        midia_dono_total: midia.total,
        midia_clientes: midiaCli.lista.map(m),
        midia_clientes_total: midiaCli.total,
        avaliacoes: rev.lista.map((r) => ({
          nota: NOTA[String(r.starRating)] ?? null,
          texto: r.comment ?? "",
          autor: (r.reviewer as Json | undefined)?.displayName ?? "Anônimo",
          data: r.createTime,
          resposta: (r.reviewReply as Json | undefined)?.comment ?? null,
          resposta_data: (r.reviewReply as Json | undefined)?.updateTime ?? null,
        })),
        avaliacoes_total: rev.total,
        avaliacoes_media: rev.extra.media ?? null,
        postagens: posts.lista.map((p) => ({
          data: p.createTime,
          tipo: p.topicType,
          texto: p.summary ?? "",
          estado: p.state,
          cta: (p.callToAction as Json | undefined)?.actionType ?? null,
          midia: ((p.media as Json[]) ?? []).length,
          url: p.searchUrl ?? null,
        })),
        dias,
        avisos: [...new Set(avisos)].slice(0, 5),
      });
    } catch (e) {
      return responder({ erro: (e as Error).message }, 500);
    }
  }


  // ---------------- Postagens: texto com IA, listar, publicar agora e fila de agendadas ----------------
  if (corpo.acao === "gbp_post_ia") {
    const chave = await segredo("openai_api_key");
    if (!chave) return responder({ erro: "Falta a chave da IA (OpenAI) em Integrações." }, 412);
    const pedido = `Escreva uma postagem para o Perfil da Empresa no Google de "${corpo.empresa ?? ""}".
Tema: ${String(corpo.tema ?? "").trim() || "apresente um serviço da empresa"}
Tipo: ${corpo.tipo === "OFFER" ? "oferta" : corpo.tipo === "EVENT" ? "evento" : "novidade"}
Regras: português do Brasil, de 600 a 1200 caracteres, parágrafos curtos, comece com uma pergunta ou frase que prenda atenção, cite o serviço e a cidade de forma natural (bom para buscas locais), termine com um convite para entrar em contato. Sem hashtags, sem telefone ou link no texto (o Google recusa) e no máximo 1 emoji. Responda só com o texto.`;
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("ASSISTENTE_MODELO_OPENAI") || "gpt-5.5", input: pedido }),
    });
    const j = (await r.json()) as Json;
    if (!r.ok) return responder({ erro: (j.error as Json | undefined)?.message ?? "A IA não respondeu." }, 502);
    const texto = ((j.output as Json[]) ?? []).filter((o) => o.type === "message").flatMap((o) => (o.content as Json[]) ?? []).map((c) => c.text).join("\n").trim();
    return responder({ ok: true, texto });
  }

  async function baseLocal(placeId: string) {
    const loc = (await locais()).find((l) => l.place_id && l.place_id === placeId);
    if (!loc) throw new Error("Esta ficha não está na conta da agência no Google.");
    return `https://mybusiness.googleapis.com/v4/${loc.conta}/locations/${String(loc.local).split("/")[1]}`;
  }
  const dataG = (iso: string) => { const d = new Date(iso); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }; };
  const horaG = (iso: string) => { const d = new Date(new Date(iso).getTime() - 3 * 3600_000); return { hours: d.getUTCHours(), minutes: d.getUTCMinutes() }; };
  async function publicar(p: Json) {
    const corpoPost: Json = { languageCode: "pt-BR", summary: p.texto, topicType: p.tipo ?? "STANDARD" };
    if (p.cta_tipo) corpoPost.callToAction = p.cta_tipo === "CALL" ? { actionType: "CALL" } : { actionType: p.cta_tipo, url: p.cta_url };
    if (p.foto_url) corpoPost.media = [{ mediaFormat: "PHOTO", sourceUrl: p.foto_url }];
    const ev = p.evento as { titulo?: string; inicio?: string; fim?: string } | null;
    if ((p.tipo === "EVENT" || p.tipo === "OFFER") && ev?.inicio && ev?.fim) {
      corpoPost.event = {
        title: ev.titulo || "Oferta",
        schedule: { startDate: dataG(ev.inicio), endDate: dataG(ev.fim), ...(p.tipo === "EVENT" ? { startTime: horaG(ev.inicio), endTime: horaG(ev.fim) } : {}) },
      };
    }
    const of = p.oferta as { cupom?: string; link?: string; termos?: string } | null;
    if (p.tipo === "OFFER" && of) corpoPost.offer = { couponCode: of.cupom || undefined, redeemOnlineUrl: of.link || undefined, termsConditions: of.termos || undefined };
    const base = await baseLocal(String(p.place_id));
    return await gapi(`${base}/localPosts`, { method: "POST", body: JSON.stringify(corpoPost) });
  }

  if (corpo.acao === "gbp_posts") {
    try {
      const base = await baseLocal(String(corpo.place_id));
      const j = await gapi(`${base}/localPosts?pageSize=100`);
      return responder({ ok: true, postagens: ((j.localPosts as Json[]) ?? []).map((p) => ({
        nome: p.name, data: p.createTime, tipo: p.topicType, texto: p.summary ?? "", estado: p.state,
        cta: (p.callToAction as Json | undefined)?.actionType ?? null, url: p.searchUrl ?? null,
        foto: (((p.media as Json[]) ?? [])[0] as Json | undefined)?.googleUrl ?? null,
      })) });
    } catch (e) {
      return responder({ erro: (e as Error).message }, 500);
    }
  }

  if (corpo.acao === "gbp_publicar" || corpo.acao === "gbp_publicar_fila") {
    const q = admin.from("gmn_postagens").select("*");
    const { data: fila } = corpo.acao === "gbp_publicar"
      ? await q.eq("id", corpo.id ?? "").in("status", ["agendada", "falhou", "rascunho"])
      : await q.eq("status", "agendada").lte("quando", new Date().toISOString()).order("quando").limit(20);
    const feitos: Json[] = [];
    for (const p of (fila ?? []) as Json[]) {
      await admin.from("gmn_postagens").update({ status: "publicando", tentativas: Number(p.tentativas ?? 0) + 1 }).eq("id", p.id);
      try {
        const r = await publicar(p);
        await admin.from("gmn_postagens").update({ status: "publicada", erro: null, google_nome: r.name ?? null, google_url: r.searchUrl ?? null, publicada_em: new Date().toISOString() }).eq("id", p.id);
        feitos.push({ id: p.id, ok: true });
      } catch (e) {
        const msg = (e as Error).message;
        // até 3 tentativas pela fila; depois fica como "falhou" para a equipe ver
        const volta = corpo.acao === "gbp_publicar_fila" && Number(p.tentativas ?? 0) + 1 < 3;
        await admin.from("gmn_postagens").update({ status: volta ? "agendada" : "falhou", erro: msg, quando: volta ? new Date(Date.now() + 30 * 60_000).toISOString() : p.quando }).eq("id", p.id);
        feitos.push({ id: p.id, ok: false, erro: msg });
      }
    }
    if (corpo.acao === "gbp_publicar" && feitos[0] && !feitos[0].ok) return responder({ erro: `O Google recusou: ${feitos[0].erro}` }, 502);
    return responder({ ok: true, feitos });
  }

  return responder({ erro: "Ação desconhecida." }, 400);
});
