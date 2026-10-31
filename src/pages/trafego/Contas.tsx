import { useState } from "react";
import { chamarFuncao } from "../../lib/tabela";
import { Plus, Trash2 } from "lucide-react";
import { useDados } from "../../lib/dados";
import { STATUS_CONTA, repoTrafego, useTrafego } from "../../lib/trafego";
import { Botao, Entrada, Rotulo, Selecao, Vazio } from "../../components/ui";

export function Contas({ trafego }: { trafego: ReturnType<typeof useTrafego> }) {
  const d = useDados();
  const [novo, setNovo] = useState(false);
  const [cliente, setCliente] = useState("");
  const [contaId, setContaId] = useState("");
  const [nome, setNome] = useState("");
  const [plataforma, setPlataforma] = useState<"meta" | "google">("meta");
  const [opcoesGoogle, setOpcoesGoogle] = useState<{ id: string; nome: string }[] | null>(null);
  const [buscandoGoogle, setBuscandoGoogle] = useState(false);

  async function carregarGoogle() {
    setBuscandoGoogle(true);
    try {
      const r = await chamarFuncao<{ contas: { id: string; nome: string }[] }>("google-ads", { acao: "contas" });
      setOpcoesGoogle(r.contas);
    } catch (e) {
      d.avisar((e as Error).message);
      setOpcoesGoogle([]);
    } finally {
      setBuscandoGoogle(false);
    }
  }
  const [remover, setRemover] = useState<string | null>(null);

  async function executar(acao: () => Promise<unknown>, aviso: string) {
    try {
      await acao();
      await trafego.recarregar();
      d.avisar(aviso);
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  async function vincular() {
    const id = contaId.replace(/\D/g, "");
    if (!cliente || !id || !nome.trim()) return;
    await executar(async () => {
      await repoTrafego.salvarConta(null, { cliente_id: cliente, conta_id: id, nome: nome.trim(), plataforma, ativa: true });
      if (plataforma === "google") await repoTrafego.sincronizar().catch(() => null);
    }, plataforma === "google" ? "Conta do Google Ads vinculada e sincronizada." : "Conta vinculada. Os números entram na próxima atualização.");
    setContaId("");
    setNome("");
    setNovo(false);
  }

  const ordenadas = trafego.contas
    .map((c) => ({ c, cliente: d.cliente(c.cliente_id)?.nome ?? "Cliente inativo" }))
    .sort((a, b) => Number(b.c.ativa) - Number(a.c.ativa) || a.cliente.localeCompare(b.cliente));
  const semConta = d.clientes.filter((c) => !trafego.contas.some((x) => x.cliente_id === c.id && x.ativa) && !c.nome.toLowerCase().includes("vertente"));

  if (trafego.carregando) return <Vazio>Carregando…</Vazio>;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted">
          Contas de anúncio ligadas a cada cliente. Só as marcadas em <strong className="text-fg">Acompanhar</strong> entram na Visão geral e na atualização automática.
        </p>
        <Botao variante="primario" onClick={() => setNovo((v) => !v)}>
          <Plus size={14} /> Vincular conta
        </Botao>
      </div>

      {novo && (
        <div className="grid gap-3 rounded-2xl border border-accent bg-surface p-4 sm:grid-cols-[140px_1fr_200px_1fr_auto] sm:items-end">
          <Rotulo texto="Plataforma">
            <Selecao id="conta-plataforma" value={plataforma} onChange={(e) => { const p = e.target.value as "meta" | "google"; setPlataforma(p); if (p === "google" && !opcoesGoogle) carregarGoogle(); }}>
              <option value="meta">Meta Ads</option>
              <option value="google">Google Ads</option>
            </Selecao>
          </Rotulo>
          <Rotulo texto="Cliente">
            <Selecao id="conta-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)}>
              <option value="">Escolha</option>
              {d.clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Selecao>
          </Rotulo>
          {plataforma === "google" && opcoesGoogle && opcoesGoogle.length > 0 ? (
            <Rotulo texto="Conta na MCC">
              <Selecao id="conta-google" value={contaId} onChange={(e) => { setContaId(e.target.value); setNome(opcoesGoogle.find((o) => o.id === e.target.value)?.nome ?? ""); }}>
                <option value="">Escolha</option>
                {opcoesGoogle.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </Selecao>
            </Rotulo>
          ) : (
            <Rotulo texto={plataforma === "google" ? (buscandoGoogle ? "Buscando contas…" : "ID da conta Google (123-456-7890)") : "ID da conta (números)"}>
              <Entrada id="conta-id" inputMode="numeric" placeholder={plataforma === "google" ? "ex.: 123-456-7890" : "ex.: 1062585131357371"} value={contaId} onChange={(e) => setContaId(e.target.value)} />
            </Rotulo>
          )}
          <Rotulo texto="Nome">
            <Entrada id="conta-nome" placeholder="ex.: CA01 - Madalena Brandão" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Rotulo>
          <Botao variante="primario" onClick={vincular} disabled={!cliente || !contaId.trim() || !nome.trim()}>Vincular</Botao>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {["Cliente", "Conta", "Status", "Atualização", "Acompanhar", ""].map((h) => (
                <th key={h} className="eyebrow px-3 py-2.5 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map(({ c, cliente: nomeCliente }) => (
              <tr key={c.id} className={`border-b border-line last:border-0 ${c.ativa ? "" : "text-muted"}`}>
                <td className="px-3 py-2 font-medium">{nomeCliente}</td>
                <td className="px-3">
                  <div className="flex items-center gap-1.5">{c.nome}<span className={`rounded px-1 text-[10.5px] font-semibold ${c.plataforma === "google" ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"}`}>{c.plataforma === "google" ? "Google" : "Meta"}</span></div>
                  <div className="num text-[11.5px] text-muted">{c.conta_id}</div>
                </td>
                <td className="px-3">
                  {c.status ? (
                    <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${c.status === "ativa" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{STATUS_CONTA[c.status] ?? c.status}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-[260px] px-3 text-[12px]">
                  {c.erro_sync ? <span className="text-bad">{c.erro_sync}</span> : c.ultimo_sync ? new Date(c.ultimo_sync).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : <span className="text-muted">Aguardando a primeira atualização</span>}
                </td>
                <td className="px-3">
                  <input
                    id={`acompanhar-${c.id}`}
                    type="checkbox"
                    checked={c.ativa}
                    aria-label={`Acompanhar ${c.nome}`}
                    onChange={(e) => executar(() => repoTrafego.salvarConta(c.id, { ativa: e.target.checked }), e.target.checked ? "Conta entra no acompanhamento" : "Conta saiu do acompanhamento")}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </td>
                <td className="px-3 text-right">
                  {remover === c.id ? (
                    <span className="flex items-center justify-end gap-1 whitespace-nowrap text-[12px]">
                      Desvincular?
                      <Botao onClick={() => executar(() => repoTrafego.removerConta(c.id), "Conta desvinculada")}>Sim</Botao>
                      <Botao variante="fantasma" onClick={() => setRemover(null)}>Não</Botao>
                    </span>
                  ) : (
                    <button onClick={() => setRemover(c.id)} className="rounded p-1 text-muted hover:text-bad" aria-label={`Desvincular ${c.nome}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {semConta.length > 0 && (
        <p className="text-[12.5px] text-muted">
          Sem conta Meta acompanhada: {semConta.map((c) => c.nome).join(", ")}.
        </p>
      )}
    </>
  );
}
