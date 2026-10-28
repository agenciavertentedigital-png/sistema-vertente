import { useMemo, useState } from "react";
import { Activity, ArrowRight, MessageCircle } from "lucide-react";
import { useDados } from "../../lib/dados";
import { useTrafego } from "../../lib/trafego";
import { useTabela } from "../../lib/tabela";
import { hoje, somarDias, TIPO_REGISTRO } from "../../lib/tipos";
import { CAMPOS_LANCAMENTO, type Lancamento } from "../../lib/financeiro";
import { CAMPOS_POST, type Post } from "../../lib/social";
import { calcularSaude, PESOS, type Fator, type SaudeCliente } from "../../lib/saude";
import { useGmn } from "../gmn/GoogleMeuNegocio";
import { demoLancamentos, demoPosts } from "../../data/modulosDemo";
import { Vazio } from "../../components/ui";
import { Abas, Anel, Cabecalho, Kpi, Selo } from "../../components/visual";

type Aba = "projetos" | "projetos-pilares" | "projetos-cs";
const corNota = (n: number | null) => (n === null ? "var(--muted)" : n >= 75 ? "var(--ok)" : n >= 50 ? "var(--warn)" : "var(--bad)");

export function GestorProjetos({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const d = useDados();
  const aba = (["projetos-pilares", "projetos-cs"].includes(rota) ? rota : "projetos") as Aba;
  const trafego = useTrafego();
  const gmn = useGmn();
  const lanc = useTabela<Lancamento>("lancamentos", CAMPOS_LANCAMENTO, demoLancamentos, { desde: { coluna: "competencia", valor: somarDias(hoje(), -120) } });
  const posts = useTabela<Post>("posts", CAMPOS_POST, demoPosts, { desde: { coluna: "data", valor: somarDias(hoje(), -120) }, ordem: { coluna: "data" } });
  const [filtro, setFiltro] = useState<"todos" | "risco" | "atencao" | "bem">("todos");

  const saude = useMemo<SaudeCliente[]>(
    () =>
      d.clientes
        .filter((c) => c.nome !== "Agência Vertente Digital")
        .map((c) =>
          calcularSaude(c.id, {
            tarefas: d.tarefas,
            registros: d.registros,
            contas: trafego.contas,
            dias: trafego.dias,
            lancamentos: lanc.erro ? null : lanc.linhas.map((l) => ({ ...l, valor: Number(l.valor) })),
            perfis: gmn.perfis.linhas,
            analises: gmn.historico,
            posts: posts.linhas,
          }),
        )
        .sort((a, b) => a.nota - b.nota),
    [d.clientes, d.tarefas, d.registros, trafego.contas, trafego.dias, lanc.linhas, lanc.erro, gmn.perfis.linhas, gmn.historico, posts.linhas],
  );

  const media = saude.length ? Math.round(saude.reduce((s, x) => s + x.nota, 0) / saude.length) : null;
  const risco = saude.filter((s) => s.nota < 50);
  const atencao = saude.filter((s) => s.nota >= 50 && s.nota < 75);
  const bem = saude.filter((s) => s.nota >= 75);
  const vis = filtro === "risco" ? risco : filtro === "atencao" ? atencao : filtro === "bem" ? bem : saude;
  const carregando = d.carregando || trafego.carregando || gmn.perfis.carregando;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <Cabecalho icone={Activity} rotulo="Fase 6 · Gerencial" titulo="Gestor de Projetos" descricao="Saúde de cada cliente calculada com entregas, tráfego, relacionamento, financeiro, GMN e social media." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 lg:col-span-1" style={{ boxShadow: "var(--sombra)" }}>
          <Anel nota={media} tamanho={64} />
          <div>
            <div className="text-[12px] text-muted">Saúde da carteira</div>
            <div className="text-[14px] font-semibold">{saude.length} clientes</div>
          </div>
        </div>
        <Kpi rotulo="Em risco" valor={risco.length} tom={risco.length ? "bad" : "ok"} detalhe="nota abaixo de 50" onClick={() => setFiltro(filtro === "risco" ? "todos" : "risco")} ativo={filtro === "risco"} />
        <Kpi rotulo="Pedem atenção" valor={atencao.length} tom={atencao.length ? "warn" : "ok"} detalhe="entre 50 e 74" onClick={() => setFiltro(filtro === "atencao" ? "todos" : "atencao")} ativo={filtro === "atencao"} />
        <Kpi rotulo="Saudáveis" valor={bem.length} tom="ok" detalhe="75 ou mais" onClick={() => setFiltro(filtro === "bem" ? "todos" : "bem")} ativo={filtro === "bem"} />
      </div>
      <Abas<Aba> abas={[{ id: "projetos", nome: "Saúde dos clientes" }, { id: "projetos-pilares", nome: "Visão por pilar" }, { id: "projetos-cs", nome: "Fluxo de CS" }]} ativa={aba} mudar={ir} />
      {carregando ? (
        <Vazio>Carregando…</Vazio>
      ) : aba === "projetos" ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {vis.map((s) => <CartaoSaude key={s.clienteId} s={s} abrir={() => ir(`cliente-${s.clienteId}`)} />)}
        </div>
      ) : aba === "projetos-pilares" ? (
        <Pilares saude={saude} />
      ) : (
        <FluxoCS saude={saude} ir={ir} />
      )}
    </div>
  );
}

