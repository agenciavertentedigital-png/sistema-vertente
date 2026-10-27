import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { hoje, somarDias } from "./tipos";
import { CLIENTES_DEMO_TRAFEGO } from "../data/trafegoDemo";

export type StatusConta =
  | "ativa"
  | "desativada"
  | "pagamento_pendente"
  | "em_analise"
  | "pendente_acerto"
  | "periodo_carencia"
  | "fechamento_pendente"
  | "fechada";

export const STATUS_CONTA: Record<string, string> = {
  ativa: "Ativa",
  desativada: "Desativada pela Meta",
  pagamento_pendente: "Pagamento pendente",
  em_analise: "Em análise",
  pendente_acerto: "Aguardando acerto",
  periodo_carencia: "Carência do pagamento",
  fechamento_pendente: "Fechamento pendente",
  fechada: "Fechada",
};

/** Nome amigável do tipo de resultado que a Meta informa. */
export function nomeResultado(tipo: string | null | undefined, plural = true): string {
  const t = (tipo ?? "").replace(/^[a-z_]+:/, "");
  const mapa: Record<string, [string, string]> = {
    "onsite_conversion.messaging_conversation_started_7d": ["conversa", "conversas"],
    lead: ["lead", "leads"],
    "onsite_conversion.lead_grouped": ["lead", "leads"],
    "offsite_conversion.fb_pixel_lead": ["lead", "leads"],
    purchase: ["compra", "compras"],
    "onsite_conversion.purchase": ["compra", "compras"],
    contact_website: ["contato pelo site", "contatos pelo site"],
    "offsite_conversion.fb_pixel_purchase": ["compra", "compras"],
    link_click: ["clique", "cliques"],
    profile_visit_view: ["visita ao perfil", "visitas ao perfil"],
    post_engagement: ["engajamento", "engajamentos"],
    reach: ["alcance", "alcance"],
    video_view: ["visualização", "visualizações"],
    "video_thruplay_watched_actions": ["ThruPlay", "ThruPlays"],
    page_engagement: ["engajamento", "engajamentos"],
    like: ["curtida", "curtidas"],
    landing_page_view: ["visualização da página", "visualizações da página"],
  };
  const par = mapa[t];
  if (par) return plural ? par[1] : par[0];
  return t ? t.replace(/[._]/g, " ") : "resultados";
}

export interface ContaAnuncio {
  id: string;
  cliente_id: string;
  plataforma: "meta" | "google";
  conta_id: string;
  nome: string;
  moeda: string | null;
  ativa: boolean;
  status: string | null;
  motivo_bloqueio: string | null;
  pre_paga: boolean | null;
  saldo: number | null;
  saldo_texto: string | null;
  limite_gasto: number | null;
  gasto_total: number | null;
  ultimo_sync: string | null;
  erro_sync: string | null;
}

export interface DiaConta {
  conta_id: string;
  data: string;
  tipo_resultado: string;
  gasto: number;
  impressoes: number;
  cliques: number;
  resultados: number;
  leads: number;
  conversas: number;
}

export interface LinhaCampanha {
  campanha_id: string;
  campanha: string;
  objetivo: string | null;
  status_campanha: string | null;
  data: string;
  gasto: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  resultados: number;
  tipo_resultado: string | null;
}

export type CamposConta = Partial<Pick<ContaAnuncio, "cliente_id" | "conta_id" | "nome" | "ativa" | "plataforma">>;

interface RepoTrafego {
  contas(): Promise<ContaAnuncio[]>;
  dias(desde: string): Promise<DiaConta[]>;
  campanhas(contaId: string, desde: string, ate: string): Promise<LinhaCampanha[]>;
  sincronizar(contaId?: string): Promise<string>;
  salvarConta(id: string | null, campos: CamposConta): Promise<void>;
  removerConta(id: string): Promise<void>;
}

const num = (v: unknown) => Number(v ?? 0);

