import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, MapPin, MessageCircle, Save, Settings2, Star } from "lucide-react";
import { supabase, SISTEMA_URL } from "../../lib/supabase";

/** Leads da página pública do Diagnóstico Digital (/diagnostico): quem passou no corte, quem foi cortado e de qual anúncio veio. */

interface Lead {
  id: string;
  etapa: "desqualificado" | "qualificado" | "completo";
  motivo_corte: string | null;
  nome: string | null;
  empresa: string | null;
  segmento: string | null;
  faturamento: string | null;
  verba: string | null;
  ja_investe: string | null;
  desafio: string | null;
  atendimento: string | null;
  decisor: string | null;
  whatsapp: string | null;
  oque_vende: string | null;
  instagram: string | null;
  site: string | null;
  sem_site: boolean;
  google_nome: string | null;
  google_endereco: string | null;
  google_nota: number | null;
  google_avaliacoes: number | null;
  google_link: string | null;
  utm: Record<string, string>;
  status: string;
  observacao: string | null;
  criado_em: string;
}

const ROTULOS: Record<string, Record<string, string>> = {
  faturamento: { "0-10": "até 10k", "10-30": "10–30k", "30-50": "30–50k", "50-100": "50–100k", "100+": "100k+" },
  verba: { "0": "sem verba", "-1500": "< 1.500", "1500-3000": "1.500–3k", "3000-5000": "3–5k", "5000+": "5k+" },
  ja_investe: { agencia: "Investe com agência", sozinho: "Impulsiona sozinho", nao: "Vai começar" },
  desafio: { poucos_clientes: "Poucos clientes novos", nao_converte: "Contatos não viram venda", sem_controle: "Não sabe de onde vêm as vendas", agencia_ruim: "Agência anterior não deu certo" },
  atendimento: { eu: "Ele mesmo atende", equipe: "Equipe atende", ninguem: "Ninguém fixo atende" },
  decisor: { sim: "Decisor", socio: "Decide com sócio", nao: "Não é o decisor" },
  segmento: { saude: "Saúde", estetica: "Estética", otica: "Ótica", loja: "Varejo", alimentacao: "Alimentação", servicos: "Serviços", outro: "Outro" },
  status: { novo: "Novo", em_contato: "Em contato", reuniao: "Reunião marcada", proposta: "Proposta enviada", cliente: "Virou cliente", perdido: "Perdido" },
};
const r = (campo: string, v: string | null) => (v ? ROTULOS[campo]?.[v] ?? v : "—");
const LINK_PUBLICO = `${SISTEMA_URL}/diagnostico`;

type Filtro = "completo" | "qualificado" | "desqualificado" | "todos";