function CartaoSaude({ s, abrir }: { s: SaudeCliente; abrir: () => void }) {
  const d = useDados();
  return (
    <button onClick={abrir} className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent" style={{ boxShadow: "var(--sombra)" }}>
      <div className="flex items-center gap-3">
        <Anel nota={s.nota} tamanho={54} espessura={6} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{d.cliente(s.clienteId)?.nome}</div>
          {s.pior ? (
            <div className="text-[12.5px]" style={{ color: corNota(s.pior.nota) }}>
              O que mais pesa: <b>{s.pior.nome}</b> · {s.pior.motivo}
            </div>
          ) : (
            <div className="text-[12.5px] text-ok">Tudo em ordem</div>
          )}
        </div>
        <ArrowRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
        {s.fatores.map((f) => <BarraFator key={f.id} f={f} />)}
      </div>
    </button>
  );
}

function BarraFator({ f }: { f: Fator }) {
  return (
    <div title={`${f.nome}: ${f.motivo}`} className="min-w-0">
      <div className="truncate text-[10.5px] text-muted">{f.nome.replace("Google Meu Negócio", "GMN").replace("Entregas no prazo", "Entregas")}</div>
      <div className="mt-1 h-1.5 rounded-full bg-raised">
        {f.nota !== null && <div className="h-1.5 rounded-full" style={{ width: `${f.nota}%`, background: corNota(f.nota) }} />}
      </div>
      <div className="num mt-0.5 text-[11px] font-medium" style={{ color: corNota(f.nota) }}>{f.nota === null ? "—" : f.nota}</div>
    </div>
  );
}

function Pilares({ saude }: { saude: SaudeCliente[] }) {
  const d = useDados();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {(Object.keys(PESOS) as Fator["id"][]).map((id) => {
        const itens = saude.map((s) => ({ s, f: s.fatores.find((x) => x.id === id)! })).filter((x) => x.f.nota !== null).sort((a, b) => (a.f.nota ?? 0) - (b.f.nota ?? 0));
        const media = itens.length ? Math.round(itens.reduce((t, x) => t + (x.f.nota ?? 0), 0) / itens.length) : null;
        return (
          <section key={id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <Anel nota={media} tamanho={48} espessura={5} />
              <div>
                <h2 className="text-[15px] font-semibold">{PESOS[id].nome}</h2>
                <div className="text-[12px] text-muted">{itens.length} clientes · peso {PESOS[id].peso}%</div>
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {itens.slice(0, 6).map(({ s, f }) => (
                <li key={s.clienteId} className="flex items-center gap-2 text-[12.5px]">
                  <span className="num w-7 text-right font-semibold" style={{ color: corNota(f.nota) }}>{f.nota}</span>
                  <span className="min-w-0 flex-1 truncate">{d.cliente(s.clienteId)?.nome}</span>
                  <span className="max-w-[45%] truncate text-[11.5px] text-muted">{f.motivo}</span>
                </li>
              ))}
              {!itens.length && <li className="text-[12.5px] text-muted">Nenhum cliente com dados neste pilar ainda.</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function FluxoCS({ saude, ir }: { saude: SaudeCliente[]; ir: (r: string) => void }) {
  const d = useDados();
  const linhas = saude
    .map((s) => {
      const regs = d.registros.filter((r) => r.cliente_id === s.clienteId).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
      const reuniao = regs.find((r) => r.tipo === "reuniao");
      return { s, ultimo: regs[0], reuniao, rel: s.fatores.find((f) => f.id === "relacionamento")! };
    })
    .sort((a, b) => (a.rel.nota ?? 0) - (b.rel.nota ?? 0));
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-[15px] font-semibold">Quem está há mais tempo sem contato</h2>
      <p className="text-[12px] text-muted">Use o Registro rápido na tela do cliente para marcar reuniões, notas e decisões. A nota de relacionamento sobe na hora.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="text-left text-[11.5px] text-muted">
              <th className="py-2 font-medium">Cliente</th>
              <th className="py-2 font-medium">Saúde</th>
              <th className="py-2 font-medium">Último registro</th>
              <th className="py-2 font-medium">Última reunião</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {linhas.map(({ s, ultimo, reuniao, rel }) => (
              <tr key={s.clienteId}>
                <td className="py-2.5 font-medium">{d.cliente(s.clienteId)?.nome}</td>
                <td className="py-2.5"><Selo cor={corNota(s.nota)}>{s.nota}</Selo></td>
                <td className="py-2.5">
                  <span style={{ color: corNota(rel.nota) }}>{rel.motivo}</span>
                  {ultimo && <span className="text-muted"> · {TIPO_REGISTRO[ultimo.tipo]}</span>}
                </td>
                <td className="py-2.5 text-muted">{reuniao ? `${reuniao.data.slice(8, 10)}/${reuniao.data.slice(5, 7)}` : "—"}</td>
                <td className="py-2.5 text-right">
                  <button onClick={() => ir(`cliente-${s.clienteId}`)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[12px] hover:border-accent">
                    <MessageCircle size={13} /> Registrar contato
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
