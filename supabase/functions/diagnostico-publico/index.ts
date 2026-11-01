// Diagnóstico Digital Gratuito: função pública (sem login) usada pela página /diagnostico.
// Ações (POST {acao, …}):
//  - config: WhatsApp comercial e link do conteúdo gratuito
//  - buscar_google {texto}: busca a empresa no Google (Places API New); a chave fica só no Vault
//  - link_google {link}: lê um link da ficha (maps.app.goo.gl, share.google, google.com/maps…) e devolve o perfil
//  - verificar_site {url}: confere se o site abre
//  - salvar {sessao, etapa, dados}: grava o lead (em etapas, sem duplicar) e avisa o time quando completa
// Cada visitante tem limite de uso por hora (protege a cota paga do Google).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
type Json = Record<string, unknown>;

const LIMITES: Record<string, number> = { buscar_google: 40, link_google: 20, verificar_site: 20, salvar: 30 };
const CAMPOS_PERFIL = "id,displayName,formattedAddress,rating,userRatingCount,primaryTypeDisplayName,googleMapsUri";
const CAMPOS_TEXTO = ["nome", "empresa", "segmento", "faturamento", "verba", "ja_investe", "desafio", "atendimento", "decisor", "whatsapp", "oque_vende", "instagram", "site", "google_place_id", "google_nome", "google_endereco", "google_categoria", "google_link", "origem_url"] as const;

// Nota de corte (a mesma regra da página; aqui é a que vale)
const FATURAMENTO_OK = new Set(["30-50", "50-100", "100+"]);
const VERBA_OK = new Set(["1500-3000", "3000-5000", "5000+"]);

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

function perfilSimples(p: Json) {
  return {
    place_id: p.id as string,
    nome: ((p.displayName as Json)?.text as string) ?? "",
    endereco: (p.formattedAddress as string) ?? "",
    nota: (p.rating as number) ?? null,
    avaliacoes: (p.userRatingCount as number) ?? 0,
    categoria: ((p.primaryTypeDisplayName as Json)?.text as string) ?? null,
    link: (p.googleMapsUri as string) ?? null,
  };
}

/** Segue os redirecionamentos de um link do Google Maps e lê o que der da URL final. */
async function lerLink(link: string) {
  let url = link.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const visitadas: string[] = [];
  for (let i = 0; i < 6; i++) {
    visitadas.push(url);
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      break;
    }
    if (!/(^|\.)(google\.[a-z.]+|goo\.gl|g\.co|share\.google)$/i.test(host)) break; // só segue links do Google
    if (/google\.[a-z.]+\/maps|[?&](cid|ludocid)=|!1s0x[0-9a-f]+:0x[0-9a-f]+/i.test(url) && !/goo\.gl|share\.google|g\.co$/i.test(host)) break;
    const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "pt-BR" } }).catch(() => null);
    const prox = r?.headers.get("location");
    await r?.body?.cancel().catch(() => {});
    if (!prox) break;
    url = new URL(prox, url).toString();
  }
  const tudo = decodeURIComponent(visitadas.join(" "));
  const placeId = tudo.match(/place_id[:=](ChIJ[\w-]+)/)?.[1] ?? null;
  const coord = tudo.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? tudo.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const nome = tudo.match(/\/maps\/place\/([^/@?]+)/)?.[1]?.replace(/\+/g, " ") ?? tudo.match(/[?&]q=([^&]+)/)?.[1]?.replace(/\+/g, " ") ?? null;
  return { placeId, lat: coord ? Number(coord[1]) : null, lng: coord ? Number(coord[2]) : null, nome };
}

