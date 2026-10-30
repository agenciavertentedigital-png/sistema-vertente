import { useState } from "react";
import { Inbox, Plus, RefreshCw } from "lucide-react";
import { useDados } from "../../lib/dados";
import { repo } from "../../lib/repo";
import {
  ORDEM_PRIORIDADE,
  PILAR,
  PILARES,
  STATUS_ABERTOS,
  atrasada,
  hoje,
  type Pilar,
  type Tarefa,
} from "../../lib/tipos";
import { PainelTarefa } from "../../components/tarefas/PainelTarefa";
import { NovaTarefa } from "../../components/tarefas/NovaTarefa";
import { Botao, Entrada, Selecao, Vazio } from "../../components/ui";
import { Rotinas } from "./Rotinas";
import { QuadroTarefas } from "../../components/tarefas/QuadroTarefas";
import { Processos } from "./Processos";

const ABAS = [
  { id: "clientes", nome: "Tarefas" },
  { id: "clientes-carteira", nome: "Carteira" },
  { id: "clientes-entrada", nome: "Caixa de entrada" },
  { id: "clientes-rotinas", nome: "Rotinas" },
  { id: "clientes-onboarding", nome: "Onboarding" },
];

export function ordenar(a: Tarefa, b: Tarefa) {
  return (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") || ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade];
}

export function GestaoClientes({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const d = useDados();
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState<"tarefa" | "demanda" | null>(null);
  const aba = ABAS.some((a) => a.id === rota) ? rota : "clientes";
  const naEntrada = d.tarefas.filter((t) => t.triagem && STATUS_ABERTOS.includes(t.status)).length;

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight">Clientes</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="fantasma" onClick={() => d.recarregar()} aria-label="Atualizar">
            <RefreshCw size={14} />
          </Botao>
          <Botao onClick={() => setNova("demanda")}>
            <Inbox size={14} /> Nova demanda
          </Botao>
          <Botao variante="primario" onClick={() => setNova("tarefa")}>
            <Plus size={14} /> Nova tarefa
          </Botao>
        </div>
      </header>

      <div className="-mx-1 overflow-x-auto px-1">
        <div role="tablist" className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1">
          {ABAS.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => ir(a.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] ${
                aba === a.id ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg"
              }`}
            >
              {a.nome}
              {a.id === "clientes-entrada" && naEntrada > 0 && (
                <span className={`num rounded-full px-1.5 text-[11px] ${aba === a.id ? "bg-accent-fg/20" : "bg-warn-soft text-warn"}`}>{naEntrada}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {d.erro && <div className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">{d.erro}</div>}
      {d.carregando ? (
        <Vazio>Carregando tarefas…</Vazio>
      ) : aba === "clientes-carteira" ? (
        <Carteira ir={ir} />
      ) : aba === "clientes-entrada" ? (
        <CaixaEntrada abrir={setAberta} novaDemanda={() => setNova("demanda")} />
      ) : aba === "clientes-rotinas" ? (
        <Rotinas />
      ) : aba === "clientes-onboarding" ? (
        <Processos />
      ) : (
        <QuadroTarefas abrir={setAberta} />
      )}

      <PainelTarefa id={aberta} fechar={() => setAberta(null)} />
      <NovaTarefa aberto={nova !== null} caixaEntrada={nova === "demanda"} fechar={() => setNova(null)} aoCriar={nova === "tarefa" ? setAberta : undefined} />
    </div>
  );
}

export function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${alerta ? "border-warn bg-warn-soft" : "border-line bg-surface"}`}>
      <div className={`num text-[24px] font-medium leading-none ${alerta ? "text-warn" : ""}`}>{valor}</div>
      <div className={`mt-1 text-[12px] ${alerta ? "text-warn" : "text-muted"}`}>{rotulo}</div>
    </div>
  );
}

export function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-[12.5px] ${ativo ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------
// Carteira
// ------------------------------------------------------------------
function Carteira({ ir }: { ir: (r: string) => void }) {
  const d = useDados();
  const h = hoje();
  const linhas = d.clientes.map((c) => {
    const abertas = d.tarefas.filter((t) => t.cliente_id === c.id && STATUS_ABERTOS.includes(t.status));
    const porPilar = PILARES.map((p) => abertas.filter((t) => t.pilar === p).length);
    return {
      c,
      abertas: abertas.length,
      atrasadas: abertas.filter((t) => atrasada(t)).length,
      hoje: abertas.filter((t) => t.prazo === h).length,
      rotinas: d.clienteRotinas.filter((r) => r.cliente_id === c.id && r.ativa).length,
      porPilar,
    };
  });
  linhas.sort((a, b) => b.atrasadas - a.atrasadas || a.c.nome.localeCompare(b.c.nome));

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {["Cliente", "Abertas", "Atrasadas", "Hoje", ...PILARES.map((p) => PILAR[p].split(" ")[0]), "Rotinas"].map((t) => (
              <th key={t} className="eyebrow px-3 py-3 font-normal">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.c.id} onClick={() => ir(`cliente-${l.c.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-raised">
              <td className="px-3 py-2.5">
                <div className="font-medium">{l.c.nome}</div>
                {l.c.origem === "parceria_marcone" && <div className="text-[11px] text-warn">Parceria Marcone</div>}
              </td>
              <td className="num px-3">{l.abertas}</td>
              <td className={`num px-3 ${l.atrasadas ? "font-semibold text-warn" : "text-muted"}`}>{l.atrasadas}</td>
              <td className="num px-3 text-muted">{l.hoje}</td>
              {l.porPilar.map((n, i) => (
                <td key={i} className={`num px-3 ${n ? "" : "text-muted"}`}>{n || "·"}</td>
              ))}
              <td className="num px-3 text-muted">{l.rotinas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------
// Caixa de entrada (Diário de Demandas)
// ------------------------------------------------------------------
function CaixaEntrada({ abrir, novaDemanda }: { abrir: (id: string) => void; novaDemanda: () => void }) {
  const d = useDados();
  const lista = d.tarefas.filter((t) => t.triagem && STATUS_ABERTOS.includes(t.status));
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[70ch] text-[13px] text-muted">
        Pedidos novos dos clientes entram aqui sem prazo. Na triagem você define responsável, prazo e pilar, e a demanda vira tarefa.
      </p>
      {lista.length === 0 ? (
        <Vazio>
          Caixa de entrada vazia.{" "}
          <button onClick={novaDemanda} className="font-medium text-accent">Registrar uma demanda</button>
        </Vazio>
      ) : (
        lista.map((t) => <Triagem key={t.id} t={t} abrir={abrir} />)
      )}
    </div>
  );
}

function Triagem({ t, abrir }: { t: Tarefa; abrir: (id: string) => void }) {
  const d = useDados();
  const [resp, setResp] = useState(t.responsavel_id ?? "");
  const [prazo, setPrazo] = useState(t.prazo ?? "");
  const [pilar, setPilar] = useState<Pilar>(t.pilar);
  const pronto = Boolean(resp && prazo);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 lg:flex-row lg:items-center">
      <button onClick={() => abrir(t.id)} className="min-w-0 flex-1 text-left">
        <div className="text-[11.5px] text-muted">{d.cliente(t.cliente_id)?.nome}</div>
        <div className="text-[13.5px] font-medium">{t.titulo}</div>
      </button>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[620px]">
        <Selecao id={`tri-resp-${t.id}`} value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
          <option value="">Responsável</option>
          {d.membros.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </Selecao>
        <Entrada id={`tri-prazo-${t.id}`} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} aria-label="Prazo" />
        <Selecao id={`tri-pilar-${t.id}`} value={pilar} onChange={(e) => setPilar(e.target.value as Pilar)} aria-label="Pilar">
          {PILARES.map((p) => (
            <option key={p} value={p}>{PILAR[p]}</option>
          ))}
        </Selecao>
        <Botao
          variante="primario"
          disabled={!pronto}
          title={pronto ? "" : "Escolha responsável e prazo"}
          onClick={async () => {
            await repo.salvarTarefa(t.id, { responsavel_id: resp, prazo, pilar, triagem: false });
            await d.recarregar();
            d.avisar("Demanda virou tarefa");
          }}
        >
          Confirmar
        </Botao>
      </div>
    </div>
  );
}
