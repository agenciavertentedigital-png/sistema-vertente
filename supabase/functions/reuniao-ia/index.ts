// Resumo de reunião com IA: a partir da transcrição, devolve o resumo no modelo da Vertente
// (pronto para o grupo do WhatsApp) e os itens de ação separados entre Vertente e cliente.
// Não grava nada: quem confirma e cria as demandas é a pessoa, na tela da reunião.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
type Json = Record<string, unknown>;

const EXEMPLO = `📌 *RESUMO DA REUNIÃO — NOBRE FIO | 30/10*

Pessoal, segue um resumo dos principais pontos que alinhamos hoje e das ações para darmos continuidade.

*🎥 1. Conteúdos e gravações*
- Reforçamos a necessidade de novos vídeos, principalmente de *Transplante e Terapias Capilares*, para renovar os anúncios.
- O vídeo do Dr. Wesley apresentando a avaliação já foi editado e está aguardando aprovação.

*🎯 2. Campanha de Novembro*
- Alinhamos a importância de trabalhar condições atrativas, sem transformar a comunicação em uma campanha focada apenas em preço.
- A estratégia terá foco na *retomada de pacientes que já demonstraram interesse*, com ações pelo WhatsApp e CRM.

---

✅ *ITENS DE AÇÃO*

*🔵 VERTENTE DIGITAL*
- Preparar novos roteiros para novembro, considerando o formato preferido de cada médica.
- Estruturar a comunicação da campanha de novembro assim que as condições forem confirmadas.

*🟢 NOBRE FIO — DANÚBIA / EQUIPE*
- Organizar com as médicas as gravações da próxima semana.
- Selecionar e enviar ao Drive fotos de antes e depois, com autorização de uso.

*🟣 NOBRE FIO — POLYANNE / GESTÃO*
- Dar retorno sobre as condições definidas *até quarta-feira (04/11)*.

📍 *Próximo passo:* nossa prioridade agora é fechar as condições de novembro e organizar as gravações. Contamos com esses retornos de vocês para avançarmos juntos!`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: Json, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u.user) return responder({ erro: "Faça login de novo no sistema." }, 401);
  const { data: m } = await admin.from("membros").select("id").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
  if (!m) return responder({ erro: "Sem acesso." }, 403);

  const corpo = (await req.json().catch(() => ({}))) as { cliente_id?: string; transcricao?: string; data?: string };
  const transcricao = String(corpo.transcricao ?? "").trim();
  if (transcricao.length < 200) return responder({ erro: "Cole a transcrição completa da reunião." }, 400);
  const { data: cli } = await admin.from("clientes").select("nome").eq("id", corpo.cliente_id ?? "").maybeSingle();
  if (!cli) return responder({ erro: "Cliente não encontrado." }, 404);
  const { data: time } = await admin.from("membros").select("nome").eq("ativo", true);
  const dataBR = String(corpo.data ?? "").split("-").reverse().slice(0, 2).join("/");

  const chave = ((await admin.rpc("ler_segredo", { nome: "openai_api_key" })).data as string | null) ?? "";
  if (!chave) return responder({ erro: "Falta a chave da IA (OpenAI) em Integrações." }, 412);

  const pedido = `Você é a CS da Vertente Digital, agência de marketing. Com base na transcrição da reunião com o cliente "${cli.nome}" (data ${dataBR || "de hoje"}), faça o resumo da reunião com itens de ação no final, para enviar no grupo do WhatsApp do cliente.

Siga EXATAMENTE o estilo deste modelo (é um exemplo de outra reunião; não copie o conteúdo, só a forma):
<<<
${EXEMPLO}
>>>

Regras:
- Português do Brasil, tom próximo e profissional, como no modelo.
- Formatação do WhatsApp: negrito com UM asterisco (*assim*), nunca dois. Sem títulos com #.
- Tópicos numerados com emoji, cada um com 2 a 5 marcadores curtos. Só o que foi realmente falado.
- Itens de ação separados: primeiro a Vertente Digital, depois cada pessoa ou equipe do cliente pelo nome (como "${cli.nome.toUpperCase()} — NOME / ÁREA"). Prazos só quando foram ditos.
- Não invente responsáveis, prazos, valores ou combinados que não estão na transcrição.
- Time da Vertente (para reconhecer quem é da agência): ${(time ?? []).map((x) => x.nome).join(", ")}.

Responda SÓ com um JSON válido, sem nada antes ou depois, neste formato:
{"titulo": "Resumo da reunião — ${cli.nome} | ${dataBR}", "resumo": "<o texto completo no estilo do modelo>", "itens": [{"lado": "vertente" | "cliente", "quem": "<pessoa ou equipe do cliente; vazio para a Vertente>", "texto": "<ação curta, começando com verbo>", "prazo": "AAAA-MM-DD ou null"}]}

Transcrição:
<<<
${transcricao.slice(0, 120000)}
>>>`;

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("ASSISTENTE_MODELO_OPENAI") || "gpt-5.5", input: pedido }),
  });
  const j = (await r.json()) as Json;
  if (!r.ok) return responder({ erro: (j.error as Json | undefined)?.message ?? "A IA não respondeu." }, 502);
  const texto = ((j.output as Json[]) ?? []).filter((o) => o.type === "message").flatMap((o) => (o.content as Json[]) ?? []).map((c) => c.text).join("\n").trim();
  try {
    const limpo = texto.replace(/```(?:json)?/gi, "").trim();
    const ini = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    const saida = JSON.parse(limpo.slice(ini, fim + 1)) as { titulo?: string; resumo?: string; itens?: Json[] };
    const itens = (saida.itens ?? []).map((i) => ({
      lado: i.lado === "cliente" ? "cliente" : "vertente",
      quem: String(i.quem ?? "").trim(),
      texto: String(i.texto ?? "").trim(),
      prazo: typeof i.prazo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.prazo) ? i.prazo : null,
    })).filter((i) => i.texto);
    return responder({ ok: true, titulo: saida.titulo ?? `Resumo da reunião — ${cli.nome}`, resumo: String(saida.resumo ?? "").replace(/\*\*/g, "*"), itens });
  } catch {
    return responder({ ok: true, titulo: `Resumo da reunião — ${cli.nome}`, resumo: texto.replace(/\*\*/g, "*"), itens: [] });
  }
});
