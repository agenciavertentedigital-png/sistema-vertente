// Assistente de IA do Sistema Vertente: responde no chat consultando os dados do sistema.
// Só leitura. As consultas rodam com o login de quem pergunta, então valem as mesmas permissões do banco
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
  clientes: "Clientes e ficha cadastral. status: ativo|pausado|encerrado. origem: vertente|parceria_marcone (clientes da agência parceira do Marcone).",
  cliente_servicos: "Serviços contratados por cliente e valor mensal. servico_codigo: trafego_meta, trafego_google, gmn, social_media, consultoria.",
  membros: "Time da agência (nome, papel admin|gestor|cs|visualizador, ativo).",
  tarefas: "Tarefas. status: a_fazer|fazendo|aguardando|feita|nao_feita. pilar: trafego|social|gmn|cs|interno. prioridade: urgente|alta|normal|baixa. prazo (data). responsavel_id -> membros. origem: manual|rotina|clickup.",
  tarefa_checklist: "Itens de checklist das tarefas.",
  tarefa_comentarios: "Comentários das tarefas.",
  rotinas: "Modelos de rotina recorrente (revisão diária, otimização semanal…).",
  cliente_rotinas: "Rotinas ativas por cliente (frequência, responsável).",
  registros: "Linha do tempo: revisões, otimizações, reuniões, notas, decisões, daily e weekly. tipo: revisao|otimizacao|reuniao|nota|decisao|daily|weekly. situacao: ok|atencao|problema. acoes (lista), nota (texto), alteracoes (json), data.",
  notificacoes: "Avisos do usuário logado (menções, atribuições, alertas).",
  contas_anuncio: "Contas de anúncio Meta por cliente: status (ativa, desativada, pagamento_pendente…), saldo, ultimo_sync, erro_sync.",
  metricas_diarias: "Métricas da Meta por campanha e dia (sincronizadas 3x ao dia): gasto, impressoes, alcance, cliques, resultados, tipo_resultado, leads (formulário), conversas (WhatsApp/Direct). conta_id -> contas_anuncio. Contatos = conversas + leads. Alcance não se soma entre dias.",
  metricas_conta_dia: "Visão por conta e dia (soma das campanhas).",
  gmn_perfis: "Perfis do Google Meu Negócio (cliente_id nulo = prospecção).",
  gmn_analises: "Análises GBP Check dos perfis: nota 0–100, criterios (nivel 0 fraco,1 razoável,2 bom), dados do Google, data.",
  posts: "Cronograma de Social Media. status: ideia|producao|aprovacao (com o cliente)|ajuste|aprovado|publicado. formato: feed|carrossel|reels|stories.",
  lancamentos: "Financeiro da agência (só administradores): tipo receita|despesa, categoria, valor, competencia (1º dia do mês), vencimento, pago_em. Histórico desde out/2024 importado da planilha.",
  contratos: "Contratos: status rascunho|enviado|assinado|cancelado, valor_mensal, inicio, meses.",
  contrato_modelos: "Modelos de contrato.",
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
];

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

