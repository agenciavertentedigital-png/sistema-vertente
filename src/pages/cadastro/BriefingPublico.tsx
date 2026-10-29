import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { SECOES_BRIEFING } from "../../lib/briefing";
import logoPrata from "../../assets/logo-prata.png";

// Só as perguntas que o cliente responde; a parte interna da Vertente nunca aparece aqui
const SECOES = SECOES_BRIEFING.filter((s) => !s.interna).map((s) => ({ ...s, campos: s.campos.filter((c) => c.cliente) })).filter((s) => s.campos.length);
const TOTAL = SECOES.reduce((t, s) => t + s.campos.length, 0);

/** Briefing aberto pelo cliente, sem login, a partir do link gerado na tela do cliente. */
export function BriefingPublico({ token }: { token: string }) {
  const [estado, setEstado] = useState<"carregando" | "form" | "enviado" | "erro">("carregando");
  const [nome, setNome] = useState("");
  const [dados, setDados] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const url = `${base}/functions/v1/cadastro-publico`;
  const headers = { "Content-Type": "application/json", apikey: chave ?? "", Authorization: `Bearer ${chave ?? ""}` };

  useEffect(() => {
    if (!supabase) {
      setNome("Empresa de exemplo");
      setEstado("form");
      return;
    }
    fetch(`${url}?token=${encodeURIComponent(token)}`, { headers })
      .then((r) => r.json())
      .then((j) => {
        if (j.erro || j.tipo !== "briefing") {
          setErro(j.erro ?? "Este link não é de briefing.");
          setEstado("erro");
          return;
        }
        setNome(j.nome);
        setDados(j.dados ?? {});
        setEstado("form");
      })
      .catch(() => {
        setErro("Não foi possível abrir o briefing. Verifique a internet e tente de novo.");
        setEstado("erro");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setErro("Este é só um exemplo de como o cliente vê o briefing. Nada foi enviado.");
      return;
    }
    setEnviando(true);
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ token, dados }) }).then((x) => x.json()).catch(() => ({ erro: "Falha de conexão." }));
    setEnviando(false);
    if (r.erro) setErro(r.erro);
    else setEstado("enviado");
  }

  const feitos = SECOES.flatMap((s) => s.campos).filter((c) => dados[c.chave]?.trim()).length;

  return (
    <div className="min-h-full bg-bg">
      <div className="menu-marinho px-4 pb-16 pt-8 text-center">
        <img src={logoPrata} alt="Vertente Digital" className="mx-auto w-[180px]" />
      </div>
      <div className="mx-auto -mt-10 max-w-[720px] px-4 pb-12">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-xl sm:p-7">
          {estado === "carregando" && <p className="text-center text-muted">Carregando…</p>}
          {estado === "erro" && <p className="text-center text-bad">{erro}</p>}
          {estado === "enviado" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={48} className="text-ok" />
              <h1 className="text-[22px] font-semibold">Briefing recebido!</h1>
              <p className="max-w-[44ch] text-muted">Obrigado. Com essas respostas a equipe da Vertente monta a estratégia do seu negócio. Se lembrar de algo depois, é só abrir o link de novo e completar.</p>
            </div>
          )}
          {estado === "form" && (
            <form onSubmit={enviar} className="flex flex-col gap-6">
              <div>
                <div className="eyebrow">Briefing estratégico</div>
                <h1 className="mt-1 text-[22px] font-semibold">{nome}</h1>
                <p className="mt-1 text-[13.5px] text-muted">Conte sobre o seu negócio com suas palavras. Não precisa ser perfeito, e pode deixar em branco o que não souber. Leva uns 10 minutos.</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(feitos / TOTAL) * 100}%` }} />
                </div>
                <div className="mt-1 text-right text-[11.5px] text-muted">{feitos} de {TOTAL} respondidas</div>
              </div>
              {!supabase && (
                <p className="rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Exemplo da prévia: este formulário não grava dados. O link real é gerado na tela do cliente, aba Briefing.</p>
              )}
              {SECOES.map((s, i) => (
                <fieldset key={s.secao} className="flex flex-col gap-3">
                  <legend className="mb-1 flex items-center gap-2 text-[15px] font-semibold">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[12px] text-accent-fg">{i + 1}</span>
                    {s.secao}
                  </legend>
                  {s.campos.map((c) => (
                    <label key={c.chave} className="flex flex-col gap-1">
                      <span className="text-[13.5px] font-medium">{c.rotulo}</span>
                      <span className="text-[12px] text-muted">{c.dica}</span>
                      <textarea
                        rows={c.grande ? 4 : 2}
                        value={dados[c.chave] ?? ""}
                        onChange={(e) => setDados({ ...dados, [c.chave]: e.target.value })}
                        className="rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] text-fg outline-none focus:border-accent"
                      />
                    </label>
                  ))}
                </fieldset>
              ))}
              {erro && <p className="text-[13px] text-bad">{erro}</p>}
              <button type="submit" disabled={enviando} className="rounded-xl bg-accent px-4 py-3 text-[15px] font-semibold text-accent-fg disabled:opacity-60">
                {enviando ? "Enviando…" : "Enviar briefing"}
              </button>
              <p className="text-center text-[11.5px] text-muted">Suas respostas são usadas apenas pela equipe da Vertente Digital para planejar o seu marketing.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
