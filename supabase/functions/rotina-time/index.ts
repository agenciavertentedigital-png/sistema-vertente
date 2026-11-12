// Rotina do grupo do time no WhatsApp.
// { acao: "resumo" }  → resumo da manhã: demandas do dia e atrasadas por pessoa, caixa de entrada, pendências do cliente,
//                        otimizações para revisar, alertas das últimas 24h, clientes sem resposta e o que os clientes pediram (IA).
// { acao: "alertas" } → repassa os alertas novos do sistema (saldo, conta, agente de tráfego, otimizações…) e avisa
//                        quando um cliente está esperando resposta há mais de 2 horas. Cada alerta é enviado uma vez só.
// { dry: true } devolve o texto sem enviar. Chamado pelo agendamento com o cabeçalho x-chave-cron.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

type Json = Record<string, unknown>;
const ESPERA_MIN = 120; // minutos sem resposta para avisar
const TIPOS_CLIENTE = ["cliente", "parceria", "suporte"];

const dataBR = (diasAtras = 0) => new Date(Date.now() - diasAtras * 86400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const ddmm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const soDigitos = (t: unknown) => String(t ?? "").replace(/\D/g, "");
const normalizar = (t: unknown) => {
  let d = soDigitos(t);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
  return d.slice(-10);
};
const haQuanto = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;
  return `${Math.floor(h / 24)} dia(s)`;
};
const curto = (t: string, n = 90) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t).replace(/\s+/g, " ");

async function segredo(admin: SupabaseClient, nome: string) {
  return ((await admin.rpc("ler_segredo", { nome })).data as string | null) ?? null;
}

