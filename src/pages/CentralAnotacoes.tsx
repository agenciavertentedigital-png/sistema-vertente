import { useState } from "react";
import { NotebookPen, Target } from "lucide-react";
import { Anotacoes } from "../components/Anotacoes";
import { useDados } from "../lib/dados";
import { SECOES_BRIEFING, completudeBriefing, useBriefings } from "../lib/briefing";

/** Anotações de todos os clientes e situação dos briefings, num lugar só. */
export function CentralAnotacoes({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const aba = rota === "anotacoes-briefings" ? "briefings" : "notas";
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Conhecimento da agência</div>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight">Anotações e briefings</h1>
        </div>
        <div role="tablist" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {([["notas", "Anotações", NotebookPen, "anotacoes"], ["briefings", "Briefings dos clientes", Target, "anotacoes-briefings"]] as const).map(([v, n, I, r]) => (
            <button key={v} role="tab" aria-selected={aba === v} onClick={() => ir(r)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] ${aba === v ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg"}`}>
              <I size={14} /> {n}
            </button>
          ))}
        </div>
      </header>
      {aba === "notas" ? <Anotacoes /> : <PainelBriefings ir={ir} />}
    </div>
  );
}

function PainelBriefings({ ir }: { ir: (r: string) => void }) {
  const d = useDados();
  const tb = useBriefings();
  const [ordem, setOrdem] = useState<"nome" | "pct">("pct");
  const ativos = d.clientes.filter((c) => (c as { status?: string }).status !== "encerrado");
  const linhas = ativos
    .map((c) => {
      const b = tb.linhas.find((x) => x.cliente_id === c.id);
      return { c, b, comp: completudeBriefing(b) };
    })
    .sort((a, z) => (ordem === "pct" ? a.comp.pct - z.comp.pct : a.c.nome.localeCompare(z.c.nome)));
  const completos = linhas.filter((l) => l.comp.pct >= 80).length;
  const vazios = linhas.filter((l) => l.comp.pct === 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card rotulo="Briefings bons (80%+)" valor={completos} cor="text-ok" />
        <Card rotulo="Em andamento" valor={linhas.length - completos - vazios} cor="text-warn" />
        <Card rotulo="Sem briefing" valor={vazios} cor="text-bad" />
      </div>
      <div className="overflow-hidden rounded-2xl bg-surface" style={{ boxShadow: "var(--sombra)" }}>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[12.5px] text-muted">
          <span>Clique num cliente para abrir o briefing.</span>
          <button onClick={() => setOrdem(ordem === "pct" ? "nome" : "pct")} className="hover:text-fg">Ordenar por {ordem === "pct" ? "nome" : "preenchimento"}</button>
        </div>
        <div className="divide-y divide-line">
          {linhas.map(({ c, b, comp }) => (
            <button
              key={c.id}
              onClick={() => {
                try {
                  localStorage.setItem("vertente.aba-cliente", "briefing");
                } catch {
                  /* sem armazenamento */
                }
                ir(`cliente-${c.id}`);
              }}
              className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-raised md:grid-cols-[220px_1fr_70px]"
            >
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium">{c.nome}</div>
                <div className="truncate text-[12px] text-muted">{b?.campos?.objetivo_principal || "Objetivo não definido"}</div>
              </div>
              <div className="hidden gap-1 md:flex">
                {SECOES_BRIEFING.map((s) => {
                  const f = s.campos.filter((x) => b?.campos?.[x.chave]?.trim()).length;
                  const p = f / s.campos.length;
                  return (
                    <div key={s.secao} title={`${s.secao}: ${f}/${s.campos.length}`} className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                      <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: p === 1 ? "#16a34a" : p > 0 ? "#d97706" : "transparent" }} />
                    </div>
                  );
                })}
              </div>
              <div className={`num text-right text-[13px] font-semibold ${comp.pct >= 80 ? "text-ok" : comp.pct > 0 ? "text-warn" : "text-muted"}`}>{comp.pct}%</div>
            </button>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-muted">As barrinhas são as seções do briefing, na ordem: {SECOES_BRIEFING.map((s) => s.secao).join(" · ")}.</p>
    </div>
  );
}

function Card({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4" style={{ boxShadow: "var(--sombra)" }}>
      <div className="text-[12px] text-muted">{rotulo}</div>
      <div className={`num mt-1 text-[26px] font-semibold ${cor}`}>{valor}</div>
    </div>
  );
}
