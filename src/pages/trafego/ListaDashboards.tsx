import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { useDados } from "../../lib/dados";
import { useTrafego } from "../../lib/trafego";
import { useLogos } from "../../lib/logos";
import { LogoCliente } from "../../components/LogoCliente";
import { Vazio } from "../../components/ui";

/** Escolha do cliente: cards limpos, só logo e nome. Os números ficam dentro do dashboard. */
export function ListaDashboards({ trafego, ir }: { trafego: ReturnType<typeof useTrafego>; ir: (r: string) => void }) {
  const d = useDados();
  const lg = useLogos();
  const [busca, setBusca] = useState("");

  const porCliente = new Map<string, { meta: boolean; google: boolean; problema: boolean }>();
  for (const c of trafego.contas.filter((x) => x.ativa)) {
    const v = porCliente.get(c.cliente_id) ?? { meta: false, google: false, problema: false };
    if (c.plataforma === "google") v.google = true;
    else v.meta = true;
    if (c.status && c.status !== "ativa") v.problema = true;
    porCliente.set(c.cliente_id, v);
  }
  const termo = busca.trim().toLowerCase();
  const cartoes = [...porCliente.entries()]
    .map(([clienteId, v]) => ({ clienteId, nome: d.cliente(clienteId)?.nome ?? "Cliente", ...v }))
    .filter((c) => !termo || c.nome.toLowerCase().includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (trafego.carregando) return <Vazio>Carregando…</Vazio>;
  if (porCliente.size === 0) return <Vazio>Nenhum cliente com conta de anúncio acompanhada.</Vazio>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-9 w-full max-w-[320px] items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] focus-within:border-accent">
          <Search size={14} className="text-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
        </label>
        <span className="text-[12px] text-muted">{cartoes.length} {cartoes.length === 1 ? "cliente" : "clientes"}{lg.disponivel ? " · passe o mouse na logo para trocar" : ""}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {cartoes.map((c) => (
          <div key={c.clienteId} role="button" tabIndex={0}
            onClick={() => ir(`trafego-cliente-${c.clienteId}`)}
            onKeyDown={(e) => { if (e.key === "Enter") ir(`trafego-cliente-${c.clienteId}`); }}
            className="group relative flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-3 pb-4 pt-6 text-center transition-all hover:-translate-y-0.5 hover:border-line-forte hover:shadow-[var(--sombra)] focus-visible:border-accent focus-visible:outline-none">
            {c.problema && <span className="absolute left-3 top-3 h-2 w-2 rounded-full bg-bad" title="Conta com problema" />}
            <ArrowUpRight size={15} className="absolute right-3 top-3 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
            <LogoCliente nome={c.nome} url={lg.logos[c.clienteId]} tamanho={64}
              trocar={lg.disponivel ? async (f) => { try { await lg.enviar(c.clienteId, f); d.avisar("Logo atualizada"); } catch (e) { d.avisar((e as Error).message); } } : undefined} />
            <div className="w-full min-w-0">
              <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{c.nome}</div>
              <div className="mt-1 flex justify-center gap-1">
                {c.meta && <span className="rounded-full bg-raised px-2 py-0.5 text-[10.5px] text-muted">Meta</span>}
                {c.google && <span className="rounded-full bg-raised px-2 py-0.5 text-[10.5px] text-muted">Google</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
