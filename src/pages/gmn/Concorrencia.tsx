import { AlertTriangle, CheckCircle2, Swords, TrendingDown } from "lucide-react";
import { insightsConcorrencia, type ColetaFicha } from "../../lib/fichaGoogle";

const dias = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso.replace(" +00:00", "Z").replace(" ", "T")).getTime()) / 864e5) : null);
const virg = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(1).replace(".", ","));
const n0 = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("pt-BR"));
const TOM = {
  bom: { cor: "var(--ok)", fundo: "var(--ok-soft)", Icone: CheckCircle2 },
  atencao: { cor: "var(--warn)", fundo: "var(--warn-soft)", Icone: AlertTriangle },
  ruim: { cor: "var(--bad)", fundo: "var(--bad-soft)", Icone: TrendingDown },
} as const;

/** Comparativo com os primeiros colocados do Maps: insights do que separa a ficha deles + tabela lado a lado. */
export function Concorrencia({ coleta, nome }: { coleta: ColetaFicha; nome: string }) {
  const lista = coleta.concorrentes;
  if (!lista.length) return null;
  const insights = insightsConcorrencia(coleta);
  const minhasCats = [coleta.info.categoria, ...(coleta.info.categorias_adicionais ?? [])].filter(Boolean).length;
  const eu = {
    nome: coleta.info.titulo ?? nome, posicao: coleta.posicao_categoria, nota: coleta.info.nota, avaliacoes: coleta.info.avaliacoes,
    novas_30d: coleta.avaliacoes.filter((a) => (dias(a.data) ?? 999) <= 30).length, fotos: coleta.info.fotos, cats: minhasCats,
    descricao_tam: coleta.info.descricao?.trim().length ?? 0, reivindicado: coleta.info.reivindicado, distancia_km: 0, eu: true,
  };
  const linhas = [
    eu,
    ...lista.map((x) => ({ nome: x.nome, posicao: x.posicao, nota: x.nota, avaliacoes: x.avaliacoes, novas_30d: x.novas_30d ?? null, fotos: x.fotos ?? null, cats: x.categorias_adicionais ? 1 + x.categorias_adicionais.length : x.categoria ? 1 : 0, descricao_tam: x.descricao_tam ?? null, reivindicado: x.reivindicado, distancia_km: x.distancia_km ?? null, eu: false })),
  ].sort((a, b) => (a.posicao ?? 99) - (b.posicao ?? 99));
  const maior = (k: "avaliacoes" | "novas_30d" | "fotos" | "nota") => Math.max(0, ...linhas.map((l) => Number(l[k] ?? 0)));

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 [break-inside:avoid-page]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[17px] font-semibold"><Swords size={17} className="text-accent" /> Comparativo com concorrentes</h2>
          <p className="text-[12.5px] text-muted">Busca por "{coleta.palavra_concorrencia ?? coleta.info.categoria}" no Google Maps, a partir do endereço da empresa. Os 5 primeiros colocados, lado a lado.</p>
        </div>
        <div className="rounded-xl border border-line px-4 py-2 text-center">
          <div className="num text-[26px] font-semibold leading-none" style={{ color: !coleta.posicao_categoria ? "var(--bad)" : coleta.posicao_categoria <= 3 ? "var(--ok)" : "var(--warn)" }}>{coleta.posicao_categoria ? `${coleta.posicao_categoria}º` : "20+"}</div>
          <div className="text-[11px] text-muted">posição no Maps</div>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {insights.map((i) => {
            const t = TOM[i.tom];
            return (
              <div key={i.titulo} className="flex gap-2.5 rounded-xl p-3 text-[12.5px] leading-snug [break-inside:avoid]" style={{ background: t.fundo }}>
                <t.Icone size={16} className="mt-0.5 shrink-0" style={{ color: t.cor }} />
                <div><b style={{ color: t.cor }}>{i.titulo}</b><p className="mt-0.5">{i.texto}</p></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12.5px]">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pl-1 font-medium">Pos.</th><th className="font-medium">Empresa</th>
              <th className="text-right font-medium">Nota</th><th className="text-right font-medium">Avaliações</th><th className="text-right font-medium">Novas (30d)</th>
              <th className="text-right font-medium">Fotos</th><th className="text-right font-medium">Categorias</th><th className="text-right font-medium">Descrição</th><th className="pr-1 text-right font-medium">Distância</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {linhas.map((x) => {
              const destaque = (k: "avaliacoes" | "novas_30d" | "fotos" | "nota") => x[k] != null && Number(x[k]) === maior(k) && maior(k) > 0 ? "font-semibold text-ok" : "";
              return (
                <tr key={`${x.nome}${x.posicao}`} className={x.eu ? "bg-accent-soft/60 font-semibold" : ""}>
                  <td className="num py-2 pl-1">{x.posicao ? `${x.posicao}º` : "20+"}</td>
                  <td className="max-w-[240px] truncate pr-2">{x.nome}{x.eu && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-fg">você</span>}{x.reivindicado === false && <span className="ml-1.5 text-[10.5px] font-normal text-muted">(não reivindicada)</span>}</td>
                  <td className={`num whitespace-nowrap text-right ${destaque("nota")}`}>{x.nota != null ? `★ ${virg(x.nota)}` : "—"}</td>
                  <td className={`num whitespace-nowrap text-right ${destaque("avaliacoes")}`}>{n0(x.avaliacoes)}</td>
                  <td className={`num whitespace-nowrap text-right ${destaque("novas_30d")}`}>{n0(x.novas_30d)}</td>
                  <td className={`num whitespace-nowrap text-right ${destaque("fotos")}`}>{n0(x.fotos)}</td>
                  <td className="num text-right">{x.cats || "—"}</td>
                  <td className="num text-right">{x.descricao_tam == null ? "—" : x.descricao_tam ? `${x.descricao_tam} car.` : "sem"}</td>
                  <td className="num pr-1 text-right text-muted">{x.eu ? "—" : x.distancia_km != null ? `${virg(x.distancia_km)} km` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">"Novas (30d)" conta as avaliações do último mês entre as 20 mais recentes de cada empresa. Em verde, o melhor número de cada coluna.</p>
    </section>
  );
}
