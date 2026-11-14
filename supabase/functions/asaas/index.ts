// Integração Asaas ↔ Financeiro do Sistema Vertente (sem n8n).
//
// Webhook (o Asaas chama; header "asaas-access-token" = segredo asaas_webhook_token):
//   PAYMENT_RECEIVED / PAYMENT_CONFIRMED → dá baixa na receita do cliente (ou cria a receita, se não houver)
//   PAYMENT_CREATED / PAYMENT_UPDATED   → liga a cobrança à mensalidade do mês (link do boleto/Pix)
//   PAYMENT_OVERDUE                     → aviso financeiro para os administradores
//   PAYMENT_REFUNDED / ..._UNDONE       → desfaz a baixa
//   PAYMENT_DELETED                     → solta o vínculo
// Ações de administrador (login do sistema):
//   { acao: "testar" }      → confere a chave e mostra o saldo
//   { acao: "configurar" }  → cadastra (ou atualiza) o webhook no Asaas automaticamente
//   { acao: "vincular" }    → liga os clientes do Asaas às fichas (CPF/CNPJ, e-mail ou nome)
//   { acao: "importar", desde } → dá baixa no que já foi pago no Asaas desde a data
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token" };
type Json = Record<string, unknown>;
const URL_WEBHOOK = "https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/asaas";
const EVENTOS = ["PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_RECEIVED_IN_CASH_UNDONE"];
const FORMA: Record<string, string> = { PIX: "pix", BOLETO: "boleto", CREDIT_CARD: "cartão", DEBIT_CARD: "cartão", TRANSFER: "transferência", DEPOSIT: "transferência", UNDEFINED: "boleto" };

interface Cobranca { id: string; customer: string; value: number; netValue?: number; dueDate: string; paymentDate?: string | null; clientPaymentDate?: string | null; confirmedDate?: string | null; billingType?: string; status?: string; description?: string | null; invoiceUrl?: string | null; externalReference?: string | null }
interface Lanc { id: string; cliente_id: string | null; descricao: string; categoria: string; valor: number; competencia: string; vencimento: string; pago_em: string | null; asaas_id: string | null }

const hojeBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const normal = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(ltda|me|eireli|epp|s\/?a|mei)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const somarMes = (comp: string, n: number) => { const d = new Date(`${comp.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (c: Json, status = 200) => new Response(JSON.stringify(c), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const segredo = async (nome: string) => ((await admin.rpc("ler_segredo", { nome })).data as string | null) ?? "";
  const corpo = (await req.json().catch(() => ({}))) as Json;
  let fichas: { id: string; nome: string; razao_social: string | null; documento: string | null; contato_email: string | null; asaas_id: string | null }[] | null = null;

  const chave = await segredo("asaas_api_key");
  const base = chave.includes("_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  async function api<T = Json>(caminho: string, metodo = "GET", dados?: Json): Promise<T> {
    const r = await fetch(`${base}${caminho}`, { method: metodo, headers: { access_token: chave, "Content-Type": "application/json", "User-Agent": "SistemaVertente/1.0" }, body: dados ? JSON.stringify(dados) : undefined });
    const j = (await r.json().catch(() => ({}))) as Json;
    if (!r.ok) throw new Error(((j.errors as { description?: string }[] | undefined)?.[0]?.description) ?? `Asaas respondeu ${r.status}`);
    return j as T;
  }

  // ------------------------------------------------------------------ webhook do Asaas
  const tokenAsaas = req.headers.get("asaas-access-token");
  if (tokenAsaas !== null) {
    if (tokenAsaas !== (await segredo("asaas_webhook_token"))) return responder({ erro: "Token inválido." }, 401);
    const evento = String(corpo.event ?? "");
    const p = corpo.payment as Cobranca | undefined;
    const idEvento = String(corpo.id ?? `${evento}:${p?.id}:${corpo.dateCreated ?? Date.now()}`);
    // Responde 200 mesmo em erro interno: o Asaas pausa a fila se receber erro.
    const { error: dup } = await admin.from("asaas_eventos").insert({ id: idEvento, evento, cobranca_id: p?.id ?? null, cliente_asaas: p?.customer ?? null, valor: p?.value ?? null, payload: corpo });
    if (dup) return responder({ ok: true, repetido: true });
    let resultado = "ignorado", lancId: string | null = null;
    try {
      if (p && chave) ({ resultado, lancId } = await processar(evento, p));
      else if (p) resultado = "sem chave da API (só registrado)";
    } catch (e) {
      resultado = `erro: ${(e as Error).message}`;
    }
    await admin.from("asaas_eventos").update({ resultado, lancamento_id: lancId }).eq("id", idEvento);
    return responder({ ok: true, resultado });
  }

  // ------------------------------------------------------------------ ações do administrador
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u.user) return responder({ erro: "Faça login de novo no sistema." }, 401);
  const { data: eu } = await admin.from("membros").select("id, papel").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
  if ((eu as { papel?: string } | null)?.papel !== "admin") return responder({ erro: "Só administradores." }, 403);
  if (!chave) return responder({ erro: "Cole a chave de API do Asaas em Integrações primeiro." }, 412);

  try {
    const acao = String(corpo.acao ?? "testar");
    if (acao === "testar") {
      const saldo = await api<{ balance: number }>("/finance/balance");
      const ws = await api<{ data: { url: string; enabled: boolean; interrupted: boolean }[] }>("/webhooks").catch(() => ({ data: [] }));
      const meu = ws.data.find((w) => w.url === URL_WEBHOOK);
      return responder({ ok: true, ambiente: base.includes("sandbox") ? "sandbox" : "produção", saldo: saldo.balance, webhook: meu ? (meu.interrupted ? "pausado" : meu.enabled ? "ativo" : "desligado") : "não cadastrado" });
    }
    if (acao === "configurar") {
      const token = await segredo("asaas_webhook_token");
      const ws = await api<{ data: { id: string; url: string }[] }>("/webhooks");
      const dados = { name: "Sistema Vertente", url: URL_WEBHOOK, email: u.user.email, enabled: true, interrupted: false, apiVersion: 3, authToken: token, sendType: "SEQUENTIALLY", events: EVENTOS };
      const existente = ws.data.find((w) => w.url === URL_WEBHOOK);
      if (existente) await api(`/webhooks/${existente.id}`, "PUT", dados);
      else await api("/webhooks", "POST", dados);
      return responder({ ok: true, webhook: existente ? "atualizado" : "criado" });
    }
    if (acao === "vincular") {
      const r = await vincularTodos();
      return responder({ ok: true, ...r });
    }
    if (acao === "importar") {
      const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(corpo.desde)) ? String(corpo.desde) : `${hojeBR().slice(0, 7)}-01`;
      await vincularTodos();
      const resumo: Record<string, number> = {};
      for (const status of ["RECEIVED", "CONFIRMED"]) {
        for (let offset = 0; offset < 2000; offset += 100) {
          const pg = await api<{ data: Cobranca[]; hasMore: boolean }>(`/payments?status=${status}&paymentDate%5Bge%5D=${desde}&limit=100&offset=${offset}`);
          for (const p of pg.data) {
            const { resultado } = await processar("PAYMENT_RECEIVED", p);
            const k = resultado.split(":")[0];
            resumo[k] = (resumo[k] ?? 0) + 1;
          }
          if (!pg.hasMore) break;
        }
      }
      // Cobranças em aberto: só liga o link à mensalidade
      for (let offset = 0; offset < 1000; offset += 100) {
        const pg = await api<{ data: Cobranca[]; hasMore: boolean }>(`/payments?status=PENDING&dueDate%5Bge%5D=${desde}&limit=100&offset=${offset}`);
        for (const p of pg.data) await processar("PAYMENT_CREATED", p);
        if (!pg.hasMore) break;
      }
      return responder({ ok: true, desde, resumo });
    }
    return responder({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return responder({ erro: (e as Error).message }, 502);
  }

  // ------------------------------------------------------------------ regras
  async function clienteDe(customer: string): Promise<{ id: string; nome: string } | null> {
    const { data: ja } = await admin.from("clientes").select("id, nome").eq("asaas_id", customer).maybeSingle();
    if (ja) return ja as { id: string; nome: string };
    const c = await api<{ id: string; name: string; cpfCnpj?: string; email?: string }>(`/customers/${customer}`).catch(() => null);
    if (!c) return null;
    const achado = await casar(c);
    if (achado) await admin.from("clientes").update({ asaas_id: customer }).eq("id", achado.id).is("asaas_id", null);
    return achado;
  }

  async function casar(c: { name: string; cpfCnpj?: string; email?: string }) {
    if (!fichas) fichas = ((await admin.from("clientes").select("id, nome, razao_social, documento, contato_email, asaas_id")).data ?? []) as typeof fichas;
    const lista = fichas!.filter((f) => !f.asaas_id);
    const doc = digitos(c.cpfCnpj);
    const n = normal(c.name);
    return (
      (doc && lista.find((f) => digitos(f.documento) === doc)) ||
      (c.email && lista.find((f) => (f.contato_email ?? "").toLowerCase() === c.email!.toLowerCase())) ||
      lista.find((f) => normal(f.nome) === n || normal(f.razao_social) === n) ||
      (n.length >= 5 && lista.filter((f) => { const a = normal(f.nome); return a.length >= 5 && (n.includes(a) || a.includes(n)); }).length === 1 ? lista.find((f) => { const a = normal(f.nome); return a.length >= 5 && (n.includes(a) || a.includes(n)); }) : null) ||
      null
    );
  }

  async function vincularTodos() {
    let ligados = 0, total = 0;
    const sem: string[] = [];
    for (let offset = 0; offset < 3000; offset += 100) {
      const pg = await api<{ data: { id: string; name: string; cpfCnpj?: string; email?: string; deleted?: boolean }[]; hasMore: boolean }>(`/customers?limit=100&offset=${offset}`);
      for (const c of pg.data) {
        if (c.deleted) continue;
        total++;
        const { data: ja } = await admin.from("clientes").select("id").eq("asaas_id", c.id).maybeSingle();
        if (ja) { ligados++; continue; }
        const f = await casar(c);
        if (f) {
          const { error } = await admin.from("clientes").update({ asaas_id: c.id }).eq("id", f.id).is("asaas_id", null);
          if (!error) { ligados++; f.asaas_id = c.id; }
        } else sem.push(c.name);
      }
      if (!pg.hasMore) break;
    }
    return { clientes_asaas: total, ligados, sem_ficha: sem.slice(0, 40) };
  }

  async function acharLancamento(p: Cobranca, clienteId: string | null): Promise<Lanc | null> {
    const campos = "id, cliente_id, descricao, categoria, valor, competencia, vencimento, pago_em, asaas_id";
    const { data: porId } = await admin.from("lancamentos").select(campos).eq("asaas_id", p.id).maybeSingle();
    if (porId) return porId as Lanc;
    if (p.externalReference && /^[0-9a-f-]{36}$/.test(p.externalReference)) {
      const { data } = await admin.from("lancamentos").select(campos).eq("id", p.externalReference).maybeSingle();
      if (data) return data as Lanc;
    }
    if (!clienteId) return null;
    const comp = `${p.dueDate.slice(0, 7)}-01`;
    const { data } = await admin.from("lancamentos").select(campos).eq("tipo", "receita").eq("cliente_id", clienteId).is("pago_em", null).is("asaas_id", null)
      .gte("competencia", somarMes(comp, -1)).lte("competencia", somarMes(comp, 1));
    const cands = ((data ?? []) as Lanc[]).map((l) => ({ ...l, valor: Number(l.valor) }));
    if (!cands.length) return null;
    const perto = (l: Lanc) => Math.abs(l.valor - Number(p.value)) <= Math.max(1, Number(p.value) * 0.02);
    const mesmoMes = (l: Lanc) => l.competencia.slice(0, 7) === comp.slice(0, 7);
    return cands.find((l) => mesmoMes(l) && perto(l)) ?? cands.find(perto) ?? (cands.filter(mesmoMes).length === 1 ? cands.find(mesmoMes)! : null);
  }

  async function processar(evento: string, p: Cobranca): Promise<{ resultado: string; lancId: string | null }> {
    const cli = p.customer ? await clienteDe(p.customer) : null;
    const l = await acharLancamento(p, cli?.id ?? null);
    const vinculo = { asaas_id: p.id, asaas_link: p.invoiceUrl ?? null };

    if (evento === "PAYMENT_RECEIVED" || evento === "PAYMENT_CONFIRMED") {
      const pago = p.paymentDate ?? p.clientPaymentDate ?? p.confirmedDate ?? hojeBR();
      const forma = FORMA[p.billingType ?? ""] ?? null;
      if (l) {
        if (l.pago_em && l.asaas_id === p.id) return { resultado: "ja_pago", lancId: l.id };
        await admin.from("lancamentos").update({ ...vinculo, pago_em: pago, forma }).eq("id", l.id);
        return { resultado: "baixa", lancId: l.id };
      }
      const nome = cli?.nome ?? (await api<{ name: string }>(`/customers/${p.customer}`).catch(() => ({ name: "Cliente Asaas" }))).name;
      const { data: novo, error } = await admin.from("lancamentos").insert({
        tipo: "receita", cliente_id: cli?.id ?? null, descricao: `${nome}${p.description ? ` — ${p.description.slice(0, 80)}` : ""}`, categoria: "Recebimento",
        valor: Number(p.value), competencia: `${p.dueDate.slice(0, 7)}-01`, vencimento: p.dueDate, pago_em: pago, forma, observacoes: "Recebido pelo Asaas", ...vinculo,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return { resultado: cli ? "criado" : "criado_sem_cliente", lancId: (novo as { id: string }).id };
    }
    if (evento === "PAYMENT_CREATED" || evento === "PAYMENT_UPDATED") {
      if (!l) return { resultado: "sem_mensalidade", lancId: null };
      await admin.from("lancamentos").update({ ...vinculo, vencimento: p.dueDate }).eq("id", l.id);
      return { resultado: "ligado", lancId: l.id };
    }
    if (evento === "PAYMENT_OVERDUE") {
      if (l) await admin.from("lancamentos").update(vinculo).eq("id", l.id);
      const { data: adms } = await admin.from("membros").select("id").eq("ativo", true).eq("acesso", true).eq("papel", "admin");
      const nome = cli?.nome ?? "Cliente";
      const texto = `💸 ${nome} · cobrança de ${brl(p.value)} venceu em ${dataBR(p.dueDate)} e não foi paga`;
      if (adms?.length) await admin.from("notificacoes").insert(adms.map((m) => ({ membro_id: (m as { id: string }).id, tipo: "financeiro", texto, cliente_id: cli?.id ?? null })));
      return { resultado: "aviso_atraso", lancId: l?.id ?? null };
    }
    if (evento === "PAYMENT_REFUNDED" || evento === "PAYMENT_RECEIVED_IN_CASH_UNDONE") {
      if (l) await admin.from("lancamentos").update({ pago_em: null }).eq("id", l.id);
      return { resultado: "baixa_desfeita", lancId: l?.id ?? null };
    }
    if (evento === "PAYMENT_DELETED") {
      const { data } = await admin.from("lancamentos").update({ asaas_id: null, asaas_link: null }).eq("asaas_id", p.id).is("pago_em", null).select("id");
      return { resultado: "desvinculado", lancId: (data as { id: string }[] | null)?.[0]?.id ?? null };
    }
    return { resultado: "ignorado", lancId: l?.id ?? null };
  }
});
