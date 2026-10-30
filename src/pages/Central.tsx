import { useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, CircleAlert, LogOut, Moon, Plug, Sparkles, Sun } from "lucide-react";
import { useDados } from "../lib/dados";
import { useTrafego } from "../lib/trafego";
import { moedaBR, useTabela } from "../lib/tabela";
import { atrasada, hoje, somarDias, STATUS_ABERTOS } from "../lib/tipos";
import { CAMPOS_POST, type Post } from "../lib/social";
import { CAMPOS_LANCAMENTO, situacao, type Lancamento } from "../lib/financeiro";
import { useFichas } from "../lib/cadastro";
import { useGmn } from "./gmn/GoogleMeuNegocio";
import { useBriefings } from "../lib/briefing";
import { demoLancamentos, demoPosts } from "../data/modulosDemo";
import { SECOES, type Topico } from "../data/navegacao";
import { Marca } from "../components/Marca";
import { Sininho } from "../components/Sininho";

interface Props {
  ir: (r: string) => void;
  tema: "light" | "dark";
  alternarTema: () => void;
  usuario: { nome: string; papel: string };
  onSair?: () => void;
}

/** Central: tela inicial em tela cheia, com o resumo da operação e os tópicos do sistema. */
export function Central({ ir, tema, alternarTema, usuario, onSair }: Props) {
  const d = useDados();
  const trafego = useTrafego();
  const gmn = useGmn();
  const fichas = useFichas();
  const briefings = useBriefings();
  const posts = useTabela<Post>("posts", CAMPOS_POST, demoPosts, { desde: { coluna: "data", valor: somarDias(hoje(), -40) }, ordem: { coluna: "data" } });
  const lanc = useTabela<Lancamento>("lancamentos", CAMPOS_LANCAMENTO, demoLancamentos, { desde: { coluna: "competencia", valor: somarDias(hoje(), -120) } });
  const [pergunta, setPergunta] = useState("");

  const h = hoje();
  const abertas = d.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status));
  const minhasHoje = abertas.filter((t) => t.prazo === h && (!d.eu || t.responsavel_id === d.eu)).length;
  const deHoje = abertas.filter((t) => t.prazo === h).length;
  const atrasadas = abertas.filter(atrasada).length;
  const ontem = somarDias(h, -1);
  const gastoOntem = trafego.dias.filter((x) => x.data === ontem).reduce((s, x) => s + x.gasto, 0);
  const contatosOntem = trafego.dias.filter((x) => x.data === ontem).reduce((s, x) => s + x.conversas + x.leads, 0);
  const contasProblema = trafego.contas.filter((c) => c.ativa && c.status && c.status !== "ativa").length;
  const notasGmn = gmn.perfis.linhas.filter((p) => p.cliente_id).map((p) => gmn.historico(p.id)[0]?.nota).filter((n): n is number => n !== undefined);
  const mediaGmn = notasGmn.length ? Math.round(notasGmn.reduce((s, n) => s + n, 0) / notasGmn.length) : null;
  const postsAprovacao = posts.linhas.filter((p) => p.status === "aprovacao" || p.status === "ajuste").length;
  const postsSemana = posts.linhas.filter((p) => p.data >= h && p.data <= somarDias(h, 6)).length;
  const postsAtrasados = posts.linhas.filter((p) => p.data < h && p.status !== "publicado").length;
  const ativos = fichas.fichas.filter((f) => f.status === "ativo");
  const mrr = ativos.reduce((s, f) => s + fichas.mensalidade(f.id), 0);
  const emAtraso = lanc.erro ? null : lanc.linhas.filter((l) => l.tipo === "receita" && situacao(l) === "atrasado").reduce((s, l) => s + Number(l.valor), 0);
  const semBriefing = ativos.filter((f) => !briefings.linhas.some((b) => b.cliente_id === f.id && Object.values(b.campos ?? {}).some((v) => String(v).trim()))).length;
  const entrada = abertas.filter((t) => t.triagem).length;

  const resumo = [
    { rotulo: "Minhas tarefas hoje", valor: String(minhasHoje), rota: "clientes" },
    { rotulo: "Atrasadas no time", valor: String(atrasadas), rota: "clientes", alerta: atrasadas > 0 },
    { rotulo: "Investido ontem", valor: moedaBR(gastoOntem, 0), rota: "trafego" },
    { rotulo: "Contatos ontem", valor: String(Math.round(contatosOntem)), rota: "trafego" },
    { rotulo: "Posts com o cliente", valor: String(postsAprovacao), rota: "social-aprovacao", alerta: postsAprovacao > 0 },
    { rotulo: "MRR", valor: mrr ? moedaBR(mrr, 0) : "—", rota: "financeiro" },
  ];

  const alertas: { texto: string; rota: string }[] = [];
  if (contasProblema) alertas.push({ texto: `${contasProblema} conta${contasProblema > 1 ? "s" : ""} de anúncio com problema`, rota: "trafego-saude" });
  if (postsAtrasados) alertas.push({ texto: `${postsAtrasados} post${postsAtrasados > 1 ? "s" : ""} atrasado${postsAtrasados > 1 ? "s" : ""}`, rota: "social-quadro" });
  if (emAtraso) alertas.push({ texto: `${moedaBR(emAtraso, 0)} em mensalidades atrasadas`, rota: "financeiro-receber" });

  // Uma linha viva por tópico
  const linha: Record<string, string> = {
    clientes: `${abertas.length} abertas · ${deHoje} para hoje${entrada ? ` · ${entrada} na caixa` : ""}`,
    anotacoes: semBriefing ? `${semBriefing} cliente${semBriefing > 1 ? "s" : ""} sem briefing` : "Briefings em dia",
    cadastro: `${ativos.length} clientes ativos`,
    trafego: `${moedaBR(gastoOntem, 0)} ontem · ${Math.round(contatosOntem)} contatos`,
    gmn: mediaGmn === null ? "Analise a primeira ficha" : `Nota média ${mediaGmn}`,
    social: `${postsSemana} posts em 7 dias`,
    crm: "Abrir o CRM",
    financeiro: mrr ? `MRR ${moedaBR(mrr, 0)}` : "Cadastre as mensalidades",
    projetos: "Saúde de cada cliente",
    reuniao: "Pauta pronta para hoje",
  };

  function perguntar(e: FormEvent) {
    e.preventDefault();
    try {
      if (pergunta.trim()) sessionStorage.setItem("vertente.pergunta", pergunta.trim());
    } catch {
      /* sem armazenamento */
    }
    ir("assistente");
  }

  const dataTxt = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
  const data = dataTxt.charAt(0).toUpperCase() + dataTxt.slice(1);

  return (
    <div className="min-h-full bg-bg">
      {/* Barra do topo */}
      <header className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-[max(16px,env(safe-area-inset-left,0px))] pt-5 sm:px-8">
        <Marca />
        <div className="flex items-center gap-1">
          <Sininho ir={ir} compacto />
          <button onClick={() => ir("integracoes")} className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg" aria-label="Integrações" title="Integrações"><Plug size={17} /></button>
          <button onClick={alternarTema} className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg" aria-label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}>
            {tema === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <span className="mx-1 hidden h-8 w-8 place-items-center rounded-full bg-accent text-[12px] font-semibold text-accent-fg sm:grid" title={`${usuario.nome} · ${usuario.papel}`}>
            {usuario.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          {onSair && <button onClick={onSair} className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg" aria-label="Sair" title="Sair"><LogOut size={17} /></button>}
        </div>
      </header>

      <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-[max(16px,env(safe-area-inset-left,0px))] pb-24 pt-8 sm:px-8">
        {/* Data + resumo */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted">Resumo da operação</div>
              <h1 className="mt-1 text-[26px] font-semibold leading-tight sm:text-[30px]">{data}</h1>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {alertas.map((a) => (
                <button key={a.texto} onClick={() => ir(a.rota)} className="flex items-center gap-1.5 rounded-full bg-bad-soft px-3 py-1.5 text-[12px] font-medium text-bad transition-transform hover:-translate-y-0.5">
                  <CircleAlert size={13} /> {a.texto}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-3 lg:grid-cols-6" style={{ boxShadow: "var(--sombra)" }}>
            {resumo.map((r, i) => (
              <button
                key={r.rotulo}
                onClick={() => ir(r.rota)}
                className={`group flex flex-col gap-0.5 px-4 py-3.5 text-left transition-colors hover:bg-accent-soft/60 ${i ? "border-line lg:border-l" : ""} ${i % 2 ? "border-l sm:border-l-0" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i >= 3 ? "sm:border-t lg:border-t-0" : ""} ${i % 3 ? "sm:border-l" : ""}`}
              >
                <span className="text-[11.5px] text-muted">{r.rotulo}</span>
                <span className={`num text-[20px] font-semibold ${r.alerta ? "text-bad" : ""}`}>{r.valor}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Assistente */}
        <form onSubmit={perguntar} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-all focus-within:border-accent hover:border-accent/50" style={{ boxShadow: "var(--sombra)" }}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#2f54eb] to-[#0b1450] text-white"><Sparkles size={17} /></span>
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Pergunte ao Assistente… ex.: quais clientes gastaram mais ontem?"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-muted"
          />
          <button type="submit" className="flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-[13px] font-medium text-accent-fg transition-opacity hover:opacity-90">
            Perguntar <ArrowRight size={14} />
          </button>
        </form>

        {/* Tópicos */}
        {SECOES.map((s) => (
          <section key={s.id} className="flex flex-col gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">{s.nome}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {s.topicos.map((t) => <CartaoTopico key={t.id} t={t} linha={linha[t.id] ?? t.descricao} ir={ir} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CartaoTopico({ t, linha, ir }: { t: Topico; linha: string; ir: (r: string) => void }) {
  const Icone = t.icone;
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => ir(t.rota)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), ir(t.rota))}
      className="group relative flex min-h-[150px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-surface p-4 outline-none transition-all duration-200 hover:-translate-y-1 hover:border-transparent focus-visible:ring-2 focus-visible:ring-accent"
      style={{ boxShadow: "var(--sombra)", ["--cor" as string]: t.cor }}
    >
      {/* brilho na cor do tópico ao passar o mouse */}
      <span className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ boxShadow: `inset 0 0 0 1.5px ${t.cor}, 0 12px 32px -12px ${t.cor}66` }} />
      <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.07] transition-transform duration-300 group-hover:scale-150" style={{ background: t.cor }} />
      <div className="relative flex items-start justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-xl text-white transition-transform duration-200 group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${t.cor}, #0b1450)` }}>
          <Icone size={20} />
        </span>
        <ArrowUpRight size={18} className="text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" style={{ color: t.cor }} />
      </div>
      <div className="relative mt-3">
        <div className="text-[15.5px] font-semibold">{t.nome}</div>
        <div className="mt-0.5 text-[12.5px] text-muted">{linha}</div>
      </div>
      {t.atalhos.length > 0 && (
        <div className="relative mt-auto flex flex-wrap gap-1 pt-3 opacity-60 transition-opacity duration-200 group-hover:opacity-100">
          {t.atalhos.map((a) => (
            <button
              key={a.rota}
              onClick={(e) => { e.stopPropagation(); ir(a.rota); }}
              className="rounded-full border border-line px-2 py-0.5 text-[11.5px] text-muted transition-colors hover:border-transparent hover:text-white"
              onMouseEnter={(e) => (e.currentTarget.style.background = t.cor)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              {a.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