const repoSupabase = (): RepoTrafego => {
  const sb = supabase!;
  return {
    async contas() {
      const r = await sb.from("contas_anuncio").select("*").order("nome");
      if (r.error) throw new Error(r.error.message);
      return (r.data as ContaAnuncio[]).map((c) => ({ ...c, saldo: c.saldo === null ? null : num(c.saldo), gasto_total: c.gasto_total === null ? null : num(c.gasto_total) }));
    },
    async dias(desde) {
      // Paginado: o Supabase devolve no máximo 1000 linhas por vez
      const todas: DiaConta[] = [];
      for (let de = 0; ; de += 1000) {
        const r = await sb.from("metricas_conta_dia").select("*").gte("data", desde).order("data").range(de, de + 999);
        if (r.error) throw new Error(r.error.message);
        const lote = (r.data as DiaConta[]).map((d) => ({ ...d, gasto: num(d.gasto), resultados: num(d.resultados) }));
        todas.push(...lote);
        if (lote.length < 1000) break;
      }
      return todas;
    },
    async campanhas(contaId, desde, ate) {
      const r = await sb
        .from("metricas_diarias")
        .select("campanha_id, campanha, objetivo, status_campanha, data, gasto, impressoes, alcance, cliques, resultados, tipo_resultado")
        .eq("conta_id", contaId)
        .gte("data", desde)
        .lte("data", ate)
        .limit(5000);
      if (r.error) throw new Error(r.error.message);
      return (r.data as LinhaCampanha[]).map((l) => ({ ...l, gasto: num(l.gasto), resultados: num(l.resultados) }));
    },
    async sincronizar(contaId) {
      const { data, error } = await sb.functions.invoke("sincronizar-meta", { body: contaId ? { conta_id: contaId } : {} });
      if (error) {
        // A função devolve { erro } no corpo; tenta ler a mensagem
        const ctx = (error as { context?: Response }).context;
        const corpo = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(corpo?.erro ?? error.message);
      }
      const contas = (data?.contas ?? []) as { erro?: string }[];
      const falhas = contas.filter((c) => c.erro).length;
      return falhas ? `Atualizado, mas ${falhas} conta(s) deram erro. Veja na aba Contas.` : `${contas.length} conta(s) atualizadas`;
    },
    async salvarConta(id, campos) {
      const r = id ? await sb.from("contas_anuncio").update(campos).eq("id", id) : await sb.from("contas_anuncio").insert(campos);
      if (r.error) throw new Error(r.error.message.includes("duplicate") ? "Essa conta já está vinculada." : r.error.message);
    },
    async removerConta(id) {
      const r = await sb.from("contas_anuncio").delete().eq("id", id);
      if (r.error) throw new Error(r.error.message);
    },
  };
};

// ------------------------------------------------------------------
// Demonstração (sem banco)
// ------------------------------------------------------------------
const repoMemoria = (): RepoTrafego => {
  const { contas, dias, campanhas } = CLIENTES_DEMO_TRAFEGO();
  return {
    async contas() {
      return contas.map((c) => ({ ...c }));
    },
    async dias(desde) {
      return dias.filter((d) => d.data >= desde);
    },
    async campanhas(contaId, desde, ate) {
      return campanhas.filter((c) => c.conta_id === contaId && c.data >= desde && c.data <= ate);
    },
    async sincronizar() {
      contas.forEach((c) => (c.ultimo_sync = new Date().toISOString()));
      return "Modo demonstração: nada a buscar na Meta";
    },
    async salvarConta(id, campos) {
      if (id) Object.assign(contas.find((c) => c.id === id)!, campos);
      else
        contas.push({
          id: `cx-${contas.length + 1}`,
          plataforma: "meta",
          moeda: "BRL",
          ativa: true,
          status: null,
          motivo_bloqueio: null,
          pre_paga: null,
          saldo: null,
          saldo_texto: null,
          limite_gasto: null,
          gasto_total: null,
          ultimo_sync: null,
          erro_sync: null,
          cliente_id: "",
          conta_id: "",
          nome: "",
          ...campos,
        } as ContaAnuncio);
    },
    async removerConta(id) {
      const i = contas.findIndex((c) => c.id === id);
      if (i >= 0) contas.splice(i, 1);
    },
  };
};

export const repoTrafego: RepoTrafego = supabase ? repoSupabase() : repoMemoria();

/** Carrega contas e os últimos 60 dias por conta (para comparar 30 com os 30 anteriores). */
export function useTrafego() {
  const [contas, setContas] = useState<ContaAnuncio[]>([]);
  const [dias, setDias] = useState<DiaConta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const recarregar = useCallback(async () => {
    try {
      const [c, d] = await Promise.all([repoTrafego.contas(), repoTrafego.dias(somarDias(hoje(), -60))]);
      setContas(c);
      setDias(d);
      setErro("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { contas, dias, carregando, erro, recarregar };
}