async function executar(nome: string, entrada: Json, sb: SupabaseClient, jwt: string): Promise<unknown> {
  if (nome === "consultar_tabela") {
    const tabela = String(entrada.tabela);
    if (!TABELAS[tabela]) throw new Error("Tabela não permitida.");
    let q = sb.from(tabela).select(String(entrada.colunas || "*"));
    q = aplicarFiltros(q, entrada.filtros as never);
    if (entrada.ordem) q = q.order(String(entrada.ordem), { ascending: !entrada.decrescente });
    const { data, error } = await q.limit(Math.min(500, Number(entrada.limite ?? 100)));
    if (error) throw new Error(error.message);
    return { linhas: data?.length ?? 0, dados: data };
  }

  if (nome === "agregar") {
    const tabela = String(entrada.tabela);
    if (!TABELAS[tabela]) throw new Error("Tabela não permitida.");
    const grupos = (entrada.agrupar_por as string[] | undefined) ?? [];
    const somar = (entrada.somar as string[] | undefined) ?? [];
    const mes = entrada.agrupar_mes ? String(entrada.agrupar_mes) : null;
    const cols = [...new Set([...grupos, ...somar, ...(mes ? [mes] : [])])];
    for (const c of cols) if (!/^[a-z_]+$/.test(c)) throw new Error(`Coluna inválida: ${c}`);
    const linhas: Json[] = [];
    for (let de = 0; de < 20000; de += 1000) {
      let q = sb.from(tabela).select(cols.length ? cols.join(",") : "*");
      q = aplicarFiltros(q, entrada.filtros as never);
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
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
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
  throw new Error("Ferramenta desconhecida.");
}

function sistema(nome: string, papel: string, pagina: string | undefined) {
  return `Você é o Assistente da Vertente Digital, agência de marketing (tráfego pago, Google Meu Negócio, social media e CRM) de Minas Gerais. Você fica dentro do Sistema Vertente, o sistema interno da agência, e conversa com ${nome} (${papel}).
Hoje é ${hojeBR()} (horário de Brasília).${pagina ? ` A pessoa está na tela "${pagina}" do sistema.` : ""}

Você tem acesso de LEITURA a todo o sistema pelas ferramentas. Sempre consulte os dados antes de afirmar números; nunca invente. Se algo não existir no sistema, diga que não encontrou. Você não altera nada: se pedirem para mudar algo, explique onde fazer no sistema.

Tabelas disponíveis:
${Object.entries(TABELAS).map(([t, d]) => `- ${t}: ${d}`).join("\n")}

Dicas:
- IDs ligam as tabelas (cliente_id -> clientes.id, responsavel_id/autor_id -> membros.id, conta_id -> contas_anuncio.id, perfil_id -> gmn_perfis.id). Busque nomes para mostrar em vez de IDs.
- Para achar um cliente pelo nome use consultar_tabela em clientes com filtro ilike '%parte do nome%'.
- Tarefas atrasadas: status em (a_fazer, fazendo, aguardando) e prazo < hoje.
- Tráfego: "contatos" = conversas + leads; custo por contato = gasto / contatos. Para números exatos de um período e criativos, use relatorio_meta_ao_vivo.
- Financeiro: resultado do mês = receitas − despesas pela competência. Se a consulta de lançamentos voltar vazia ou com erro de permissão, explique que só administradores veem o financeiro.

Responda em português do Brasil, de forma direta e organizada: comece pela resposta, use tabelas e listas em Markdown quando ajudarem, valores em R$ com vírgula decimal, datas no formato dd/mm/aaaa. Em análises, aponte o que chama atenção e sugira próximos passos práticos.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Json, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u.user) return responder({ erro: "Sua sessão expirou. Saia e entre de novo no sistema." }, 401);
  const { data: m } = await admin.from("membros").select("id, nome, papel").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
  if (!m) return responder({ erro: "Sem acesso." }, 403);

  const chave = Deno.env.get("ANTHROPIC_API_KEY") || ((await admin.rpc("ler_segredo", { nome: "anthropic_api_key" })).data as string | null);
  const chaveOpenai = chave ? null : Deno.env.get("OPENAI_API_KEY") || ((await admin.rpc("ler_segredo", { nome: "openai_api_key" })).data as string | null);
  if (!chave && !chaveOpenai) return responder({ erro: "O assistente ainda não está ligado: falta a chave da IA (anthropic_api_key ou openai_api_key no Vault do Supabase)." }, 412);

  // Cliente com o login de quem pergunta: as regras de acesso do banco continuam valendo
  const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });

  const corpo = (await req.json().catch(() => ({}))) as { mensagens?: { role: string; content: string }[]; pagina?: string };
  const historico = (corpo.mensagens ?? []).filter((x) => (x.role === "user" || x.role === "assistant") && typeof x.content === "string" && x.content.trim()).slice(-20);
  if (!historico.length || historico[historico.length - 1].role !== "user") return responder({ erro: "Envie uma pergunta." }, 400);

  const mensagens: Json[] = historico.map((x) => ({ role: x.role, content: x.content.slice(0, 12000) }));
  const consultas: { ferramenta: string; tabela?: string; ok: boolean }[] = [];

  /** Executa uma ferramenta e devolve o texto do resultado para a IA. */
  async function rodarFerramenta(nome: string, entrada: Json): Promise<{ texto: string; erro: boolean }> {
    try {
      const saida = await executar(nome, entrada, sb, jwt);
      consultas.push({ ferramenta: nome, tabela: (entrada.tabela as string) ?? (nome === "relatorio_meta_ao_vivo" ? "Meta" : undefined), ok: true });
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
    const instrucoes = sistema(m.nome, m.papel, corpo.pagina);
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
          return responder({ ok: true, resposta: texto || "Não consegui montar uma resposta. Tente perguntar de outro jeito.", consultas, modelo: MODELO_OPENAI });
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
      return responder({ ok: true, resposta: "A pergunta exigiu consultas demais. Tente dividir em partes menores.", consultas, modelo: MODELO_OPENAI });
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
        body: JSON.stringify({ model: MODELO, max_tokens: 4096, system: sistema(m.nome, m.papel, corpo.pagina), tools: FERRAMENTAS, messages: mensagens }),
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
        return responder({ ok: true, resposta: texto || "Não consegui montar uma resposta. Tente perguntar de outro jeito.", consultas, modelo: MODELO });
      }
      const resultados = await Promise.all(
        usos.map(async (b) => {
          const res = await rodarFerramenta(b.name!, b.input ?? {});
          return { type: "tool_result", tool_use_id: b.id, content: res.texto, ...(res.erro ? { is_error: true } : {}) };
        }),
      );
      mensagens.push({ role: "user", content: resultados });
    }
    return responder({ ok: true, resposta: "A pergunta exigiu consultas demais. Tente dividir em partes menores.", consultas, modelo: MODELO });
  } catch (e) {
    return responder({ erro: (e as Error).message }, 500);
  }
});