async function enviarAoTime(admin: SupabaseClient, texto: string) {
  const [url, apikey, inst, grupo] = await Promise.all(["evolution_url", "evolution_apikey", "evolution_instancia", "whatsapp_grupo"].map((n) => segredo(admin, n)));
  if (!url || !apikey || !inst || !grupo) throw new Error("WhatsApp (Evolution) ou grupo do time não configurado.");
  const r = await fetch(`${url.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(inst)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey },
    body: JSON.stringify({ number: grupo, text: texto.slice(0, 4000) }),
  });
  if (!r.ok) throw new Error(`Evolution respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function hash(t: string) {
  const b = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).slice(0, 10).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Grupos de clientes/parceria/suporte com nome amigável (nome do cliente quando ligado). */
async function gruposDeClientes(admin: SupabaseClient, tipos = TIPOS_CLIENTE) {
  const { data } = await admin.from("whatsapp_grupos").select("grupo, nome, tipo, clientes(nome)").in("tipo", tipos);
  return new Map((data ?? []).map((g) => [g.grupo as string, ((g.clientes as { nome?: string } | null)?.nome ?? g.nome ?? "Grupo sem nome") as string]));
}

interface Espera { grupo: string; nome: string; autor: string; texto: string; desde: string; chave: string }

/** Grupos em que a última mensagem é de alguém de fora do time e ficou sem resposta há pelo menos `minimo` minutos. */
async function clientesSemResposta(admin: SupabaseClient, minimo = ESPERA_MIN): Promise<Espera[]> {
  const grupos = await gruposDeClientes(admin);
  if (!grupos.size) return [];
  const { data: time } = await admin.from("membros").select("telefone").not("telefone", "is", null);
  const fones = new Set((time ?? []).map((t) => normalizar(t.telefone)).filter(Boolean));
  const { data: msgs } = await admin
    .from("whatsapp_mensagens")
    .select("id, msg_id, grupo, papel, membro_id, autor_telefone, autor_nome, texto, criado_em")
    .in("grupo", [...grupos.keys()])
    .in("papel", ["grupo", "agencia"])
    .gte("criado_em", new Date(Date.now() - 3 * 86400_000).toISOString())
    .order("criado_em", { ascending: false })
    .limit(2000);
  const ultima = new Map<string, Json>();
  for (const m of msgs ?? []) if (!ultima.has(m.grupo as string)) ultima.set(m.grupo as string, m);
  const lista: Espera[] = [];
  for (const [grupo, m] of ultima) {
    const doTime = m.papel === "agencia" || m.membro_id || fones.has(normalizar(m.autor_telefone));
    const idade = (Date.now() - new Date(m.criado_em as string).getTime()) / 60000;
    if (doTime || idade < minimo) continue;
    lista.push({ grupo, nome: grupos.get(grupo)!, autor: (m.autor_nome as string) || "cliente", texto: String(m.texto ?? ""), desde: m.criado_em as string, chave: `espera:${grupo}:${m.msg_id ?? m.id}` });
  }
  return lista.sort((a, b) => a.desde.localeCompare(b.desde));
}

/** Resumo com IA do que os clientes falaram nas últimas 24h. */
async function resumoConversas(admin: SupabaseClient) {
  const grupos = await gruposDeClientes(admin, [...TIPOS_CLIENTE, "pendente"]);
  if (!grupos.size) return null;
  const { data: msgs } = await admin
    .from("whatsapp_mensagens")
    .select("grupo, papel, autor_nome, texto, criado_em")
    .in("grupo", [...grupos.keys()])
    .in("papel", ["grupo", "agencia"])
    .gte("criado_em", new Date(Date.now() - 86400_000).toISOString())
    .order("criado_em", { ascending: true })
    .limit(1500);
  if (!msgs?.length) return null;
  const porGrupo = new Map<string, string[]>();
  for (const m of msgs) {
    const hora = new Date(m.criado_em as string).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const quem = m.papel === "agencia" ? "Vertente" : (m.autor_nome as string) || "?";
    const l = porGrupo.get(m.grupo as string) ?? [];
    l.push(`[${hora}] ${quem}: ${String(m.texto).slice(0, 600)}`);
    porGrupo.set(m.grupo as string, l);
  }
  const conversa = [...porGrupo].map(([g, l]) => `### ${grupos.get(g)}\n${l.join("\n")}`).join("\n\n").slice(0, 60000);
  const chave = await segredo(admin, "openai_api_key");
  if (!chave) return null;
  const { data: time } = await admin.from("membros").select("nome").eq("ativo", true);
  const pedido = `Você ajuda o time da Vertente Digital (agência de tráfego pago). Abaixo estão as mensagens das últimas 24 horas nos grupos de WhatsApp com clientes, parceiros e suporte. Pessoas do time: ${(time ?? []).map((t) => t.nome).join(", ")}; "Vertente" é o número da agência.

Faça um resumo curto para o grupo interno do time, só com o que importa para trabalhar hoje:
- Para cada grupo com algo relevante, uma linha com *Nome do grupo* e de 1 a 3 marcadores curtos: pedidos do cliente, problemas, aprovações, materiais enviados e o que a Vertente ficou de fazer.
- Ignore grupos onde só houve conversa social, agradecimentos ou bom dia.
- Não invente nada. Não repita a conversa inteira.
- Formatação de WhatsApp: negrito com UM asterisco (*assim*), marcadores com "• ". Sem títulos com #.
- Se nada for relevante, responda exatamente: NADA

Mensagens:
${conversa}`;
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("ASSISTENTE_MODELO_OPENAI") || "gpt-5.5", input: pedido }),
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const j = (await r.json()) as Json;
  const texto = ((j.output as Json[]) ?? []).filter((o) => o.type === "message").flatMap((o) => (o.content as Json[]) ?? []).map((c) => c.text).join("\n").trim().replace(/\*\*/g, "*");
  return !texto || /^NADA\.?$/i.test(texto) ? null : texto;
}

