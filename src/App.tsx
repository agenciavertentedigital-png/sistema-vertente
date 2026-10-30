import { useCallback, useEffect, useState } from "react";
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
import { supabase } from "./lib/supabase";
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
import { Comando, useAtalhoComando } from "./components/Comando";
import { Assistente } from "./pages/Assistente";
import { Integracoes } from "./pages/Integracoes";
import { CentralAnotacoes } from "./pages/CentralAnotacoes";
import { BriefingPublico } from "./pages/cadastro/BriefingPublico";
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
  const [comando, setComando] = useState(false);
  const [novaSenha, setNovaSenha] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((evento) => { if (evento === "PASSWORD_RECOVERY") setNovaSenha(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  const abrirComando = useCallback(() => setComando(true), []);
  useAtalhoComando(abrirComando);
  const [recolhido, setRecolhido] = useState(() => {
    try {
      return localStorage.getItem("vertente.menu-recolhido") === "1";
    } catch {
      return false;
    }
  });
  const alternarRecolhido = () => {
    setRecolhido((r) => {
      try {
        localStorage.setItem("vertente.menu-recolhido", r ? "0" : "1");
      } catch {
        /* sem armazenamento: vale só nesta visita */
      }
      return !r;
    });
  };

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
  if (rota.startsWith("briefing-publico-")) return <BriefingPublico token={rota.slice(17)} />;

  if (sessao.tipo === "carregando") {
    return <div className="grid h-full place-items-center text-muted">Carregando…</div>;
  }
  if (sessao.tipo === "deslogado" || (!supabase && rota === "entrar")) return <Entrar />;
  if (sessao.tipo === "sem-acesso") return <Entrar semAcessoEmail={sessao.email} />;

  const usuario =
    sessao.tipo === "logado"
      ? { nome: sessao.membro.nome, papel: PAPEIS[sessao.membro.papel] ?? sessao.membro.papel }
      : { nome: "Modo demonstração", papel: "Sem login" };

  const modulo = MODULOS.find((m) => m.id === rota);
  const naCentral = rota === "inicio" || (!modulo && !rotaConhecida(rota));
  let pagina = <Central ir={navegar} tema={tema} alternarTema={alternarTema} usuario={usuario} onSair={sessao.tipo === "logado" ? sair : undefined} abrirComando={abrirComando} />;
  if (rota === "base") pagina = <><AbasCadastro rota={rota} ir={navegar} /><BaseClientes /></>;
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
  else if (rota === "integracoes") pagina = <Integracoes />;
  else if (rota === "anotacoes" || rota.startsWith("anotacoes-")) pagina = <CentralAnotacoes rota={rota} ir={navegar} />;
  else if (rota === "cadastro") pagina = <><AbasCadastro rota={rota} ir={navegar} /><Cadastro ir={navegar} /></>;
  else if (rota === "contratos" || rota.startsWith("contratos-")) pagina = <><AbasCadastro rota={rota} ir={navegar} /><Contratos rota={rota} ir={navegar} /></>;
  else if (modulo) pagina = <PaginaModulo key={modulo.id} modulo={modulo} ir={navegar} />;

  const menu = <Menu
      rota={rota}
      ir={navegar}
      tema={tema}
      alternarTema={alternarTema}
      usuario={usuario}
      onSair={sessao.tipo === "logado" ? sair : undefined}
      abrirComando={() => { setMenuAberto(false); abrirComando(); }}
    />;

  return (
    <ProvedorDados eu={sessao.tipo === "logado" ? sessao.membro.id : null}>
    <div className="flex h-full">
      <aside className={`menu-lateral hidden shrink-0 transition-[width] duration-200 ${naCentral ? "" : "lg:block"} ${recolhido ? "w-[68px]" : "w-[252px]"}`}>
        <Menu
          rota={rota}
          ir={navegar}
          tema={tema}
          alternarTema={alternarTema}
          usuario={usuario}
          onSair={sessao.tipo === "logado" ? sair : undefined}
          recolhido={recolhido}
          alternarRecolhido={alternarRecolhido}
          abrirComando={abrirComando}
        />
      </aside>

      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAberto(false)} />
          <aside
            className="menu-lateral anim-deslizar absolute inset-y-0 left-0 w-[272px] max-w-[85vw] shadow-xl"
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
        {!supabase && (
          <div className="bg-warn-soft px-4 py-1.5 text-center text-[12px] text-warn">
            Prévia com dados de exemplo: nada aqui é salvo. O sistema real fica em <b>sistema.agenciavertente.com.br</b>.
          </div>
        )}
        <div className={`flex items-center justify-between border-b border-line bg-surface px-[max(16px,env(safe-area-inset-left,0px))] py-2.5 lg:hidden ${naCentral ? "!hidden" : ""}`}>
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
          className={`min-h-0 flex-1 ${naCentral ? "overflow-y-auto" : "pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))] lg:pl-8 lg:pr-[max(32px,env(safe-area-inset-right,0px))]"} ${
            naCentral
              ? ""
              : rota === "crm" || rota === "assistente"
              ? "overflow-hidden pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3 sm:pb-5 sm:pt-5"
              : "overflow-y-auto py-6 sm:py-8"
          }`}
        >
          <div key={rota.split("-")[0]} className={`anim-entrar ${rota === "crm" || rota === "assistente" ? "h-full" : ""}`}>{pagina}</div>
        </main>
        {rota !== "assistente" && rota !== "crm" && !naCentral && (
          <button
            onClick={() => navegar("assistente")}
            className="fixed right-[max(16px,env(safe-area-inset-right,0px))] z-30 flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2.5 text-[13px] font-medium text-fg hover:-translate-y-0.5 hover:border-line-forte"
            style={{ bottom: "calc(20px + env(safe-area-inset-bottom, 0px))", boxShadow: "var(--sombra-flutuante)" }}
            aria-label="Abrir o Assistente de IA"
          >
            <Sparkles size={15} className="text-accent" /> <span className="hidden sm:inline">Perguntar à IA</span>
          </button>
        )}
      </div>
      <Aviso />
      {novaSenha && <NovaSenha fechar={() => setNovaSenha(false)} />}
      <Comando aberto={comando} fechar={() => setComando(false)} ir={navegar} alternarTema={alternarTema} />
    </div>
    </ProvedorDados>
  );
}

/** Rotas que têm página própria (o resto cai na Central). */
function rotaConhecida(r: string) {
  return /^(base|cliente-|clientes|trafego|reuniao|gmn|social|financeiro|projetos|crm|assistente|integracoes|anotacoes|cadastro|contratos)/.test(r);
}

/** Abas que unem Fichas, Contratos e Base num tópico só. */
function AbasCadastro({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const abas = [
    { id: "cadastro", nome: "Fichas dos clientes", ativo: rota === "cadastro" },
    { id: "contratos", nome: "Contratos", ativo: rota.startsWith("contratos") },
    { id: "base", nome: "Base de clientes", ativo: rota === "base" },
  ];
  return (
    <div className="mx-auto mb-5 max-w-[1240px]">
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 sm:w-max">
      {abas.map((a) => (
        <button key={a.id} role="tab" aria-selected={a.ativo} onClick={() => ir(a.id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] ${a.ativo ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg"}`}>
          {a.nome}
        </button>
      ))}
    </div>
    </div>
  );
}

/** Depois do link "Esqueci a senha": define a nova senha. */
function NovaSenha({ fechar }: { fechar: () => void }) {
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase!.auth.updateUser({ password: senha });
    if (error) setMsg(error.message);
    else fechar();
  }
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgb(12_14_20/0.4)] px-4">
      <form onSubmit={salvar} className="anim-surgir w-full max-w-[360px] rounded-2xl border border-line bg-surface p-5" style={{ boxShadow: "var(--sombra-flutuante)" }}>
        <h2 className="text-[17px] font-semibold">Criar nova senha</h2>
        <p className="mt-1 text-[13px] text-muted">Mínimo de 8 caracteres.</p>
        <input type="password" autoFocus minLength={8} required value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" className="mt-4 h-11 w-full rounded-xl border border-line bg-bg px-3.5 outline-none focus:border-accent" />
        {msg && <p className="mt-2 text-[13px] text-bad">{msg}</p>}
        <button type="submit" className="mt-4 h-11 w-full rounded-xl bg-accent font-semibold text-accent-fg">Salvar senha</button>
      </form>
    </div>
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
