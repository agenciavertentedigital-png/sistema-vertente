import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { repo } from "../../lib/repo";
import { useDados } from "../../lib/dados";
import {
  ACOES_REVISAO,
  CANAL,
  SITUACAO,
  TIPOS_ALTERACAO,
  type Alteracao,
  type Situacao,
  type Tarefa,
  type TipoRegistro,
} from "../../lib/tipos";
import { Botao, Entrada, Rotulo, Selecao, COR_SITUACAO } from "../ui";
import { CampoMencao } from "../LinhaDoTempo";
import { NumerosDaConta } from "../NumerosDaConta";

/** Qual registro a tarefa pede ao ser concluída (null = conclui direto). */
export function tipoDeRegistro(t: Tarefa, nomeRotina?: string): TipoRegistro | null {
  const n = (nomeRotina ?? t.titulo).toLowerCase();
  if (n.startsWith("revisão")) return "revisao";
  if (n.startsWith("otimização")) return "otimizacao";
  return null;
}

const ESTILO_SITUACAO: Record<Situacao, string> = {
  ok: "border-ok bg-ok-soft text-ok",
  atencao: "border-warn bg-warn-soft text-warn",
  problema: "border-bad bg-bad-soft text-bad",
};

export function RegistroRapido({ t, tipo, cancelar, concluido }: { t: Tarefa; tipo: TipoRegistro; cancelar: () => void; concluido: () => void }) {
  const d = useDados();
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [acoes, setAcoes] = useState<string[]>([]);
  const [nota, setNota] = useState("");
  const [alteracoes, setAlteracoes] = useState<Alteracao[]>([{ tipo: TIPOS_ALTERACAO[0], descricao: "", antes: "", depois: "" }]);
  const [salvando, setSalvando] = useState(false);

  const notaObrigatoria = situacao === "atencao" || situacao === "problema";
  const alteracoesValidas = alteracoes.filter((a) => a.descricao.trim());
  const pronto =
    situacao !== null &&
    (!notaObrigatoria || nota.trim().length > 0) &&
    (tipo === "otimizacao" ? alteracoesValidas.length > 0 || nota.trim().length > 0 : acoes.length > 0);

  function alternarAcao(a: string) {
    setAcoes((v) => {
      if (a === "Nenhuma ação") return v.includes(a) ? [] : [a];
      const sem = v.filter((x) => x !== "Nenhuma ação");
      return sem.includes(a) ? sem.filter((x) => x !== a) : [...sem, a];
    });
  }

  async function salvar() {
    if (!pronto || !situacao) return;
    setSalvando(true);
    try {
      await repo.registrar({
        cliente_id: t.cliente_id,
        tarefa_id: t.id,
        tipo,
        canal: t.canal,
        situacao,
        acoes: tipo === "revisao" ? acoes : [],
        nota: nota.trim() || null,
        alteracoes: tipo === "otimizacao" ? alteracoesValidas : [],
      });
      await repo.salvarTarefa(t.id, { status: "feita" });
      await d.recarregar();
      d.avisar(situacao === "problema" ? "Registrado. O time foi avisado da conta em vermelho." : "Registrado e concluído");
      concluido();
    } catch (e) {
      d.avisar(`Não foi possível registrar: ${(e as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-accent bg-surface p-4">
      <div>
        <div className="eyebrow">Registro rápido{t.canal ? ` · ${CANAL[t.canal]}` : ""}</div>
        <h3 className="mt-0.5 text-[15px] font-semibold">{tipo === "revisao" ? "Como está a conta hoje?" : "Como ficou a conta depois da otimização?"}</h3>
      </div>

      {t.canal !== "google" && <NumerosDaConta clienteId={t.cliente_id} compacto />}

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Situação da conta">
        {(Object.keys(SITUACAO) as Situacao[]).map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={situacao === s}
            onClick={() => setSituacao(s)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-[13px] font-semibold transition-colors ${
              situacao === s ? ESTILO_SITUACAO[s] : "border-line text-muted hover:text-fg"
            }`}
          >
            <span className="h-4 w-4 rounded-full" style={{ background: COR_SITUACAO[s] }} />
            {SITUACAO[s]}
          </button>
        ))}
      </div>

      {tipo === "revisao" ? (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-muted">O que foi feito</span>
          <div className="flex flex-wrap gap-1.5">
            {ACOES_REVISAO.map((a) => (
              <button
                key={a}
                onClick={() => alternarAcao(a)}
                aria-pressed={acoes.includes(a)}
                className={`rounded-full border px-3 py-1 text-[12.5px] ${acoes.includes(a) ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-fg"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-muted">Alterações feitas</span>
          {alteracoes.map((a, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-raised p-2 sm:grid-cols-[150px_1fr_90px_90px_32px]">
              <Selecao id={`alt-tipo-${i}`} aria-label="Tipo" value={a.tipo} onChange={(e) => setAlteracoes((v) => v.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)))}>
                {TIPOS_ALTERACAO.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Selecao>
              <Entrada id={`alt-desc-${i}`} aria-label="O que mudou" placeholder="O que mudou (campanha, conjunto…)" value={a.descricao} onChange={(e) => setAlteracoes((v) => v.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))} />
              <Entrada id={`alt-antes-${i}`} aria-label="Antes" placeholder="Antes" value={a.antes ?? ""} onChange={(e) => setAlteracoes((v) => v.map((x, j) => (j === i ? { ...x, antes: e.target.value } : x)))} />
              <Entrada id={`alt-depois-${i}`} aria-label="Depois" placeholder="Depois" value={a.depois ?? ""} onChange={(e) => setAlteracoes((v) => v.map((x, j) => (j === i ? { ...x, depois: e.target.value } : x)))} />
              <button
                onClick={() => setAlteracoes((v) => (v.length > 1 ? v.filter((_, j) => j !== i) : v))}
                className="grid place-items-center rounded-lg text-muted hover:text-bad"
                aria-label="Remover alteração"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Botao variante="fantasma" className="self-start" onClick={() => setAlteracoes((v) => [...v, { tipo: TIPOS_ALTERACAO[0], descricao: "", antes: "", depois: "" }])}>
            <Plus size={14} /> Outra alteração
          </Botao>
        </div>
      )}

      <Rotulo texto={notaObrigatoria ? "O que está acontecendo (obrigatório). Use @Nome para avisar alguém" : "Observação (opcional). Use @Nome para avisar alguém"}>
        <CampoMencao id="registro-nota" rows={2} valor={nota} mudar={setNota} />
      </Rotulo>

      <div className="flex flex-wrap gap-2">
        <Botao variante="primario" disabled={!pronto || salvando} onClick={salvar}>
          {salvando ? "Salvando…" : "Registrar e concluir"}
        </Botao>
        <Botao variante="fantasma" onClick={cancelar}>Cancelar</Botao>
      </div>
    </div>
  );
}
