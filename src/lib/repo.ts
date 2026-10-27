import { supabase } from "./supabase";
import {
  hoje,
  somarDias,
  type CamposTarefa,
  type Cliente,
  type ClienteRotina,
  type Comentario,
  type ItemChecklist,
  type Membro,
  type Rotina,
  type Tarefa,
} from "./tipos";
import { CLIENTES } from "../data/clientes";

export interface Dados {
  clientes: Cliente[];
  membros: Membro[];
  tarefas: Tarefa[];
  rotinas: Rotina[];
  clienteRotinas: ClienteRotina[];
}

export interface Repo {
  carregar(): Promise<Dados>;
  salvarTarefa(id: string | null, campos: CamposTarefa): Promise<string>;
  excluirTarefa(id: string): Promise<void>;
  checklist(tarefaId: string): Promise<ItemChecklist[]>;
  adicionarItem(tarefaId: string, texto: string, ordem: number): Promise<void>;
  marcarItem(id: string, feito: boolean): Promise<void>;
  removerItem(id: string): Promise<void>;
  comentarios(tarefaId: string): Promise<Comentario[]>;
  comentar(tarefaId: string, texto: string): Promise<void>;
  salvarRotina(id: string, campos: Partial<Omit<Rotina, "id">>): Promise<void>;
  salvarClienteRotina(id: string | null, campos: Partial<Omit<ClienteRotina, "id" | "ultima_data">>): Promise<void>;
}

