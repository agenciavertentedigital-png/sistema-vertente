import { useEffect, useState } from "react";
import { FileText, Lock, Printer } from "lucide-react";
import { supabase } from "../lib/supabase";
import { htmlDoDocumento, htmlLimpo } from "../lib/doc";
import { Marca } from "../components/Marca";

interface Doc { titulo: string | null; conteudo: string | null; texto: string | null; atualizado_em: string; cliente: string | null; autor: string | null }
type Estado = { tipo: "carregando" } | { tipo: "erro"; msg: string } | { tipo: "senha"; errou: boolean } | { tipo: "ok"; doc: Doc };

/** Documento compartilhado por link (/d/código): leitura pública, sem login, com senha opcional. */
export function DocPublico({ codigo }: { codigo: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function abrir(s: string | null) {
    if (!supabase) return setEstado({ tipo: "erro", msg: "Documento indisponível nesta prévia." });
    setEnviando(true);
    const { data, error } = await supabase.rpc("nota_publica", { p_codigo: codigo, p_senha: s });
    setEnviando(false);
    if (error) return setEstado({ tipo: "erro", msg: "Não foi possível abrir o documento agora. Tente de novo em instantes." });
    const r = data as Doc & { erro?: string; precisa_senha?: boolean; senha_errada?: boolean };
    if (r.erro) return setEstado({ tipo: "erro", msg: "Este link não existe ou não está mais compartilhado." });
    if (r.precisa_senha) return setEstado({ tipo: "senha", errou: Boolean(r.senha_errada) });
    setEstado({ tipo: "ok", doc: r });
    document.title = `${r.titulo || "Documento"} · Vertente Digital`;
  }
  useEffect(() => { abrir(null); }, [codigo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-full overflow-y-auto bg-bg">
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-5 py-3">
          <a href="https://agenciavertente.com.br" target="_blank" rel="noreferrer"><Marca /></a>
          {estado.tipo === "ok" && (
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted hover:bg-raised hover:text-fg"><Printer size={14} /> Imprimir / PDF</button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-5 py-8 sm:py-12">
        {estado.tipo === "carregando" && <div className="h-40 animate-pulse rounded-2xl bg-raised" />}

        {estado.tipo === "erro" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-14 text-center">
            <FileText size={28} className="text-muted" />
            <p className="text-[15px]">{estado.msg}</p>
          </div>
        )}

        {estado.tipo === "senha" && (
          <form onSubmit={(e) => { e.preventDefault(); if (senha.trim()) abrir(senha.trim()); }} className="mx-auto flex max-w-[380px] flex-col gap-3 rounded-2xl border border-line bg-surface p-6 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent"><Lock size={20} /></span>
            <h1 className="font-display text-[18px] font-bold">Documento protegido</h1>
            <p className="text-[13px] text-muted">Digite a senha que a Vertente Digital enviou junto com o link.</p>
            <input autoFocus type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" className="rounded-xl border border-line bg-bg px-3 py-2.5 text-center text-[15px] outline-none focus:border-accent" />
            {estado.errou && <p className="text-[12.5px] text-bad">Senha incorreta.</p>}
            <button disabled={enviando || !senha.trim()} className="rounded-xl bg-accent py-2.5 text-[14px] font-semibold text-accent-fg disabled:opacity-50">{enviando ? "Abrindo…" : "Abrir documento"}</button>
          </form>
        )}

        {estado.tipo === "ok" && (
          <article className="rounded-2xl border border-line bg-surface px-6 py-8 shadow-sm sm:px-12 sm:py-12 print:border-0 print:p-0 print:shadow-none">
            {estado.doc.cliente && <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-accent">{estado.doc.cliente}</div>}
            {estado.doc.titulo && <h1 className="mt-1 font-display text-[30px] font-extrabold leading-tight tracking-tight sm:text-[34px]">{estado.doc.titulo}</h1>}
            <div className="mt-2 text-[12.5px] text-muted">
              {estado.doc.autor ? `${estado.doc.autor} · ` : ""}atualizado em {new Date(estado.doc.atualizado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
            <hr className="my-6 border-line" />
            <div className="doc doc-leitura" dangerouslySetInnerHTML={{ __html: htmlLimpo(htmlDoDocumento(estado.doc.conteudo, estado.doc.texto)) }} />
          </article>
        )}
        <p className="mt-6 text-center text-[11.5px] text-muted print:hidden">Documento compartilhado pela Vertente Digital · somente leitura</p>
      </main>
    </div>
  );
}
