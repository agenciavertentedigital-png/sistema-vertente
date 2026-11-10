import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { hoje, somarDias } from "../../../lib/tipos";

export type Aba = "geral" | "meta" | "google" | "funil";

/** Configuração salva por cliente e aba (dashboard_config). Na prévia fica só na memória. */
export function useConfigDashboard<T extends object>(clienteId: string, aba: Aba, padrao: T) {
  const [config, setConfig] = useState<T>(padrao);
  const [personalizado, setPersonalizado] = useState(false);
  useEffect(() => {
    setConfig(padrao);
    setPersonalizado(false);
    if (!supabase) return;
    supabase
      .from("dashboard_config")
      .select("config")
      .eq("cliente_id", clienteId)
      .eq("aba", aba)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.config && Object.keys(data.config).length) {
          setConfig({ ...padrao, ...(data.config as T) });
          setPersonalizado(true);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, aba]);

  const salvar = useCallback(
    async (novo: T) => {
      setConfig(novo);
      setPersonalizado(true);
      if (!supabase) return;
      const { error } = await supabase.from("dashboard_config").upsert({ cliente_id: clienteId, aba, config: novo, atualizado_em: new Date().toISOString() });
      if (error) throw new Error(error.message);
    },
    [clienteId, aba],
  );
  const restaurar = useCallback(async () => {
    setConfig(padrao);
    setPersonalizado(false);
    if (supabase) await supabase.from("dashboard_config").delete().eq("cliente_id", clienteId).eq("aba", aba);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, aba]);
  return { config, salvar, restaurar, personalizado };
}

// ------------------------------------------------------------------
// Série diária guardada (metricas_conta_dia): Meta e Google juntos, sem chamar as APIs
// ------------------------------------------------------------------
export interface DiaPlataformas {
  data: string;
  meta: { gasto: number; impressoes: number; cliques: number; contatos: number };
  google: { gasto: number; impressoes: number; cliques: number; contatos: number };
}

const vazio = () => ({ gasto: 0, impressoes: 0, cliques: 0, contatos: 0 });

export function useDiarioPlataformas(clienteId: string, ini: string, fim: string) {
  const [dias, setDias] = useState<DiaPlataformas[]>([]);
  useEffect(() => {
    if (!ini || !fim || ini > fim) return;
    const lista: string[] = [];
    for (let d = ini; d <= fim; d = somarDias(d, 1)) lista.push(d);
    if (!supabase) {
      // prévia: série de exemplo
      setDias(lista.map((d, i) => ({ data: d, meta: { gasto: 120 + ((i * 37) % 60), impressoes: 9000 + ((i * 911) % 3000), cliques: 160 + ((i * 13) % 50), contatos: 9 + ((i * 7) % 8) }, google: { gasto: 60 + ((i * 17) % 30), impressoes: 1500 + ((i * 97) % 600), cliques: 70 + ((i * 11) % 25), contatos: 3 + ((i * 5) % 4) } })));
      return;
    }
    (async () => {
      const { data: contas } = await supabase!.from("contas_anuncio").select("id, plataforma").eq("cliente_id", clienteId).eq("ativa", true);
      const plat = new Map((contas ?? []).map((c: { id: string; plataforma: string }) => [c.id, c.plataforma]));
      if (!plat.size) return setDias([]);
      const { data } = await supabase!
        .from("metricas_conta_dia")
        .select("conta_id, data, gasto, impressoes, cliques, resultados, leads, conversas, tipo_resultado")
        .in("conta_id", [...plat.keys()])
        .gte("data", ini)
        .lte("data", fim)
        .limit(5000);
      const mapa = new Map(lista.map((d) => [d, { data: d, meta: vazio(), google: vazio() }]));
      for (const r of (data ?? []) as { conta_id: string; data: string; gasto: number; impressoes: number; cliques: number; resultados: number; leads: number; conversas: number }[]) {
        const dia = mapa.get(r.data);
        if (!dia) continue;
        const p = plat.get(r.conta_id) === "google" ? dia.google : dia.meta;
        p.gasto += Number(r.gasto) || 0;
        p.impressoes += Number(r.impressoes) || 0;
        p.cliques += Number(r.cliques) || 0;
        p.contatos += plat.get(r.conta_id) === "google" ? Number(r.resultados) || 0 : (Number(r.conversas) || 0) + (Number(r.leads) || 0);
      }
      setDias([...mapa.values()]);
    })();
  }, [clienteId, ini, fim]);
  return dias;
}

export const hojeISO = hoje;
