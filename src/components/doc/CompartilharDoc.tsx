import { useState } from "react";
import { Check, Copy, ExternalLink, Globe, Lock, LockOpen } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { linkDoDocumento } from "../../lib/doc";
import { Botao, campo } from "../ui";

interface Estado { compartilhado: boolean; codigo: string | null; com_senha: boolean }

/** Liga o link público do documento (/d/código), com senha opcional. Quem abre o link só lê. */
export function CompartilharDoc({ notaId, inicial, mudou }: { notaId: string; inicial: Estado; mudou?: () => void }) {
  const [e, setE] = useState<Estado>(inicial);
  const [senha, setSenha] = useState("");
  const [trabalhando, setTrabalhando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");

  async function aplicar(ativo: boolean, novaSenha: string | null) {
    if (!supabase) return setErro("Na prévia não dá para compartilhar.");
    setTrabalhando(true);
    setErro("");
    const { data, error } = await supabase.rpc("compartilhar_nota", { p_nota: notaId, p_ativo: ativo, p_senha: novaSenha });
    setTrabalhando(false);
    if (error) return setErro(error.message);
    const r = data as { codigo: string; compartilhado: boolean; com_senha: boolean };
    setE({ compartilhado: r.compartilhado, codigo: r.codigo, com_senha: r.com_senha });
    setSenha("");
    mudou?.();
  }

  const link = e.codigo ? linkDoDocumento(e.codigo) : "";
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
        <input type="checkbox" checked={e.compartilhado} disabled={trabalhando} onChange={(ev) => aplicar(ev.target.checked, null)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
        <span className="flex-1">
          <span className="flex items-center gap-1.5 font-semibold"><Globe size={14} className="text-accent" /> Compartilhar por link</span>
          <span className="text-[12px] text-muted">Quem tiver o link lê o documento, sem login e sem poder editar. As mudanças que você salvar aparecem no link na hora.</span>
        </span>
      </label>

      {e.compartilhado && e.codigo && (
        <>
          <div className="flex gap-2">
            <input readOnly value={link} onFocus={(ev) => ev.target.select()} className={`${campo} min-w-0 flex-1 font-mono text-[12.5px]`} />
            <Botao onClick={async () => { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }}>
              {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar"}
            </Botao>
            <a href={link} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:bg-raised hover:text-fg" title="Abrir o link"><ExternalLink size={14} /></a>
          </div>

          <div className="rounded-xl border border-line p-3">
            <div className="flex items-center gap-1.5 font-semibold">
              {e.com_senha ? <Lock size={14} className="text-ok" /> : <LockOpen size={14} className="text-muted" />}
              {e.com_senha ? "Protegido por senha" : "Sem senha"}
            </div>
            <form onSubmit={(ev) => { ev.preventDefault(); if (senha.trim().length >= 4) aplicar(true, senha.trim()); }} className="mt-2 flex flex-wrap gap-2">
              <input type="text" value={senha} onChange={(ev) => setSenha(ev.target.value)} placeholder={e.com_senha ? "Nova senha" : "Criar uma senha (mín. 4 caracteres)"} className={`${campo} min-w-0 flex-1`} autoComplete="off" />
              <Botao type="submit" disabled={senha.trim().length < 4 || trabalhando}>{e.com_senha ? "Trocar senha" : "Pôr senha"}</Botao>
              {e.com_senha && <Botao type="button" variante="fantasma" disabled={trabalhando} onClick={() => aplicar(true, "")}>Tirar senha</Botao>}
            </form>
            <p className="mt-1.5 text-[11.5px] text-muted">A senha não fica visível depois de salva. Envie para a pessoa junto com o link.</p>
          </div>
        </>
      )}
      {erro && <p className="text-[12px] text-bad">{erro}</p>}
    </div>
  );
}
