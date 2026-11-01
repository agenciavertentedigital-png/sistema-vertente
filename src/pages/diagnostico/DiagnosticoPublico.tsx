import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ExternalLink, Globe, Instagram, Lock, MapPin, MessageCircle, Search, ShieldCheck, Star } from "lucide-react";
import logoPrata from "../../assets/logo-prata.png";

/**
 * Diagnóstico Digital Gratuito: página pública (sem login) em /diagnostico, pensada para ir direto em anúncio.
 * Uma pergunta por tela. Nota de corte: verba de anúncios a partir de R$1.500/mês E faturamento acima de R$30 mil/mês.
 * Quem passa informa ficha do Google (obrigatória e confirmada), site, Instagram e o que vende, e deixa o WhatsApp.
 * Tudo é gravado pela função pública diagnostico-publico (a regra de corte vale no servidor).
 */

const BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CHAVE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const DEMO = !BASE || !CHAVE;

type Opcao = { v: string; t: string };
type Resp = Record<string, string>;
type PerfilGoogle = { place_id: string; nome: string; endereco: string; nota: number | null; avaliacoes: number; categoria: string | null; link: string | null };

const OPCOES: Record<string, Opcao[]> = {
  segmento: [
    { v: "saude", t: "Clínica / saúde" },
    { v: "estetica", t: "Estética e beleza" },
    { v: "otica", t: "Ótica" },
    { v: "loja", t: "Loja / varejo" },
    { v: "alimentacao", t: "Alimentação" },
    { v: "servicos", t: "Prestação de serviços" },
    { v: "outro", t: "Outro" },
  ],
  faturamento: [
    { v: "0-10", t: "Até R$10 mil" },
    { v: "10-30", t: "De R$10 mil a R$30 mil" },
    { v: "30-50", t: "De R$30 mil a R$50 mil" },
    { v: "50-100", t: "De R$50 mil a R$100 mil" },
    { v: "100+", t: "Acima de R$100 mil" },
  ],
  verba: [
    { v: "0", t: "Ainda não tenho verba separada" },
    { v: "-1500", t: "Menos de R$1.500" },
    { v: "1500-3000", t: "De R$1.500 a R$3.000" },
    { v: "3000-5000", t: "De R$3.000 a R$5.000" },
    { v: "5000+", t: "Acima de R$5.000" },
  ],
  ja_investe: [
    { v: "agencia", t: "Sim, com agência ou gestor" },
    { v: "sozinho", t: "Sim, eu mesmo impulsiono" },
    { v: "nao", t: "Ainda não, vou começar" },
  ],
  desafio: [
    { v: "poucos_clientes", t: "Poucos clientes novos chegando" },
    { v: "nao_converte", t: "Muitos contatos, poucas vendas" },
    { v: "sem_controle", t: "Não sei de onde vêm minhas vendas" },
    { v: "agencia_ruim", t: "Já tive agência e não deu certo" },
  ],
  atendimento: [
    { v: "eu", t: "Eu mesmo" },
    { v: "equipe", t: "Uma pessoa da equipe" },
    { v: "ninguem", t: "Ninguém fixo, quem estiver livre" },
  ],
  decisor: [
    { v: "sim", t: "Sim, eu decido" },
    { v: "socio", t: "Decido junto com sócio(a)" },
    { v: "nao", t: "Não, outra pessoa decide" },
  ],
};
const FATURAMENTO_OK = new Set(["30-50", "50-100", "100+"]);
const VERBA_OK = new Set(["1500-3000", "3000-5000", "5000+"]);

const EXEMPLO_VENDE: Record<string, string> = {
  saude: "Ex.: clínica odontológica com foco em implantes e lentes de contato dental",
  estetica: "Ex.: harmonização facial, botox e limpeza de pele para mulheres de 30 a 55 anos",
  otica: "Ex.: óculos de grau e solares, exame de vista no local",
  loja: "Ex.: moda feminina plus size, venda na loja física e pelo WhatsApp",
  alimentacao: "Ex.: hamburgueria artesanal com delivery próprio",
  servicos: "Ex.: energia solar residencial e comercial na região",
  outro: "Conte em uma frase o que você vende e para quem",
};

