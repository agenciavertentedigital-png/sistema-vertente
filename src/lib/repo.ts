import { supabase } from "./supabase";
import {
  hoje,
  somarDias,
  type CamposTarefa,
  type Cliente,
  type ClienteRotina,
  type Comentario,
  type ItemChecklist,
  type ItemLinha,
  type Membro,
  type Notificacao,
  type NovoRegistro,
  type Registro,
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
  registros: Registro[]; // últimos ~40 dias
  notificacoes: Notificacao[]; // do usuário logado
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
  registrar(r: NovoRegistro): Promise<void>;
  linhaDoTempo(clienteId: string): Promise<ItemLinha[]>;
  marcarLidas(ids: string[]): Promise<void>;
}

const CAMPOS_REGISTRO = "id, cliente_id, tarefa_id, tipo, canal, situacao, acoes, nota, alteracoes, dados, data, autor_id, criado_em";

function erro(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

// ------------------------------------------------------------------
// Supabase
// ------------------------------------------------------------------
const CAMPOS_TAREFA =
  "id, cliente_id, titulo, descricao, pilar, canal, responsavel_id, prazo, prioridade, status, triagem, cliente_rotina_id, origem, clickup_id, concluida_em, processo_aplicado_id, tarefa_checklist(feito)";

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
      const [cl, me, ab, fe, ro, cr, rg, no] = await Promise.all([
        sb.from("clientes").select("id, nome, origem, marca").eq("status", "ativo").order("nome"),
        sb.from("membros").select("id, nome, acesso").eq("ativo", true).order("nome"),
        sb.from("tarefas").select(CAMPOS_TAREFA).in("status", ["a_fazer", "fazendo", "aguardando"]),
        sb.from("tarefas").select(CAMPOS_TAREFA).in("status", ["feita", "nao_feita"]).gte("concluida_em", corte),
        sb.from("rotinas").select("id, nome, pilar, frequencia_padrao, prioridade, checklist, mensagem, ativa").order("nome"),
        sb.from("cliente_rotinas").select("id, cliente_id, rotina_id, canal, responsavel_id, frequencia, dia_semana, dia_mes, ativa, ultima_data, criado_em"),
        sb.from("registros").select(CAMPOS_REGISTRO).gte("data", somarDias(hoje(), -40)).order("criado_em", { ascending: false }),
        sb.from("notificacoes").select("id, tipo, texto, cliente_id, tarefa_id, lida, criado_em").order("criado_em", { ascending: false }).limit(40),
      ]);
      [cl, me, ab, fe, ro, cr, rg, no].forEach((r) => erro(r.error));
      return {
        clientes: cl.data as Cliente[],
        membros: me.data as Membro[],
        tarefas: [...(ab.data as unknown as LinhaTarefa[]), ...(fe.data as unknown as LinhaTarefa[])].map(paraTarefa),
        rotinas: ro.data as Rotina[],
        clienteRotinas: cr.data as ClienteRotina[],
        registros: rg.data as Registro[],
        notificacoes: no.data as Notificacao[],
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
    async registrar(r) {
      erro((await sb.from("registros").insert(r)).error);
    },
    async linhaDoTempo(clienteId) {
      const [rg, co, fe] = await Promise.all([
        sb.from("registros").select(`${CAMPOS_REGISTRO}, autor:membros(nome)`).eq("cliente_id", clienteId).order("criado_em", { ascending: false }).limit(150),
        sb
          .from("tarefa_comentarios")
          .select("id, texto, criado_em, autor:membros(nome), tarefa:tarefas!inner(titulo, cliente_id)")
          .eq("tarefa.cliente_id", clienteId)
          .order("criado_em", { ascending: false })
          .limit(100),
        sb
          .from("tarefas")
          .select("id, titulo, concluida_em, responsavel:membros!tarefas_responsavel_id_fkey(nome)")
          .eq("cliente_id", clienteId)
          .eq("status", "feita")
          .is("cliente_rotina_id", null)
          .not("concluida_em", "is", null)
          .order("concluida_em", { ascending: false })
          .limit(60),
      ]);
      [rg, co, fe].forEach((r) => erro(r.error));
      type R = Registro & { autor: { nome: string } | null };
      type C = { id: string; texto: string; criado_em: string; autor: { nome: string } | null; tarefa: { titulo: string } };
      type F = { id: string; titulo: string; concluida_em: string; responsavel: { nome: string } | null };
      const itens: ItemLinha[] = [
        ...(rg.data as unknown as R[]).map((r) => ({ id: r.id, quando: r.criado_em, tipo: "registro" as const, registro: r, autor: r.autor?.nome })),
        ...(co.data as unknown as C[]).map((c) => ({ id: c.id, quando: c.criado_em, tipo: "comentario" as const, texto: c.texto, tarefa: c.tarefa.titulo, autor: c.autor?.nome })),
        ...(fe.data as unknown as F[]).map((f) => ({ id: f.id, quando: f.concluida_em, tipo: "concluida" as const, tarefa: f.titulo, autor: f.responsavel?.nome })),
      ];
      return itens.sort((a, b) => b.quando.localeCompare(a.quando));
    },
    async marcarLidas(ids) {
      if (ids.length) erro((await sb.from("notificacoes").update({ lida: true }).in("id", ids)).error);
    },
  };
};

