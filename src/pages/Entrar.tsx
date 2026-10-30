import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import simbolo from "../assets/simbolo-azul.png";
import logoPrata from "../assets/simbolo-prata.png";

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

  const [verSenha, setVerSenha] = useState(false);

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

  async function esqueci() {
    if (!supabase) return;
    setErro("");
    setAviso("");
    if (!email.trim()) return setErro("Escreva seu e-mail acima e clique de novo em Esqueci a senha.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (error) setErro(error.message);
    else setAviso("Enviamos um link para criar uma nova senha. Confira seu e-mail.");
  }

  const campo = "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[14px] outline-none hover:border-line-forte focus:border-accent focus:ring-[3px] focus:ring-accent/15";

  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden bg-bg px-[max(16px,env(safe-area-inset-left,0px))] py-12">
      {/* traço vertente: a linha que desce, única decoração da tela */}
      <div className="anim-entrar relative w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center">
          <span aria-hidden className="mb-0 block h-20 w-px bg-gradient-to-b from-transparent to-accent/50" />
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface">
            <img src={simbolo} alt="" className="h-9 w-9 object-contain dark-oculto" />
            <img src={logoPrata} alt="" className="claro-oculto h-9 w-9 object-contain" />
          </span>
          <h1 className="mt-5 text-[24px] font-semibold">{modo === "entrar" ? "Entrar na Vertente" : "Criar seu acesso"}</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {modo === "entrar" ? "Use o e-mail cadastrado no time." : "Só e-mails cadastrados no time conseguem ver os dados."}
          </p>
        </div>

        {semAcessoEmail && (
          <div className="mt-6 rounded-xl border border-warn/30 bg-warn-soft px-3.5 py-3 text-[13px] text-warn">
            {semAcessoEmail} ainda não está no time. Peça a um administrador para cadastrar este e-mail.
            <button onClick={() => supabase?.auth.signOut()} className="mt-1 block font-semibold underline">Sair e usar outro e-mail</button>
          </div>
        )}

        <form onSubmit={enviar} className="mt-7 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            E-mail
            <input id="entrar-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} placeholder="voce@agenciavertente.com.br" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            <span className="flex items-center justify-between">
              Senha
              {modo === "entrar" && <button type="button" onClick={esqueci} className="text-[12.5px] font-medium text-accent hover:underline">Esqueci a senha</button>}
            </span>
            <span className="relative">
              <input
                id="entrar-senha"
                type={verSenha ? "text" : "password"}
                required
                minLength={8}
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className={`${campo} pr-11`}
              />
              <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg" aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}>
                {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          {erro && <p className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{erro}</p>}
          {aviso && <p className="rounded-lg bg-ok-soft px-3 py-2 text-[13px] text-ok">{aviso}</p>}
          <button type="submit" disabled={enviando} className="mt-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-fg hover:bg-accent/90 active:scale-[0.99] disabled:opacity-60">
            {enviando && <Loader2 size={16} className="animate-spin" />}
            {enviando ? "Entrando…" : modo === "entrar" ? "Entrar" : "Criar acesso"}
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-muted">
          {modo === "entrar" ? "Primeiro acesso?" : "Já tem acesso?"}{" "}
          <button onClick={() => { setModo(modo === "entrar" ? "criar" : "entrar"); setErro(""); setAviso(""); }} className="font-semibold text-fg hover:underline">
            {modo === "entrar" ? "Criar senha" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}