type Passo =
  | { id: string; tipo: "texto"; titulo: (r: Resp) => string; ajuda?: string; placeholder: string; obrigatorio: true }
  | { id: string; tipo: "escolha"; titulo: (r: Resp) => string; ajuda?: string; filtro?: boolean }
  | { id: "google" | "site" | "instagram" | "oque_vende" | "contato"; tipo: "especial"; titulo: (r: Resp) => string; ajuda?: string };

const primeiro = (r: Resp) => (r.nome ?? "").trim().split(/\s+/)[0] ?? "";

const PASSOS: Passo[] = [
  { id: "nome", tipo: "texto", titulo: () => "Para começar, qual é o seu nome?", placeholder: "Seu nome", obrigatorio: true },
  { id: "empresa", tipo: "texto", titulo: (r) => `Prazer, ${primeiro(r)}! Qual é o nome da sua empresa?`, placeholder: "Nome da empresa", obrigatorio: true },
  { id: "segmento", tipo: "escolha", titulo: (r) => `Qual é o ramo da ${r.empresa || "empresa"}?` },
  { id: "faturamento", tipo: "escolha", titulo: () => "Qual é o faturamento médio mensal da empresa hoje?", ajuda: "Fica só entre nós. Serve para indicar o plano certo para o seu momento.", filtro: true },
  { id: "verba", tipo: "escolha", titulo: () => "Quanto você tem disponível por mês para investir em anúncios?", ajuda: "Pode ser a verba que você já investe hoje ou a que já tem separada para começar. Não inclui o valor da agência.", filtro: true },
  { id: "ja_investe", tipo: "escolha", titulo: () => "Você já investe em anúncios hoje?" },
  { id: "desafio", tipo: "escolha", titulo: () => "Qual é o maior desafio da empresa hoje?" },
  { id: "atendimento", tipo: "escolha", titulo: () => "Quem responde o WhatsApp de quem chega pelos anúncios?" },
  { id: "decisor", tipo: "escolha", titulo: () => "Você é quem decide sobre o marketing da empresa?" },
  { id: "google", tipo: "especial", titulo: (r) => `Agora vamos achar a ${r.empresa || "sua empresa"} no Google`, ajuda: "Busque pelo nome e a cidade e toque na sua empresa para confirmar." },
  { id: "site", tipo: "especial", titulo: () => "Qual é o site da empresa?", ajuda: "Vamos analisar velocidade, botão de WhatsApp e se a medição dos anúncios está instalada." },
  { id: "instagram", tipo: "especial", titulo: () => "E o Instagram da empresa?", ajuda: "Use o @ da empresa (não o pessoal)." },
  { id: "oque_vende", tipo: "especial", titulo: () => "Em uma frase: o que a empresa vende e para quem?", ajuda: "Isso deixa o diagnóstico específico para o seu negócio." },
  { id: "contato", tipo: "especial", titulo: (r) => `Última etapa, ${primeiro(r)}: para onde mandamos o diagnóstico?`, ajuda: "Seu diagnóstico fica pronto na hora e enviamos uma cópia no seu WhatsApp." },
];
const INDICE_CORTE = PASSOS.findIndex((p) => p.id === "verba");

function novaSessao() {
  try {
    return crypto.randomUUID();
  } catch {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
  }
}

function lerArmazenado<T>(chave: string, padrao: T): T {
  try {
    const v = sessionStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}
function gravarArmazenado(chave: string, v: unknown) {
  try {
    sessionStorage.setItem(chave, JSON.stringify(v));
  } catch {
    /* sem armazenamento: segue só em memória */
  }
}

async function chamar<T = Record<string, unknown>>(acao: string, extra: Record<string, unknown> = {}): Promise<T & { erro?: string }> {
  if (DEMO) return { erro: "Prévia sem conexão: nada é buscado nem gravado." } as T & { erro?: string };
  try {
    const r = await fetch(`${BASE}/functions/v1/diagnostico-publico`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CHAVE!, Authorization: `Bearer ${CHAVE}` },
      body: JSON.stringify({ acao, ...extra }),
    });
    return (await r.json()) as T & { erro?: string };
  } catch {
    return { erro: "Falha de conexão. Verifique a internet e tente de novo." } as T & { erro?: string };
  }
}