async function montarResumo(admin: SupabaseClient) {
  const hoje = dataBR();
  const diaSemana = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });
  const partes: string[] = [`☀️ *Bom dia, time! Resumo de ${diaSemana}, ${ddmm(hoje)}*`];

  const { data: membros } = await admin.from("membros").select("id, nome").eq("ativo", true).eq("acesso", true).order("nome");
  const { data: tarefas } = await admin
    .from("tarefas")
    .select("titulo, prazo, responsavel_id, status, clientes(nome)")
    .in("status", ["a_fazer", "fazendo"])
    .eq("lado", "vertente")
    .eq("triagem", false)
    .not("prazo", "is", null)
    .lte("prazo", hoje)
    .order("prazo");
  const linha = (t: Json) => `• ${curto(String(t.titulo), 70)}${(t.clientes as { nome?: string } | null)?.nome ? ` _(${(t.clientes as { nome: string }).nome})_` : ""}${t.prazo !== hoje ? ` · ${ddmm(String(t.prazo))}` : ""}${t.status === "fazendo" ? " ▶️" : ""}`;

  const blocos: string[] = [];
  for (const m of membros ?? []) {
    const minhas = (tarefas ?? []).filter((t) => t.responsavel_id === m.id);
    if (!minhas.length) continue;
    const doDia = minhas.filter((t) => t.prazo === hoje);
    const atrasadas = minhas.filter((t) => String(t.prazo) < hoje);
    const b = [`👤 *${String(m.nome).split(" ")[0]}* — ${doDia.length} para hoje${atrasadas.length ? `, ${atrasadas.length} atrasada(s)` : ""}`];
    doDia.slice(0, 6).forEach((t) => b.push(linha(t)));
    if (doDia.length > 6) b.push(`• … e mais ${doDia.length - 6} para hoje`);
    if (atrasadas.length) {
      b.push("_Atrasadas:_");
      atrasadas.slice(0, 4).forEach((t) => b.push(linha(t)));
      if (atrasadas.length > 4) b.push(`• … e mais ${atrasadas.length - 4} atrasadas`);
    }
    blocos.push(b.join("\n"));
  }
  const semDono = (tarefas ?? []).filter((t) => !t.responsavel_id).length;
  if (semDono) blocos.push(`⚠️ ${semDono} demanda(s) vencendo sem responsável`);
  partes.push(blocos.length ? `📋 *Demandas*\n\n${blocos.join("\n\n")}` : "📋 *Demandas:* nada vencendo hoje nem atrasado. 👏");

  const { count: caixa } = await admin.from("tarefas").select("id", { count: "exact", head: true }).eq("triagem", true).in("status", ["a_fazer", "fazendo"]);
  if (caixa) partes.push(`📥 *Caixa de entrada:* ${caixa} item(ns) para triagem`);

  const { data: aguardando } = await admin.from("tarefas").select("titulo, atualizado_em, clientes(nome)").eq("lado", "cliente").eq("status", "aguardando").order("atualizado_em");
  const parados = (aguardando ?? []).filter((t) => Date.now() - new Date(t.atualizado_em as string).getTime() > 3 * 86400_000);
  if (aguardando?.length) {
    const b = [`🕓 *Pendências do cliente:* ${aguardando.length} aguardando${parados.length ? `, ${parados.length} há mais de 3 dias — cobrar:` : ""}`];
    parados.slice(0, 5).forEach((t) => b.push(`• ${(t.clientes as { nome?: string } | null)?.nome ?? "Cliente"}: ${curto(String(t.titulo), 70)} · ${haQuanto(t.atualizado_em as string)}`));
    partes.push(b.join("\n"));
  }

  const { data: otim } = await admin.from("registros").select("dados, nota, clientes(nome)").eq("tipo", "otimizacao").not("dados->>revisar_em", "is", null).lte("dados->>revisar_em", hoje);
  const pendOtim = (otim ?? []).filter((o) => !String((o.dados as Json)?.resultado ?? "").trim());
  if (pendOtim.length) {
    const b = [`🔧 *Otimizações para anotar o resultado:* ${pendOtim.length}`];
    pendOtim.slice(0, 5).forEach((o) => b.push(`• ${(o.clientes as { nome?: string } | null)?.nome ?? ""}: ${curto(String((o.dados as Json)?.motivo ?? o.nota ?? "otimização"), 70)}`));
    partes.push(b.join("\n"));
  }

  const { data: alertas } = await admin.from("notificacoes").select("texto").eq("tipo", "alerta").gte("criado_em", new Date(Date.now() - 86400_000).toISOString()).order("criado_em", { ascending: false });
  const unicos = [...new Set((alertas ?? []).map((a) => curto(String(a.texto), 140)))];
  if (unicos.length) partes.push(`🚨 *Alertas das últimas 24h*\n${unicos.slice(0, 8).map((a) => `• ${a}`).join("\n")}${unicos.length > 8 ? `\n• … e mais ${unicos.length - 8}` : ""}`);

  const espera = await clientesSemResposta(admin, 60);
  if (espera.length) partes.push(`⏳ *Esperando resposta da Vertente*\n${espera.map((e) => `• *${e.nome}* — ${e.autor}, há ${haQuanto(e.desde)}: "${curto(e.texto, 80)}"`).join("\n")}`);

  const conversas = await resumoConversas(admin);
  if (conversas) partes.push(`💬 *O que os clientes falaram (24h)*\n${conversas}`);

  partes.push("_Bom trabalho! Para falar comigo, é só mandar a pergunta aqui. Conversa entre vocês: comece com //_");
  return partes.join("\n\n");
}