function erro(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

// ------------------------------------------------------------------
// Supabase
// ------------------------------------------------------------------
const CAMPOS_TAREFA =
  "id, cliente_id, titulo, descricao, pilar, canal, responsavel_id, prazo, prioridade, status, triagem, cliente_rotina_id, origem, clickup_id, concluida_em, tarefa_checklist(feito)";

type LinhaTarefa = Omit<Tarefa, "checklist_total" | "checklist_feitos"> & { tarefa_checklist: { feito: boolean }[] };

function paraTarefa(l: LinhaTarefa): Tarefa {
  const { tarefa_checklist, ...resto } = l;
  return {
    ...resto,
    checklist_total: tarefa_checklist.length,
    checklist_feitos: tarefa_checklist.filter((i) => i.feito).length,
  };
}

const repoSupabase = (): Repo => {
  const sb = supabase!;
  return {
    async carregar() {
      const corte = `${somarDias(hoje(), -30)}T00:00:00Z`;
      const [cl, me, ab, fe, ro, cr] = await Promise.all([
        sb.from("clientes").select("id, nome, origem, marca").eq("status", "ativo").order("nome"),
        sb.from("membros").select("id, nome, acesso").eq("ativo", true).order("nome"),
        sb.from("tarefas").select(CAMPOS_TAREFA).in("status", ["a_fazer", "fazendo", "aguardando"]),
        sb.from("tarefas").select(CAMPOS_TAREFA).in("status", ["feita", "nao_feita"]).gte("concluida_em", corte),
        sb.from("rotinas").select("id, nome, pilar, frequencia_padrao, prioridade, checklist, mensagem, ativa").order("nome"),
        sb.from("cliente_rotinas").select("id, cliente_id, rotina_id, canal, responsavel_id, frequencia, dia_semana, dia_mes, ativa, ultima_data"),
      ]);
      [cl, me, ab, fe, ro, cr].forEach((r) => erro(r.error));
      return {
        clientes: cl.data as Cliente[],
        membros: me.data as Membro[],
        tarefas: [...(ab.data as unknown as LinhaTarefa[]), ...(fe.data as unknown as LinhaTarefa[])].map(paraTarefa),
        rotinas: ro.data as Rotina[],
        clienteRotinas: cr.data as ClienteRotina[],
      };
    },
    async salvarTarefa(id, campos) {
      if (id) {
        erro((await sb.from("tarefas").update(campos).eq("id", id)).error);
        return id;
      }
      const r = await sb.from("tarefas").insert(campos).select("id").single();
      erro(r.error);
      return (r.data as { id: string }).id;
    },
    async excluirTarefa(id) {
      erro((await sb.from("tarefas").delete().eq("id", id)).error);
    },
    async checklist(tarefaId) {
      const r = await sb.from("tarefa_checklist").select("id, texto, feito, ordem").eq("tarefa_id", tarefaId).order("ordem");
      erro(r.error);
      return r.data as ItemChecklist[];
    },
    async adicionarItem(tarefaId, texto, ordem) {
      erro((await sb.from("tarefa_checklist").insert({ tarefa_id: tarefaId, texto, ordem })).error);
    },
    async marcarItem(id, feito) {
      erro((await sb.from("tarefa_checklist").update({ feito }).eq("id", id)).error);
    },
    async removerItem(id) {
      erro((await sb.from("tarefa_checklist").delete().eq("id", id)).error);
    },
    async comentarios(tarefaId) {
      const r = await sb
        .from("tarefa_comentarios")
        .select("id, texto, criado_em, autor:membros(nome)")
        .eq("tarefa_id", tarefaId)
        .order("criado_em");
      erro(r.error);
      return (r.data as unknown as { id: string; texto: string; criado_em: string; autor: { nome: string } | null }[]).map((c) => ({
        id: c.id,
        texto: c.texto,
        criado_em: c.criado_em,
        autor: c.autor?.nome ?? null,
      }));
    },
    async comentar(tarefaId, texto) {
      erro((await sb.from("tarefa_comentarios").insert({ tarefa_id: tarefaId, texto })).error);
    },
    async salvarRotina(id, campos) {
      erro((await sb.from("rotinas").update(campos).eq("id", id)).error);
    },
    async salvarClienteRotina(id, campos) {
      if (id) erro((await sb.from("cliente_rotinas").update(campos).eq("id", id)).error);
      else erro((await sb.from("cliente_rotinas").insert(campos)).error);
    },
  };
};

// ------------------------------------------------------------------
// Memória (modo demonstração, sem banco): dados de exemplo
// ------------------------------------------------------------------
const repoMemoria = (): Repo => {
  let seq = 0;
  const novoId = () => `ex-${++seq}`;
  const h = hoje();
  const clientes: Cliente[] = CLIENTES.map((c) => ({
    id: novoId(),
    nome: c.nome,
    origem: c.origem === "Vertente" ? "vertente" : "parceria_marcone",
    marca: c.grupo ?? null,
  }));
  const membros: Membro[] = ["Rener", "Silvio", "Caroline", "João Paulo"].map((nome, i) => ({ id: novoId(), nome, acesso: i === 0 }));
  const [rener, silvio, carol, joao] = membros;
  const cli = (nome: string) => clientes.find((c) => c.nome === nome)!.id;
  const rotinas: Rotina[] = [
    { id: novoId(), nome: "Revisão diária", pilar: "trafego", frequencia_padrao: "diaria", prioridade: "normal", ativa: true, mensagem: null,
      checklist: ["Saúde da conta: ativa, sem restrições ou violações", "Campanhas importantes ativas", "Métricas principais: custo por resultado, volume e comparação com ontem e 7 dias", "Gastos dentro do orçamento (conta pré-paga: conferir saldo)", "Anúncios: ativos, criativos novos e criativos com desempenho baixo"] },
    { id: novoId(), nome: "Otimização semanal", pilar: "trafego", frequencia_padrao: "semanal", prioridade: "alta", ativa: true, mensagem: null,
      checklist: ["Lances e orçamentos", "Palavras-chave e termos de pesquisa (Google)", "Anúncios e criativos", "Grupos e conjuntos de anúncios"] },
    { id: novoId(), nome: "Contato semanal e relatório", pilar: "cs", frequencia_padrao: "semanal", prioridade: "alta", ativa: true,
      mensagem: "Ei gente, boa tarde, tudo bem? 😁\n\nPoderiam nos dar um feedback sobre o volume e a qualidade dos leads dos últimos dias?",
      checklist: ["Solicitar feedback de resultados", "Sugerir melhorias", "Enviar pequeno relatório com as conquistas"] },
  ];
  const clienteRotinas: ClienteRotina[] = [];
  const tarefas: (Tarefa & { itens: ItemChecklist[]; coments: Comentario[] })[] = [];
  const addRotina = (cliente: string, r: Rotina, canal: ClienteRotina["canal"], resp: Membro, prazo: string) => {
    const cr: ClienteRotina = { id: novoId(), cliente_id: cli(cliente), rotina_id: r.id, canal, responsavel_id: resp.id, frequencia: r.frequencia_padrao, dia_semana: 3, dia_mes: null, ativa: true, ultima_data: prazo };
    clienteRotinas.push(cr);
    add({ cliente_id: cr.cliente_id, titulo: r.nome, pilar: r.pilar, canal, responsavel_id: resp.id, prazo, prioridade: r.prioridade, descricao: r.mensagem }, cr.id, r.checklist);
  };
  const add = (c: CamposTarefa, crId: string | null = null, check: string[] = []) => {
    const id = novoId();
    const itens = check.map((texto, ordem) => ({ id: novoId(), texto, feito: false, ordem }));
    tarefas.push({
      id, cliente_id: c.cliente_id!, titulo: c.titulo ?? "", descricao: c.descricao ?? null, pilar: c.pilar ?? "trafego", canal: c.canal ?? null,
      responsavel_id: c.responsavel_id ?? null, prazo: c.prazo ?? null, prioridade: c.prioridade ?? "normal", status: c.status ?? "a_fazer",
      triagem: c.triagem ?? false, cliente_rotina_id: crId, origem: crId ? "rotina" : "manual", clickup_id: null, concluida_em: null,
      checklist_total: itens.length, checklist_feitos: 0, itens, coments: [],
    });
    return id;
  };
  addRotina("Clínica Nobre Fio", rotinas[0], "meta", joao, h);
  addRotina("Clínica Nobre Fio", rotinas[0], "google", silvio, h);
  addRotina("Clínica Nobre Fio", rotinas[1], "meta", silvio, somarDias(h, 1));
  addRotina("Madalena Brandão", rotinas[2], null, carol, somarDias(h, -2));
  addRotina("Espaço Larissa Lemos", rotinas[0], "meta", joao, somarDias(h, -1));
  addRotina("CDT Porto Seguro", rotinas[2], null, carol, somarDias(h, 3));
  add({ cliente_id: cli("Óticas Carol SVA"), titulo: "Finalizar site com fotos enviadas", pilar: "trafego", responsavel_id: rener.id, prazo: somarDias(h, -5), status: "fazendo" });
  add({ cliente_id: cli("Clínica Nobre Fio"), titulo: "Otimizar ficha do Google", pilar: "gmn", responsavel_id: silvio.id, prazo: somarDias(h, 2), prioridade: "alta" });
  add({ cliente_id: cli("Advocacia Djalmas"), titulo: "Enviar sugestões de melhoria da ficha do Google", pilar: "gmn", responsavel_id: silvio.id, prazo: somarDias(h, 6) });
  add({ cliente_id: cli("Essenza Planejados"), titulo: "Briefing da campanha de lançamento", triagem: true });
  add({ cliente_id: cli("Terapia de Oração"), titulo: "Criativos para a Noite Oracional", triagem: true });
  add({ cliente_id: cli("Agência Vertente Digital"), titulo: "Melhorar a copy da landing page", pilar: "interno", responsavel_id: rener.id, prioridade: "baixa" });

  const semInternos = (t: (typeof tarefas)[number]): Tarefa => {
    const { itens, coments: _c, ...r } = t;
    return { ...r, checklist_total: itens.length, checklist_feitos: itens.filter((i) => i.feito).length };
  };
  const achar = (id: string) => tarefas.find((t) => t.id === id)!;
  const pausa = () => new Promise((r) => setTimeout(r, 60));

  return {
    async carregar() {
      await pausa();
      return { clientes, membros, tarefas: tarefas.map(semInternos), rotinas: [...rotinas], clienteRotinas: [...clienteRotinas] };
    },
    async salvarTarefa(id, campos) {
      if (id) {
        const t = achar(id);
        Object.assign(t, campos);
        if (campos.status) t.concluida_em = ["feita", "nao_feita"].includes(campos.status) ? new Date().toISOString() : null;
        return id;
      }
      return add(campos);
    },
    async excluirTarefa(id) {
      tarefas.splice(tarefas.findIndex((t) => t.id === id), 1);
    },
    async checklist(tarefaId) {
      return [...achar(tarefaId).itens];
    },
    async adicionarItem(tarefaId, texto, ordem) {
      achar(tarefaId).itens.push({ id: novoId(), texto, feito: false, ordem });
    },
    async marcarItem(id, feito) {
      for (const t of tarefas) for (const i of t.itens) if (i.id === id) i.feito = feito;
    },
    async removerItem(id) {
      for (const t of tarefas) t.itens = t.itens.filter((i) => i.id !== id);
    },
    async comentarios(tarefaId) {
      return [...achar(tarefaId).coments];
    },
    async comentar(tarefaId, texto) {
      achar(tarefaId).coments.push({ id: novoId(), texto, autor: "Modo demonstração", criado_em: new Date().toISOString() });
    },
    async salvarRotina(id, campos) {
      Object.assign(rotinas.find((r) => r.id === id)!, campos);
    },
    async salvarClienteRotina(id, campos) {
      if (id) Object.assign(clienteRotinas.find((r) => r.id === id)!, campos);
      else clienteRotinas.push({ id: novoId(), canal: null, responsavel_id: null, dia_semana: null, dia_mes: null, ativa: true, ultima_data: null, frequencia: "semanal", cliente_id: "", rotina_id: "", ...campos });
    },
  };
};

export const repo: Repo = supabase ? repoSupabase() : repoMemoria();
