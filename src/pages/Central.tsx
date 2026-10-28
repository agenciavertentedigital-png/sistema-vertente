import { ArrowRight, CalendarDays, CircleAlert, ListTodo, MapPin, TrendingUp, Wallet } from "lucide-react";
import { GRUPOS, MODULOS } from "../data/modulos";
import { useDados } from "../lib/dados";
import { useTrafego } from "../lib/trafego";
import { moedaBR, useTabela } from "../lib/tabela";
import { atrasada, hoje, somarDias, STATUS_ABERTOS } from "../lib/tipos";
import { CAMPOS_POST, type Post } from "../lib/social";
import { CAMPOS_LANCAMENTO, situacao, type Lancamento } from "../lib/financeiro";
import { useFichas } from "../lib/cadastro";
import { useGmn } from "./gmn/GoogleMeuNegocio";
import { demoLancamentos, demoPosts } from "../data/modulosDemo";
import { Kpi } from "../components/visual";

function saudacao() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function Central({ ir }: { ir: (r: string) => void }) {
  const d = useDados();
  const trafego = useTrafego();
  const gmn = useGmn();
  const fichas = useFichas();
  const posts = useTabela<Post>("posts", CAMPOS_POST, demoPosts, { desde: { coluna: "data", valor: somarDias(hoje(), -40) }, ordem: { coluna: "data" } });
  const lanc = useTabela<Lancamento>("lancamentos", CAMPOS_LANCAMENTO, demoLancamentos, { desde: { coluna: "competencia", valor: somarDias(hoje(), -120) } });

  const h = hoje();
  const eu = d.membro(d.eu)?.nome?.split(" ")[0];
  const abertas = d.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status));
  const deHoje = abertas.filter((t) => t.prazo === h).length;
  const atrasadas = abertas.filter(atrasada).length;
  const ontem = somarDias(h, -1);
  const gastoOntem = trafego.dias.filter((x) => x.data === ontem).reduce((s, x) => s + x.gasto, 0);
  const contatosOntem = trafego.dias.filter((x) => x.data === ontem).reduce((s, x) => s + x.conversas + x.leads, 0);
  const contasProblema = trafego.contas.filter((c) => c.ativa && c.status && c.status !== "ativa").length;
  const notas = gmn.perfis.linhas.filter((p) => p.cliente_id).map((p) => gmn.historico(p.id)[0]?.nota).filter((n): n is number => n !== undefined);
  const mediaGmn = notas.length ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length) : null;
  const postsAprovacao = posts.linhas.filter((p) => p.status === "aprovacao" || p.status === "ajuste").length;
  const postsAtrasados = posts.linhas.filter((p) => p.data < h && p.status !== "publicado").length;
  const mrr = fichas.fichas.filter((f) => f.status === "ativo").reduce((s, f) => s + fichas.mensalidade(f.id), 0);
  const emAtraso = lanc.erro ? null : lanc.linhas.filter((l) => l.tipo === "receita" && situacao(l) === "atrasado").reduce((s, l) => s + Number(l.valor), 0);

  const alertas: { texto: string; rota: string }[] = [];
  if (atrasadas) alertas.push({ texto: `${atrasadas} tarefa${atrasadas > 1 ? "s" : ""} atrasada${atrasadas > 1 ? "s" : ""}`, rota: "clientes" });
  if (contasProblema) alertas.push({ texto: `${contasProblema} conta${contasProblema > 1 ? "s" : ""} de anúncio com problema`, rota: "trafego" });
  if (postsAtrasados) alertas.push({ texto: `${postsAtrasados} post${postsAtrasados > 1 ? "s" : ""} atrasado${postsAtrasados > 1 ? "s" : ""}`, rota: "social-quadro" });
  if (emAtraso) alertas.push({ texto: `${moedaBR(emAtraso, 0)} em mensalidades atrasadas`, rota: "financeiro-receber" });

  const resumo: Record<string, string> = {
    clientes: `${abertas.length} tarefas abertas · ${deHoje} para hoje`,
    trafego: `${moedaBR(gastoOntem, 0)} investidos ontem · ${Math.round(contatosOntem)} contatos`,
    gmn: mediaGmn === null ? "Cadastre os perfis e gere a primeira análise" : `Nota média ${mediaGmn} · ${gmn.perfis.linhas.filter((p) => p.cliente_id).length} perfis`,
    social: `${posts.linhas.filter((p) => p.data >= h && p.data <= somarDias(h, 6)).length} posts nos próximos 7 dias · ${postsAprovacao} com o cliente`,
    financeiro: mrr ? `MRR ${moedaBR(mrr, 0)}` : "Cadastre os valores das mensalidades",
    projetos: "Saúde de cada cliente e fluxo de CS",
    cadastro: `${fichas.fichas.filter((f) => f.status === "ativo").length} clientes ativos`,
    contratos: "Contratos gerados do modelo",
  };

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl px-6 py-7 text-white sm:px-8" style={{ background: "linear-gradient(120deg,#1d34a0 0%,#0d1850 55%,#060b2c 100%)" }}>
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[28px] border-white/[0.05]" />
        <div className="pointer-events-none absolute -bottom-28 right-40 h-56 w-56 rounded-full border-[20px] border-white/[0.04]" />
        <div className="relative">
          <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-white/60">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })}
          </div>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight sm:text-[34px]">{saudacao()}{eu ? `, ${eu}` : ""}!</h1>
          <p className="mt-1 max-w-[60ch] text-[14px] text-white/75">Aqui está o resumo da operação da Vertente agora.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {alertas.length === 0 ? (
              <span className="rounded-full bg-white/12 px-3 py-1.5 text-[12.5px]" style={{ background: "rgb(255 255 255 / .12)" }}>✓ Nenhum alerta no momento</span>
            ) : (
              alertas.map((a) => (
                <button key={a.texto} onClick={() => ir(a.rota)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-white/25" style={{ background: "rgb(255 255 255 / .14)" }}>
                  <CircleAlert size={14} className="text-[#ffb4a8]" /> {a.texto}
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icone={ListTodo} rotulo="Minhas tarefas hoje" valor={d.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status) && t.prazo === h && (!d.eu || t.responsavel_id === d.eu)).length} detalhe={`${atrasadas} atrasadas no time`} tom={atrasadas ? "warn" : "neutro"} onClick={() => ir("clientes")} />
        <Kpi icone={TrendingUp} rotulo="Investido ontem" valor={moedaBR(gastoOntem, 0)} detalhe={`${Math.round(contatosOntem)} contatos · ${contatosOntem ? moedaBR(gastoOntem / contatosOntem) : "—"} cada`} onClick={() => ir("trafego")} />
        <Kpi icone={MapPin} rotulo="Nota média GMN" valor={mediaGmn ?? "—"} tom={mediaGmn === null ? "neutro" : mediaGmn >= 75 ? "ok" : mediaGmn >= 50 ? "warn" : "bad"} onClick={() => ir("gmn")} />
        <Kpi icone={CalendarDays} rotulo="Posts com o cliente" valor={postsAprovacao} detalhe="aguardando aprovação" tom={postsAprovacao ? "warn" : "neutro"} onClick={() => ir("social-aprovacao")} />
        <Kpi icone={Wallet} rotulo="MRR contratado" valor={mrr ? moedaBR(mrr, 0) : "—"} detalhe={emAtraso ? `${moedaBR(emAtraso, 0)} em atraso` : "mensalidades em dia"} tom="accent" onClick={() => ir("financeiro")} />
      </div>

      {GRUPOS.map((g) => {
        const itens = MODULOS.filter((m) => m.grupo === g.id);
        const futuro = g.id === "futuro";
        return (
          <section key={g.id} className="flex flex-col gap-3">
            <h2 className="eyebrow">{g.nome}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {itens.map((m) => {
                const Icone = m.icone;
                return (
                  <button
                    key={m.id}
                    onClick={() => ir(m.id)}
                    className={`group flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all ${futuro ? "border-dashed border-line bg-transparent hover:bg-surface" : "border-line bg-surface hover:-translate-y-0.5 hover:border-accent"}`}
                    style={futuro ? undefined : { boxShadow: "var(--sombra)" }}
                  >
                    <span className={`grid h-10 w-10 place-items-center rounded-xl ${futuro ? "bg-raised text-muted" : "bg-gradient-to-br from-[#1d34a0] to-[#0b1450] text-white"}`}>
                      <Icone size={19} />
                    </span>
                    <div>
                      <div className="text-[15.5px] font-semibold">{m.nome}</div>
                      <p className="mt-1 text-[12.5px] leading-snug text-muted">{futuro ? m.resumo : resumo[m.id] ?? m.resumo}</p>
                    </div>
                    {!futuro && (
                      <span className="mt-auto flex items-center gap-1 text-[12.5px] font-medium text-accent">
                        Abrir <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
