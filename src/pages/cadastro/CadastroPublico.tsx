import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import logoPrata from "../../assets/logo-prata.png";

const CAMPOS: { id: string; nome: string; tipo?: string; dica?: string; obrigatorio?: boolean }[] = [
  { id: "razao_social", nome: "Razão social ou nome completo", obrigatorio: true },
  { id: "documento", nome: "CNPJ ou CPF", obrigatorio: true },
  { id: "contato_nome", nome: "Nome do responsável", obrigatorio: true },
  { id: "contato_telefone", nome: "WhatsApp", tipo: "tel", obrigatorio: true },
  { id: "contato_email", nome: "E-mail", tipo: "email", obrigatorio: true },
  { id: "endereco", nome: "Endereço completo" },
  { id: "cidade", nome: "Cidade / UF" },
  { id: "segmento", nome: "Ramo de atividade", dica: "Ex.: clínica de estética, ótica, loja de roupas" },
  { id: "instagram", nome: "Instagram", dica: "@suaempresa" },
  { id: "site", nome: "Site (se tiver)" },
  { id: "link_gmn", nome: "Link do Google Meu Negócio (se tiver)" },
];

/** Página aberta pelo cliente, sem login, a partir do link de cadastro. */
export function CadastroPublico({ token }: { token: string }) {
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
        if (j.erro) {
          setErro(j.erro);
          setEstado("erro");
          return;
        }
        setNome(j.nome);
        setDados(Object.fromEntries(Object.entries(j.dados ?? {}).filter(([, v]) => typeof v === "string")) as Record<string, string>);
        setEstado("form");
      })
      .catch(() => {
        setErro("Não foi possível abrir o cadastro. Verifique a internet e tente de novo.");
        setEstado("erro");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setErro("Este é só um exemplo de como o cliente vê o formulário. Nada foi enviado.");
      return;
    }
    setEnviando(true);
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ token, dados }) }).then((x) => x.json()).catch(() => ({ erro: "Falha de conexão." }));
    setEnviando(false);
    if (r.erro) setErro(r.erro);
    else setEstado("enviado");
  }

  return (
    <div className="min-h-full bg-bg">
      <div className="menu-marinho px-4 pb-16 pt-8 text-center">
        <img src={logoPrata} alt="Vertente Digital" className="mx-auto w-[180px]" />
      </div>
      <div className="mx-auto -mt-10 max-w-[620px] px-4 pb-12">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl">
          {estado === "carregando" && <p className="text-center text-muted">Carregando…</p>}
          {estado === "erro" && <p className="text-center text-bad">{erro}</p>}
          {estado === "enviado" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={48} className="text-ok" />
              <h1 className="text-[22px] font-semibold">Cadastro recebido!</h1>
              <p className="max-w-[40ch] text-muted">Obrigado. A equipe da Vertente já recebeu seus dados e vai seguir com os próximos passos.</p>
            </div>
          )}
          {estado === "form" && (
            <form onSubmit={enviar} className="flex flex-col gap-4">
              <div>
                <div className="eyebrow">Cadastro de cliente</div>
                <h1 className="mt-1 text-[22px] font-semibold">{nome}</h1>
                <p className="mt-1 text-[13px] text-muted">Preencha seus dados para o cadastro e o contrato com a Vertente Digital.</p>
              </div>
              {!supabase && (
                <p className="rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Exemplo da prévia: este formulário não grava dados. O link real é gerado pelo sistema em sistema.agenciavertente.com.br.</p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CAMPOS.map((c) => (
                  <label key={c.id} className={`flex flex-col gap-1 text-[12.5px] text-muted ${c.id === "endereco" || c.id === "razao_social" ? "sm:col-span-2" : ""}`}>
                    {c.nome}
                    {c.obrigatorio && <span className="sr-only">(obrigatório)</span>}
                    <input
                      type={c.tipo ?? "text"}
                      required={c.obrigatorio}
                      value={dados[c.id] ?? ""}
                      placeholder={c.dica}
                      onChange={(e) => setDados({ ...dados, [c.id]: e.target.value })}
                      className="rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] text-fg outline-none focus:border-accent"
                    />
                  </label>
                ))}
              </div>
              {erro && <p className="text-[13px] text-bad">{erro}</p>}
              <button type="submit" disabled={enviando} className="rounded-xl bg-accent px-4 py-3 text-[15px] font-semibold text-accent-fg disabled:opacity-60">
                {enviando ? "Enviando…" : "Enviar cadastro"}
              </button>
              <p className="text-center text-[11.5px] text-muted">Seus dados são usados apenas para o cadastro e o contrato com a Vertente Digital.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