function formatarWhats(v: string) {
  const d = v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
const normalizarInsta = (v: string) =>
  v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@/, "").toLowerCase();

export function DiagnosticoPublico() {
  const [sessao] = useState(() => lerArmazenado("diag.sessao", "") || novaSessao());
  const [resp, setResp] = useState<Resp>(() => lerArmazenado("diag.resp", {}));
  const [passo, setPasso] = useState<number>(() => lerArmazenado("diag.passo", -1)); // -1 = abertura
  const [fim, setFim] = useState<"" | "corte" | "pronto">(() => lerArmazenado("diag.fim", ""));
  const [google, setGoogle] = useState<PerfilGoogle | null>(() => lerArmazenado("diag.google", null));
  const [config, setConfig] = useState<{ whatsapp?: string | null; mensagem_whatsapp?: string; link_conteudo?: string | null }>({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const utm = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    const u: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"]) {
      const v = q.get(k);
      if (v) u[k] = v.slice(0, 200);
    }
    return Object.keys(u).length ? u : lerArmazenado<Record<string, string>>("diag.utm", {});
  }, []);

  useEffect(() => {
    document.title = "Diagnóstico Digital Gratuito · Vertente Digital";
    chamar<{ whatsapp?: string; mensagem_whatsapp?: string; link_conteudo?: string }>("config").then((c) => !c.erro && setConfig(c));
  }, []);
  useEffect(() => {
    gravarArmazenado("diag.sessao", sessao);
    gravarArmazenado("diag.resp", resp);
    gravarArmazenado("diag.passo", passo);
    gravarArmazenado("diag.fim", fim);
    gravarArmazenado("diag.google", google);
    gravarArmazenado("diag.utm", utm);
  }, [sessao, resp, passo, fim, google, utm]);

  const dadosParaSalvar = (extra: Resp = {}) => ({
    ...resp,
    ...extra,
    google_place_id: google?.place_id,
    google_nome: google?.nome,
    google_endereco: google?.endereco,
    google_nota: google?.nota ?? undefined,
    google_avaliacoes: google?.avaliacoes,
    google_categoria: google?.categoria ?? undefined,
    google_link: google?.link ?? undefined,
    sem_site: resp.site === "" && resp.sem_site === "1",
    utm,
    origem_url: window.location.href.slice(0, 300),
  });

  function irPara(i: number) {
    setErro("");
    setPasso(i);
    window.scrollTo({ top: 0 });
  }

  async function avancar(novas: Resp = {}) {
    const r = { ...resp, ...novas };
    setResp(r);
    if (passo === INDICE_CORTE) {
      const passa = FATURAMENTO_OK.has(r.faturamento) && VERBA_OK.has(r.verba);
      // grava em segundo plano: desqualificado (só métricas) ou qualificado (lead parcial)
      void chamar("salvar", { sessao, etapa: passa ? "qualificado" : "desqualificado", dados: { ...r, utm, origem_url: window.location.href.slice(0, 300) } });
      if (!passa) {
        setFim("corte");
        return;
      }
    }
    irPara(passo + 1);
  }

  async function concluir(whatsapp: string) {
    setEnviando(true);
    setErro("");
    const r = await chamar<{ ok?: boolean; etapa?: string }>("salvar", { sessao, etapa: "completo", dados: { ...dadosParaSalvar({ whatsapp }), aceite_lgpd: true } });
    setEnviando(false);
    if (r.erro && !DEMO) {
      setErro(r.erro);
      return;
    }
    setResp({ ...resp, whatsapp });
    setFim("pronto");
  }

  function recomecar() {
    try {
      for (const k of ["diag.sessao", "diag.resp", "diag.passo", "diag.fim", "diag.google"]) sessionStorage.removeItem(k);
    } catch {
      /* nada */
    }
    window.location.reload();
  }

  const atual = passo >= 0 ? PASSOS[passo] : null;
  const progresso = fim ? 100 : passo < 0 ? 0 : Math.round((passo / PASSOS.length) * 100);
  const linkWhats = config.whatsapp
    ? `https://wa.me/${config.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `${config.mensagem_whatsapp ?? "Olá! Fiz o Diagnóstico Digital da Vertente."}${resp.empresa ? ` (Empresa: ${resp.empresa})` : ""}`,
      )}`
    : null;

  return (
    <div className="tema-diagnostico flex min-h-full flex-col">
      <header className="sticky top-0 z-10 bg-[#0b1442]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-4 py-3">
          <img src={logoPrata} alt="Vertente Digital" className="h-9 w-auto" />
          {passo >= 0 && !fim && <span className="num text-[12.5px] text-muted">{passo + 1} de {PASSOS.length}</span>}
        </div>
        <div className="h-1 w-full bg-line/60">
          <div className="h-1 bg-accent transition-all duration-500" style={{ width: `${progresso}%` }} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-4 py-8 sm:py-12">
        {DEMO && <p className="mb-4 rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Prévia sem conexão: a busca no Google e o envio não funcionam aqui.</p>}

        {fim === "corte" && <TelaCorte nome={primeiro(resp)} linkConteudo={config.link_conteudo ?? null} />}
        {fim === "pronto" && <TelaPronto nome={primeiro(resp)} empresa={resp.empresa} google={google} linkWhats={linkWhats} />}

        {!fim && passo < 0 && <Abertura comecar={() => irPara(0)} />}

        {!fim && atual && (
          <div key={atual.id} className="diag-pergunta">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-accent">
              <span className="num">{passo + 1}</span>
              <ArrowRight size={14} />
              {"filtro" in atual && atual.filtro && <Lock size={12} className="text-muted" aria-hidden />}
            </div>
            <h1 className="text-[24px] font-bold leading-tight sm:text-[30px]">{atual.titulo(resp)}</h1>
            {atual.ajuda && <p className="mt-2 text-[15px] text-muted">{atual.ajuda}</p>}
            <div className="mt-7">
              {atual.tipo === "texto" && <CampoTexto key={atual.id} inicial={resp[atual.id] ?? ""} placeholder={atual.placeholder} ok={(v) => avancar({ [atual.id]: v })} />}
              {atual.tipo === "escolha" && <Escolhas opcoes={OPCOES[atual.id]} marcado={resp[atual.id]} escolher={(v) => avancar({ [atual.id]: v })} />}
              {atual.id === "google" && (
                <PassoGoogle empresa={resp.empresa ?? ""} confirmado={google} confirmar={setGoogle} seguir={() => avancar()} linkWhats={linkWhats} />
              )}
              {atual.id === "site" && <PassoSite inicial={resp.site ?? ""} ok={(site, sem) => avancar({ site, sem_site: sem ? "1" : "" })} />}
              {atual.id === "instagram" && <PassoInstagram inicial={resp.instagram ?? ""} ok={(instagram) => avancar({ instagram })} />}
              {atual.id === "oque_vende" && (
                <CampoTexto key="oque_vende" inicial={resp.oque_vende ?? ""} placeholder={EXEMPLO_VENDE[resp.segmento] ?? EXEMPLO_VENDE.outro} longo minimo={12} ok={(v) => avancar({ oque_vende: v })} />
              )}
              {atual.id === "contato" && <PassoContato inicial={resp.whatsapp ?? ""} enviando={enviando} enviar={concluir} />}
            </div>
            {erro && <p className="mt-4 text-[14px] text-bad">{erro}</p>}
            {passo > 0 && (
              <button onClick={() => irPara(passo - 1)} className="mt-8 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-fg">
                <ArrowLeft size={15} /> Voltar
              </button>
            )}
          </div>
        )}
      </main>

      <footer className="px-4 pb-6 text-center text-[11.5px] text-muted">
        Vertente Digital · Seus dados são usados só para gerar o diagnóstico e falar com você.
        {fim && (
          <button onClick={recomecar} className="ml-2 underline hover:text-fg">
            Fazer de novo
          </button>
        )}
      </footer>
    </div>
  );
}

