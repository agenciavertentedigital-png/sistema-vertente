// Ficha cadastral completa dos clientes e serviços contratados (usada por Financeiro, Cadastro, Contratos e Saúde).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { CLIENTES } from "../data/clientes";
import { DEMO_IDS } from "./repo";
import { demoServicos } from "../data/modulosDemo";
import type { ServicoCliente } from "./financeiro";

export interface Ficha {
  id: string;
  nome: string;
  status: "ativo" | "pausado" | "encerrado";
  origem: "vertente" | "parceria_marcone";
  marca: string | null;
  cliente_desde: string | null;
  observacoes: string | null;
  razao_social: string | null;
  documento: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  endereco: string | null;
  cidade: string | null;
  segmento: string | null;
  instagram: string | null;
  site: string | null;
  link_gmn: string | null;
  dia_vencimento: number | null;
  forma_pagamento: string | null;
  pasta_drive: string | null;
}

export const CAMPOS_FICHA =
  "id, nome, status, origem, marca, cliente_desde, observacoes, razao_social, documento, contato_nome, contato_telefone, contato_email, endereco, cidade, segmento, instagram, site, link_gmn, dia_vencimento, forma_pagamento, pasta_drive";

/** Campos que contam para "ficha completa". */
export const CAMPOS_ESSENCIAIS: { campo: keyof Ficha; nome: string }[] = [
  { campo: "razao_social", nome: "Razão social / nome completo" },
  { campo: "documento", nome: "CNPJ ou CPF" },
  { campo: "contato_nome", nome: "Responsável" },
  { campo: "contato_telefone", nome: "WhatsApp" },
  { campo: "contato_email", nome: "E-mail" },
  { campo: "endereco", nome: "Endereço" },
  { campo: "cidade", nome: "Cidade" },
  { campo: "segmento", nome: "Segmento" },
  { campo: "instagram", nome: "Instagram" },
  { campo: "dia_vencimento", nome: "Dia de vencimento" },
];

export function completude(f: Ficha) {
  const faltam = CAMPOS_ESSENCIAIS.filter((c) => f[c.campo] === null || f[c.campo] === "");
  return { pct: Math.round(((CAMPOS_ESSENCIAIS.length - faltam.length) / CAMPOS_ESSENCIAIS.length) * 100), faltam };
}

const memoria: { fichas: Ficha[] | null; servicos: ServicoCliente[] | null } = { fichas: null, servicos: null };
const ouvintes = new Set<() => void>();

function fichasDemo(): Ficha[] {
  return CLIENTES.map((c, i) => ({
    id: DEMO_IDS.get(c.nome) ?? `f-${i}`,
    nome: c.nome,
    status: "ativo",
    origem: c.origem === "Vertente" ? "vertente" : "parceria_marcone",
    marca: c.grupo ?? null,
    cliente_desde: null,
    observacoes: null,
    razao_social: i % 3 === 0 ? `${c.nome} LTDA` : null,
    documento: i % 3 === 0 ? "00.000.000/0001-00" : null,
    contato_nome: i % 2 === 0 ? "Responsável" : null,
    contato_telefone: i % 2 === 0 ? "(31) 90000-0000" : null,
    contato_email: null,
    endereco: null,
    cidade: i % 2 === 0 ? "Ipatinga" : null,
    segmento: null,
    instagram: i % 2 === 0 ? "@cliente" : null,
    site: null,
    link_gmn: null,
    dia_vencimento: [5, 10, 15, 20][i % 4],
    forma_pagamento: "pix",
    pasta_drive: null,
  }));
}

export function useFichas() {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [servicos, setServicos] = useState<ServicoCliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const recarregar = useCallback(async () => {
    if (!supabase) {
      memoria.fichas ??= fichasDemo();
      memoria.servicos ??= demoServicos();
      setFichas([...memoria.fichas]);
      setServicos([...memoria.servicos]);
      setCarregando(false);
      return;
    }
    const [f, s] = await Promise.all([
      supabase.from("clientes").select(CAMPOS_FICHA).order("nome"),
      supabase.from("cliente_servicos").select("cliente_id, servico_codigo, valor_mensal, inicio"),
    ]);
    if (f.error || s.error) setErro((f.error ?? s.error)!.message);
    setFichas((f.data ?? []) as Ficha[]);
    setServicos(((s.data ?? []) as Omit<ServicoCliente, "id">[]).map((x) => ({ ...x, id: `${x.cliente_id}|${x.servico_codigo}`, valor_mensal: x.valor_mensal === null ? null : Number(x.valor_mensal) })));
    setCarregando(false);
  }, []);

  useEffect(() => {
    recarregar();
    ouvintes.add(recarregar);
    return () => {
      ouvintes.delete(recarregar);
    };
  }, [recarregar]);

  const avisar = () => ouvintes.forEach((f) => f());

  async function salvarFicha(id: string | null, campos: Partial<Ficha>): Promise<string> {
    if (!supabase) {
      if (id) memoria.fichas = memoria.fichas!.map((f) => (f.id === id ? { ...f, ...campos } : f));
      else {
        id = crypto.randomUUID();
        memoria.fichas = [...memoria.fichas!, { ...fichasDemo()[0], ...campos, id } as Ficha];
      }
      avisar();
      return id;
    }
    if (id) {
      const { error } = await supabase.from("clientes").update(campos).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase.from("clientes").insert(campos).select("id").single();
      if (error) throw new Error(error.message);
      id = (data as { id: string }).id;
    }
    avisar();
    return id;
  }

  async function salvarServico(clienteId: string, codigo: string, valor: number | null, contratado: boolean) {
    if (!supabase) {
      const resto = memoria.servicos!.filter((s) => !(s.cliente_id === clienteId && s.servico_codigo === codigo));
      memoria.servicos = contratado ? [...resto, { id: `${clienteId}|${codigo}`, cliente_id: clienteId, servico_codigo: codigo, valor_mensal: valor, inicio: null }] : resto;
      avisar();
      return;
    }
    const r = contratado
      ? await supabase.from("cliente_servicos").upsert({ cliente_id: clienteId, servico_codigo: codigo, valor_mensal: valor }, { onConflict: "cliente_id,servico_codigo" })
      : await supabase.from("cliente_servicos").delete().eq("cliente_id", clienteId).eq("servico_codigo", codigo);
    if (r.error) throw new Error(r.error.message);
    avisar();
  }

  const mensalidade = (clienteId: string) => servicos.filter((s) => s.cliente_id === clienteId).reduce((t, s) => t + (s.valor_mensal ?? 0), 0);

  return { fichas, servicos, carregando, erro, recarregar, salvarFicha, salvarServico, mensalidade };
}
