import type { ReactNode } from "react";
import { ChevronRight, LogOut, Moon, Plug, Search, Sun } from "lucide-react";
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
  abrirComando: () => void;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Central: ponto de partida do dia. O que pede atenção, o seu dia e todas as áreas, sem menu lateral. */
export function Central({ ir, tema, alternarTema, usuario, onSair, abrirComando }: Props) {
  const d = useDados();
  const trafego = useTrafego();
  const gmn = useGmn();
  const fichas = useFichas();
  const briefings = useBriefings();
  const posts = useTabela<Post>("posts", CAMPOS_POST, demoPosts, { desde: { coluna: "data", valor: somarDias(hoje(), -40) }, ordem: { coluna: "data" } });
  const lanc = useTabela<Lancamento>("lancamentos", CAMPOS_LANCAMENTO, demoLancamentos, { desde: { coluna: "competencia", valor: somarDias(hoje(), -120) } });

  const h = hoje();
  const abertas = d.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status));
  const minhasHoje = abertas.filter((t) => t.prazo === h && (!d.eu || t.responsavel_id === d.eu));
  const deHoje = abertas.filter((t) => t.prazo === h).length;
  const atrasadas = abertas.filter(atrasada);
  const ontem = somarDias(h, -1);
  const gastoOntem = trafego.dias.filter((x) => x.data === ontem).reduce((s, x) => s + x.gasto, 0);
  const contatosOntem = trafego.dias.filter((x) => x.data === ontem).reduce((s, x) => s + x.conversas + x.leads, 0);
  const contasProblema = trafego.contas.filter((c) => c.ativa && c.status && c.status !== "ativa").length;
  const ultimaSync = trafego.contas.map((c) => c.ultimo_sync).filter(Boolean).sort().pop() ?? null;
  const notasGmn = gmn.perfis.linhas.filter((p) => p.cliente_id).map((p) => gmn.historico(p.id)[0]?.nota).filter((n): n is number => n !== undefined);
  const mediaGmn = notasGmn.length ? Math.round(notasGmn.reduce((s, n) => s + n, 0) / notasGmn.length) : null;
  const postsAprovacao = posts.linhas.filter((p) => p.status === "aprovacao" || p.status === "ajuste").length;
  const postsSemana = posts.linhas.filter((p) => p.data >= h && p.data <= somarDias(h, 6)).length;
  const postsAtrasados = posts.linhas.filter((p) => p.data < h && p.status !== "publicado").length;
  const ativos = fichas.fichas.filter((f) => f.status === "ativo");
  const mrr = ativos.reduce((s, f) => s + fichas.mensalidade(f.id), 0);
  const emAtraso = lanc.erro ? 0 : lanc.linhas.filter((l) => l.tipo === "receita" && situacao(l) === "atrasado").reduce((s, l) => s + Number(l.valor), 0);
  const semBriefing = ativos.filter((f) => !briefings.linhas.some((b) => b.cliente_id === f.id && Object.values(b.campos ?? {}).some((v) => String(v).trim()))).length;
  const entrada = abertas.filter((t) => t.triagem).length;

  // O que pede atenção, do mais grave para o menos
  const atencao: { tom: "bad" | "warn"; texto: string; rota: string }[] = [];
  if (atrasadas.length) atencao.push({ tom: "bad", texto: `${plural(atrasadas.length, "tarefa atrasada", "tarefas atrasadas")} no time`, rota: "clientes" });
  if (contasProblema) atencao.push({ tom: "bad", texto: `${plural(contasProblema, "conta de anúncio", "contas de anúncio")} com problema`, rota: "trafego-saude" });
  if (emAtraso) atencao.push({ tom: "bad", texto: `${moedaBR(emAtraso, 0)} em mensalidades atrasadas`, rota: "financeiro-receber" });
  if (postsAtrasados) atencao.push({ tom: "warn", texto: `${plural(postsAtrasados, "post atrasado", "posts atrasados")}`, rota: "social-quadro" });
  if (postsAprovacao) atencao.push({ tom: "warn", texto: `${plural(postsAprovacao, "post esperando", "posts esperando")} o cliente aprovar`, rota: "social-aprovacao" });
  if (entrada) atencao.push({ tom: "warn", texto: `${plural(entrada, "demanda", "demandas")} na caixa de entrada`, rota: "clientes-entrada" });
  if (semBriefing) atencao.push({ tom: "warn", texto: `${plural(semBriefing, "cliente", "clientes")} sem briefing`, rota: "anotacoes-briefings" });

  const graves = atencao.filter((a) => a.tom === "bad").length;
  const frase =
    atencao.length === 0
      ? "Tudo em dia. Nenhuma pendência na operação."
      : graves
        ? `${graves === 1 ? "Uma coisa pede" : `${graves} coisas pedem`} atenção agora${atencao.length > graves ? `, e ${atencao.length - graves} podem esperar um pouco` : ""}.`
        : `Nada urgente. ${plural(atencao.length, "item pode", "itens podem")} ser resolvido${atencao.length > 1 ? "s" : ""} hoje.`;

  const numeros = [
    { rotulo: "Suas tarefas hoje", valor: String(minhasHoje.length), rota: "clientes" },
    { rotulo: "Investido ontem", valor: moedaBR(gastoOntem, 0), rota: "trafego" },
    { rotulo: "Contatos ontem", valor: String(Math.round(contatosOntem)), rota: "trafego" },
    { rotulo: "Custo por contato", valor: contatosOntem ? moedaBR(gastoOntem / contatosOntem) : "—", rota: "trafego" },
    { rotulo: "Clientes ativos", valor: String(ativos.length), rota: "clientes-carteira" },
    { rotulo: "MRR", valor: mrr ? moedaBR(mrr, 0) : "—", rota: "financeiro" },
  ];

  const linha: Record<string, string> = {
    clientes: `${abertas.length} abertas · ${deHoje} hoje`,
    anotacoes: semBriefing ? `${semBriefing} sem briefing` : "Em dia",
    cadastro: `${ativos.length} ativos`,
    trafego: gastoOntem ? `${moedaBR(gastoOntem, 0)} ontem` : "Sem gasto ontem",
    gmn: mediaGmn === null ? "Sem análise" : `Nota ${mediaGmn}`,
    social: `${postsSemana} na semana`,
    crm: "Atendimento",
    financeiro: mrr ? `MRR ${moedaBR(mrr, 0)}` : "—",
    projetos: "Saúde dos clientes",
    reuniao: "Pauta pronta",
  };

  const dataTxt = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
  const data = dataTxt.charAt(0).toUpperCase() + dataTxt.slice(1);
  const horaSync = ultimaSync ? new Date(ultimaSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null;
  const iniciais = usuario.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-full">
      {/* Barra do topo: marca, busca e conta */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-3 px-[max(16px,env(safe-area-inset-left,0px))] sm:px-8">
          <span className="shrink-0 sm:hidden"><Marca compacta /></span>
          <span className="hidden shrink-0 sm:block"><Marca /></span>
          <button
            onClick={abrirComando}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] text-muted hover:border-line-forte hover:text-fg sm:ml-8 sm:mr-auto sm:max-w-[340px]"
          >
            <Search size={15} strokeWidth={1.8} />
            <span className="flex-1 truncate text-left"><span className="sm:hidden">Buscar</span><span className="hidden sm:inline">Buscar, abrir cliente ou perguntar à IA</span></span>
            <kbd className="hidden sm:inline">Ctrl K</kbd>
          </button>
          <div className="flex shrink-0 items-center">
            <Sininho ir={ir} compacto />
            <Icone rotulo="Integrações" onClick={() => ir("integracoes")}><Plug size={16} strokeWidth={1.8} /></Icone>
            <Icone rotulo={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"} onClick={alternarTema}>{tema === "dark" ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}</Icone>
            <span className="ml-1.5 hidden h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-bg sm:grid" style={{ background: "var(--marinho)" }} title={`${usuario.nome} · ${usuario.papel}`}>{iniciais}</span>
            {onSair && <Icone rotulo="Sair" onClick={onSair}><LogOut size={16} strokeWidth={1.8} /></Icone>}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1120px] flex-col gap-10 px-[max(16px,env(safe-area-inset-left,0px))] pb-20 pt-10 sm:px-8">
        {/* Abertura: data, frase do dia e estado da sincronização */}
        <section>
          <p className="text-[13px] font-medium text-muted">{data}</p>
          <h1 className="mt-2 max-w-[24ch] text-[30px] font-semibold leading-[1.15] sm:text-[38px]">{frase}</h1>
          <p className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
            <span className={`ponto-vivo inline-block h-1.5 w-1.5 rounded-full ${contasProblema ? "bg-warn" : "bg-ok"}`} />
            {horaSync ? `Meta sincronizado às ${horaSync}` : "Aguardando a primeira sincronização da Meta"}
          </p>
        </section>

        {/* Números do dia: uma régua só */}
        <section className="grid grid-cols-2 border-y border-line sm:grid-cols-3 lg:grid-cols-6">
          {numeros.map((n, i) => (
            <button
              key={n.rotulo}
              onClick={() => ir(n.rota)}
              className={`group flex flex-col gap-1 py-4 text-left hover:bg-surface sm:px-4 ${i % 2 ? "pl-4" : ""} ${i ? "lg:border-l lg:border-line" : "lg:pl-0"} ${i >= 2 ? "border-t border-line sm:border-t-0" : ""} ${i >= 3 ? "sm:border-t lg:border-t-0" : ""}`}
            >
              <span className="text-[12px] text-muted">{n.rotulo}</span>
              <span className="num text-[22px] font-semibold leading-none">{n.valor}</span>
            </button>
          ))}
        </section>

        {/* Atenção e o seu dia */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Bloco titulo="Pede atenção" contador={atencao.length}>
            {atencao.length === 0 ? (
              <p className="py-3 text-[13px] text-muted">Nada pendente. Bom momento para revisar as estratégias.</p>
            ) : (
              atencao.map((a) => (
                <Linha key={a.texto} onClick={() => ir(a.rota)}>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.tom === "bad" ? "bg-bad" : "bg-warn"}`} />
                  <span className="flex-1 truncate">{a.texto}</span>
                </Linha>
              ))
            )}
          </Bloco>
          <Bloco titulo="Seu dia" contador={minhasHoje.length}>
            {minhasHoje.length === 0 ? (
              <p className="py-3 text-[13px] text-muted">Nenhuma tarefa sua com prazo hoje.</p>
            ) : (
              minhasHoje.slice(0, 6).map((t) => (
                <Linha key={t.id} onClick={() => ir(`cliente-${t.cliente_id}`)}>
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-line-forte" />
                  <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                  <span className="hidden max-w-[40%] truncate text-[12px] text-muted sm:inline">{d.cliente(t.cliente_id)?.nome}</span>
                </Linha>
              ))
            )}
            {minhasHoje.length > 6 && <button onClick={() => ir("clientes")} className="mt-1 text-[12.5px] font-medium text-accent hover:underline">Ver todas as {minhasHoje.length}</button>}
          </Bloco>
        </section>

        {/* Áreas */}
        <section className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {SECOES.map((s) => (
            <div key={s.id}>
              <h2 className="mb-1.5 text-[13px] font-semibold text-muted">{s.nome}</h2>
              <div className="flex flex-col">
                {s.topicos.map((t) => <Area key={t.id} t={t} linha={linha[t.id] ?? ""} ir={ir} />)}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Icone({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg" aria-label={rotulo} title={rotulo}>
      {children}
    </button>
  );
}

function Bloco({ titulo, contador, children }: { titulo: string; contador: number; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-muted">
        {titulo}
        {contador > 0 && <span className="num rounded-full bg-raised px-1.5 text-[11px] text-fg">{contador}</span>}
      </h2>
      <div className="flex flex-col border-t border-line">{children}</div>
    </div>
  );
}

function Linha({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="group -mx-2 flex items-center gap-3 rounded-lg border-b border-line px-2 py-2.5 text-left text-[13.5px] last:border-b-0 hover:border-transparent hover:bg-surface">
      {children}
      <ChevronRight size={15} className="shrink-0 text-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
    </button>
  );
}

/** Uma área do sistema. Ao passar o mouse, mostra os atalhos para as abas. */
function Area({ t, linha, ir }: { t: Topico; linha: string; ir: (r: string) => void }) {
  const Ic = t.icone;
  return (
    <div className="group -mx-2 rounded-xl px-2 py-1 hover:bg-surface hover:shadow-[0_0_0_1px_var(--line)]">
      <button onClick={() => ir(t.rota)} className="flex w-full items-center gap-3 py-1.5 text-left">
        <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface text-muted transition-colors group-hover:border-transparent group-hover:text-white">
          <span className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: t.cor }} />
          <Ic size={16} strokeWidth={1.8} className="relative" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{t.nome}</span>
          <span className="block truncate text-[12px] text-muted">{linha}</span>
        </span>
        <ChevronRight size={15} className="shrink-0 text-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      </button>
      {t.atalhos.length > 1 && (
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 group-focus-within:grid-rows-[1fr] group-hover:grid-rows-[1fr]">
          <div className="flex flex-wrap gap-1 overflow-hidden pl-11">
            {t.atalhos.slice(1).map((a) => (
              <button key={a.rota} onClick={() => ir(a.rota)} className="mb-1.5 rounded-md px-1.5 py-0.5 text-[12px] text-muted hover:bg-raised hover:text-fg">
                {a.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