function Abertura({ comecar }: { comecar: () => void }) {
  return (
    <div className="diag-pergunta">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12.5px] font-semibold text-fg">
        <ShieldCheck size={14} className="text-ok" /> Gratuito · leva 3 minutos
      </span>
      <h1 className="mt-5 text-[30px] font-extrabold leading-[1.1] sm:text-[42px]">
        Descubra o que está travando o crescimento da sua empresa no digital
      </h1>
      <p className="mt-4 max-w-[52ch] text-[16px] text-muted sm:text-[17px]">
        Analisamos sua ficha no Google, seu site e seu Instagram e entregamos um diagnóstico com as melhorias e um plano de execução para atrair mais clientes.
      </p>
      <ul className="mt-6 grid gap-2.5 text-[14.5px] sm:grid-cols-3">
        {[
          { i: <MapPin size={16} />, t: "Ficha do Google" },
          { i: <Globe size={16} />, t: "Site e medição" },
          { i: <Instagram size={16} />, t: "Instagram" },
        ].map((x) => (
          <li key={x.t} className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2.5">
            <span className="text-accent">{x.i}</span>
            {x.t}
          </li>
        ))}
      </ul>
      <button onClick={comecar} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-4 text-[17px] font-bold text-accent-fg shadow-lg shadow-accent/30 hover:brightness-110 sm:w-auto">
        Quero meu diagnóstico <ArrowRight size={18} />
      </button>
    </div>
  );
}

