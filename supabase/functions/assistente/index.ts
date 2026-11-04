// Assistente de IA do Sistema Vertente: responde no chat consultando os dados do sistema e executa ações
// pedidas pelo time (criar e atualizar tarefas, comentar, checklist, anotações, registros e temperatura).
// Exclusão/arquivamento de tarefas só com o clique da pessoa no quadro de confirmação (token assinado). As operações rodam com o login de quem pede, então valem as mesmas permissões do banco
// (ex.: financeiro só para administradores).
// IA: Anthropic (Claude) se houver 'anthropic_api_key' no Vault; senão OpenAI (ChatGPT) com 'openai_api_key'.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
type Json = Record<string, unknown>;

const MODELO = Deno.env.get("ASSISTENTE_MODELO") || "claude-sonnet-5-5";
const MODELO_OPENAI = Deno.env.get("ASSISTENTE_MODELO_OPENAI") || "gpt-5.5";
const MAX_RODADAS = 10;

// Tabelas que o assistente pode ler (sem tokens de link nem dados de login)
const TABELAS: Record<string, string> = {
  clientes: "Clientes e ficha cadastral (pasta_drive = link da pasta do cliente no Google Drive). status: ativo|pausado|encerrado. origem: vertente|parceria_marcone (clientes da agência parceira do Marcone).",
  cliente_servicos: "Serviços contratados por cliente e valor mensal. servico_codigo: trafego_meta, trafego_google, gmn, social_media, consultoria.",
  membros: "Time da agência (nome, papel admin|gestor|cs|visualizador, ativo).",
  tarefas: "Tarefas. status: a_fazer|fazendo|aguardando|feita|nao_feita. pilar: trafego|social|gmn|cs|interno. prioridade: urgente|alta|normal|baixa. prazo (data). responsavel_id -> membros. origem: manual|rotina|clickup.",
  tarefa_checklist: "Itens de checklist das tarefas.",
  tarefa_comentarios: "Comentários das tarefas.",
  rotinas: "Modelos de rotina recorrente (revisão diária, otimização semanal…).",
  cliente_rotinas: "Rotinas ativas por cliente (frequência, responsável).",
  registros: "Linha do tempo: revisões, otimizações, reuniões, notas, decisões, daily e weekly. tipo: revisao|otimizacao|reuniao|nota|decisao|daily|weekly. situacao: ok|atencao|problema. acoes (lista), nota (texto), alteracoes (json), data.",
  notificacoes: "Avisos do usuário logado (menções, atribuições, alertas).",
  contas_anuncio: "Contas de anúncio por cliente (plataforma meta|google): status, saldo, ultimo_sync, erro_sync.",
  metricas_diarias: "Métricas da Meta por campanha e dia (sincronizadas 3x ao dia): gasto, impressoes, alcance, cliques, resultados, tipo_resultado, leads (formulário), conversas (WhatsApp/Direct). conta_id -> contas_anuncio. Contatos = conversas + leads. Alcance não se soma entre dias.",
  metricas_conta_dia: "Visão por conta e dia (soma das campanhas).",
  gmn_perfis: "Perfis do Google Meu Negócio (cliente_id nulo = prospecção).",
  gmn_analises: "Análises GBP Check dos perfis: nota 0–100, criterios (nivel 0 fraco,1 razoável,2 bom), dados do Google, data.",
  posts: "Cronograma de Social Media. status: ideia|producao|aprovacao (com o cliente)|ajuste|aprovado|publicado. formato: feed|carrossel|reels|stories.",
  lancamentos: "Financeiro da agência (só administradores): tipo receita|despesa, categoria, valor, competencia (1º dia do mês), vencimento, pago_em. Histórico desde out/2024 importado da planilha.",
  contratos: "Contratos: status rascunho|enviado|assinado|cancelado, valor_mensal, inicio, meses.",
  contrato_modelos: "Modelos de contrato.",
  processos: "Modelos de processo (Pré-onboarding, Onboarding…): etapas com título, pilar, dias após o início e checklist.",
  processos_aplicados: "Processos aplicados a clientes (nome, cliente_id, inicio). As tarefas do processo têm tarefas.processo_aplicado_id = processos_aplicados.id.",
  briefings: "Briefing estratégico de cada cliente (um por cliente): campos = {negocio_resumo, produtos_carro_chefe, ticket_medio, area_atendimento, sazonalidade, persona, dores_desejos, objecoes, diferenciais, concorrentes, tom_de_voz, restricoes, objetivo_principal, metas_90_dias, verba_midia, kpi_principal, atendimento_leads, processo_venda, conversao, historico_marketing, funcionou, materiais, estrategia_atual, funil_campanhas, proximos_testes, pontos_atencao}. Use para entender o contexto e a estratégia do cliente.",
  notas: "Anotações do time (cliente_id nulo = interna da agência): titulo, texto, etiqueta geral|estrategia|reuniao|ideia|alinhamento|aprendizado|pendencia, fixada (importante), autor_id, atualizado_em.",
  temperaturas: "Temperatura do cliente marcada pelo time: nivel 1 (crítica) a 5 (ótima), motivo, criado_em.",
  servicos: "Catálogo de serviços.",
};

const OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is"] as const;