// ------------------------------------------------------------------
// Memória (modo demonstração, sem banco): dados de exemplo
// ------------------------------------------------------------------
/** Ids dos clientes de demonstração, por nome (usado pelos dados de tráfego de exemplo). */
export const DEMO_IDS = new Map<string, string>();

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
  clientes.forEach((c) => DEMO_IDS.set(c.nome, c.id));
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
  addRotina("Madalena Brandão", rotinas[0], "meta", joao, h);
  addRotina("CDT Porto Seguro", rotinas[0], "meta", joao, h);
  const daily: Rotina = { id: novoId(), nome: "Daily Vertente", pilar: "interno", frequencia_padrao: "diaria", prioridade: "urgente", ativa: true, mensagem: null,
    checklist: ["Revisar rapidamente o dia anterior", "Status por setor: operacional, estratégico e comercial", "Definir os 3 focos do dia e resolver bloqueios"] };
  rotinas.push(daily);
  addRotina("Agência Vertente Digital", daily, null, rener, h);
  add({ cliente_id: cli("Óticas Carol SVA"), titulo: "Finalizar site com fotos enviadas", pilar: "trafego", responsavel_id: rener.id, prazo: somarDias(h, -5), status: "fazendo" });
  add({ cliente_id: cli("Clínica Nobre Fio"), titulo: "Otimizar ficha do Google", pilar: "gmn", responsavel_id: silvio.id, prazo: somarDias(h, 2), prioridade: "alta" });
  add({ cliente_id: cli("Advocacia Djalmas"), titulo: "Enviar sugestões de melhoria da ficha do Google", pilar: "gmn", responsavel_id: silvio.id, prazo: somarDias(h, 6) });
  add({ cliente_id: cli("Essenza Planejados"), titulo: "Briefing da campanha de lançamento", triagem: true });
  add({ cliente_id: cli("Terapia de Oração"), titulo: "Criativos para a Noite Oracional", triagem: true });
  add({ cliente_id: cli("Agência Vertente Digital"), titulo: "Melhorar a copy da landing page", pilar: "interno", responsavel_id: rener.id, prioridade: "baixa" });

  const registros: Registro[] = [];
  const notificacoes: Notificacao[] = [];
  const reg = (cliente: string, canal: Registro["canal"], dia: string, situacao: Registro["situacao"], acoes: string[], nota: string | null, autor: Membro, tipo: Registro["tipo"] = "revisao", alteracoes: Registro["alteracoes"] = []) =>
    registros.push({ id: novoId(), cliente_id: cli(cliente), tarefa_id: null, tipo, canal, situacao, acoes, nota, alteracoes, dados: {}, data: dia, autor_id: autor.id, criado_em: `${dia}T13:00:00.000Z` });
  for (let i = 1; i <= 9; i++) {
    const dia = somarDias(h, -i);
    const dow = new Date(`${dia}T12:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    reg("Clínica Nobre Fio", "meta", dia, i === 2 ? "atencao" : "ok", ["Nenhuma ação"], i === 2 ? "CPL subiu 30% no conjunto de botox" : null, silvio);
    reg("Clínica Nobre Fio", "google", dia, "ok", ["Nenhuma ação"], null, silvio);
    if (i !== 3) reg("Espaço Larissa Lemos", "meta", dia, "ok", ["Nenhuma ação"], null, joao);
    reg("Madalena Brandão", "meta", dia, i <= 2 ? "problema" : "ok", i <= 2 ? ["Conta sem saldo", "Avisei o cliente"] : ["Nenhuma ação"], i <= 2 ? "Conta sem saldo, campanhas paradas. @Caroline cobra o cliente" : null, joao);
    if (i % 4 !== 0) reg("CDT Porto Seguro", "meta", dia, i === 1 ? "atencao" : "ok", ["Subi criativo"], i === 1 ? "Frequência acima de 3" : null, joao);
  }
  reg("Clínica Nobre Fio", "meta", somarDias(h, -6), "ok", [], "Pausados os 2 piores criativos e aumentado o orçamento do remarketing", silvio, "otimizacao", [
    { tipo: "Criativo / anúncio", descricao: "Pausados Botox v2 e Laser v1", antes: "", depois: "" },
    { tipo: "Orçamento", descricao: "Remarketing", antes: "R$ 30/dia", depois: "R$ 50/dia" },
  ]);
  notificacoes.push({ id: novoId(), tipo: "alerta", texto: "Madalena Brandão · Meta em vermelho: conta sem saldo", cliente_id: cli("Madalena Brandão"), tarefa_id: null, lida: false, criado_em: new Date().toISOString() });

  const semInternos = (t: (typeof tarefas)[number]): Tarefa => {
    const { itens, coments: _c, ...r } = t;
    return { ...r, checklist_total: itens.length, checklist_feitos: itens.filter((i) => i.feito).length };
  };
  const achar = (id: string) => tarefas.find((t) => t.id === id)!;
  const pausa = () => new Promise((r) => setTimeout(r, 60));

  return {
    async carregar() {
      await pausa();
      return {
        clientes,
        membros,
        tarefas: tarefas.map(semInternos),
        rotinas: [...rotinas],
        clienteRotinas: [...clienteRotinas],
        registros: [...registros].sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
        notificacoes: [...notificacoes],
      };
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
    async registrar(r) {
      registros.push({ id: novoId(), tarefa_id: null, canal: null, situacao: null, acoes: [], nota: null, alteracoes: [], dados: {}, data: hoje(), autor_id: rener.id, criado_em: new Date().toISOString(), ...r });
    },
    async linhaDoTempo(clienteId) {
      const nome = (id: string | null) => membros.find((m) => m.id === id)?.nome;
      return [
        ...registros.filter((r) => r.cliente_id === clienteId).map((r) => ({ id: r.id, quando: r.criado_em, tipo: "registro" as const, registro: r, autor: nome(r.autor_id) })),
        ...tarefas
          .filter((t) => t.cliente_id === clienteId)
          .flatMap((t) => t.coments.map((c) => ({ id: c.id, quando: c.criado_em, tipo: "comentario" as const, texto: c.texto, tarefa: t.titulo, autor: c.autor }))),
      ].sort((a, b) => b.quando.localeCompare(a.quando));
    },
    async marcarLidas(ids) {
      notificacoes.forEach((n) => ids.includes(n.id) && (n.lida = true));
    },
  };
};

export const repo: Repo = supabase ? repoSupabase() : repoMemoria();
