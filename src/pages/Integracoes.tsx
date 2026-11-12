import { useEffect, useState } from "react";
import { BarChart3, Bot, CheckCircle2, Link2, Copy, FolderOpen, MapPin, MessageCircle, Plug, Save, Search, Smartphone, XCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { chamarFuncao } from "../lib/tabela";
import { useRef } from "react";
import { Iniciais } from "../components/ui";
import { useDadosOpcional } from "../lib/dados";
import { enviarFotoMembro } from "../lib/fotos";

type Status = Record<string, boolean>;
interface Grupo { grupo: string; nome: string | null; cliente_id: string | null; tipo: string; atualizado_em: string }
interface ClienteMin { id: string; nome: string }
interface MembroTel { id: string; nome: string; telefone: string | null; foto_url?: string | null }

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
  const [clientes, setClientes] = useState<ClienteMin[]>([]);
  const [configurando, setConfigurando] = useState(false);
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
    const [s, w, g, m, c] = await Promise.all([
      supabase.rpc("integracoes_status"),
      supabase.rpc("whatsapp_config"),
      supabase.from("whatsapp_grupos").select("grupo, nome, cliente_id, tipo, atualizado_em").order("atualizado_em", { ascending: false }),
      supabase.from("membros").select("id, nome, telefone, foto_url").eq("ativo", true).order("nome"),
      supabase.from("clientes").select("id, nome").eq("status", "ativo").order("nome"),
    ]);
    if (s.error) {
      setErro(s.error.message.includes("administradores") ? "Só administradores podem ver as integrações." : s.error.message);
      return;
    }
    setStatus(s.data as Status);
    const cfg = (w.data ?? {}) as { webhook?: string; grupo?: string | null };
    setWebhook(cfg.webhook ?? "");
    setGrupoAtual(cfg.grupo ?? null);
    setGrupos((g.data ?? []) as Grupo[]);
    setClientes((c.data ?? []) as ClienteMin[]);
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

  async function ligarEvolution() {
    setConfigurando(true);
    try {
      const r = await chamarFuncao<{ conexao: string }>("whatsapp", { acao: "configurar" });
      setAviso(r.conexao === "open" ? "WhatsApp conectado e webhook ligado. Mande uma mensagem num grupo para testar." : `Webhook ligado, mas a conexão está "${r.conexao}". Leia o QR code no painel da Evolution.`);
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setConfigurando(false);
    }
  }

  async function salvarGrupo(grupo: string, campos: Partial<Grupo>) {
    if (!supabase) return;
    setGrupos((xs) => xs.map((x) => (x.grupo === grupo ? { ...x, ...campos } : x)));
    const { error } = await supabase.from("whatsapp_grupos").update(campos).eq("grupo", grupo);
    if (error) setAviso(`Não salvou: ${error.message}`);
  }

  async function salvarTelefone(id: string, telefone: string) {
    if (!supabase) return;
    const { error } = await supabase.from("membros").update({ telefone: telefone.replace(/\D/g, "") || null }).eq("id", id);
    setAviso(error ? `Não salvou: ${error.message}` : "Telefone salvo.");
    carregar();
  }

  if (erro) return <div className="rounded-xl bg-surface p-6 text-[13px] text-muted" style={{ boxShadow: "var(--sombra)" }}>{erro}</div>;
  if (!status) return <div className="p-6 text-[13px] text-muted">Carregando…</div>;

  const evoOk = status.evolution_url && status.evolution_apikey && status.evolution_instancia;
  const whatsOk = evoOk || (status.zapi_instancia && status.zapi_token);
  const cartoes = [
    { icone: Plug, nome: "Meta Ads", ok: status.meta_access_token, texto: "Sincroniza as contas de anúncio 3x ao dia." },
    { icone: BarChart3, nome: "Google Ads", ok: !!(status.google_ads_refresh_token && status.google_ads_mcc), texto: "Sincroniza as campanhas 3x ao dia." },
    { icone: Bot, nome: "IA do Assistente", ok: status.openai_api_key || status.anthropic_api_key, texto: status.anthropic_api_key ? "Usando Claude (Anthropic)." : "Usando ChatGPT (OpenAI)." },
    { icone: MapPin, nome: "Google Places (GBP Check)", ok: status.google_places_key, texto: "Busca nota, avaliações e fotos dos perfis do Google." },
    { icone: Search, nome: "DataForSEO", ok: status.dataforseo_login && status.dataforseo_senha, texto: saldo !== null ? `Análise completa e grade do Maps. Saldo: US$ ${saldo.toFixed(2)}` : "Análise completa do GBP e grade do Maps." },
    { icone: MessageCircle, nome: evoOk ? "WhatsApp (Evolution)" : "WhatsApp (Z-API)", ok: !!whatsOk, texto: "Lê os grupos dos clientes e responde no grupo do time." },
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
        <h2 className="flex items-center gap-2 text-[16px] font-semibold"><Plug size={17} className="text-accent" /> Meta Ads e Instagram</h2>
        <div className="mt-3 grid gap-2 text-[13px] lg:grid-cols-2">
          <Campo rotulo="Token do usuário do sistema (Gerenciador de Negócios)" ok={status.meta_access_token} onSalvar={(v) => salvar("meta_access_token", v)} />
        </div>
        <p className="mt-2 text-[12px] text-muted">Gere em business.facebook.com → Configurações → Usuários do sistema → Gerar token (app Vertente Dashboard, expiração "Nunca"). Ao salvar, a sincronização das contas volta a funcionar na próxima rodada.</p>
      </section>

      <section className="rounded-xl bg-surface p-5" style={{ boxShadow: "var(--sombra)" }}>
        <h2 className="flex items-center gap-2 text-[16px] font-semibold"><BarChart3 size={17} className="text-accent" /> Google Ads e Perfil da Empresa</h2>
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
            <Link2 size={14} /> {status.google_ads_refresh_token ? "Reconectar Google (Ads + Meu Negócio)" : "Conectar Google (Ads + Meu Negócio)"}
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
            <b>1. Z-API (conexão por QR code)</b>
            <p className="text-[12px] text-muted">No painel da Z-API, abra a instância conectada e copie os dados abaixo. O Client-Token fica em Segurança, na conta. Tudo vai direto para o cofre.</p>
            <Campo rotulo="ID da instância" ok={status.zapi_instancia} onSalvar={(v) => salvar("zapi_instancia", v)} />
            <Campo rotulo="Token da instância" ok={status.zapi_token} onSalvar={(v) => salvar("zapi_token", v)} />
            <Campo rotulo="Client-Token (Segurança da conta)" ok={status.zapi_client_token} onSalvar={(v) => salvar("zapi_client_token", v)} />
            <b className="mt-2">Webhook "Ao receber"</b>
            <p className="text-[12px] text-muted">Na instância da Z-API, em Webhooks, cole este endereço no campo "Ao receber" e salve. Deixe desligada a opção de receber as mensagens enviadas por você.</p>
            <div className="flex gap-2">
              <input readOnly value={webhook || "(disponível no sistema publicado)"} className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-2 font-mono text-[11.5px]" />
              <button onClick={() => { navigator.clipboard?.writeText(webhook); setAviso("Endereço copiado."); }} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 text-[12.5px] hover:bg-raised"><Copy size={14} /> Copiar</button>
            </div>
            <details className="mt-2 text-[12px] text-muted">
              <summary className="cursor-pointer">Usar Evolution API em vez da Z-API</summary>
              <div className="mt-2 flex flex-col gap-2">
                <Campo rotulo="Endereço da Evolution (https://…)" ok={!!status.evolution_url} onSalvar={(v) => salvar("evolution_url", v)} />
                <Campo rotulo="Chave da API (AUTHENTICATION_API_KEY)" ok={!!status.evolution_apikey} onSalvar={(v) => salvar("evolution_apikey", v)} />
                <Campo rotulo="Nome da instância" ok={!!status.evolution_instancia} onSalvar={(v) => salvar("evolution_instancia", v)} />
                <button onClick={ligarEvolution} disabled={!evoOk || configurando} className="mt-1 inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg disabled:opacity-40">
                  <Link2 size={14} /> {configurando ? "Ligando…" : "Ligar webhook e testar conexão"}
                </button>
              </div>
            </details>
          </li>
          <li className="flex flex-col gap-2">
            <b>2. Grupos</b>
            <p className="text-muted">Cada grupo aparece aqui quando chega a primeira mensagem depois da conexão. Ligue cada um ao cliente e marque qual é o grupo do time (onde o assistente responde).</p>
            {grupos.length === 0 && <p className="text-[12px] text-muted">Nenhum grupo detectado ainda.</p>}
            <div className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
              {grupos.map((g) => (
                <div key={g.grupo} className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2 ${g.tipo === "pendente" ? "border-warn/50" : "border-line"}`}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{g.nome ?? "Grupo sem nome"}</span>
                    {g.grupo === grupoAtual ? <span className="text-[12px] text-emerald-600">Grupo do time</span> : <button onClick={() => { salvar("whatsapp_grupo", g.grupo); salvarGrupo(g.grupo, { tipo: "time", cliente_id: null }); }} className="text-[12px] text-accent hover:underline">É o grupo do time</button>}
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-1.5">
                    <select value={g.tipo} onChange={(e) => salvarGrupo(g.grupo, { tipo: e.target.value, ...(e.target.value === "cliente" ? {} : { cliente_id: null }) })} className="h-8 rounded-lg border border-line bg-bg px-2 text-[12.5px]">
                      <option value="pendente">Definir…</option>
                      <option value="cliente">Cliente</option>
                      <option value="parceria">Parceria</option>
                      <option value="suporte">Suporte CRM</option>
                      <option value="time">Time</option>
                      <option value="ignorar">Ignorar</option>
                    </select>
                    {g.tipo === "cliente" || g.tipo === "suporte" ? (
                      <select value={g.cliente_id ?? ""} onChange={(e) => salvarGrupo(g.grupo, { cliente_id: e.target.value || null })} className="h-8 min-w-0 rounded-lg border border-line bg-bg px-2 text-[12.5px]">
                        <option value="">Qual cliente?</option>
                        {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    ) : <span />}
                  </div>
                </div>
              ))}
            </div>
          </li>
        </ol>
        <div className="mt-5">
          <b className="flex items-center gap-2 text-[13px]"><Smartphone size={15} /> 4. Foto e WhatsApp de cada pessoa do time</b>
          <p className="text-[12px] text-muted">Clique na foto para enviar ou trocar. O assistente só responde quem tem o número cadastrado aqui (com DDD).</p>
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
      <div className="flex items-center gap-2">
        <FotoMembro m={m} />
        <div className="text-[13px] font-medium">{m.nome}</div>
      </div>
      <div className="mt-1 flex gap-2">
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="(31) 99999-9999" className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 py-1.5 text-[13px]" />
        <button onClick={() => onSalvar(t)} disabled={t === (m.telefone ?? "")} className="rounded-lg border border-line px-2 text-[12px] hover:bg-raised disabled:opacity-40"><Save size={13} /></button>
      </div>
    </div>
  );
}

/** Foto da pessoa no cartão do time: clique para enviar ou trocar (a própria pessoa ou um administrador). */
function FotoMembro({ m }: { m: MembroTel }) {
  const d = useDadosOpcional();
  const arquivo = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState(m.foto_url ?? null);
  const [enviando, setEnviando] = useState(false);
  return (
    <>
      <button onClick={() => arquivo.current?.click()} disabled={enviando} title="Enviar ou trocar a foto" aria-label={`Foto de ${m.nome}`} className={`rounded-full ${enviando ? "animate-pulse" : ""}`}>
        <Iniciais nome={m.nome} foto={foto} tamanho="m" />
      </button>
      <input
        ref={arquivo}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setEnviando(true);
          try {
            setFoto(await enviarFotoMembro(m.id, f, d?.eu === m.id));
            await d?.recarregar();
            d?.avisar(`Foto de ${m.nome.split(" ")[0]} atualizada`);
          } catch (err) {
            d?.avisar((err as Error).message);
          } finally {
            setEnviando(false);
          }
        }}
      />
    </>
  );
}