function Botao({ children, onClick, disabled, tipo = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; tipo?: "button" | "submit" }) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[16px] font-bold text-accent-fg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

const estiloCampo =
  "w-full border-0 border-b-2 border-line-forte bg-transparent px-0 py-2 text-[22px] text-fg placeholder:text-muted/60 outline-none focus:border-accent sm:text-[26px]";

function CampoTexto({ inicial, placeholder, ok, longo, minimo = 2 }: { inicial: string; placeholder: string; ok: (v: string) => void; longo?: boolean; minimo?: number }) {
  const [v, setV] = useState(inicial);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const valido = v.trim().length >= minimo;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) ok(v.trim());
      }}
    >
      {longo ? (
        <textarea
          ref={ref}
          value={v}
          rows={2}
          maxLength={400}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (valido) ok(v.trim());
            }
          }}
          className={`${estiloCampo} resize-none text-[19px] sm:text-[21px]`}
        />
      ) : (
        <input ref={ref} value={v} maxLength={120} placeholder={placeholder} onChange={(e) => setV(e.target.value)} className={estiloCampo} />
      )}
      <div className="mt-6 flex items-center gap-3">
        <Botao tipo="submit" disabled={!valido}>
          OK <Check size={18} />
        </Botao>
        <span className="hidden text-[12.5px] text-muted sm:inline">ou aperte Enter ↵</span>
      </div>
    </form>
  );
}

function Escolhas({ opcoes, marcado, escolher }: { opcoes: Opcao[]; marcado?: string; escolher: (v: string) => void }) {
  const [clicado, setClicado] = useState<string | null>(null);
  const escolherComPausa = (v: string) => {
    if (clicado) return;
    setClicado(v);
    setTimeout(() => escolher(v), 260);
  };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const i = e.key.toUpperCase().charCodeAt(0) - 65;
      if (e.key.length === 1 && i >= 0 && i < opcoes.length) escolherComPausa(opcoes[i].v);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });
  return (
    <div className="flex max-w-[520px] flex-col gap-2.5">
      {opcoes.map((o, i) => {
        const ativo = clicado ? clicado === o.v : marcado === o.v;
        return (
          <button
            key={o.v}
            onClick={() => escolherComPausa(o.v)}
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3.5 text-left text-[16px] ${
              ativo ? "border-accent bg-accent/25" : "border-line-forte bg-surface/60 hover:border-accent hover:bg-accent-soft"
            }`}
          >
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border text-[12.5px] font-bold ${ativo ? "border-accent bg-accent text-accent-fg" : "border-line-forte text-muted"}`}>
              {ativo ? <Check size={14} /> : String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1">{o.t}</span>
          </button>
        );
      })}
    </div>
  );
}