const FERRAMENTAS = [
  {
    name: "consultar_tabela",
    description: "Lê linhas de uma tabela do sistema com filtros. Use para listas e detalhes. Máximo 500 linhas.",
    input_schema: {
      type: "object",
      properties: {
        tabela: { type: "string", enum: Object.keys(TABELAS) },
        colunas: { type: "string", description: "Colunas separadas por vírgula (padrão *). Pode usar relação, ex.: 'titulo,prazo,cliente:clientes(nome)'." },
        filtros: {
          type: "array",
          items: {
            type: "object",
            properties: { coluna: { type: "string" }, op: { type: "string", enum: OPS }, valor: {} },
            required: ["coluna", "op", "valor"],
          },
        },
        ordem: { type: "string" },
        decrescente: { type: "boolean" },
        limite: { type: "integer", minimum: 1, maximum: 500 },
      },
      required: ["tabela"],
    },
  },
  {
    name: "agregar",
    description: "Soma e conta linhas de uma tabela agrupando por colunas (ex.: gasto por conta e mês, tarefas por status). Lê até 20.000 linhas. Para agrupar por mês use agrupar_mes com a coluna de data.",
    input_schema: {
      type: "object",
      properties: {
        tabela: { type: "string", enum: Object.keys(TABELAS) },
        agrupar_por: { type: "array", items: { type: "string" } },
        agrupar_mes: { type: "string", description: "Coluna de data para agrupar por mês (AAAA-MM)." },
        somar: { type: "array", items: { type: "string" } },
        filtros: { type: "array", items: { type: "object", properties: { coluna: { type: "string" }, op: { type: "string", enum: OPS }, valor: {} }, required: ["coluna", "op", "valor"] } },
      },
      required: ["tabela"],
    },
  },
  {
    name: "relatorio_meta_ao_vivo",
    description: "Busca direto na Meta o relatório de um cliente num período: totais exatos (alcance, frequência), comparação com o período anterior, campanhas e melhores anúncios. Use para perguntas de desempenho de tráfego de um cliente.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        inicio: { type: "string", description: "AAAA-MM-DD" },
        fim: { type: "string", description: "AAAA-MM-DD" },
      },
      required: ["cliente_id", "inicio", "fim"],
    },
  },
  {
    name: "criar_tarefa",
    description: "AÇÃO: cria uma tarefa para um cliente (use o cliente 'Agência Vertente Digital' para tarefas internas). Só use quando a pessoa pedir.",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        titulo: { type: "string" },
        descricao: { type: "string" },
        prazo: { type: "string", description: "AAAA-MM-DD" },
        responsavel_id: { type: "string", description: "id em membros" },
        prioridade: { type: "string", enum: ["urgente", "alta", "normal", "baixa"] },
        pilar: { type: "string", enum: ["trafego", "social", "gmn", "cs", "interno"] },
        canal: { type: "string", enum: ["meta", "google"] },
        checklist: { type: "array", items: { type: "string" } },
      },
      required: ["cliente_id", "titulo"],
    },
  },
  {
    name: "atualizar_tarefa",
    description: "AÇÃO: muda status (concluir = feita), prazo, responsável, prioridade, título ou descrição de uma tarefa existente.",
    input_schema: {
      type: "object",
      properties: {
        tarefa_id: { type: "string" },
        status: { type: "string", enum: ["a_fazer", "fazendo", "aguardando", "feita", "nao_feita"] },
        prazo: { type: "string", description: "AAAA-MM-DD" },
        responsavel_id: { type: "string" },
        prioridade: { type: "string", enum: ["urgente", "alta", "normal", "baixa"] },
        titulo: { type: "string" },
        descricao: { type: "string" },
      },
      required: ["tarefa_id"],
    },
  },
  {
    name: "comentar_tarefa",
    description: "AÇÃO: escreve um comentário numa tarefa (use @Nome para avisar alguém do time).",
    input_schema: { type: "object", properties: { tarefa_id: { type: "string" }, texto: { type: "string" } }, required: ["tarefa_id", "texto"] },
  },
  {
    name: "checklist_tarefa",
    description: "AÇÃO: adiciona itens ao checklist de uma tarefa e/ou marca/desmarca itens existentes (ids de tarefa_checklist).",
    input_schema: {
      type: "object",
      properties: {
        tarefa_id: { type: "string" },
        adicionar: { type: "array", items: { type: "string" } },
        marcar: { type: "array", items: { type: "object", properties: { item_id: { type: "string" }, feito: { type: "boolean" } }, required: ["item_id", "feito"] } },
      },
      required: ["tarefa_id"],
    },
  },
  {
    name: "criar_anotacao",
    description: "AÇÃO: cria uma anotação (cliente_id vazio = anotação interna da agência).",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        titulo: { type: "string" },
        texto: { type: "string" },
        etiqueta: { type: "string", enum: ["geral", "estrategia", "reuniao", "ideia", "alinhamento", "aprendizado", "pendencia"] },
        fixada: { type: "boolean" },
      },
      required: ["texto"],
    },
  },
  {
    name: "registrar_na_linha_do_tempo",
    description: "AÇÃO: registra na linha do tempo do cliente uma nota, reunião, decisão, revisão ou otimização (alterações feitas na conta de anúncio entram como otimização).",
    input_schema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        tipo: { type: "string", enum: ["nota", "reuniao", "decisao", "revisao", "otimizacao"] },
        nota: { type: "string" },
        canal: { type: "string", enum: ["meta", "google"] },
        situacao: { type: "string", enum: ["ok", "atencao", "problema"] },
        data: { type: "string", description: "AAAA-MM-DD (padrão hoje)" },
      },
      required: ["cliente_id", "tipo", "nota"],
    },
  },
  {
    name: "marcar_temperatura",
    description: "AÇÃO: marca a temperatura do cliente de 1 (crítica) a 5 (ótima), com o motivo.",
    input_schema: {
      type: "object",
      properties: { cliente_id: { type: "string" }, nivel: { type: "integer", minimum: 1, maximum: 5 }, motivo: { type: "string" } },
      required: ["cliente_id", "nivel"],
    },
  },
  {
    name: "preparar_exclusao_tarefas",
    description: "PEDE CONFIRMAÇÃO para excluir (apagar de vez) ou arquivar (marcar como Não feita, sai das listas e fica no histórico) tarefas. NÃO apaga nada: só monta a lista e mostra para a pessoa um quadro com o botão de confirmar. A exclusão só acontece quando ela clicar em Confirmar. Antes, ache os ids certos com consultar_tabela (título + cliente). Use só quando a pessoa pedir para excluir/apagar/arquivar.",
    input_schema: {
      type: "object",
      properties: {
        tarefa_ids: { type: "array", items: { type: "string" }, description: "ids das tarefas (até 50)" },
        modo: { type: "string", enum: ["excluir", "arquivar"] },
        motivo: { type: "string", description: "frase curta do pedido da pessoa" },
      },
      required: ["tarefa_ids", "modo"],
    },
  },
];

