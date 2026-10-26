import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Marca } from "../components/Marca";

type Modo = "entrar" | "criar";

const ERROS: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme o e-mail pelo link que enviamos antes de entrar.",
  "User already registered": "Este e-mail já tem acesso. Use Entrar.",
};

export function Entrar({ semAcessoEmail }: { semAcessoEmail?: string }) {
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setErro("");
    setAviso("");
    setEnviando(true);
    const res =
      modo === "entrar"
        ? await supabase.auth.signInWithPassword({ email, password: senha })
        : await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin } });
    setEnviando(false);
    if (res.error) {
      setErro(ERROS[res.error.message] ?? res.error.message);
      return;
    }
    if (modo === "criar" && !res.data.session) {
      setAviso("Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre.");
      setModo("entrar");
    }
  }

  return (
    <div className="grid min-h-full place-items-center px-[max(16px,env(safe-area-inset-left,0px))] py-10">
      <div className="w-full max-w-[380px]">
        <Marca />
        <h1 className="mt-6 text-[24px] font-semibold">{modo === "entrar" ? "Entrar no sistema" : "Criar seu acesso"}</h1>
        <p className="mt-1 text-muted">
          {modo === "entrar"
            ? "Use o e-mail cadastrado no time da Vertente."
            : "Só e-mails cadastrados no time conseguem ver os dados."}
        </p>

        {semAcessoEmail && (
          <div className="mt-4 rounded-lg bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
            {semAcessoEmail} ainda não está no time. Peça a um administrador para cadastrar este e-mail.
            <button onClick={() => supabase?.auth.signOut()} className="mt-1 block font-medium underline">
              Sair e usar outro e-mail
            </button>
          </div>
        )}

        <form onSubmit={enviar} className="mt-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px]">
            E-mail
            <input
              id="entrar-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px]">
            Senha
            <input
              id="entrar-senha"
              type="password"
              required
              minLength={8}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
            />
          </label>
          {erro && <p className="text-[13px] text-warn">{erro}</p>}
          {aviso && <p className="text-[13px] text-ok">{aviso}</p>}
          <button
            type="submit"
            disabled={enviando}
            className="mt-1 rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg disabled:opacity-60"
          >
            {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar acesso"}
          </button>
        </form>

        <button
          onClick={() => {
            setModo(modo === "entrar" ? "criar" : "entrar");
            setErro("");
          }}
          className="mt-4 text-[13px] text-muted hover:text-fg"
        >
          {modo === "entrar" ? "Primeiro acesso? Criar senha" : "Já tenho acesso. Entrar"}
        </button>
      </div>
    </div>
  );
}