function CartaoGoogle({ p, destaque }: { p: PerfilGoogle; destaque?: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3.5 text-left ${destaque ? "border-ok bg-ok-soft" : "border-line-forte bg-surface/60"}`}>
      <MapPin size={20} className={`mt-0.5 shrink-0 ${destaque ? "text-ok" : "text-accent"}`} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{p.nome}</div>
        <div className="truncate text-[13px] text-muted">{p.endereco}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
          {p.nota !== null ? (
            <span className="inline-flex items-center gap-1 text-fg">
              <Star size={13} className="fill-warn text-warn" /> <span className="num">{p.nota.toFixed(1)}</span>
              <span className="text-muted">({p.avaliacoes} avaliações)</span>
            </span>
          ) : (
            <span>Sem avaliações</span>
          )}
          {p.categoria && <span>{p.categoria}</span>}
        </div>
      </div>
      {destaque && <Check size={20} className="shrink-0 text-ok" />}
    </div>
  );
}

function PassoGoogle({ empresa, confirmado, confirmar, seguir, linkWhats }: { empresa: string; confirmado: PerfilGoogle | null; confirmar: (p: PerfilGoogle | null) => void; seguir: () => void; linkWhats: string | null }) {
  const [texto, setTexto] = useState(empresa ? `${empresa} ` : "");
  const [resultados, setResultados] = useState<PerfilGoogle[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [modoLink, setModoLink] = useState(false);
  const [link, setLink] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!confirmado) ref.current?.focus();
  }, [confirmado]);

  async function buscar() {
    if (texto.trim().length < 3) return;
    setBuscando(true);
    setErro("");
    const r = await chamar<{ resultados?: PerfilGoogle[] }>("buscar_google", { texto });
    setBuscando(false);
    if (r.erro) return setErro(r.erro);
    setResultados(r.resultados ?? []);
  }
  async function lerLink() {
    setBuscando(true);
    setErro("");
    const r = await chamar<{ perfil?: PerfilGoogle; outros?: PerfilGoogle[] }>("link_google", { link });
    setBuscando(false);
    if (r.erro || !r.perfil) return setErro(r.erro ?? "Não conseguimos ler esse link.");
    setResultados([r.perfil, ...(r.outros ?? [])]);
  }

  if (confirmado) {
    return (
      <div className="flex max-w-[560px] flex-col gap-4">
        <CartaoGoogle p={confirmado} destaque />
        <p className="text-[14px] text-muted">Ficha confirmada. É esta que vamos analisar.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Botao onClick={seguir}>
            Continuar <ArrowRight size={18} />
          </Botao>
          <button
            onClick={() => {
              confirmar(null);
              setResultados(null);
            }}
            className="text-[14px] text-muted underline hover:text-fg"
          >
            Não é essa, trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[560px] flex-col gap-4">
      {!modoLink ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void buscar();
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-2 rounded-xl border border-line-forte bg-surface/60 px-3 focus-within:border-accent">
            <Search size={18} className="text-muted" />
            <input
              ref={ref}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Nome da empresa e cidade"
              className="flex-1 bg-transparent py-3.5 text-[16px] text-fg outline-none placeholder:text-muted/70"
            />
          </div>
          <div>
            <Botao tipo="submit" disabled={buscando || texto.trim().length < 3}>
              {buscando ? "Buscando…" : "Buscar no Google"}
            </Botao>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <InstrucoesLink />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Cole aqui o link (ex.: https://maps.app.goo.gl/…)"
            className="rounded-xl border border-line-forte bg-surface/60 px-3 py-3.5 text-[15px] text-fg outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <div>
            <Botao onClick={lerLink} disabled={buscando || link.trim().length < 10}>
              {buscando ? "Lendo o link…" : "Encontrar minha ficha"}
            </Botao>
          </div>
        </div>
      )}

      {erro && <p className="text-[14px] text-bad">{erro}</p>}

      {resultados && (
        <div className="flex flex-col gap-2">
          {resultados.length === 0 ? (
            <p className="text-[14px] text-muted">Nada encontrado. Tente escrever o nome como aparece no Google, com a cidade, ou cole o link da ficha.</p>
          ) : (
            <>
              <p className="text-[13px] text-muted">Toque na sua empresa:</p>
              {resultados.map((p) => (
                <button key={p.place_id} onClick={() => confirmar(p)} className="rounded-xl hover:ring-2 hover:ring-accent">
                  <CartaoGoogle p={p} />
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5 border-t border-line pt-4 text-[13.5px]">
        <button onClick={() => { setModoLink(!modoLink); setErro(""); setResultados(null); }} className="self-start text-accent underline">
          {modoLink ? "Prefiro buscar pelo nome" : "Não achou? Cole o link da sua ficha do Google"}
        </button>
        {linkWhats && (
          <a href={linkWhats} target="_blank" rel="noopener noreferrer" className="self-start text-muted underline hover:text-fg">
            Minha empresa não tem ficha no Google
          </a>
        )}
      </div>
    </div>
  );
}

function InstrucoesLink() {
  const [aberto, setAberto] = useState(true);
  return (
    <div className="rounded-xl border border-line bg-surface/60">
      <button onClick={() => setAberto(!aberto)} className="flex w-full items-center justify-between px-3.5 py-3 text-left text-[14px] font-semibold">
        Como pegar o link da sua ficha
        <ChevronDown size={16} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <ol className="flex flex-col gap-2 px-3.5 pb-3.5 text-[14px] text-muted">
          {[
            "Abra o app Google Maps (ou google.com/maps no computador).",
            "Pesquise o nome da sua empresa e toque nela para abrir a ficha.",
            "Toque em “Compartilhar” e depois em “Copiar link”.",
            "Volte aqui e cole. O link começa com maps.app.goo.gl ou share.google.",
          ].map((t, i) => (
            <li key={t} className="flex gap-2.5">
              <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-fg">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PassoSite({ inicial, ok }: { inicial: string; ok: (site: string, semSite: boolean) => void }) {
  const [v, setV] = useState(inicial);
  const [testando, setTestando] = useState(false);
  const [aviso, setAviso] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const parece = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v.trim());

  async function testar() {
    if (aviso) return ok(v.trim(), false); // já avisou: segue mesmo assim
    setTestando(true);
    const r = await chamar<{ abre?: boolean; motivo?: string }>("verificar_site", { url: v.trim() });
    setTestando(false);
    if (r.erro || r.abre) return ok(v.trim(), false);
    setAviso(`${r.motivo ?? "Não conseguimos abrir esse site."} Confira o endereço ou toque em continuar mesmo assim.`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (parece) void testar();
      }}
      className="flex max-w-[560px] flex-col gap-4"
    >
      <input ref={ref} value={v} onChange={(e) => { setV(e.target.value); setAviso(""); }} placeholder="www.suaempresa.com.br" inputMode="url" autoCapitalize="off" className={estiloCampo} />
      {aviso && <p className="text-[14px] text-warn">{aviso}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Botao tipo="submit" disabled={!parece || testando}>
          {testando ? "Conferindo…" : aviso ? "Continuar mesmo assim" : "OK"} {!testando && <Check size={18} />}
        </Botao>
        <button type="button" onClick={() => ok("", true)} className="rounded-xl border border-line-forte px-4 py-3 text-[14.5px] hover:border-accent">
          Não tenho site
        </button>
      </div>
    </form>
  );
}

function PassoInstagram({ inicial, ok }: { inicial: string; ok: (v: string) => void }) {
  const [v, setV] = useState(inicial ? `@${inicial}` : "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const usuario = normalizarInsta(v);
  const valido = /^[a-z0-9._]{2,30}$/.test(usuario);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) ok(usuario);
      }}
      className="flex max-w-[560px] flex-col gap-4"
    >
      <input ref={ref} value={v} onChange={(e) => setV(e.target.value)} placeholder="@suaempresa" autoCapitalize="off" autoCorrect="off" className={estiloCampo} />
      {v && !valido && <p className="text-[13.5px] text-warn">Use só o @ (letras, números, ponto e _), ou cole o link do perfil.</p>}
      {valido && (
        <a href={`https://instagram.com/${usuario}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start text-[13.5px] text-muted underline hover:text-fg">
          Conferir instagram.com/{usuario} <ExternalLink size={13} />
        </a>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Botao tipo="submit" disabled={!valido}>
          OK <Check size={18} />
        </Botao>
        <button type="button" onClick={() => ok("")} className="rounded-xl border border-line-forte px-4 py-3 text-[14.5px] hover:border-accent">
          A empresa não tem Instagram
        </button>
      </div>
    </form>
  );
}