async function hashIp(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "sem-ip";
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`vertente:${ip}`));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Json, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return responder({ erro: "Use POST." }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const corpo = (await req.json().catch(() => ({}))) as Json;
  const acao = String(corpo.acao ?? "");

  try {
    if (acao === "config") {
      const { data } = await admin.from("diagnostico_config").select("whatsapp, mensagem_whatsapp, link_conteudo, ativo").maybeSingle();
      return responder({ ok: true, ...(data ?? {}) });
    }

    if (!(acao in LIMITES)) return responder({ erro: "Ação inválida." }, 400);

    // Limite por visitante (última hora)
    const ip = await hashIp(req);
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("diagnostico_uso").select("id", { count: "exact", head: true }).eq("ip_hash", ip).eq("acao", acao).gte("criado_em", desde);
    if ((count ?? 0) >= LIMITES[acao]) return responder({ erro: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo." }, 429);
    await admin.from("diagnostico_uso").insert({ ip_hash: ip, acao });

    if (acao === "buscar_google" || acao === "link_google") {
      const chave = Deno.env.get("GOOGLE_PLACES_KEY") || ((await admin.rpc("ler_segredo", { nome: "google_places_key" })).data as string | null);
      if (!chave) return responder({ erro: "Busca do Google indisponível no momento." }, 503);

      if (acao === "buscar_google") {
        const texto = String(corpo.texto ?? "").trim().slice(0, 120);
        if (texto.length < 3) return responder({ ok: true, resultados: [] });
        const j = await places("places:searchText", chave, CAMPOS_PERFIL.split(",").map((c) => `places.${c}`).join(","), {
          textQuery: texto,
          languageCode: "pt-BR",
          regionCode: "BR",
          pageSize: 6,
        });
        return responder({ ok: true, resultados: ((j.places as Json[]) ?? []).map(perfilSimples) });
      }

      const link = String(corpo.link ?? "").trim().slice(0, 600);
      if (!/(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|share\.google|g\.co\/kgs|g\.page|google\.[a-z.]+\/search)/i.test(link)) {
        return responder({ erro: "Esse não parece um link do Google Maps. Siga o passo a passo e copie o link do botão Compartilhar." }, 400);
      }
      const pistas = await lerLink(link);
      let placeId = pistas.placeId;
      let outros: Json[] = [];
      if (!placeId && pistas.nome) {
        const j = await places("places:searchText", chave, CAMPOS_PERFIL.split(",").map((c) => `places.${c}`).join(","), {
          textQuery: pistas.nome,
          languageCode: "pt-BR",
          regionCode: "BR",
          pageSize: 4,
          ...(pistas.lat !== null ? { locationBias: { circle: { center: { latitude: pistas.lat, longitude: pistas.lng }, radius: 1500 } } } : {}),
        });
        const lista = (j.places as Json[]) ?? [];
        placeId = (lista[0]?.id as string) ?? null;
        outros = lista.slice(1);
      }
      if (!placeId) return responder({ erro: "Não conseguimos ler esse link. Tente buscar pelo nome da empresa e a cidade." }, 404);
      const perfil = await places(`places/${encodeURIComponent(placeId)}`, chave, CAMPOS_PERFIL);
      return responder({ ok: true, perfil: perfilSimples(perfil), outros: outros.map(perfilSimples) });
    }

    if (acao === "verificar_site") {
      let url = String(corpo.url ?? "").trim().slice(0, 300);
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      let host = "";
      try {
        host = new URL(url).hostname;
      } catch {
        return responder({ ok: true, abre: false, motivo: "Endereço inválido." });
      }
      if (!host.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
        return responder({ ok: true, abre: false, motivo: "Endereço inválido." });
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (Diagnostico Vertente)" } }).catch(() => null);
      clearTimeout(t);
      await r?.body?.cancel().catch(() => {});
      if (!r) return responder({ ok: true, abre: false, motivo: "O site não respondeu." });
      return responder({ ok: true, abre: r.status < 500, status: r.status, url_final: r.url });
    }

    if (acao === "salvar") {
      const sessao = String(corpo.sessao ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(sessao)) return responder({ erro: "Sessão inválida. Recarregue a página." }, 400);
      const d = (corpo.dados ?? {}) as Json;
      const linha: Json = { sessao, ip_hash: ip };
      for (const c of CAMPOS_TEXTO) {
        const v = d[c];
        if (typeof v === "string") linha[c] = v.trim().slice(0, c === "oque_vende" ? 400 : 300) || null;
      }
      if (typeof d.google_nota === "number") linha.google_nota = Math.round(d.google_nota * 10) / 10;
      if (typeof d.google_avaliacoes === "number") linha.google_avaliacoes = Math.round(d.google_avaliacoes);
      linha.sem_site = d.sem_site === true;
      linha.aceite_lgpd = d.aceite_lgpd === true;
      if (d.utm && typeof d.utm === "object") {
        linha.utm = Object.fromEntries(Object.entries(d.utm as Json).filter(([k, v]) => /^[a-z_]{2,20}$/.test(k) && typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 200)]).slice(0, 10));
      }
      if (typeof linha.whatsapp === "string") linha.whatsapp = (linha.whatsapp as string).replace(/\D/g, "").slice(0, 13) || null;

      // A regra de corte é decidida aqui, não no navegador
      const fatOk = FATURAMENTO_OK.has(String(linha.faturamento ?? ""));
      const verbaOk = VERBA_OK.has(String(linha.verba ?? ""));
      const qualificado = fatOk && verbaOk;
      linha.motivo_corte = qualificado ? null : !fatOk && !verbaOk ? "verba_e_faturamento" : !verbaOk ? "verba" : "faturamento";
      const pediuCompleto = corpo.etapa === "completo";
      if (!qualificado) {
        linha.etapa = "desqualificado";
        delete linha.whatsapp; // quem não passa no corte não deixa contato (só métricas)
      } else if (pediuCompleto) {
        if (!linha.google_place_id) return responder({ erro: "Confirme a ficha da empresa no Google." }, 400);
        if (!linha.whatsapp || String(linha.whatsapp).length < 10) return responder({ erro: "Informe um WhatsApp com DDD." }, 400);
        if (!linha.aceite_lgpd) return responder({ erro: "É preciso aceitar o uso dos dados para gerar o diagnóstico." }, 400);
        linha.etapa = "completo";
      } else {
        linha.etapa = "qualificado";
      }

      const { data: existente } = await admin.from("diagnostico_leads").select("id, etapa").eq("sessao", sessao).maybeSingle();
      if (existente?.etapa === "completo" && linha.etapa !== "completo") return responder({ ok: true, etapa: "completo" });
      const r = existente
        ? await admin.from("diagnostico_leads").update(linha).eq("id", existente.id)
        : await admin.from("diagnostico_leads").insert(linha);
      if (r.error) return responder({ erro: "Não foi possível salvar. Tente de novo." }, 500);

      if (linha.etapa === "completo" && existente?.etapa !== "completo") {
        const { data: time } = await admin.from("membros").select("id").eq("ativo", true).eq("acesso", true);
        if (time?.length) {
          const quem = [linha.nome, linha.empresa].filter(Boolean).join(" · ");
          await admin.from("notificacoes").insert(time.map((m) => ({ membro_id: m.id, tipo: "alerta", texto: `Novo lead do Diagnóstico Digital: ${quem}` })));
        }
      }
      return responder({ ok: true, etapa: linha.etapa });
    }

    return responder({ erro: "Ação inválida." }, 400);
  } catch (e) {
    console.error(e);
    return responder({ erro: "Algo deu errado do nosso lado. Tente de novo em instantes." }, 500);
  }
});
