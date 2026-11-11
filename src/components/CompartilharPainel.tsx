import { useEffect, useState } from "react";
import { Copy, ExternalLink, Share2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { useDados } from "../lib/dados";
import { Botao } from "./ui";

type Portal = { slug: string; ativo: boolean; mostrar: { trafego?: boolean; diario?: boolean; conquistas?: boolean; instagram?: boolean }; ultimo_acesso: string | null };
const SITE = "https://sistema.agenciavertente.com.br";
const slugDe = (nome: string) => nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cliente";

/** Botão + janela para criar o Painel do cliente (link + senha) e escolher o que ele vê. */
export function CompartilharPainel({ clienteId }: { clienteId: string }) {
  const [aberto, setAberto] = useState(false);
  if (!supabase) return null;
  return (
    <>
      <button onClick={() => setAberto(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-medium hover:border-line-forte" title="Painel do cliente">
        <Share2 size={14} /> <span className="hidden sm:inline">Painel do cliente</span>
      </button>
      {aberto && <Janela clienteId={clienteId} fechar={() => setAberto(false)} />}
    </>
  );
}

function Janela({ clienteId, fechar }: { clienteId: string; fechar: () => void }) {
  const d = useDados();
  const nome = d.cliente(clienteId)?.nome ?? "cliente";
  const [p, setP] = useState<Portal | null | undefined>(undefined);
  const [slug, setSlug] = useState(slugDe(nome));
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [faltaBanco, setFaltaBanco] = useState(false);

  const carregar = async () => {
    const r = await supabase!.from("portal_clientes").select("slug, ativo, mostrar, ultimo_acesso").eq("cliente_id", clienteId).maybeSingle();
    if (r.error) { setFaltaBanco(true); return setP(null); }
    setP(r.data as Portal | null);
    if (r.data) setSlug((r.data as Portal).slug);
  };
  useEffect(() => { carregar(); }, [clienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = `${SITE}/#painel-${p?.slug ?? slug}`;
  const copiar = (t: string, msg: string) => navigator.clipboard?.writeText(t).then(() => d.avisar(msg), () => d.avisar("Selecione e copie manualmente"));

  async function salvar() {
    if (!p && senha.length < 6) return d.avisar("Defina uma senha com pelo menos 6 caracteres.");
    if (senha && senha.length < 6) return d.avisar("A senha precisa ter pelo menos 6 caracteres.");
    setSalvando(true);
    const r = await supabase!.rpc("definir_portal", { p_cliente: clienteId, p_slug: slug, p_senha: senha || null });
    setSalvando(false);
    if (r.error) return d.avisar(r.error.message);
    if (senha) copiar(senha, "Painel salvo. A senha foi copiada: envie para o cliente separada do link.");
    else d.avisar("Painel salvo");
    setSenha("");
    carregar();
  }
  async function mudar(campos: Partial<Pick<Portal, "ativo" | "mostrar">>) {
    const r = await supabase!.from("portal_clientes").update(campos).eq("cliente_id", clienteId);
    if (r.error) return d.avisar(r.error.message);
    setP((x) => (x ? { ...x, ...campos } : x));
  }
  const gerarSenha = () => {
    const a = "abcdefghjkmnpqrstuvwxyz23456789";
    setSenha(Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => a[n % a.length]).join(""));
  };

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4 text-fg">
      <div className="anim-entrar absolute inset-0 bg-[rgb(12_14_20/0.35)] backdrop-blur-[2px]" onClick={fechar} />
      <section role="dialog" aria-modal="true" aria-label="Painel do cliente" className="relative flex max-h-[90dvh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-surface p-5" style={{ boxShadow: "var(--sombra-flutuante)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold">Painel do cliente · {nome}</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">Uma página só dele, com senha: resultados das campanhas, pequenas conquistas e Diário de Bordo (versão do cliente).</p>
          </div>
          <button onClick={fechar} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised" aria-label="Fechar"><X size={16} /></button>
        </div>

        {p === undefined ? <p className="text-[13px] text-muted">Carregando…</p> : faltaBanco ? (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Falta aplicar a atualização do banco do Painel do cliente.</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium">
              Link
              <div className="flex items-center rounded-lg border border-line bg-bg pl-2.5 focus-within:border-accent">
                <span className="whitespace-nowrap text-[12px] text-muted">…/#painel-</span>
                <input value={slug} onChange={(e) => setSlug(slugDe(e.target.value))} className="h-9 min-w-0 flex-1 bg-transparent px-1 text-[13px] outline-none" />
              </div>
            </label>
            <label className="flex flex-col gap-1 text-[12.5px] font-medium">
              {p ? "Trocar a senha (deixe vazio para manter)" : "Senha"}
              <div className="flex gap-2">
                <input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 6 caracteres" autoComplete="new-password" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 text-[13px] outline-none focus:border-accent" />
                <Botao onClick={gerarSenha}>Gerar</Botao>
              </div>
            </label>
            <Botao variante="primario" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : p ? "Salvar" : "Criar painel"}</Botao>

            {p && (
              <div className="flex flex-col gap-3 border-t border-line pt-4">
                <div className="flex flex-wrap gap-2">
                  <Botao onClick={() => copiar(link, "Link copiado")}><Copy size={13} /> Copiar link</Botao>
                  <Botao onClick={() => copiar(`Oi! Preparamos um painel só seu para acompanhar os resultados das campanhas e tudo o que estamos fazendo pelo seu negócio: ${link}\n\nA senha eu te mando na próxima mensagem.`, "Mensagem copiada")}><Copy size={13} /> Copiar mensagem</Botao>
                  <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 text-[12.5px] text-accent hover:underline"><ExternalLink size={12} /> Abrir</a>
                </div>
                <div className="flex flex-col gap-1.5 text-[13px]">
                  <span className="text-[12.5px] font-medium">O que o cliente vê</span>
                  {([["trafego", "Resultados das campanhas"], ["instagram", "Instagram (se o perfil estiver ligado)"], ["conquistas", "Pequenas conquistas"], ["diario", "Diário de Bordo"]] as const).map(([k, n]) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="checkbox" checked={p.mostrar?.[k] !== false} onChange={(e) => mudar({ mostrar: { ...p.mostrar, [k]: e.target.checked } })} className="h-4 w-4 accent-[var(--accent)]" /> {n}
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={p.ativo} onChange={(e) => mudar({ ativo: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                  Painel ativo {!p.ativo && <span className="text-[12px] text-bad">(o cliente não consegue entrar)</span>}
                </label>
                <p className="text-[11.5px] text-muted">{p.ultimo_acesso ? `Último acesso do cliente: ${new Date(p.ultimo_acesso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}` : "O cliente ainda não entrou."} A senha fica guardada de forma que nem o time consegue ver; para mudar, defina uma nova.</p>
              </div>
            )}
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