function PassoContato({ inicial, enviando, enviar }: { inicial: string; enviando: boolean; enviar: (whats: string) => void }) {
  const [v, setV] = useState(formatarWhats(inicial));
  const [aceite, setAceite] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const digitos = v.replace(/\D/g, "");
  const valido = /^[1-9]{2}9?\d{8}$/.test(digitos);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valido && aceite) enviar(`55${digitos}`);
      }}
      className="flex max-w-[560px] flex-col gap-5"
    >
      <input ref={ref} value={v} onChange={(e) => setV(formatarWhats(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" autoComplete="tel" className={estiloCampo} />
      <label className="flex cursor-pointer items-start gap-3 text-[13.5px] text-muted">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#5b7bff]" />
        <span>Autorizo a Vertente Digital a usar esses dados para gerar meu diagnóstico e entrar em contato pelo WhatsApp. Não compartilhamos com terceiros.</span>
      </label>
      <div>
        <Botao tipo="submit" disabled={!valido || !aceite || enviando}>
          {enviando ? "Gerando…" : "Gerar meu diagnóstico"} {!enviando && <ArrowRight size={18} />}
        </Botao>
      </div>
    </form>
  );
}

function TelaCorte({ nome, linkConteudo }: { nome: string; linkConteudo: string | null }) {
  return (
    <div className="diag-pergunta max-w-[600px]">
      <h1 className="text-[26px] font-bold leading-tight sm:text-[32px]">Obrigado pelo interesse{nome ? `, ${nome}` : ""}!</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-muted">
        Neste momento, a Vertente trabalha com empresas que querem escalar e já têm uma verba mensal separada para isso, a partir de R$1.500 em anúncios. É o que permite gerar resultado de verdade, com testes, otimização e acompanhamento.
      </p>
      {linkConteudo ? (
        <>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">Enquanto isso, separamos um conteúdo gratuito para você estruturar o digital da sua empresa.</p>
          <a href={linkConteudo} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[16px] font-bold text-accent-fg hover:brightness-110">
            Acessar o conteúdo gratuito <ExternalLink size={17} />
          </a>
        </>
      ) : null}
      <p className="mt-6 text-[16px] text-fg">Quando estiver nesse momento, vai ser um prazer conversar.</p>
    </div>
  );
}

function TelaPronto({ nome, empresa, google, linkWhats }: { nome: string; empresa?: string; google: PerfilGoogle | null; linkWhats: string | null }) {
  return (
    <div className="diag-pergunta max-w-[620px]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1 text-[12.5px] font-semibold text-ok">
        <Check size={14} /> Recebemos tudo
      </span>
      <h1 className="mt-4 text-[26px] font-bold leading-tight sm:text-[32px]">Pronto{nome ? `, ${nome}` : ""}! O diagnóstico da {empresa || "sua empresa"} está a caminho.</h1>
      <p className="mt-3 text-[16px] text-muted">Nossa análise cruza sua ficha no Google, seu site e seu Instagram. Você recebe o diagnóstico com o plano de execução no WhatsApp que informou.</p>
      {google && (
        <div className="mt-6">
          <div className="eyebrow mb-2">Ficha analisada</div>
          <CartaoGoogle p={google} destaque />
        </div>
      )}
      <div className="mt-8 rounded-2xl border border-line-forte bg-surface/70 p-5">
        <h2 className="text-[18px] font-bold">Quer o plano executado por especialistas?</h2>
        <p className="mt-1 text-[14.5px] text-muted">Agende uma conversa com a Vertente: mostramos o diagnóstico e como colocamos cada ponto em prática.</p>
        {linkWhats ? (
          <a href={linkWhats} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] px-6 py-3.5 text-[16px] font-bold text-[#06371b] hover:brightness-105 sm:w-auto">
            <MessageCircle size={19} /> Falar com a Vertente no WhatsApp
          </a>
        ) : (
          <p className="mt-3 text-[14px] text-muted">Nossa equipe vai te chamar no WhatsApp em breve.</p>
        )}
      </div>
    </div>
  );
}
