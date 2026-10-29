import { useEffect, useState } from "react";
import { Menu as MenuIcone, X } from "lucide-react";
import { Menu } from "./components/Menu";
import { Marca } from "./components/Marca";
import { useRota } from "./lib/rota";
import { MODULOS } from "./data/modulos";
import { Central } from "./pages/Central";
import { PaginaModulo } from "./pages/PaginaModulo";
import { BaseClientes } from "./pages/BaseClientes";
import { Entrar } from "./pages/Entrar";
import { sair, useSessao } from "./lib/sessao";
import { ProvedorDados, useDados } from "./lib/dados";
import { GestaoClientes } from "./pages/clientes/GestaoClientes";
import { TelaCliente } from "./pages/clientes/TelaCliente";
import { GestaoTrafego } from "./pages/trafego/GestaoTrafego";
import { Reunioes } from "./pages/Reunioes";
import { Sininho } from "./components/Sininho";
import { GoogleMeuNegocio } from "./pages/gmn/GoogleMeuNegocio";
import { SocialMedia } from "./pages/social/SocialMedia";
import { Financeiro } from "./pages/financeiro/Financeiro";
import { GestorProjetos } from "./pages/projetos/GestorProjetos";
import { Cadastro } from "./pages/cadastro/Cadastro";
import { Contratos } from "./pages/cadastro/Contratos";
import { CadastroPublico } from "./pages/cadastro/CadastroPublico";
import { Crm } from "./pages/Crm";
import { Assistente } from "./pages/Assistente";
import { Sparkles } from "lucide-react";

const PAPEIS: Record<string, string> = { admin: "Administrador", gestor: "Gestor", cs: "CS", visualizador: "Visualizador" };

type Tema = "light" | "dark";

function temaInicial(): Tema {
  const definido = document.documentElement.getAttribute("data-theme");
  if (definido === "light" || definido === "dark") return definido;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const sessao = useSessao();
  const [rota, ir] = useRota();
  const [tema, setTema] = useState<Tema>(temaInicial);
  const [menuAberto, setMenuAberto] = useState(false);

  const alternarTema = () => {
    const novo = tema === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", novo);
    setTema(novo);
  };

  const navegar = (r: string) => {
    ir(r);
    setMenuAberto(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuAberto(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Link público de cadastro: abre sem login
  if (rota.startsWith("cadastro-publico-")) return <CadastroPublico token={rota.slice(17)} />;

  if (sessao.tipo === "carregando") {
    return <div className="grid h-full place-items-center text-muted">Carregando…</div>;
  }
  if (sessao.tipo === "deslogado") return <Entrar />;
  if (sessao.tipo === "sem-acesso") return <Entrar semAcessoEmail={sessao.email} />;

  const usuario =
    sessao.tipo === "logado"
      ? { nome: sessao.membro.nome, papel: PAPEIS[sessao.membro.papel] ?? sessao.membro.papel }
      : { nome: "Modo demonstração", papel: "Sem login" };

  const modulo = MODULOS.find((m) => m.id === rota);
  let pagina = <Central ir={navegar} />;
  if (rota === "base") pagina = <BaseClientes />;
  else if (rota.startsWith("cliente-")) pagina = <TelaCliente key={rota} clienteId={rota.slice(8)} ir={navegar} />;
  else if (rota === "clientes" || rota.startsWith("clientes-")) pagina = <GestaoClientes rota={rota} ir={navegar} />;
  else if (rota === "trafego" || rota.startsWith("trafego-")) pagina = <GestaoTrafego rota={rota} ir={navegar} />;
  else if (rota.startsWith("reuniao")) pagina = <Reunioes rota={rota} ir={navegar} />;
  else if (rota === "gmn" || rota.startsWith("gmn-")) pagina = <GoogleMeuNegocio rota={rota} ir={navegar} />;
  else if (rota === "social" || rota.startsWith("social-")) pagina = <SocialMedia rota={rota} ir={navegar} />;
  else if (rota === "financeiro" || rota.startsWith("financeiro-")) pagina = <Financeiro rota={rota} ir={navegar} />;
  else if (rota === "projetos" || rota.startsWith("projetos-")) pagina = <GestorProjetos rota={rota} ir={navegar} />;
  else if (rota === "crm") pagina = <Crm />;
  else if (rota === "assistente") pagina = <Assistente />;
  else if (rota === "cadastro") pagina = <Cadastro ir={navegar} />;
  else if (rota === "contratos" || rota.startsWith("contratos-")) pagina = <Contratos rota={rota} ir={navegar} />;
  else if (modulo) pagina = <PaginaModulo key={modulo.id} modulo={modulo} ir={navegar} />;

  const menu = <Menu
      rota={rota}
      ir={navegar}
      tema={tema}
      alternarTema={alternarTema}
      usuario={usuario}
      onSair={sessao.tipo === "logado" ? sair : undefined}
    />;

  return (
    <ProvedorDados eu={sessao.tipo === "logado" ? sessao.membro.id : null}>
    <div className="flex h-full">
      <aside className="menu-marinho hidden w-[252px] shrink-0 lg:block">{menu}</aside>

      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAberto(false)} />
          <aside
            className="menu-marinho absolute inset-y-0 left-0 w-[272px] max-w-[85vw] shadow-xl"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingLeft: "env(safe-area-inset-left, 0px)" }}
          >
            <button
              onClick={() => setMenuAberto(false)}
              className="absolute right-2 top-3 rounded-lg p-2 text-muted hover:bg-raised"
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
            {menu}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-line bg-surface px-[max(16px,env(safe-area-inset-left,0px))] py-2.5 lg:hidden">
          <Marca />
          <div className="flex items-center gap-1">
          <Sininho ir={navegar} compacto />
          <button onClick={() => setMenuAberto(true)} className="rounded-lg p-2 hover:bg-raised" aria-label="Abrir menu">
            <MenuIcone size={20} />
          </button>
          </div>
        </div>
        <main
          id="area-principal"
          className={`min-h-0 flex-1 pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))] lg:pl-8 lg:pr-[max(32px,env(safe-area-inset-right,0px))] ${
            rota === "crm" || rota === "assistente"
              ? "overflow-hidden pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3 sm:pb-5 sm:pt-5"
              : "overflow-y-auto py-6 sm:py-8"
          }`}
        >
          {pagina}
        </main>
        {rota !== "assistente" && rota !== "crm" && (
          <button
            onClick={() => navegar("assistente")}
            className="fixed right-[max(16px,env(safe-area-inset-right,0px))] z-30 flex items-center gap-2 rounded-full bg-gradient-to-br from-[#1d34a0] to-[#0b1450] px-4 py-3 text-[13px] font-medium text-white shadow-xl transition-transform hover:-translate-y-0.5"
            style={{ bottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
            aria-label="Abrir o Assistente de IA"
          >
            <Sparkles size={16} /> <span className="hidden sm:inline">Perguntar à IA</span>
          </button>
        )}
      </div>
      <Aviso />
    </div>
    </ProvedorDados>
  );
}

function Aviso() {
  const { aviso } = useDados();
  if (!aviso) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-fg px-4 py-2 text-[13px] text-bg shadow-lg"
      style={{ bottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
    >
      {aviso}
    </div>
  );
}
