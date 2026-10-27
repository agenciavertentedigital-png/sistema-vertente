import { useState, type FormEvent } from "react";
import { repo } from "../../lib/repo";
import { useDados } from "../../lib/dados";
import { CANAL, PILAR, PILARES, PRIORIDADE, type CamposTarefa, type Pilar, type Prioridade } from "../../lib/tipos";
import { Botao, Entrada, Painel, Rotulo, Selecao } from "../ui";

export function NovaTarefa({
  aberto,
  fechar,
  clienteFixo,
  caixaEntrada = false,
  aoCriar,
}: {
  aberto: boolean;
  fechar: () => void;
  clienteFixo?: string;
  caixaEntrada?: boolean;
  aoCriar?: (id: string) => void;
}) {
  const d = useDados();
  const [f, setF] = useState<CamposTarefa>({});
  const [salvando, setSalvando] = useState(false);
  const set = (c: CamposTarefa) => setF((v) => ({ ...v, ...c }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const cliente_id = clienteFixo ?? f.cliente_id;
    if (!f.titulo?.trim() || !cliente_id) return;
    setSalvando(true);
    try {
      const id = await repo.salvarTarefa(null, {
        titulo: f.titulo.trim(),
        cliente_id,
        pilar: f.pilar ?? "trafego",
        canal: f.canal ?? null,
        responsavel_id: caixaEntrada ? null : f.responsavel_id ?? d.eu,
        prazo: caixaEntrada ? null : f.prazo ?? null,
        prioridade: f.prioridade ?? "normal",
        descricao: f.descricao ?? null,
        triagem: caixaEntrada,
      });
      await d.recarregar();
      d.avisar(caixaEntrada ? "Demanda na caixa de entrada" : "Tarefa criada");
      setF({});
      fechar();
      aoCriar?.(id);
    } catch (err) {
      d.avisar(`Não foi possível criar: ${(err as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Painel aberto={aberto} fechar={fechar} titulo={caixaEntrada ? "Nova demanda" : "Nova tarefa"} largura={460}>
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <Rotulo texto="O que precisa ser feito">
          <Entrada id="nova-titulo" autoFocus required value={f.titulo ?? ""} onChange={(e) => set({ titulo: e.target.value })} />
        </Rotulo>
        {!clienteFixo && (
          <Rotulo texto="Cliente">
            <Selecao id="nova-cliente" required value={f.cliente_id ?? ""} onChange={(e) => set({ cliente_id: e.target.value })}>
              <option value="" disabled>Escolha o cliente</option>
              {d.clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Selecao>
          </Rotulo>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Rotulo texto="Pilar">
            <Selecao id="nova-pilar" value={f.pilar ?? "trafego"} onChange={(e) => set({ pilar: e.target.value as Pilar })}>
              {PILARES.map((p) => (
                <option key={p} value={p}>{PILAR[p]}</option>
              ))}
            </Selecao>
          </Rotulo>
          <Rotulo texto="Canal">
            <Selecao id="nova-canal" value={f.canal ?? ""} onChange={(e) => set({ canal: (e.target.value || null) as CamposTarefa["canal"] })}>
              <option value="">Nenhum</option>
              {Object.entries(CANAL).map(([v, n]) => (
                <option key={v} value={v}>{n}</option>
              ))}
            </Selecao>
          </Rotulo>
          {!caixaEntrada && (
            <>
              <Rotulo texto="Responsável">
                <Selecao id="nova-responsavel" value={f.responsavel_id ?? d.eu ?? ""} onChange={(e) => set({ responsavel_id: e.target.value || null })}>
                  <option value="">Sem responsável</option>
                  {d.membros.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </Selecao>
              </Rotulo>
              <Rotulo texto="Prazo">
                <Entrada id="nova-prazo" type="date" value={f.prazo ?? ""} onChange={(e) => set({ prazo: e.target.value || null })} />
              </Rotulo>
            </>
          )}
          <Rotulo texto="Prioridade">
            <Selecao id="nova-prioridade" value={f.prioridade ?? "normal"} onChange={(e) => set({ prioridade: e.target.value as Prioridade })}>
              {Object.entries(PRIORIDADE).map(([v, n]) => (
                <option key={v} value={v}>{n}</option>
              ))}
            </Selecao>
          </Rotulo>
        </div>
        <Rotulo texto="Descrição (opcional)">
          <textarea id="nova-descricao" rows={3} value={f.descricao ?? ""} onChange={(e) => set({ descricao: e.target.value })} className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent" />
        </Rotulo>
        {caixaEntrada && <p className="text-[12px] text-muted">A demanda entra sem responsável e sem prazo. Na triagem você define os dois.</p>}
        <Botao variante="primario" type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : caixaEntrada ? "Mandar para a caixa de entrada" : "Criar tarefa"}
        </Botao>
      </form>
    </Painel>
  );
}
