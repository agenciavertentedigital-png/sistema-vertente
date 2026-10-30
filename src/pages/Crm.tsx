import { useEffect, useState } from "react";
import { ExternalLink, Info, Maximize2, MessagesSquare, Minimize2 } from "lucide-react";

/** Endereço do CRM Vertente (plataforma whitelabel de terceiros). */
export const CRM_URL = "https://app.agenciavertente.com.br";

/**
 * CRM incorporado por iframe. O login acontece na própria tela do fornecedor:
 * o sistema não pede, guarda nem lê credenciais do CRM, e o login do sistema não entra no CRM.
 * Como a página é de outra origem, não dá para saber daqui se carregou ou se o login funcionou;
 * por isso o atalho para abrir em nova aba fica sempre visível.
 * "Tela cheia" só muda o tamanho da área: o iframe continua o mesmo, sem recarregar o CRM.
 */
export function Crm() {
  const [cheia, setCheia] = useState(() => {
    try {
      return localStorage.getItem("vertente.crm-cheia") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("vertente.crm-cheia", cheia ? "1" : "0");
    } catch {
      /* sem armazenamento */
    }
    if (!cheia) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCheia(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cheia]);

  const botaoNovaAba = (compacto: boolean) => (
    <a
      href={CRM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium ${
        compacto ? "px-2.5 py-1.5 text-[12.5px] text-fg hover:bg-raised" : "flex-1 bg-accent px-3.5 py-2 text-[13px] text-accent-fg hover:opacity-90 sm:flex-none"
      }`}
    >
      <ExternalLink size={compacto ? 14 : 15} /> Abrir CRM em nova aba
    </a>
  );

  return (
    <div
      className={
        cheia
          ? "fixed inset-0 z-[70] flex flex-col bg-bg pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)]"
          : "flex h-full min-h-0 flex-col gap-3"
      }
    >
      <header className={cheia ? "flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-1.5" : "flex flex-wrap items-center justify-between gap-x-4 gap-y-2"}>
        {cheia ? (
          <>
            <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
              <MessagesSquare size={15} className="text-accent" /> CRM
              <span className="hidden truncate text-[11.5px] font-normal text-muted md:inline">· Se o CRM não aparecer ou o login não funcionar aqui, abra em uma nova aba.</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {botaoNovaAba(true)}
              <button onClick={() => setCheia(false)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[12.5px] font-medium text-accent-fg hover:opacity-90" title="Sair da tela cheia (Esc)">
                <Minimize2 size={14} /> <span className="hidden sm:inline">Diminuir</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-accent sm:grid">
                <MessagesSquare size={19} />
              </span>
              <div className="min-w-0">
                <h1 className="text-[20px] font-semibold leading-tight sm:text-[22px]">CRM</h1>
                <p className="flex items-start gap-1.5 text-[12px] text-muted">
                  <Info size={13} className="mt-px shrink-0" />
                  <span>Se o CRM não aparecer ou o login não funcionar aqui, abra em uma nova aba.</span>
                </p>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button onClick={() => setCheia(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium hover:bg-raised" title="Ampliar o CRM para a tela toda">
                <Maximize2 size={15} /> Tela cheia
              </button>
              {botaoNovaAba(false)}
            </div>
          </>
        )}
      </header>

      <div className={`relative min-h-0 flex-1 overflow-hidden bg-surface ${cheia ? "" : "rounded-xl"}`} style={cheia ? undefined : { boxShadow: "var(--sombra)" }}>
        {/* Fica atrás do iframe: some quando o CRM desenha a página. Não indica sucesso nem falha. */}
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-[13px] text-muted">
          <div>
            Carregando o CRM…
            <div className="mt-1 text-[12px]">Se nada aparecer, use o botão "Abrir CRM em nova aba".</div>
          </div>
        </div>
        <iframe
          src={CRM_URL}
          title="CRM Vertente Digital"
          className="relative block h-full w-full border-0"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
