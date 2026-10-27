import { useState } from "react";
import { AlertTriangle, AtSign, Bell, UserPlus } from "lucide-react";
import { repo } from "../lib/repo";
import { useDados } from "../lib/dados";
import { STATUS_ABERTOS, atrasada, hoje, type Notificacao } from "../lib/tipos";
import { Botao, Painel, Vazio } from "./ui";
import { TextoComMencoes } from "./LinhaDoTempo";

const ICONE = { mencao: AtSign, atribuicao: UserPlus, alerta: AlertTriangle };

function quando(iso: string) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return dia === hoje() ? hora : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" })} ${hora}`;
}

/** Botão do sininho + painel "Para mim". */
export function Sininho({ ir, compacto }: { ir: (r: string) => void; compacto?: boolean }) {
  const d = useDados();
  const [aberto, setAberto] = useState(false);
  const naoLidas = d.notificacoes.filter((n) => !n.lida);
  const minhas = d.tarefas.filter((t) => t.responsavel_id && t.responsavel_id === d.eu && STATUS_ABERTOS.includes(t.status));
  const atrasadas = minhas.filter((t) => atrasada(t)).length;
  const deHoje = minhas.filter((t) => t.prazo === hoje()).length;

  async function abrirNotificacao(n: Notificacao) {
    setAberto(false);
    if (!n.lida) await repo.marcarLidas([n.id]).catch(() => undefined);
    if (n.cliente_id) ir(`cliente-${n.cliente_id}`);
    d.recarregar();
  }

  async function marcarTodas() {
    await repo.marcarLidas(naoLidas.map((n) => n.id));
    await d.recarregar();
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className={`relative flex items-center gap-2.5 rounded-lg text-[13.5px] hover:bg-raised ${compacto ? "p-2" : "w-full px-2.5 py-2 text-left"}`}
        aria-label={`Para mim${naoLidas.length ? `, ${naoLidas.length} novas` : ""}`}
      >
        <Bell size={compacto ? 20 : 16} />
        {!compacto && <span className="flex-1">Para mim</span>}
        {naoLidas.length > 0 && (
          <span className={`num grid min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[10.5px] font-semibold leading-[18px] text-white ${compacto ? "absolute right-0.5 top-0.5" : ""}`}>
            {naoLidas.length}
          </span>
        )}
      </button>

      <Painel aberto={aberto} fechar={() => setAberto(false)} titulo="Para mim" largura={440}>
        <div className="flex flex-col gap-4">
          {d.eu && (
            <button
              onClick={() => {
                setAberto(false);
                ir("clientes");
              }}
              className="grid grid-cols-2 gap-2 text-left"
            >
              <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
                <div className="num text-[20px] font-medium leading-none">{deHoje}</div>
                <div className="mt-1 text-[12px] text-muted">minhas tarefas de hoje</div>
              </div>
              <div className={`rounded-xl border px-3 py-2.5 ${atrasadas ? "border-warn bg-warn-soft" : "border-line bg-surface"}`}>
                <div className={`num text-[20px] font-medium leading-none ${atrasadas ? "text-warn" : ""}`}>{atrasadas}</div>
                <div className="mt-1 text-[12px] text-muted">atrasadas comigo</div>
              </div>
            </button>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Avisos</h3>
            {naoLidas.length > 0 && (
              <Botao variante="fantasma" onClick={marcarTodas}>Marcar todos como lidos</Botao>
            )}
          </div>
          {d.notificacoes.length === 0 ? (
            <Vazio>Nenhum aviso. Quando alguém te marcar com @, te passar uma tarefa ou uma conta ficar em vermelho, aparece aqui.</Vazio>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {d.notificacoes.map((n) => {
                const Icone = ICONE[n.tipo];
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => abrirNotificacao(n)}
                      className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] leading-snug hover:border-accent ${
                        n.lida ? "border-line bg-transparent text-muted" : n.tipo === "alerta" ? "border-bad bg-bad-soft" : "border-line bg-surface"
                      }`}
                    >
                      <Icone size={15} className={`mt-0.5 shrink-0 ${n.tipo === "alerta" ? "text-bad" : "text-accent"}`} />
                      <span className="min-w-0 flex-1">
                        <TextoComMencoes texto={n.texto} />
                      </span>
                      <span className="num shrink-0 text-[11px] text-muted">{quando(n.criado_em)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Painel>
    </>
  );
}
