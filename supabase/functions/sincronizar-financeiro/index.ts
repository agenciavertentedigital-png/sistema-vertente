// Sincroniza um mês do Financeiro com a planilha "Controle Financeiro" (aba "Outubro 2026" etc.).
// A planilha manda: os lançamentos importados daquele mês e as mensalidades previstas ainda não pagas
// são substituídos pelo que está na aba. Lançamentos feitos à mão no sistema ficam como estão.
// Só administradores (sócios). Com { previa: true } devolve o que faria, sem gravar.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const PLANILHA = "1S6mTGT96trC4IyExffjX_HJ3aq6WaNeW_GJrvUG1Id8";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DESP: [string, string][] = [["ESCRITÓRIO", "Escritório"], ["PRÓ-LABORE", "Pró-labore"], ["MÃO DE OBRA", "Mão de obra"], ["RECURSOS HUMANOS", "Recursos humanos"], ["EDUCAÇÃO", "Educação"], ["FERRAMENTAS", "Ferramentas"], ["JURÍDICO E CONTÁBIL", "Jurídico e contábil"], ["EVENTOS", "Eventos"], ["PARCERIAS", "Parcerias"], ["PUBLICIDADE E VENDAS", "Publicidade e vendas"], ["OUTROS", "Outros"]];

function csv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}
const valor = (s: string) => {
  const t = s.replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(t);
  return t && Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function catReceita(d: string) {
  const u = d.toUpperCase();
  if (u.includes("CRM") || u.includes("KOMMO")) return "CRM";
  if (u.includes("CONSULTORIA") || u.includes("ASSESSORIA")) return "Consultoria";
  if (["LANDINGPAGE", " - LP", "DESIGN", "IMPLEMENTAÇÃO DIG", "SELLFLUX", "COP. DOMIN", "PROJETO", "IMPLEM"].some((x) => u.includes(x))) return "Projeto avulso";
  return "Recebimento";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const responder = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const chaveCron = req.headers.get("x-chave-cron");
  const porServidor = chaveCron ? (await admin.rpc("validar_chave_cron", { chave: chaveCron })).data === true : false;
  if (!porServidor) {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u.user) return responder({ erro: "Faça login de novo no sistema." }, 401);
    const { data: m } = await admin.from("membros").select("id, papel").or(`user_id.eq.${u.user.id},email.eq.${(u.user.email ?? "").toLowerCase()}`).eq("ativo", true).eq("acesso", true).limit(1).maybeSingle();
    if (!m || m.papel !== "admin") return responder({ erro: "Só os sócios podem sincronizar o financeiro." }, 403);
  }

  const corpo = (await req.json().catch(() => ({}))) as { mes?: string; previa?: boolean };
  const mes = String(corpo.mes ?? "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) return responder({ erro: "Mês inválido." }, 400);
  const [ano, mm] = mes.split("-").map(Number);
  const aba = `${MESES[mm - 1]} ${ano}`;
  const comp = `${mes}-01`;
  const fim = `${mes}-${String(new Date(ano, mm, 0).getDate()).padStart(2, "0")}`;

  const r = await fetch(`https://docs.google.com/spreadsheets/d/${PLANILHA}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(aba)}`);
  const texto = await r.text();
  if (!r.ok || texto.trimStart().startsWith("<")) return responder({ erro: `Não consegui ler a aba "${aba}". Confira se ela existe e se a planilha está compartilhada por link.` }, 502);
  const linhas = csv(texto);
  const cab = linhas[0] ?? [];
  if (!norm(cab[0] ?? "").startsWith("entrada")) return responder({ erro: `A aba "${aba}" não está no formato esperado (primeira coluna ENTRADA).` }, 422);

  // Colunas em pares (descrição, valor) por categoria; a de DESEJOS não entra no financeiro.
  const pares: { col: number; tipo: "receita" | "despesa"; categoria: string | null }[] = [];
  for (let c = 0; c + 1 < cab.length; c += 2) {
    const h = (cab[c] ?? "").toUpperCase();
    if (!h.trim() || h.startsWith("DESEJOS")) continue;
    if (h.startsWith("ENTRADA")) pares.push({ col: c, tipo: "receita", categoria: null });
    else {
      const d = DESP.find(([k]) => h.startsWith(k));
      if (d) pares.push({ col: c, tipo: "despesa", categoria: d[1] });
    }
  }

  const { data: clientes } = await admin.from("clientes").select("id, nome, razao_social");
  const { data: anteriores } = await admin.from("lancamentos").select("descricao, cliente_id").not("cliente_id", "is", null).order("competencia", { ascending: false }).limit(2000);
  const porDescricao = new Map<string, string>();
  for (const a of anteriores ?? []) {
    const k = norm(String(a.descricao).split("(")[0]);
    if (k && !porDescricao.has(k)) porDescricao.set(k, a.cliente_id as string);
  }
  const acharCliente = (desc: string): string | null => {
    const base = norm(desc.split("(")[0]);
    if (porDescricao.has(base)) return porDescricao.get(base)!;
    const n = norm(desc);
    const c = (clientes ?? []).find((x) => [x.nome, x.razao_social].filter(Boolean).some((nome) => {
      const k = norm(String(nome));
      return k.length >= 4 && (n.startsWith(k) || k.endsWith(base) && base.length >= 6);
    }));
    return c?.id ?? null;
  };

  const novos: Record<string, unknown>[] = [];
  for (const l of linhas.slice(1)) {
    if (norm(l[0] ?? "").startsWith("total")) break;
    for (const p of pares) {
      const desc = (l[p.col] ?? "").trim();
      const v = valor(l[p.col + 1] ?? "");
      if (!v) continue;
      const d = desc || "(sem descrição)";
      novos.push({
        tipo: p.tipo,
        cliente_id: p.tipo === "receita" ? acharCliente(d) : null,
        descricao: d,
        categoria: p.tipo === "receita" ? catReceita(d) : p.categoria,
        valor: v,
        competencia: comp,
        vencimento: comp,
        pago_em: fim,
        observacoes: `Importado da planilha Controle Financeiro (${aba})`,
      });
    }
  }
  const soma = (t: string) => Math.round(novos.filter((x) => x.tipo === t).reduce((s, x) => s + (x.valor as number), 0) * 100) / 100;

  const { data: substituir } = await admin.from("lancamentos").select("id, tipo, descricao, valor, categoria, pago_em, observacoes")
    .eq("competencia", comp)
    .or("observacoes.like.Importado da planilha%,and(tipo.eq.receita,categoria.eq.Mensalidade,pago_em.is.null)");
  const resumo = {
    aba,
    receitas: novos.filter((x) => x.tipo === "receita").length,
    despesas: novos.filter((x) => x.tipo === "despesa").length,
    total_receitas: soma("receita"),
    total_despesas: soma("despesa"),
    removidos: (substituir ?? []).length,
    removidos_previstos: (substituir ?? []).filter((x) => !String(x.observacoes ?? "").startsWith("Importado")).length,
    sem_cliente: novos.filter((x) => x.tipo === "receita" && !x.cliente_id).map((x) => x.descricao),
  };
  if (corpo.previa) return responder({ ok: true, previa: true, ...resumo });
  if (!novos.length) return responder({ erro: `A aba "${aba}" não tem valores para importar.` }, 422);

  // Grava os novos primeiro; só depois tira os antigos, para nunca deixar o mês vazio se algo falhar.
  const { error } = await admin.from("lancamentos").insert(novos);
  if (error) return responder({ erro: error.message }, 500);
  const ids = (substituir ?? []).map((x) => x.id);
  if (ids.length) {
    const { error: e2 } = await admin.from("lancamentos").delete().in("id", ids);
    if (e2) return responder({ erro: `Importei, mas não consegui tirar os lançamentos antigos: ${e2.message}` }, 500);
  }
  return responder({ ok: true, ...resumo });
});