export function Diagnosticos() {
  const [leads, setLeads] = useState<Lead[] | null>(supabase ? null : []);
  const [filtro, setFiltro] = useState<Filtro>("completo");
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [config, setConfig] = useState({ whatsapp: "", mensagem_whatsapp: "", link_conteudo: "" });
  const [verConfig, setVerConfig] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("diagnostico_leads")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) setAviso("Não foi possível carregar os leads.");
        setLeads((data as Lead[]) ?? []);
      });
    supabase
      .from("diagnostico_config")
      .select("whatsapp, mensagem_whatsapp, link_conteudo")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setConfig({ whatsapp: data.whatsapp ?? "", mensagem_whatsapp: data.mensagem_whatsapp ?? "", link_conteudo: data.link_conteudo ?? "" });
        if (data && !data.whatsapp) setVerConfig(true);
      });
  }, []);

  const contagem = useMemo(() => {
    const c = { completo: 0, qualificado: 0, desqualificado: 0, todos: leads?.length ?? 0 };
    for (const l of leads ?? []) c[l.etapa]++;
    return c;
  }, [leads]);
  const lista = (leads ?? []).filter((l) => filtro === "todos" || l.etapa === filtro);

  async function salvarConfig() {
    if (!supabase) return;
    const { error } = await supabase
      .from("diagnostico_config")
      .update({ whatsapp: config.whatsapp.replace(/\D/g, "") || null, mensagem_whatsapp: config.mensagem_whatsapp, link_conteudo: config.link_conteudo.trim() || null })
      .eq("id", true);
    setAviso(error ? "Só administradores podem mudar a configuração." : "Configuração salva.");
  }

  async function mudarStatus(l: Lead, status: string) {
    setLeads((ls) => ls?.map((x) => (x.id === l.id ? { ...x, status } : x)) ?? null);
    await supabase?.from("diagnostico_leads").update({ status }).eq("id", l.id);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Diagnóstico Digital</h1>
          <p className="text-[13px] text-muted">Leads da página pública. Só quem passa no corte (verba ≥ R$1.500 e faturamento &gt; R$30 mil) deixa o WhatsApp.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(LINK_PUBLICO);
              setAviso("Link copiado. Use em anúncios com UTM, ex.: ?utm_source=meta&utm_campaign=diagnostico");
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] hover:bg-raised"
          >
            <Copy size={14} /> Copiar link público
          </button>
          <a href={LINK_PUBLICO} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] hover:bg-raised">
            <ExternalLink size={14} /> Abrir página
          </a>
          <button onClick={() => setVerConfig(!verConfig)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] hover:bg-raised">
            <Settings2 size={14} /> Configurar
          </button>
        </div>
      </header>
      {aviso && <div className="rounded-lg bg-accent/10 px-3 py-2 text-[13px] text-accent">{aviso}</div>}

      {verConfig && (
        <section className="grid gap-3 rounded-xl bg-surface p-5 text-[13px] lg:grid-cols-3" style={{ boxShadow: "var(--sombra)" }}>
          <label className="flex flex-col gap-1 text-muted">
            WhatsApp comercial (com DDD) — botão final da página
            <input value={config.whatsapp} onChange={(e) => setConfig({ ...config, whatsapp: e.target.value })} placeholder="35 99999-9999" className="rounded-lg border border-line bg-bg px-2.5 py-2 text-fg" />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            Mensagem que já vem escrita
            <input value={config.mensagem_whatsapp} onChange={(e) => setConfig({ ...config, mensagem_whatsapp: e.target.value })} className="rounded-lg border border-line bg-bg px-2.5 py-2 text-fg" />
          </label>
          <label className="flex flex-col gap-1 text-muted">
            Link do conteúdo gratuito (para quem não passa no corte)
            <input value={config.link_conteudo} onChange={(e) => setConfig({ ...config, link_conteudo: e.target.value })} placeholder="https://…" className="rounded-lg border border-line bg-bg px-2.5 py-2 text-fg" />
          </label>
          <div className="lg:col-span-3">
            <button onClick={salvarConfig} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg">
              <Save size={14} /> Salvar
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["completo", "Completos", "Deixaram WhatsApp"],
            ["qualificado", "Passaram no corte", "Pararam no meio"],
            ["desqualificado", "Cortados", "Verba ou faturamento"],
            ["todos", "Total", "Todos que responderam"],
          ] as [Filtro, string, string][]
        ).map(([id, nome, sub]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`rounded-xl border p-4 text-left ${filtro === id ? "border-accent bg-accent-soft" : "border-transparent bg-surface hover:border-line"}`}
            style={{ boxShadow: "var(--sombra)" }}
          >
            <div className="num text-[26px] font-bold">{contagem[id]}</div>
            <div className="text-[13px] font-semibold">{nome}</div>
            <div className="text-[12px] text-muted">{sub}</div>
          </button>
        ))}
      </div>

      {leads === null ? (
        <div className="esqueleto h-40" />
      ) : lista.length === 0 ? (
        <p className="rounded-xl bg-surface p-6 text-center text-[13px] text-muted">Nenhum lead aqui ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((l) => (
            <div key={l.id} className="rounded-xl bg-surface" style={{ boxShadow: "var(--sombra)" }}>
              <button onClick={() => setAberto(aberto === l.id ? null : l.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left">
                <div className="min-w-[180px] flex-1">
                  <div className="font-semibold">{l.empresa ?? "—"}</div>
                  <div className="text-[12.5px] text-muted">
                    {l.nome ?? "—"} · {r("segmento", l.segmento)} · {new Date(l.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
                <span className="num text-[12.5px] text-muted">Fat. {r("faturamento", l.faturamento)}</span>
                <span className="num text-[12.5px] text-muted">Verba {r("verba", l.verba)}</span>
                {l.google_nota !== null && (
                  <span className="inline-flex items-center gap-1 text-[12.5px]">
                    <Star size={12} className="fill-warn text-warn" /> {l.google_nota} ({l.google_avaliacoes})
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${
                    l.etapa === "completo" ? "bg-ok-soft text-ok" : l.etapa === "qualificado" ? "bg-warn-soft text-warn" : "bg-raised text-muted"
                  }`}
                >
                  {l.etapa === "completo" ? r("status", l.status) : l.etapa === "qualificado" ? "Parou no meio" : `Cortado: ${l.motivo_corte?.replace(/_/g, " ") ?? ""}`}
                </span>
              </button>
              {aberto === l.id && (
                <div className="grid gap-4 border-t border-line p-4 text-[13px] md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Linha k="Já investe" v={r("ja_investe", l.ja_investe)} />
                    <Linha k="Maior desafio" v={r("desafio", l.desafio)} />
                    <Linha k="Atendimento" v={r("atendimento", l.atendimento)} />
                    <Linha k="Decisão" v={r("decisor", l.decisor)} />
                    <Linha k="O que vende" v={l.oque_vende ?? "—"} />
                    <Linha k="Origem" v={Object.keys(l.utm ?? {}).length ? Object.entries(l.utm).map(([k, v]) => `${k.replace("utm_", "")}: ${v}`).join(" · ") : "Direto / sem UTM"} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {l.google_nome && (
                      <a href={l.google_link ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 rounded-lg border border-line p-2.5 hover:bg-raised">
                        <MapPin size={15} className="mt-0.5 text-accent" />
                        <span>
                          <b>{l.google_nome}</b>
                          <br />
                          <span className="text-muted">{l.google_endereco}</span>
                        </span>
                      </a>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {l.site && <a href={/^https?:/.test(l.site) ? l.site : `https://${l.site}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-2.5 py-1.5 hover:bg-raised">Site</a>}
                      {l.sem_site && <span className="rounded-lg bg-raised px-2.5 py-1.5 text-muted">Sem site</span>}
                      {l.instagram && <a href={`https://instagram.com/${l.instagram}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-2.5 py-1.5 hover:bg-raised">@{l.instagram}</a>}
                      {l.whatsapp && (
                        <a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#25d366] px-2.5 py-1.5 font-medium text-[#06371b]">
                          <MessageCircle size={14} /> Chamar no WhatsApp
                        </a>
                      )}
                    </div>
                    {l.etapa === "completo" && (
                      <label className="mt-1 flex items-center gap-2 text-muted">
                        Status
                        <select value={l.status} onChange={(e) => mudarStatus(l, e.target.value)} className="rounded-lg border border-line bg-bg px-2 py-1.5 text-fg">
                          {Object.entries(ROTULOS.status).map(([v, t]) => (
                            <option key={v} value={v}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-[110px] shrink-0 text-muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}