const ACOES = new Set(["preparar_exclusao_tarefas", "criar_tarefa", "atualizar_tarefa", "comentar_tarefa", "checklist_tarefa", "criar_anotacao", "registrar_na_linha_do_tempo", "marcar_temperatura"]);
const dataValida = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

function hojeBR() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

// deno-lint-ignore no-explicit-any
function aplicarFiltros(q: any, filtros: { coluna: string; op: string; valor: unknown }[] = []) {
  for (const f of filtros) {
    if (!OPS.includes(f.op as (typeof OPS)[number])) throw new Error(`Operador inválido: ${f.op}`);
    if (!/^[a-z_]+$/.test(f.coluna)) throw new Error(`Coluna inválida: ${f.coluna}`);
    if (f.op === "in") q = q.in(f.coluna, Array.isArray(f.valor) ? f.valor : [f.valor]);
    else if (f.op === "is") q = q.is(f.coluna, f.valor === "null" ? null : f.valor);
    else q = q[f.op](f.coluna, f.valor);
  }
  return q;
}

interface Acesso {
  sb: SupabaseClient;
  jwt: string | null; // login de quem pergunta (no sistema)
  chaveCron: string | null; // chamada interna (WhatsApp)
  membroId: string;
  admin: boolean;
  acoes: { tipo: string; texto: string; tarefa_id?: string }[]; // o que foi feito nesta conversa
  canal?: string;
  confirmacao?: Confirmacao | null; // exclusão aguardando o clique da pessoa
}
interface ItemExclusao { id: string; titulo: string; cliente: string; status: string; prazo: string | null; responsavel: string | null; rotina: boolean; comentarios: number; checklist: number }
interface Confirmacao { token: string; modo: "excluir" | "arquivar"; itens: ItemExclusao[]; expira_em: string }

