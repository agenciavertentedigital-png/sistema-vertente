// Redirecionador de rastreio (público): /r/<slug> → registra o clique com a origem (UTMs, gclid, fbclid…),
// gera um código curto e manda a pessoa para o WhatsApp do cliente com o código escondido na primeira mensagem.
// GET  ?s=<slug>&utm_…          → 302 para o WhatsApp (links de bio, QR, anúncios, e-mail)
// POST { s, params, pagina, … } → { url, codigo } (usado pelo script rastreio.js nos sites dos clientes)
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const ALFABETO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
// Código invisível: cada caractere vira 3 símbolos de largura zero entre dois marcadores invisíveis
const ZW = ["​", "‌", "‍", "﻿"];
const INICIO = "⁢";
const FIM = "⁣";
const CAMPOS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "campaign_id", "adset_id", "ad_id", "gclid", "gbraid", "wbraid", "fbclid"] as const;
const ROBO = /bot|crawl|spider|facebookexternalhit|whatsapp|preview|slurp|bingpreview|telegram|discord|skype|linkedin/i;

function novoCodigo() {
  const b = crypto.getRandomValues(new Uint8Array(7));
  return [...b].map((x) => ALFABETO[x % 32]).join("");
}
export function esconder(codigo: string) {
  return INICIO + [...codigo].map((c) => { const i = ALFABETO.indexOf(c); return ZW[(i >> 4) & 3] + ZW[(i >> 2) & 3] + ZW[i & 3]; }).join("") + FIM;
}
const limpar = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function origemDe(p: Record<string, string | null>, referencia: string | null, canal: string) {
  const src = (p.utm_source ?? "").toLowerCase();
  if (p.gclid || p.gbraid || p.wbraid || /google|adwords|gads/.test(src)) return p.gclid || p.gbraid || p.wbraid || /cpc|ppc|paid|ads/.test(p.utm_medium ?? "") ? "google_ads" : "google";
  if (p.fbclid || p.campaign_id || /facebook|instagram|^fb$|^ig$|meta/.test(src)) return /cpc|paid|ads|pago|anuncio/.test((p.utm_medium ?? "").toLowerCase()) || p.campaign_id || p.ad_id ? "meta_ads" : src.includes("insta") || src === "ig" ? "instagram" : "meta";
  if (src) return src.slice(0, 40);
  const ref = (referencia ?? "").toLowerCase();
  if (/google\./.test(ref)) return "google_organico";
  if (/instagram\./.test(ref)) return "instagram";
  if (/facebook\.|fb\.com/.test(ref)) return "facebook";
  if (canal === "bio") return "instagram_bio";
  if (canal === "gmn") return "google_meu_negocio";
  if (canal === "qr") return "qr_code";
  return ref ? "outro_site" : "direto";
}
function dispositivoDe(ua: string) {
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "celular";
  return "computador";
}
async function hash(texto: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 20);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ehPost = req.method === "POST";
  const corpo = ehPost ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  const slug = String((ehPost ? corpo.s : url.searchParams.get("s")) ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const json = (c: unknown, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const { data: link } = slug ? await admin.from("rastreio_links").select("id, cliente_id, whatsapp, mensagem, codigo_visivel, canal, utm, ativo").eq("slug", slug).maybeSingle() : { data: null };
  if (!link || !link.ativo) {
    if (ehPost) return json({ erro: "Link de rastreio não encontrado." }, 404);
    return new Response("<!doctype html><meta charset=utf-8><title>Link indisponível</title><p style='font-family:sans-serif;padding:24px'>Este link não está mais disponível.</p>", { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const params: Record<string, string | null> = {};
  const vindos = (ehPost ? (corpo.params as Record<string, unknown>) : null) ?? {};
  for (const k of CAMPOS) params[k] = limpar(ehPost ? vindos[k] : url.searchParams.get(k)) ?? limpar((link.utm as Record<string, unknown>)?.[k]);
  const referencia = limpar(ehPost ? corpo.referencia : req.headers.get("referer"), 500);
  const pagina = limpar(ehPost ? corpo.pagina : null, 500);

  let codigo = "";
  // Pré-visualizações de link (WhatsApp, Instagram, Facebook) não contam como clique
  if (!ROBO.test(ua)) {
    for (let t = 0; t < 4 && !codigo; t++) {
      const c = novoCodigo();
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
      const { error } = await admin.from("rastreio_cliques").insert({
        link_id: link.id,
        cliente_id: link.cliente_id,
        codigo: c,
        origem: origemDe(params, referencia, link.canal),
        ...params,
        fbc: limpar(corpo.fbc) ?? (params.fbclid ? `fb.1.${Date.now()}.${params.fbclid}` : null),
        fbp: limpar(corpo.fbp),
        pagina,
        referencia,
        dispositivo: dispositivoDe(ua),
        navegador: ua.slice(0, 200) || null,
        ip_hash: ip ? await hash(ip + (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").slice(-12)) : null,
        primeiro_toque: ehPost && corpo.primeiro_toque && typeof corpo.primeiro_toque === "object" ? corpo.primeiro_toque : null,
      });
      if (!error) codigo = c;
      else if (!/duplicate|unique/i.test(error.message)) break;
    }
  }

  const marca = codigo ? (link.codigo_visivel ? ` (cód. ${codigo})` : esconder(codigo)) : "";
  const destino = `https://wa.me/${link.whatsapp}?text=${encodeURIComponent(`${link.mensagem}${marca}`)}`;
  if (ehPost) return json({ url: destino, codigo: codigo || null });
  return new Response(null, { status: 302, headers: { Location: destino, "Cache-Control": "no-store" } });
});
