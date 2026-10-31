import { useEffect, useState } from "react";
import { BarChart3, Bot, CheckCircle2, Link2, Copy, FolderOpen, MapPin, MessageCircle, Plug, Save, Search, Smartphone, XCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { chamarFuncao } from "../lib/tabela";

type Status = Record<string, boolean>;
interface Grupo { grupo: string; grupo_nome: string | null; ultima: string }
interface MembroTel { id: string; nome: string; telefone: string | null }

const DEMO_STATUS: Status = { dataforseo_login: true, dataforseo_senha: true, meta_access_token: true, openai_api_key: true, anthropic_api_key: false, google_places_key: false, zapi_instancia: false, zapi_token: false, zapi_client_token: false, whatsapp_grupo: false };

/** Situação das integrações e configuração do WhatsApp (só administradores). Os valores ficam no cofre do Supabase e nunca voltam para a tela. */
export function Integracoes() {
  const [status, setStatus] = useState<Status | null>(supabase ? null : DEMO_STATUS);
  const [webhook, setWebhook] = useState("");
  const [grupoAtual, setGrupoAtual] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [time, setTime] = useState<MembroTel[]>([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [saldo, setSaldo] = useState<number | null>(null);
  const [conectando, setConectando] = useState(false);
  const [contasGoogle, setContasGoogle] = useState<{ id: string; nome: string; status: string }[] | null>(null);

  // Volta da autorização do Google (#integracoes?google=ok)
  useEffect(() => {
    const r = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("google");
    if (!r) return;
    const msg: Record<string, string> = {
      ok: "Google Ads conectado. Agora vincule as contas aos clientes em Tráfego > Contas.",
      recusado: "A autorização no Google foi cancelada.",
      expirado: "O link de autorização expirou. Clique em Conectar Google Ads de novo.",
      sem_refresh: "O Google não devolveu a permissão permanente. Remova o acesso do app em myaccount.google.com/permissions e conecte de novo.",
      erro: "Não deu para concluir a conexão com o Google. Tente de novo.",
    };
    setAviso(msg[r] ?? msg.erro);
    try { history.replaceState(null, "", "#integracoes"); } catch { /* ignora */ }
  }, []);

  async function conectarGoogle() {
    setConectando(true);
    try {
      const r = await chamarFuncao<{ url: string }>("google-ads", { acao: "conectar" });
      window.location.href = r.url;
    } catch (e) {
      setAviso((e as Error).message);
      setConectando(false);
    }
  }

  async function testarGoogle() {
    setConectando(true);
    try {
      const r = await chamarFuncao<{ contas: { id: string; nome: string; status: string }[] }>("google-ads", { acao: "contas" });
      setContasGoogle(r.contas);
      setAviso(`Conexão funcionando: ${r.contas.length} conta${r.contas.length === 1 ? "" : "s"} na MCC.`);
    } catch (e) {
      setAviso(`Google Ads: ${(e as Error).message}`);
    } finally {
      setConectando(false);
    }
  }

  async function carregar() {
    if (!supabase) return;
    const [s, w, g, m] = await Promise.all([
      supabase.rpc("integracoes_status"),
      supabase.rpc("whatsapp_config"),
      supabase.from("whatsapp_mensagens").select("grupo, grupo_nome, criado_em").order("criado_em", { ascending: false }).limit(300),
      supabase.from("membros").select("id, nome, telefone").eq("ativo", true).order("nome"),
    ]);
    if (s.error) {
      setErro(s.error.message.includes("administradores") ? "Só administradores podem ver as integrações." : s.error.message);
      return;
    }
    setStatus(s.data as Status);
    const cfg = (w.data ?? {}) as { webhook?: string; grupo?: string | null };
    setWebhook(cfg.webhook ?? "");
    setGrupoAtual(cfg.grupo ?? null);
    const vistos = new Map<string, Grupo>();
    for (const r of (g.data ?? []) as { grupo: string; grupo_nome: string | null; criado_em: string }[]) if (!vistos.has(r.grupo)) vistos.set(r.grupo, { grupo: r.grupo, grupo_nome: r.grupo_nome, ultima: r.criado_em });
    setGrupos([...vistos.values()]);
    setTime((m.data ?? []) as MembroTel[]);
    if ((s.data as Status).dataforseo_login) chamarFuncao<{ saldo: number | null }>("gbp-check", { acao: "saldo" }).then((r) => setSaldo(r.saldo), () => setSaldo(null));
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar(nome: string, valor: string) {
    if (!valor.trim()) return;
    if (!supabase) return setAviso("Na prévia nada é salvo.");
    const { error } = await supabase.rpc("definir_integracao", { nome, valor: valor.trim() });
    if (error) return setAviso(`Não salvou: ${error.message}`);
    setAviso("Salvo no cofre do sistema.");
    carregar();
  }

  async function salvarTelefone(id: string, telefone: string) {
    if (!supabase) return;
    const { error } = await supabase.from("membros").update({ telefone: telefone.replace(/\D/g, "") || null }).eq("id", id);
    setAviso(error ? `Não salvou: ${error.message}` : "Telefone salvo.");
    carregar();
  }

  if (erro) return <div className="rounded-xl bg-surface p-6 text-[13px] text-muted" style={{ boxShadow: "var(--sombra)" }}>{erro}</div>;
  if (!status) return <div className="p-6 text-[13px] text-muted">Carregando…</div>;

  const whatsOk = status.zapi_instancia && status.zapi_token && status.whatsapp_grupo;
  const cartoes = [
    { icone: Plug, nome: "Meta Ads", ok: status.meta_access_token, texto: "Sincroniza as contas de anúncio 3x ao dia." },
    { icone: BarChart3, nome: "Google Ads", ok: !!(status.google_ads_refresh_token && status.google_ads_mcc), texto: "Sincroniza as campanhas 3x ao dia." },
    { icone: Bot, nome: "IA do Assistente", ok: status.openai_api_key || status.anthropic_api_key, texto: status.anthropic_api_key ? "Usando Claude (Anthropic)." : "Usando ChatGPT (OpenAI)." },
    { icone: MapPin, nome: "Google Places (GBP Check)", ok: status.google_places_key, texto: "Busca nota, avaliações e fotos dos perfis do Google." },
    { icone: Search, nome: "DataForSEO", ok: status.dataforseo_login && status.dataforseo_senha, texto: saldo !== null ? `Análise completa e grade do Maps. Saldo: US$ ${saldo.toFixed(2)}` : "Análise completa do GBP e grade do Maps." },
    { icone: MessageCircle, nome: "WhatsApp (Z-API)", ok: whatsOk, texto: "Assistente respondendo no grupo do time." },
    { icone: FolderOpen, nome: "Google Drive", ok: true, texto: "Pasta de cada cliente aparece na ficha (aba Pasta no Drive)." },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[22px] font-semibold">Integrações</h1>
        <p className="text-[13px] text-muted">As chaves ficam guardadas no cofre do sistema e não aparecem de volta aqui.</p>
      </header>
      {aviso && <div className="rounded-lg bg-accent/10 px-3 py-2 text-[13px] text-accent">{aviso}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {cartoes.map((c) => (
          <div key={c.nome} className="rounded-xl bg-surface p-4" style={{ boxShadow: "var(--sombra)" }}>
            <div className="flex items-center justify-between">
              <c.icone size={18} className="text-accent" />
              {c.ok ? <CheckCircle2 size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-amber-500" />}
            </div>
            <div className="mt-2 text-[14px] font-semibold">{c.nome}</div>
            <div className="text-[12px] text-muted">{c.ok ? c.texto : "Falta configurar."}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl bg-surface p-5" style={{ boxShadow: "var(--sombra)" }}>
        <h2 className="flex items-center gap-2 text-[16px] font-semibold"><BarChart3 size={17} className="text-accent" /> Google Ads</h2>
        <p className="mt-1 text-[12.5px] text-muted">O acesso à API agora fica no projeto do Google Cloud: ative a Google Ads API, peça o nível Explorer na página dela e crie a credencial OAuth (Aplicativo da Web) com o endereço abaixo.</p>
        <div className="mt-3 grid gap-2 text-[13px] lg:grid-cols-2">
          <Campo rotulo="ID da MCC (ex.: 123-456-7890)" ok={!!status.google_ads_mcc} onSalvar={(v) => salvar("google_ads_mcc", v)} />
          <Campo rotulo="Token de desenvolvedor (opcional desde set/2026)" ok={!!status.google_ads_dev_token} onSalvar={(v) => salvar("google_ads_dev_token", v)} />
          <Campo rotulo="ID do cliente OAuth" ok={!!status.google_ads_client_id} onSalvar={(v) => salvar("google_ads_client_id", v)} />
          <Campo rotulo="Chave secreta do cliente OAuth" ok={!!status.google_ads_client_secret} onSalvar={(v) => salvar("google_ads_client_secret", v)} />
        </div>
        <div className="mt-3 flex flex-col gap-1 text-[12.5px]">
          <span className="text-muted">URI de redirecionamento autorizado (cole no Google Cloud):</span>
          <div className="flex gap-2">
            <input readOnly value="https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/google-ads" className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-2 font-mono text-[11.5px]" />
            <button onClick={() => { navigator.clipboard?.writeText("https://phtbhawdzewrzaiegheo.supabase.co/functions/v1/google-ads"); setAviso("Endereço copiado."); }} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 text-[12.5px] hover:bg-raised"><Copy size={14} /> Copiar</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={conectarGoogle} disabled={conectando || !status.google_ads_client_id || !status.google_ads_client_secret} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-fg disabled:opacity-40">
            <Link2 size={14} /> {status.google_ads_refresh_token ? "Reconectar Google Ads" : "Conectar Google Ads"}
          </button>
          {status.google_ads_refresh_token && (
            <button onClick={testarGoogle} disabled={conectando} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] hover:bg-raised disabled:opacity-40">Testar conexão</button>
          )}
          <span className="text-[12px] text-muted">{status.google_ads_refresh_token ? "Conectado." : "Depois de salvar a MCC e as chaves OAuth, conecte com o Google que acessa a MCC."}</span>
        </div>
        {contasGoogle && (
          <ul className="mt-3 grid gap-1 text-[12.5px] sm:grid-cols-2">
            {contasGoogle.map((c) => <li key={c.id} className="rounded-lg border border-line px-3 py-1.5"><b>{c.nome}</b> <span className="font-mono text-muted">{c.id}</span> · {c.status}</li>)}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-surface p-5" style={{ boxShadow: "var(--sombra)" }}>
        <h2 className="flex items-center gap-2 text-[16px] font-semibold"><MessageCircle size={17} className="text-accent" /> WhatsApp do time</h2>
        <ol className="mt-3 grid gap-4 text-[13px] lg:grid-cols-2">
          <li className="flex flex-col gap-2">
            <b>1. Credenciais da Z-API</b>
            <Campo rotulo="ID da instância" ok={status.zapi_instancia} onSalvar={(v) => salvar("zapi_instancia", v)} />
            <Campo rotulo="Token da instância" ok={status.zapi_token} onSalvar={(v) => salvar("zapi_token", v)} />
            <Campo rotulo="Client-Token (Segurança da conta)" ok={status.zapi_client_token} onSalvar={(v) => salvar("zapi_client_token", v)} />
          </li>
          <li className="flex flex-col gap-2">
            <b>2. Webhook "Ao receber" na Z-API</b>
            <div className="flex gap-2">
              <input readOnly value={webhook || "(disponível no sistema publicado)"} className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-2 font-mono text-[11.5px]" />
              <button onClick={() => { navigator.clipboard?.writeText(webhook); setAviso("Endereço copiado."); }} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 text-[12.5px] hover:bg-raised"><Copy size={14} /> Copiar</button>
            </div>
            <b className="mt-2">3. Grupo</b>
            <p className="text-muted">Mande qualquer mensagem no grupo; ele aparece aqui. {grupoAtual ? <>Grupo em uso: <span className="font-mono">{grupoAtual}</span></> : "Nenhum grupo escolhido."}</p>
            {grupos.length === 0 && <p className="text-[12px] text-muted">Nenhum grupo detectado ainda.</p>}
            {grupos.map((g) => (
              <div key={g.grupo} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{g.grupo_nome ?? "Grupo sem nome"}</div>
                  <div className="truncate font-mono text-[11px] text-muted">{g.grupo}</div>
                </div>
                {g.grupo === grupoAtual ? <span className="text-[12px] text-emerald-600">Em uso</span> : <button onClick={() => salvar("whatsapp_grupo", g.grupo)} className="rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-medium text-accent-fg">Usar este grupo</button>}
              </div>
            ))}
          </li>
        </ol>
        <div className="mt-5">
          <b className="flex items-center gap-2 text-[13px]"><Smartphone size={15} /> 4. WhatsApp de cada pessoa do time</b>
          <p className="text-[12px] text-muted">O assistente só responde quem tem o número cadastrado aqui (com DDD).</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {time.map((m) => <Telefone key={m.id} m={m} onSalvar={(t) => salvarTelefone(m.id, t)} />)}
          </div>
          <p className="mt-3 text-[12px] text-muted">No grupo, mensagens que começam com <b>//</b> são ignoradas pela IA (conversa entre pessoas).</p>
        </div>
      </section>

      <section className="rounded-xl bg-surface p-5" style={{ boxShadow: "var(--sombra)" }}>
        <h2 className="flex items-center gap-2 text-[16px] font-semibold"><Plug size={17} className="text-accent" /> Outras chaves</h2>
        <div className="mt-3 grid gap-2 text-[13px] lg:grid-cols-3">
          <Campo rotulo="Google Places API (GBP Check)" ok={status.google_places_key} onSalvar={(v) => salvar("google_places_key", v)} />
          <Campo rotulo="OpenAI (ChatGPT)" ok={status.openai_api_key} onSalvar={(v) => salvar("openai_api_key", v)} />
          <Campo rotulo="DataForSEO · API Login" ok={status.dataforseo_login} onSalvar={(v) => salvar("dataforseo_login", v)} />
          <Campo rotulo="DataForSEO · API Password" ok={status.dataforseo_senha} onSalvar={(v) => salvar("dataforseo_senha", v)} />
          <Campo rotulo="Anthropic (Claude) — opcional" ok={status.anthropic_api_key} onSalvar={(v) => salvar("anthropic_api_key", v)} />
        </div>
      </section>
    </div>
  );
}

function Campo({ rotulo, ok, onSalvar }: { rotulo: string; ok: boolean; onSalvar: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[12px] text-muted">{ok ? <CheckCircle2 size={13} className="text-emerald-500" /> : <XCircle size={13} className="text-amber-500" />} {rotulo}</span>
      <div className="flex gap-2">
        <input type="password" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} placeholder={ok ? "Configurado · cole para trocar" : "Cole aqui"} className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-2" />
        <button disabled={!v.trim()} onClick={() => { onSalvar(v); setV(""); }} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 text-[12.5px] font-medium text-accent-fg disabled:opacity-40"><Save size={14} /> Salvar</button>
      </div>
    </label>
  );
}

function Telefone({ m, onSalvar }: { m: MembroTel; onSalvar: (t: string) => void }) {
  const [t, setT] = useState(m.telefone ?? "");
  return (
    <div className="rounded-lg border border-line p-2.5">
      <div className="text-[13px] font-medium">{m.nome}</div>
      <div className="mt-1 flex gap-2">
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="(31) 99999-9999" className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 py-1.5 text-[13px]" />
        <button onClick={() => onSalvar(t)} disabled={t === (m.telefone ?? "")} className="rounded-lg border border-line px-2 text-[12px] hover:bg-raised disabled:opacity-40"><Save size={13} /></button>
      </div>
    </div>
  );
}
