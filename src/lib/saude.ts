// Nota de saúde de cada cliente (0 a 100), calculada com o que o sistema já registra.
import { atrasada, hoje, somarDias, type Registro, type Tarefa } from "./tipos";
import type { ContaAnuncio, DiaConta } from "./trafego";
import type { Lancamento } from "./financeiro";
import { situacao } from "./financeiro";
import type { AnaliseGmn, PerfilGmn } from "./gmn";
import type { Post } from "./social";

export interface Fator {
  id: "entregas" | "trafego" | "relacionamento" | "financeiro" | "gmn" | "social";
  nome: string;
  peso: number;
  nota: number | null; // null = não se aplica a este cliente
  motivo: string;
}

export interface SaudeCliente {
  clienteId: string;
  nota: number;
  fatores: Fator[];
  pior: Fator | null;
}

export const PESOS: Record<Fator["id"], { nome: string; peso: number }> = {
  entregas: { nome: "Entregas no prazo", peso: 25 },
  trafego: { nome: "Tráfego", peso: 25 },
  relacionamento: { nome: "Relacionamento", peso: 20 },
  financeiro: { nome: "Financeiro", peso: 15 },
  gmn: { nome: "Google Meu Negócio", peso: 10 },
  social: { nome: "Social Media", peso: 5 },
};

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

export interface Fontes {
  tarefas: Tarefa[];
  registros: Registro[];
  contas: ContaAnuncio[];
  dias: DiaConta[];
  lancamentos: Lancamento[] | null; // null = sem permissão
  perfis: PerfilGmn[];
  analises: (perfilId: string) => AnaliseGmn[];
  posts: Post[];
}

export function calcularSaude(clienteId: string, f: Fontes): SaudeCliente {
  const h = hoje();
  const fatores: Fator[] = [];
  const add = (id: Fator["id"], nota: number | null, motivo: string) => fatores.push({ id, ...PESOS[id], nota: nota === null ? null : Math.max(0, Math.min(100, Math.round(nota))), motivo });

  // Entregas
  const abertas = f.tarefas.filter((t) => t.cliente_id === clienteId && ["a_fazer", "fazendo", "aguardando"].includes(t.status));
  const atrasadas = abertas.filter(atrasada);
  add("entregas", 100 - atrasadas.length * 22, atrasadas.length ? `${atrasadas.length} tarefa${atrasadas.length > 1 ? "s" : ""} atrasada${atrasadas.length > 1 ? "s" : ""}` : abertas.length ? "Tudo dentro do prazo" : "Sem tarefas abertas");

  // Tráfego
  const contas = f.contas.filter((c) => c.cliente_id === clienteId && c.ativa);
  if (contas.length) {
    const ids = new Set(contas.map((c) => c.id));
    const bloqueada = contas.find((c) => c.status && c.status !== "ativa");
    const ini = somarDias(h, -7);
    const ant = somarDias(h, -14);
    const ds = f.dias.filter((d) => ids.has(d.conta_id));
    const g7 = ds.filter((d) => d.data >= ini && d.data < h).reduce((s, d) => s + d.gasto, 0);
    const r7 = ds.filter((d) => d.data >= ini && d.data < h).reduce((s, d) => s + d.conversas + d.leads, 0);
    const gA = ds.filter((d) => d.data >= ant && d.data < ini).reduce((s, d) => s + d.gasto, 0);
    const rA = ds.filter((d) => d.data >= ant && d.data < ini).reduce((s, d) => s + d.conversas + d.leads, 0);
    const ultRev = f.registros.filter((r) => r.cliente_id === clienteId && r.tipo === "revisao").sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
    let nota = 85;
    let motivo = "Rodando normalmente";
    if (bloqueada) {
      nota = 10;
      motivo = "Conta de anúncio com problema";
    } else if (g7 === 0) {
      nota = 35;
      motivo = "Sem investimento nos últimos 7 dias";
    } else if (r7 && rA && g7 / r7 > (gA / rA) * 1.3) {
      nota = 55;
      motivo = "Custo por contato subiu mais de 30%";
    } else if (r7 && rA && g7 / r7 < (gA / rA) * 0.9) {
      nota = 100;
      motivo = "Custo por contato caiu";
    }
    if (ultRev?.situacao === "problema") {
      nota = Math.min(nota, 30);
      motivo = "Última revisão marcou problema";
    } else if (ultRev?.situacao === "atencao") {
      nota = Math.min(nota, 60);
      if (nota === 60) motivo = "Última revisão pediu atenção";
    }
    add("trafego", nota, motivo);
  } else add("trafego", null, "Sem conta acompanhada");

  // Relacionamento: último registro com o cliente
  const ult = f.registros.filter((r) => r.cliente_id === clienteId && ["reuniao", "nota", "decisao", "revisao", "otimizacao"].includes(r.tipo)).sort((a, b) => b.data.localeCompare(a.data))[0];
  const dias = ult ? diasEntre(ult.data, h) : null;
  add("relacionamento", dias === null ? 25 : dias <= 7 ? 100 : dias <= 14 ? 75 : dias <= 30 ? 45 : 15, dias === null ? "Nenhum registro nos últimos 40 dias" : dias === 0 ? "Contato hoje" : `Último registro há ${dias} dia${dias > 1 ? "s" : ""}`);

  // Financeiro
  if (f.lancamentos) {
    const atraso = f.lancamentos.filter((l) => l.tipo === "receita" && l.cliente_id === clienteId && situacao(l) === "atrasado");
    const temReceita = f.lancamentos.some((l) => l.tipo === "receita" && l.cliente_id === clienteId);
    if (temReceita) {
      const maior = atraso.reduce((m, l) => Math.max(m, diasEntre(l.vencimento, h)), 0);
      add("financeiro", atraso.length ? (maior > 15 ? 0 : 40) : 100, atraso.length ? `${atraso.length} cobrança${atraso.length > 1 ? "s" : ""} em atraso (${maior} dias)` : "Pagamentos em dia");
    } else add("financeiro", null, "Sem cobranças lançadas");
  } else add("financeiro", null, "Só administradores");

  // GMN
  const perfis = f.perfis.filter((p) => p.cliente_id === clienteId && p.ativo);
  if (perfis.length) {
    const notas = perfis.map((p) => f.analises(p.id)[0]?.nota).filter((n): n is number => n !== undefined);
    add("gmn", notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : 30, notas.length ? `Nota do perfil: ${Math.round(notas.reduce((s, n) => s + n, 0) / notas.length)}` : "Perfil sem análise");
  } else add("gmn", null, "Sem perfil acompanhado");

  // Social
  const posts = f.posts.filter((p) => p.cliente_id === clienteId && p.data >= somarDias(h, -30));
  if (posts.length) {
    const atrasados = posts.filter((p) => p.data < h && p.status !== "publicado").length;
    add("social", 100 - atrasados * 25, atrasados ? `${atrasados} post${atrasados > 1 ? "s" : ""} atrasado${atrasados > 1 ? "s" : ""}` : "Cronograma em dia");
  } else add("social", null, "Sem posts no cronograma");

  const validos = fatores.filter((x) => x.nota !== null);
  const peso = validos.reduce((s, x) => s + x.peso, 0);
  const nota = peso ? Math.round(validos.reduce((s, x) => s + x.peso * (x.nota ?? 0), 0) / peso) : 0;
  const pior = validos.filter((x) => (x.nota ?? 100) < 75).sort((a, b) => a.peso * (100 - (a.nota ?? 0)) > b.peso * (100 - (b.nota ?? 0)) ? -1 : 1)[0] ?? null;
  return { clienteId, nota, fatores, pior };
}