async function montarAlertas(admin: SupabaseClient) {
  const hoje = dataBR();
  const novos: { chave: string; tipo: string; texto: string }[] = [];

  const { data: notifs } = await admin.from("notificacoes").select("texto").eq("tipo", "alerta").gte("criado_em", new Date(Date.now() - 6 * 3600_000).toISOString());
  for (const t of new Set((notifs ?? []).map((n) => String(n.texto)))) novos.push({ chave: `alerta:${hoje}:${await hash(t)}`, tipo: "alerta", texto: t });

  for (const e of await clientesSemResposta(admin)) novos.push({ chave: e.chave, tipo: "espera", texto: `*${e.nome}* — ${e.autor}, há ${haQuanto(e.desde)}: "${curto(e.texto, 100)}"` });

  if (!novos.length) return { texto: null, chaves: [] as typeof novos };
  const { data: ja } = await admin.from("whatsapp_avisos").select("chave").in("chave", novos.map((n) => n.chave));
  const enviados = new Set((ja ?? []).map((j) => j.chave));
  const pendentes = novos.filter((n) => !enviados.has(n.chave));
  if (!pendentes.length) return { texto: null, chaves: [] as typeof novos };

  const partes: string[] = [];
  const al = pendentes.filter((p) => p.tipo === "alerta");
  const es = pendentes.filter((p) => p.tipo === "espera");
  if (al.length) partes.push(`🚨 *Alerta${al.length > 1 ? "s" : ""} do sistema*\n${al.map((a) => `• ${curto(a.texto, 220)}`).join("\n")}`);
  if (es.length) partes.push(`⏳ *Cliente esperando resposta*\n${es.map((e) => `• ${e.texto}`).join("\n")}`);
  return { texto: partes.join("\n\n"), chaves: pendentes };
}

Deno.serve(async (req) => {
  const responder = (c: Json, status = 200) => new Response(JSON.stringify(c), { status, headers: { "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const esperada = await segredo(admin, "chave_cron_meta");
  if (!esperada || req.headers.get("x-chave-cron") !== esperada) return responder({ erro: "sem acesso" }, 403);
  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; dry?: boolean };

  try {
    if (corpo.acao === "resumo") {
      const texto = await montarResumo(admin);
      if (!corpo.dry) await enviarAoTime(admin, texto);
      return responder({ ok: true, enviado: !corpo.dry, texto });
    }
    if (corpo.acao === "alertas") {
      const { texto, chaves } = await montarAlertas(admin);
      if (texto && !corpo.dry) {
        await enviarAoTime(admin, texto);
        await admin.from("whatsapp_avisos").upsert(chaves.map((c) => ({ chave: c.chave, tipo: c.tipo, texto: c.texto.slice(0, 500) })), { onConflict: "chave", ignoreDuplicates: true });
      }
      return responder({ ok: true, enviado: Boolean(texto) && !corpo.dry, texto });
    }
    return responder({ erro: "acao deve ser resumo ou alertas" }, 400);
  } catch (e) {
    console.error("rotina-time:", (e as Error).message);
    return responder({ erro: (e as Error).message }, 500);
  }
});