// ---------------- Confirmação de exclusão (assinada pelo servidor; a IA não consegue confirmar sozinha) ----------------
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function assinar(dados: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! + ":exclusao"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", k, enc.encode(dados)));
}
async function criarToken(p: { m: string; modo: string; ids: string[]; exp: number }) {
  const corpo = b64(enc.encode(JSON.stringify(p)));
  return `${corpo}.${await assinar(corpo)}`;
}
async function lerToken(token: string): Promise<{ m: string; modo: "excluir" | "arquivar"; ids: string[]; exp: number } | null> {
  const [corpo, ass] = String(token).split(".");
  if (!corpo || !ass || (await assinar(corpo)) !== ass) return null;
  try {
    return JSON.parse(atob(corpo.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** Na chamada interna as regras do banco não se aplicam sozinhas: repete aqui as restrições. */
function conferirTabela(tabela: string, a: Acesso) {
  if (!TABELAS[tabela]) throw new Error("Tabela não permitida.");
  if (a.chaveCron && tabela === "lancamentos" && !a.admin) throw new Error("Só administradores veem o financeiro.");
}
// deno-lint-ignore no-explicit-any
function restringir(q: any, tabela: string, a: Acesso) {
  if (a.chaveCron && tabela === "notificacoes") q = q.eq("membro_id", a.membroId);
  return q;
}

async function executar(nome: string, entrada: Json, a: Acesso): Promise<unknown> {
  const sb = a.sb;
  if (nome === "consultar_tabela") {
    const tabela = String(entrada.tabela);
    conferirTabela(tabela, a);
    let q = sb.from(tabela).select(String(entrada.colunas || "*"));
    q = restringir(aplicarFiltros(q, entrada.filtros as never), tabela, a);
    if (entrada.ordem) q = q.order(String(entrada.ordem), { ascending: !entrada.decrescente });
    const { data, error } = await q.limit(Math.min(500, Number(entrada.limite ?? 100)));
    if (error) throw new Error(error.message);
    return { linhas: data?.length ?? 0, dados: data };
  }

  if (nome === "agregar") {
    const tabela = String(entrada.tabela);
    conferirTabela(tabela, a);
    const grupos = (entrada.agrupar_por as string[] | undefined) ?? [];
    const somar = (entrada.somar as string[] | undefined) ?? [];
    const mes = entrada.agrupar_mes ? String(entrada.agrupar_mes) : null;
    const cols = [...new Set([...grupos, ...somar, ...(mes ? [mes] : [])])];
    for (const c of cols) if (!/^[a-z_]+$/.test(c)) throw new Error(`Coluna inválida: ${c}`);
    const linhas: Json[] = [];
    for (let de = 0; de < 20000; de += 1000) {
      let q = sb.from(tabela).select(cols.length ? cols.join(",") : "*");
      q = restringir(aplicarFiltros(q, entrada.filtros as never), tabela, a);
      const { data, error } = await q.range(de, de + 999);
      if (error) throw new Error(error.message);
      linhas.push(...((data ?? []) as unknown as Json[]));
      if (!data || data.length < 1000) break;
    }
    const mapa = new Map<string, Json>();
    for (const l of linhas) {
      const chave: Json = {};
      for (const g of grupos) chave[g] = l[g] ?? null;
      if (mes) chave.mes = String(l[mes] ?? "").slice(0, 7);
      const k = JSON.stringify(chave);
      const acc = mapa.get(k) ?? { ...chave, quantidade: 0, ...Object.fromEntries(somar.map((s) => [`soma_${s}`, 0])) };
      acc.quantidade = (acc.quantidade as number) + 1;
      for (const s of somar) acc[`soma_${s}`] = Math.round(((acc[`soma_${s}`] as number) + (Number(l[s]) || 0)) * 100) / 100;
      mapa.set(k, acc);
    }
    const grupos_ = [...mapa.values()];
    return { linhas_lidas: linhas.length, grupos: grupos_.length, resultado: grupos_.slice(0, 400) };
  }

  if (nome === "relatorio_meta_ao_vivo") {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/relatorio-meta`, {
      method: "POST",
      headers: a.chaveCron ? { "x-chave-cron": a.chaveCron, "Content-Type": "application/json" } : { Authorization: `Bearer ${a.jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id: entrada.cliente_id, inicio: entrada.inicio, fim: entrada.fim }),
    });
    const j = (await r.json()) as Json;
    if (j.erro) throw new Error(String(j.erro));
    // Resumo enxuto para não estourar o contexto
    const contas = (j.contas as Json[]).map((c) => ({
      conta: (c.conta as Json)?.nome,
      erro: c.erro,
      total: c.total,
      periodo_anterior: c.anterior,
      campanhas: ((c.campanhas as Json[]) ?? []).map((x) => ({ nome: x.campaign_name, objetivo: x.objective, status: x.status, gasto: x.spend, impressoes: x.impressions, alcance: x.reach, cliques_link: x.inline_link_clicks, resultados: x.results, acoes: x.actions })),
      melhores_anuncios: ((c.anuncios as Json[]) ?? []).slice(0, 12).map((a) => ({ nome: a.ad_name, campanha: a.campaign_name, gasto: a.spend, ctr: a.ctr, resultados: a.results, status: a.status })),
    }));
    return { inicio: j.inicio, fim: j.fim, anterior: j.anterior, contas };
  }

  // ---------------- Ações (escrita) ----------------
  const ok = (r: { error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
  };
  const umaTarefa = async (id: string) => {
    const { data, error } = await sb.from("tarefas").select("id, titulo, cliente_id, cliente:clientes(nome)").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Tarefa não encontrada.");
    return data as unknown as { id: string; titulo: string; cliente_id: string; cliente: { nome: string } | null };
  };

  if (nome === "preparar_exclusao_tarefas") {
    if (a.canal === "whatsapp" || !a.jwt) throw new Error("Exclusão só pode ser confirmada dentro do sistema (Central de IA), não pelo WhatsApp.");
    if (a.confirmacao) throw new Error("Já existe uma exclusão aguardando confirmação nesta resposta. Junte tudo numa única lista.");
    const modo = entrada.modo === "arquivar" ? "arquivar" : "excluir";
    const ids = [...new Set(((entrada.tarefa_ids as string[] | undefined) ?? []).map(String))];
    if (!ids.length) throw new Error("Informe as tarefas.");
    if (ids.length > 50) throw new Error("No máximo 50 tarefas por vez. Divida o pedido.");
    const { data, error } = await a.sb.from("tarefas").select("id, titulo, status, prazo, cliente_rotina_id, cliente:clientes(nome), responsavel:membros!tarefas_responsavel_id_fkey(nome), tarefa_comentarios(count), tarefa_checklist(count)").in("id", ids);
    if (error) throw new Error(error.message);
    const linhas = (data ?? []) as unknown as Json[];
    const faltam = ids.filter((id) => !linhas.some((l) => l.id === id));
    if (faltam.length) throw new Error(`Não achei ${faltam.length} tarefa(s) com esses ids. Consulte de novo antes de pedir a confirmação.`);
    const cnt = (x: unknown) => Number(((x as { count?: number }[] | undefined) ?? [])[0]?.count ?? 0);
    const itens: ItemExclusao[] = linhas.map((l) => ({
      id: String(l.id),
      titulo: String(l.titulo),
      cliente: (l.cliente as { nome?: string } | null)?.nome ?? "—",
      status: String(l.status),
      prazo: (l.prazo as string | null) ?? null,
      responsavel: (l.responsavel as { nome?: string } | null)?.nome ?? null,
      rotina: !!l.cliente_rotina_id,
      comentarios: cnt(l.tarefa_comentarios),
      checklist: cnt(l.tarefa_checklist),
    }));
    const exp = Date.now() + 15 * 60_000;
    a.confirmacao = { token: await criarToken({ m: a.membroId, modo, ids, exp }), modo, itens, expira_em: new Date(exp).toISOString() };
    return {
      ok: true,
      aguardando_confirmacao: true,
      nada_foi_alterado: true,
      modo,
      quantidade: itens.length,
      itens: itens.map((i) => ({ titulo: i.titulo, cliente: i.cliente, status: i.status, prazo: i.prazo })),
      instrucao: "A tela vai mostrar um quadro com a lista e o botão de confirmar. Diga em 1-2 linhas o que será feito e peça para a pessoa conferir a lista e clicar em Confirmar. Não diga que já foi feito.",
    };
  }

  if (nome === "criar_tarefa") {
    if (entrada.prazo && !dataValida(entrada.prazo)) throw new Error("Prazo deve ser AAAA-MM-DD.");
    const r = await sb.from("tarefas").insert({
      cliente_id: entrada.cliente_id,
      titulo: String(entrada.titulo).slice(0, 200),
      descricao: entrada.descricao ?? null,
      prazo: entrada.prazo ?? null,
      responsavel_id: entrada.responsavel_id ?? null,
      prioridade: entrada.prioridade ?? "normal",
      pilar: entrada.pilar ?? "trafego",
      canal: entrada.canal ?? null,
      origem: "manual",
      criado_por: a.membroId,
    }).select("id, titulo, cliente:clientes(nome)").single();
    ok(r);
    const t = r.data as unknown as { id: string; titulo: string; cliente: { nome: string } | null };
    const itens = ((entrada.checklist as string[] | undefined) ?? []).filter((x) => String(x).trim()).slice(0, 30);
    if (itens.length) ok(await sb.from("tarefa_checklist").insert(itens.map((texto, ordem) => ({ tarefa_id: t.id, texto: String(texto), ordem }))));
    a.acoes.push({ tipo: "tarefa_criada", texto: `Tarefa criada: "${t.titulo}" (${t.cliente?.nome ?? "cliente"})`, tarefa_id: t.id });
    return { ok: true, tarefa_id: t.id };
  }

  if (nome === "atualizar_tarefa") {
    const t = await umaTarefa(String(entrada.tarefa_id));
    const campos: Json = {};
    for (const k of ["status", "prazo", "responsavel_id", "prioridade", "titulo", "descricao"]) if (entrada[k] !== undefined) campos[k] = entrada[k];
    if (campos.prazo && !dataValida(campos.prazo)) throw new Error("Prazo deve ser AAAA-MM-DD.");
    if (!Object.keys(campos).length) throw new Error("Nada para mudar.");
    ok(await sb.from("tarefas").update(campos).eq("id", t.id));
    const desc = Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join(", ");
    a.acoes.push({ tipo: "tarefa_atualizada", texto: `Tarefa "${t.titulo}" (${t.cliente?.nome ?? ""}) → ${desc}`, tarefa_id: t.id });
    return { ok: true };
  }

  if (nome === "comentar_tarefa") {
    const t = await umaTarefa(String(entrada.tarefa_id));
    ok(await sb.from("tarefa_comentarios").insert({ tarefa_id: t.id, texto: String(entrada.texto).slice(0, 4000), autor_id: a.membroId }));
    a.acoes.push({ tipo: "comentario", texto: `Comentário em "${t.titulo}" (${t.cliente?.nome ?? ""})`, tarefa_id: t.id });
    return { ok: true };
  }

  if (nome === "checklist_tarefa") {
    const t = await umaTarefa(String(entrada.tarefa_id));
    const novos = ((entrada.adicionar as string[] | undefined) ?? []).filter((x) => String(x).trim()).slice(0, 30);
    if (novos.length) {
      const { data: ex } = await sb.from("tarefa_checklist").select("ordem").eq("tarefa_id", t.id).order("ordem", { ascending: false }).limit(1);
      const base = ((ex?.[0] as { ordem?: number } | undefined)?.ordem ?? -1) + 1;
      ok(await sb.from("tarefa_checklist").insert(novos.map((texto, i) => ({ tarefa_id: t.id, texto: String(texto), ordem: base + i }))));
    }
    const marcar = (entrada.marcar as { item_id: string; feito: boolean }[] | undefined) ?? [];
    for (const m of marcar) ok(await sb.from("tarefa_checklist").update({ feito: !!m.feito }).eq("id", m.item_id).eq("tarefa_id", t.id));
    a.acoes.push({ tipo: "checklist", texto: `Checklist de "${t.titulo}": ${novos.length ? `+${novos.length} item(ns)` : ""}${novos.length && marcar.length ? ", " : ""}${marcar.length ? `${marcar.length} marcado(s)` : ""}`, tarefa_id: t.id });
    return { ok: true };
  }

  if (nome === "criar_anotacao") {
    const r = await sb.from("notas").insert({
      cliente_id: entrada.cliente_id || null,
      titulo: entrada.titulo ?? null,
      texto: String(entrada.texto).slice(0, 8000),
      etiqueta: entrada.etiqueta ?? "geral",
      fixada: !!entrada.fixada,
      autor_id: a.membroId,
    }).select("id").single();
    ok(r);
    a.acoes.push({ tipo: "anotacao", texto: `Anotação criada${entrada.titulo ? `: "${entrada.titulo}"` : ""}` });
    return { ok: true };
  }

  if (nome === "registrar_na_linha_do_tempo") {
    const data = entrada.data && dataValida(entrada.data) ? entrada.data : hojeBR();
    ok(await sb.from("registros").insert({
      cliente_id: entrada.cliente_id,
      tipo: entrada.tipo,
      nota: String(entrada.nota).slice(0, 8000),
      canal: entrada.canal ?? null,
      situacao: entrada.situacao ?? null,
      data,
      autor_id: a.membroId,
    }));
    a.acoes.push({ tipo: "registro", texto: `Registro (${entrada.tipo}) na linha do tempo, ${String(data).split("-").reverse().join("/")}` });
    return { ok: true };
  }

  if (nome === "marcar_temperatura") {
    const nivel = Math.round(Number(entrada.nivel));
    if (!(nivel >= 1 && nivel <= 5)) throw new Error("Nível de 1 a 5.");
    ok(await sb.from("temperaturas").insert({ cliente_id: entrada.cliente_id, nivel, motivo: entrada.motivo ?? null, autor_id: a.membroId }));
    a.acoes.push({ tipo: "temperatura", texto: `Temperatura marcada: ${["", "Crítica", "Fria", "Morna", "Boa", "Ótima"][nivel]}` });
    return { ok: true };
  }
  throw new Error("Ferramenta desconhecida.");
}

function sistema(nome: string, papel: string, pagina: string | undefined, canal?: string, membroId = "") {
  return `Você é o Assistente da Vertente Digital, agência de marketing (tráfego pago, Google Meu Negócio, social media e CRM) de Minas Gerais. Você fica dentro do Sistema Vertente, o sistema interno da agência, e conversa com ${nome} (${papel}).
Hoje é ${hojeBR()} (horário de Brasília).${pagina ? ` A pessoa está na tela "${pagina}" do sistema.` : ""}

Você lê todo o sistema pelas ferramentas e também EXECUTA ações quando a pessoa pede: criar tarefa, excluir/arquivar tarefas (sempre com confirmação na tela), mudar status/prazo/responsável/prioridade, concluir tarefa, comentar, mexer no checklist, criar anotação, registrar na linha do tempo e marcar a temperatura do cliente. Sempre consulte os dados antes de afirmar números; nunca invente.
Regras das ações:
- Só aja quando a pessoa pedir (ou confirmar uma sugestão sua). Em perguntas, apenas responda.
- Antes, ache os ids certos (cliente por nome com ilike, membro por nome, tarefa pelo título + cliente). Se houver mais de uma opção possível ou faltar algo essencial, pergunte antes em vez de chutar.
- Se o pedido mexer em mais de 5 itens de uma vez, liste o que vai fazer e peça confirmação primeiro.
- Excluir ou arquivar tarefas: use SEMPRE preparar_exclusao_tarefas com a lista exata (uma única chamada com todas). Isso NÃO apaga: a tela mostra a lista com um aviso e o botão Confirmar, e só o clique da pessoa executa. Nunca diga que excluiu antes da confirmação. Se o pedido for vago ("apague as antigas"), consulte, mostre e deixe a pessoa conferir na lista. Arquivar = marcar como Não feita (some das listas e fica no histórico); excluir = apagar de vez, com comentários e checklist.
- Você NÃO apaga mais nada além de tarefas, e NÃO faz mudanças estruturais no sistema (tabelas, colunas, telas, permissões, usuários, integrações, automações, rotinas), nem mexe em financeiro, contratos ou cadastros: para isso, explique onde fazer no sistema.
- "Minhas tarefas"/"para mim" = responsavel_id ${membroId} (você está falando com essa pessoa). Datas relativas ("amanhã", "sexta") contam a partir de hoje.
- Depois de agir, confirme em poucas linhas o que foi feito.

Tabelas disponíveis:
${Object.entries(TABELAS).map(([t, d]) => `- ${t}: ${d}`).join("\n")}

Dicas:
- IDs ligam as tabelas (cliente_id -> clientes.id, responsavel_id/autor_id -> membros.id, conta_id -> contas_anuncio.id, perfil_id -> gmn_perfis.id). Busque nomes para mostrar em vez de IDs.
- Para achar um cliente pelo nome use consultar_tabela em clientes com filtro ilike '%parte do nome%'.
- Perguntas sobre estratégia, público, oferta ou "como está o cliente X": leia o briefing (briefings) e as notas fixadas/recentes do cliente (notas) junto com os números.
- Tarefas atrasadas: status em (a_fazer, fazendo, aguardando) e prazo < hoje.
- Tráfego: "contatos" = conversas + leads; custo por contato = gasto / contatos. Para números exatos de um período e criativos, use relatorio_meta_ao_vivo.
- Financeiro: resultado do mês = receitas − despesas pela competência. Se a consulta de lançamentos voltar vazia ou com erro de permissão, explique que só administradores veem o financeiro.

Responda em português do Brasil, de forma direta e organizada: comece pela resposta, use tabelas e listas em Markdown quando ajudarem, valores em R$ com vírgula decimal, datas no formato dd/mm/aaaa. Em análises, aponte o que chama atenção e sugira próximos passos práticos.${
    canal === "whatsapp"
      ? `

Você está respondendo num grupo de WhatsApp do time. Seja curto (até ~15 linhas), use a formatação do WhatsApp (*negrito*, listas com •) e NUNCA use tabelas Markdown, títulos com # ou links em Markdown.`
      : ""
  }`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Json, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const corpo = (await req.json().catch(() => ({}))) as { mensagens?: { role: string; content: string }[]; pagina?: string; membro_id?: string; canal?: string; confirmar_exclusao?: string; cancelar_exclusao?: boolean };

  // Quem pergunta: login do sistema ou chamada interna (WhatsApp) com a chave do servidor
  const chaveCron = req.headers.get("x-chave-cron");
  const interno = chaveCron ? (await admin.rpc("validar_chave_cron", { chave: chaveCron })).data === true : false;
  let jwt: string | null = null;
  let m: { id: string; nome: string; papel: string } | null = null;
  if (interno) {
    if (!corpo.membro_id) return responder({ erro: "Informe o membro." }, 400);
    const r = await admin.from("membros").select("id, nome, papel").eq("id", corpo.membro_id).eq("ativo", true).maybeSingle();
    m = r.data;
  } else {
    jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u.user) return responder({ erro: "Sua sessão expirou. Saia e entre de novo no sistema." }, 401);
    const r = await admin.from("membros").select("id, nome, papel").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
    m = r.data;
  }
  if (!m) return responder({ erro: "Sem acesso." }, 403);

  // ---------------- Clique em "Confirmar" no quadro de exclusão ----------------
  if (corpo.confirmar_exclusao) {
    if (interno || !jwt) return responder({ erro: "Exclusão só pelo sistema." }, 403);
    const t = await lerToken(corpo.confirmar_exclusao);
    if (!t || t.m !== m.id) return responder({ erro: "Confirmação inválida. Peça a exclusão de novo ao assistente." }, 403);
    if (Date.now() > t.exp) return responder({ erro: "A confirmação expirou (15 min). Peça de novo para eu montar a lista atualizada." }, 410);
    const sbu = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: antes } = await sbu.from("tarefas").select("id, titulo, cliente:clientes(nome)").in("id", t.ids);
    const lista = (antes ?? []) as unknown as { id: string; titulo: string; cliente: { nome: string } | null }[];
    if (!lista.length) return responder({ ok: true, resposta: "Essas tarefas já não existem mais (talvez já tenham sido excluídas).", acoes: [] });
    const r = t.modo === "excluir"
      ? await sbu.from("tarefas").delete().in("id", lista.map((x) => x.id))
      : await sbu.from("tarefas").update({ status: "nao_feita" }).in("id", lista.map((x) => x.id));
    if (r.error) return responder({ erro: r.error.message }, 500);
    const verbo = t.modo === "excluir" ? "Excluída" : "Arquivada";
    const acoes = lista.map((x) => ({ tipo: t.modo === "excluir" ? "tarefa_excluida" : "tarefa_arquivada", texto: `${verbo}: "${x.titulo}" (${x.cliente?.nome ?? ""})` }));
    const resposta = `${t.modo === "excluir" ? "Exclusão" : "Arquivamento"} confirmado: ${lista.length} tarefa${lista.length > 1 ? "s" : ""} ${t.modo === "excluir" ? "excluída" : "arquivada"}${lista.length > 1 ? "s" : ""}.${lista.length < t.ids.length ? ` (${t.ids.length - lista.length} já não existia${t.ids.length - lista.length > 1 ? "m" : ""}.)` : ""}`;
    return responder({ ok: true, resposta, acoes });
  }

  const chave = Deno.env.get("ANTHROPIC_API_KEY") || ((await admin.rpc("ler_segredo", { nome: "anthropic_api_key" })).data as string | null);
  const chaveOpenai = chave ? null : Deno.env.get("OPENAI_API_KEY") || ((await admin.rpc("ler_segredo", { nome: "openai_api_key" })).data as string | null);
  if (!chave && !chaveOpenai) return responder({ erro: "O assistente ainda não está ligado: falta a chave da IA (anthropic_api_key ou openai_api_key no Vault do Supabase)." }, 412);

  // No sistema: cliente com o login de quem pergunta (as regras do banco valem).
  // Interno: cliente do servidor, com as restrições repetidas em conferirTabela/restringir.
  const sb = interno ? admin : createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const acesso: Acesso = { sb, jwt, chaveCron: interno ? chaveCron : null, membroId: m.id, admin: m.papel === "admin", acoes: [], canal: corpo.canal, confirmacao: null };
  const historico = (corpo.mensagens ?? []).filter((x) => (x.role === "user" || x.role === "assistant") && typeof x.content === "string" && x.content.trim()).slice(-20);
  if (!historico.length || historico[historico.length - 1].role !== "user") return responder({ erro: "Envie uma pergunta." }, 400);

  const mensagens: Json[] = historico.map((x) => ({ role: x.role, content: x.content.slice(0, 12000) }));
  const consultas: { ferramenta: string; tabela?: string; ok: boolean }[] = [];

  /** Executa uma ferramenta e devolve o texto do resultado para a IA. */
  async function rodarFerramenta(nome: string, entrada: Json): Promise<{ texto: string; erro: boolean }> {
    try {
      const saida = await executar(nome, entrada, acesso);
      if (!ACOES.has(nome)) consultas.push({ ferramenta: nome, tabela: (entrada.tabela as string) ?? (nome === "relatorio_meta_ao_vivo" ? "Meta" : undefined), ok: true });
      let texto = JSON.stringify(saida);
      if (texto.length > 60000) texto = texto.slice(0, 60000) + "… (resultado cortado; refine os filtros)";
      return { texto, erro: false };
    } catch (e) {
      consultas.push({ ferramenta: nome, tabela: entrada.tabela as string, ok: false });
      return { texto: `Erro: ${(e as Error).message}`, erro: true };
    }
  }

  // ---------------- OpenAI (Responses API com funções) ----------------
  if (!chave && chaveOpenai) {
    const ferramentas = FERRAMENTAS.map((f) => ({ type: "function", name: f.name, description: f.description, parameters: f.input_schema }));
    const instrucoes = sistema(m.nome, m.papel, corpo.pagina, corpo.canal, m.id);
    let entrada: unknown = historico.map((x) => ({ role: x.role, content: x.content.slice(0, 12000) }));
    let anterior: string | null = null;
    try {
      for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${chaveOpenai}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODELO_OPENAI, instructions: instrucoes, input: entrada, tools: ferramentas, ...(anterior ? { previous_response_id: anterior } : {}) }),
        });
        const j = (await r.json()) as Json;
        if (!r.ok || j.error) {
          const e = (j.error as { message?: string } | undefined)?.message ?? `Erro ${r.status} na API da OpenAI`;
          return responder({ erro: `A IA não respondeu: ${e}` }, 502);
        }
        anterior = String(j.id);
        const saida = (j.output as { type: string; call_id?: string; name?: string; arguments?: string; content?: { type: string; text?: string }[] }[]) ?? [];
        const chamadas = saida.filter((o) => o.type === "function_call");
        if (!chamadas.length) {
          const texto = saida.filter((o) => o.type === "message").flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text).join("\n").trim();
          return responder({ ok: true, resposta: texto || "Não consegui montar uma resposta. Tente perguntar de outro jeito.", consultas, acoes: acesso.acoes, confirmacao: acesso.confirmacao, modelo: MODELO_OPENAI });
        }
        entrada = await Promise.all(
          chamadas.map(async (c) => {
            let args: Json = {};
            try {
              args = JSON.parse(c.arguments || "{}");
            } catch { /* argumentos inválidos: a ferramenta devolve erro */ }
            const res = await rodarFerramenta(c.name!, args);
            return { type: "function_call_output", call_id: c.call_id, output: res.texto };
          }),
        );
      }
      return responder({ ok: true, resposta: "A pergunta exigiu consultas demais. Tente dividir em partes menores.", consultas, acoes: acesso.acoes, confirmacao: acesso.confirmacao, modelo: MODELO_OPENAI });
    } catch (e) {
      return responder({ erro: (e as Error).message }, 500);
    }
  }

  // ---------------- Anthropic (Claude) ----------------

  try {
    for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": chave!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODELO, max_tokens: 4096, system: sistema(m.nome, m.papel, corpo.pagina, corpo.canal, m.id), tools: FERRAMENTAS, messages: mensagens }),
      });
      const j = (await r.json()) as Json;
      if (j.type === "error" || !r.ok) {
        const e = (j.error as { message?: string } | undefined)?.message ?? `Erro ${r.status} na API da Anthropic`;
        return responder({ erro: `A IA não respondeu: ${e}` }, 502);
      }
      const blocos = j.content as { type: string; text?: string; id?: string; name?: string; input?: Json }[];
      mensagens.push({ role: "assistant", content: blocos });
      const usos = blocos.filter((b) => b.type === "tool_use");
      if (j.stop_reason !== "tool_use" || !usos.length) {
        const texto = blocos.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
        return responder({ ok: true, resposta: texto || "Não consegui montar uma resposta. Tente perguntar de outro jeito.", consultas, acoes: acesso.acoes, confirmacao: acesso.confirmacao, modelo: MODELO });
      }
      const resultados = await Promise.all(
        usos.map(async (b) => {
          const res = await rodarFerramenta(b.name!, b.input ?? {});
          return { type: "tool_result", tool_use_id: b.id, content: res.texto, ...(res.erro ? { is_error: true } : {}) };
        }),
      );
      mensagens.push({ role: "user", content: resultados });
    }
    return responder({ ok: true, resposta: "A pergunta exigiu consultas demais. Tente dividir em partes menores.", consultas, acoes: acesso.acoes, confirmacao: acesso.confirmacao, modelo: MODELO });
  } catch (e) {
    return responder({ erro: (e as Error).message }, 500);
  }
});
