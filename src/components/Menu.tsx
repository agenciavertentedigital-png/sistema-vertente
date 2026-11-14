import type { LucideIcon } from "lucide-react";
import { arrastavelFavorito, useFavoritos } from "../lib/favoritos";
import { ArrowLeft, ChevronDown, LayoutGrid, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Plug, Search, Sun } from "lucide-react";
import { Sininho } from "./Sininho";
import { AVULSOS, SECOES, ativo, moduloDe, submenuAtivo } from "../data/navegacao";
import { Marca } from "./Marca";
import { useRef, useState } from "react";
import { Iniciais } from "./ui";
import { useDadosOpcional } from "../lib/dados";
import { enviarFotoMembro } from "../lib/fotos";

/** Foto (ou iniciais) de quem está logado; um clique abre o seletor para trocar a foto. */
function MinhaFoto({ nome }: { nome: string }) {
  const d = useDadosOpcional();
  const arquivo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const eu = d?.eu ? d.membro(d.eu) : undefined;
  if (!d?.eu) return <Iniciais nome={nome} tamanho="m" foto={null} />;
  return (
    <>
      <button
        onClick={() => arquivo.current?.click()}
        disabled={enviando}
        className={`group relative shrink-0 rounded-full ${enviando ? "animate-pulse" : ""}`}
        title="Trocar minha foto"
        aria-label="Trocar minha foto"
      >
        <Iniciais nome={eu?.nome ?? nome} foto={eu?.foto_url ?? null} tamanho="m" />
        <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-full bg-black/45 text-[9px] font-semibold text-white opacity-0 transition group-hover:opacity-100">Trocar</span>
      </button>
      <input
        ref={arquivo}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f || !d.eu) return;
          setEnviando(true);
          try {
            await enviarFotoMembro(d.eu, f, true);
            await d.recarregar();
            d.avisar("Foto atualizada");
          } catch (err) {
            d.avisar((err as Error).message);
          } finally {
            setEnviando(false);
          }
        }}
      />
    </>
  );
}

interface Props {
  rota: string;
  ir: (r: string) => void;
  tema: "light" | "dark";
  alternarTema: () => void;
  usuario: { nome: string; papel: string };
  onSair?: () => void;
  /** Menu recolhido: só ícones (desktop) */
  recolhido?: boolean;
  alternarRecolhido?: () => void;
  abrirComando?: () => void;
}

function Item({
  ativo,
  onClick,
  icone: Icone,
  rotulo,
  apagado,
  recolhido,
  rotaFav,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: LucideIcon;
  rotulo: string;
  apagado?: boolean;
  recolhido?: boolean;
  rotaFav?: string;
}) {
  const fav = useFavoritos();
  return (
    <button
      {...(fav.ativo && rotaFav ? arrastavelFavorito({ tipo: "rota", alvo: rotaFav, nome: rotulo }) : {})}
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      title={recolhido ? rotulo : undefined}
      aria-label={recolhido ? rotulo : undefined}
      className={`group relative flex w-full items-center gap-2.5 rounded-lg py-[7px] text-left text-[13px] ${recolhido ? "justify-center px-0" : "px-2.5"} ${
        ativo ? "bg-surface font-semibold text-fg shadow-[0_0_0_1px_var(--line)]" : apagado ? "text-muted hover:bg-raised" : "text-muted hover:bg-raised hover:text-fg"
      }`}
    >
      {/* traço "vertente": marca o item ativo */}
      <span
        aria-hidden
        className={`absolute -left-3 top-1.5 bottom-1.5 w-[2.5px] origin-top rounded-full bg-accent transition-transform duration-200 ${ativo ? "scale-y-100" : "scale-y-0"} ${recolhido ? "-left-2" : ""}`}
      />
      <Icone size={recolhido ? 18 : 16} strokeWidth={ativo ? 2 : 1.7} className={ativo ? "text-accent" : ""} />
      {!recolhido && <span className="truncate">{rotulo}</span>}
    </button>
  );
}

