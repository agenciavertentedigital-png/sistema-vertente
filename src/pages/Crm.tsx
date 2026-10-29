import { ExternalLink, Info, MessagesSquare } from "lucide-react";

/** Endereço do CRM Vertente (plataforma whitelabel de terceiros). */
export const CRM_URL = "https://app.agenciavertente.com.br";

/**
 * CRM incorporado por iframe. O login acontece na própria tela do fornecedor:
 * o sistema não pede, guarda nem lê credenciais do CRM, e o login do sistema não entra no CRM.
 * Como a página é de outra origem, não dá para saber daqui se carregou ou se o login funcionou;
 * por isso o atalho para abrir em nova aba fica sempre visível.
 */
export function Crm() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1d34a0] to-[#0b1450] text-white sm:grid">
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
        <a
          href={CRM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-fg hover:opacity-90 sm:w-auto"
        >
          <ExternalLink size={15} /> Abrir CRM em nova aba
        </a>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-surface" style={{ boxShadow: "var(--sombra)" }}>
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