export function Menu({ rota, ir, tema, alternarTema, usuario, onSair, recolhido = false, alternarRecolhido, abrirComando }: Props) {
  return (
    <nav className={`flex h-full flex-col gap-4 overflow-y-auto overflow-x-hidden pb-3 pt-4 ${recolhido ? "px-2" : "px-3"}`} style={{ scrollbarWidth: "none" }} aria-label="Menu principal">
      <div className={`flex items-center ${recolhido ? "flex-col gap-3" : "justify-between gap-2 px-1.5"}`}>
        <button onClick={() => ir("inicio")} title="Ir para a Central Vertente" aria-label="Ir para a Central Vertente" className="rounded-lg">
          <Marca compacta={recolhido} />
        </button>
        {alternarRecolhido && (
          <button
            onClick={alternarRecolhido}
            className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-fg"
            title={recolhido ? "Mostrar menu" : "Recolher menu"}
            aria-label={recolhido ? "Mostrar menu" : "Recolher menu"}
          >
            {recolhido ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        )}
      </div>

      {abrirComando && (
        <button
          onClick={abrirComando}
          title="Buscar e ir para (Ctrl K)"
          className={`flex items-center gap-2 rounded-lg border border-line bg-surface text-[13px] text-muted hover:border-line-forte hover:text-fg ${recolhido ? "justify-center p-2" : "px-2.5 py-1.5"}`}
        >
          <Search size={15} strokeWidth={1.8} />
          {!recolhido && <><span className="flex-1 text-left">Buscar…</span><kbd>Ctrl K</kbd></>}
        </button>
      )}

      <Contexto rota={rota} ir={ir} recolhido={recolhido} />

      <div className={`mt-auto flex border-t border-line pt-3 ${recolhido ? "flex-col items-center gap-1" : "items-center justify-between px-1.5"}`}>
        {recolhido ? (
          <MinhaFoto nome={usuario.nome} />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <MinhaFoto nome={usuario.nome} />
            <div className="min-w-0 text-[12px] leading-tight">
              <div className="truncate font-medium">{usuario.nome}</div>
              <div className="text-muted">{usuario.papel}</div>
            </div>
          </div>
        )}
        <div className={`flex ${recolhido ? "flex-col" : ""}`}>
          <button onClick={() => ir("integracoes")} className={`rounded-lg p-2 hover:bg-raised hover:text-fg ${rota === "integracoes" ? "text-accent" : "text-muted"}`} aria-label="Integrações" title="Integrações">
            <Plug size={16} />
          </button>
          <button
            onClick={alternarTema}
            className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg"
            aria-label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          >
            {tema === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {onSair && (
            <button onClick={onSair} className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg" aria-label="Sair" title="Sair">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

/**
 * Barra lateral contextual: botão fixo de volta para a Central, o módulo aberto com os submenus dele,
 * os outros módulos da mesma área e (recolhido) a troca rápida para qualquer módulo.
 */
function Contexto({ rota, ir, recolhido }: { rota: string; ir: (r: string) => void; recolhido: boolean }) {
  const [outros, setOutros] = useState(false);
  const m = moduloDe(rota);
  const voltar = (
    <button
      onClick={() => ir("inicio")}
      title="Voltar para a Central Vertente"
      aria-label="Voltar para a Central Vertente"
      className={`flex items-center gap-2 rounded-lg border border-line bg-surface text-[13px] font-medium text-fg hover:border-accent hover:text-accent ${recolhido ? "justify-center p-2" : "px-2.5 py-2"}`}
    >
      <ArrowLeft size={15} strokeWidth={2} />
      {!recolhido && <span className="flex-1 text-left">Central Vertente</span>}
      {!recolhido && <LayoutGrid size={14} className="text-muted" />}
    </button>
  );
  if (!m) return <div className="flex flex-col gap-2">{voltar}{recolhido ? <div className="flex justify-center"><Sininho ir={ir} compacto /></div> : <Sininho ir={ir} />}</div>;

  const { topico: t, secao } = m;
  const Ic = t.icone;
  const sub = submenuAtivo(t, rota);
  const vizinhos = secao ? secao.topicos.filter((x) => x.id !== t.id) : AVULSOS.filter((x) => x.id !== t.id);

  return (
    <>
      {voltar}

      {/* Módulo aberto */}
      <div className="flex flex-col gap-0.5">
        {recolhido ? (
          <div className="mb-1 flex justify-center" title={t.nome}>
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: t.cor }}><Ic size={17} /></span>
          </div>
        ) : (
          <button onClick={() => ir(t.rota)} className="mb-1.5 flex items-center gap-2.5 rounded-xl px-1.5 py-1 text-left">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: t.cor }}><Ic size={17} /></span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold leading-tight">{t.nome}</span>
              {secao && <span className="block truncate text-[11.5px] text-muted">{secao.nome}</span>}
            </span>
          </button>
        )}
        {!recolhido && t.submenus?.map((a) => <SubItem key={a.rota} ativo={sub === a.rota} onClick={() => ir(a.rota)} rotulo={a.nome} rotaFav={a.rota} />)}
      </div>

      {recolhido ? <div className="flex justify-center"><Sininho ir={ir} compacto /></div> : <Sininho ir={ir} />}

      {/* Mesma área: troca em 1 clique sem voltar para a Central */}
      {vizinhos.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {recolhido ? <div className="mx-2 mb-1 border-t border-line" /> : <div className="px-2.5 pb-1 text-[11.5px] font-medium text-muted/80">{secao ? `Também em ${secao.nome}` : "Inteligência e sistema"}</div>}
          {vizinhos.map((x) => <Item key={x.id} ativo={false} onClick={() => ir(x.rota)} icone={x.icone} rotulo={x.nome} recolhido={recolhido} rotaFav={x.rota} apagado />)}
        </div>
      )}

      {/* Outros módulos (recolhido por padrão) */}
      {!recolhido && (
        <div className="flex flex-col gap-0.5">
          <button onClick={() => setOutros((v) => !v)} className="flex items-center justify-between rounded-lg px-2.5 py-1 text-[11.5px] font-medium text-muted/80 hover:text-fg" aria-expanded={outros}>
            Outros módulos <ChevronDown size={13} className={`transition-transform ${outros ? "rotate-180" : ""}`} />
          </button>
          {outros && [...SECOES.filter((s) => s.id !== secao?.id).flatMap((s) => s.topicos), ...AVULSOS.filter((x) => x.id !== t.id && secao)].map((x) => (
            <Item key={x.id} ativo={ativo(x, rota)} onClick={() => ir(x.rota)} icone={x.icone} rotulo={x.nome} rotaFav={x.rota} apagado />
          ))}
        </div>
      )}
    </>
  );
}

function SubItem({ ativo: on, onClick, rotulo, rotaFav }: { ativo: boolean; onClick: () => void; rotulo: string; rotaFav: string }) {
  const fav = useFavoritos();
  return (
    <button
      {...(fav.ativo ? arrastavelFavorito({ tipo: "rota", alvo: rotaFav, nome: rotulo }) : {})}
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      className={`group relative flex w-full items-center gap-2.5 rounded-lg py-[7px] pl-[46px] pr-2.5 text-left text-[13px] ${on ? "bg-surface font-semibold text-fg shadow-[0_0_0_1px_var(--line)]" : "text-muted hover:bg-raised hover:text-fg"}`}
    >
      <span aria-hidden className={`absolute left-[22px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${on ? "bg-accent" : "bg-line-forte"}`} />
      <span aria-hidden className={`absolute -left-3 top-1.5 bottom-1.5 w-[2.5px] origin-top rounded-full bg-accent transition-transform duration-200 ${on ? "scale-y-100" : "scale-y-0"}`} />
      <span className="truncate">{rotulo}</span>
    </button>
  );
}
