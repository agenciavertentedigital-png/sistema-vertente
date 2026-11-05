import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, EyeOff, ExternalLink, KeyRound, Link2, Lock, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useTabela } from "../lib/tabela";
import { supabase } from "../lib/supabase";
import { useDados } from "../lib/dados";
import { Botao, Entrada, Painel, Rotulo, Vazio } from "./ui";

interface Acesso {
  id: string;
  cliente_id: string;
  tipo: "acesso" | "link";
  titulo: string;
  url: string | null;
  usuario: string | null;
  observacao: string | null;
  tem_senha: boolean;
  atualizado_em: string;
}
const CAMPOS = "id, cliente_id, tipo, titulo, url, usuario, observacao, tem_senha, atualizado_em";
const SUGESTOES_ACESSO = ["Instagram", "Facebook / Business Manager", "Google (Gmail)", "Site / WordPress", "Hospedagem", "Domínio", "CRM", "Google Meu Negócio"];
const SUGESTOES_LINK = ["Landing page", "Site", "Link da bio", "WhatsApp", "Catálogo", "Pasta de materiais", "Formulário"];

const comHttp = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const dominio = (u: string) => {
  try {
    return new URL(comHttp(u)).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/** Acessos (logins com senha criptografada) e links importantes de um cliente. */
export function AcessosCliente({ clienteId }: { clienteId: string }) {
  const d = useDados();
  const tabela = useTabela<Acesso>("cliente_acessos", CAMPOS, () => [], { ordem: { coluna: "titulo" } });
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Partial<Acesso> | null>(null);
  const meus = tabela.linhas.filter((a) => a.cliente_id === clienteId && `${a.titulo} ${a.url ?? ""} ${a.usuario ?? ""} ${a.observacao ?? ""}`.toLowerCase().includes(busca.toLowerCase()));
  const acessos = meus.filter((a) => a.tipo === "acesso");
  const links = meus.filter((a) => a.tipo === "link");
  const faltaBanco = !!tabela.erro && /cliente_acessos|schema cache|does not exist/i.test(tabela.erro);

  if (faltaBanco) return <Vazio>A aba de acessos fica disponível assim que a atualização do banco for aprovada.</Vazio>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar acesso ou link" className="!w-[240px] pl-8" />
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-muted"><ShieldCheck size={13} className="text-ok" /> Senhas criptografadas no cofre. Cada visualização fica registrada.</span>
        <div className="ml-auto flex gap-2">
          <Botao onClick={() => setEditando({ tipo: "link", cliente_id: clienteId })}><Link2 size={14} /> Novo link</Botao>
          <Botao variante="primario" onClick={() => setEditando({ tipo: "acesso", cliente_id: clienteId })}><Plus size={14} /> Novo acesso</Botao>
        </div>
      </div>

      {tabela.carregando ? (
        <Vazio>Carregando…</Vazio>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold"><KeyRound size={14} className="text-accent" /> Acessos <span className="num text-muted">{acessos.length}</span></h3>
            {acessos.length === 0 ? (
              <Vazio>Nenhum acesso salvo. Guarde aqui logins do Instagram, Business Manager, site, hospedagem e outros.</Vazio>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">{acessos.map((a) => <CartaoAcesso key={a.id} a={a} editar={() => setEditando(a)} />)}</div>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold"><Link2 size={14} className="text-accent" /> Links <span className="num text-muted">{links.length}</span></h3>
            {links.length === 0 ? (
              <Vazio>Nenhum link salvo. Guarde landing pages, site, link da bio, catálogo e pastas de materiais.</Vazio>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">{links.map((a) => <CartaoLink key={a.id} a={a} editar={() => setEditando(a)} />)}</div>
            )}
          </section>
        </>
      )}

      {editando && <EditorAcesso inicial={editando} tabela={tabela} fechar={() => setEditando(null)} avisar={d.avisar} />}
    </div>
  );
}

function Copiar({ texto, rotulo, aoCopiar }: { texto: string | (() => Promise<string | null>); rotulo: string; aoCopiar?: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      title={rotulo}
      aria-label={rotulo}
      onClick={async () => {
        const v = typeof texto === "string" ? texto : await texto();
        if (!v) return;
        await navigator.clipboard?.writeText(v);
        aoCopiar?.();
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg"
    >
      {ok ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
    </button>
  );
}

function CartaoAcesso({ a, editar }: { a: Acesso; editar: () => void }) {
  const d = useDados();
  const [senha, setSenha] = useState<string | null>(null);
  useEffect(() => {
    if (!senha) return;
    const t = setTimeout(() => setSenha(null), 20000);
    return () => clearTimeout(t);
  }, [senha]);
  async function lerSenha(acao: "viu" | "copiou") {
    if (!supabase) return "senha-de-exemplo";
    const { data, error } = await supabase.rpc("acesso_ver_senha", { p_acesso: a.id, p_acao: acao });
    if (error) {
      d.avisar(error.message);
      return null;
    }
    return (data as string | null) ?? null;
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5" style={{ boxShadow: "var(--sombra)" }}>
      <div className="flex items-start gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Lock size={14} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold">{a.titulo}</div>
          {a.url && <a href={comHttp(a.url)} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-[12px] text-accent hover:underline">{dominio(a.url)} <ExternalLink size={11} /></a>}
        </div>
        <button onClick={editar} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg" aria-label="Editar"><Pencil size={13} /></button>
      </div>
      <div className="grid gap-1.5 text-[13px]">
        {a.usuario && (
          <div className="flex items-center gap-2 rounded-lg bg-raised px-2.5 py-1.5">
            <span className="w-[52px] shrink-0 text-[11.5px] text-muted">Usuário</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{a.usuario}</span>
            <Copiar texto={a.usuario} rotulo="Copiar usuário" />
          </div>
        )}
        {a.tem_senha && (
          <div className="flex items-center gap-2 rounded-lg bg-raised px-2.5 py-1.5">
            <span className="w-[52px] shrink-0 text-[11.5px] text-muted">Senha</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{senha ?? "••••••••••"}</span>
            <button onClick={async () => setSenha(senha ? null : await lerSenha("viu"))} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg" aria-label={senha ? "Esconder senha" : "Mostrar senha"} title={senha ? "Esconder" : "Mostrar (some em 20 s)"}>
              {senha ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <Copiar texto={() => lerSenha("copiou")} rotulo="Copiar senha" />
          </div>
        )}
      </div>
      {a.observacao && <p className="whitespace-pre-wrap text-[12.5px] text-muted">{a.observacao}</p>}
    </div>
  );
}

function CartaoLink({ a, editar }: { a: Acesso; editar: () => void }) {
  return (
    <div className="group flex items-start gap-2.5 rounded-2xl border border-line bg-surface p-3" style={{ boxShadow: "var(--sombra)" }}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-raised text-muted"><Link2 size={14} /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{a.titulo}</div>
        {a.url && <a href={comHttp(a.url)} target="_blank" rel="noreferrer" className="block truncate text-[12px] text-accent hover:underline">{a.url.replace(/^https?:\/\//, "")}</a>}
        {a.observacao && <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{a.observacao}</p>}
      </div>
      <div className="flex shrink-0">
        {a.url && <Copiar texto={comHttp(a.url)} rotulo="Copiar link" />}
        <button onClick={editar} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg" aria-label="Editar"><Pencil size={13} /></button>
      </div>
    </div>
  );
}

function EditorAcesso({ inicial, tabela, fechar, avisar }: { inicial: Partial<Acesso>; tabela: ReturnType<typeof useTabela<Acesso>>; fechar: () => void; avisar: (t: string) => void }) {
  const [a, setA] = useState<Partial<Acesso>>(inicial);
  const [senha, setSenha] = useState("");
  const [trocarSenha, setTrocarSenha] = useState(!inicial.tem_senha);
  const [verSenha, setVerSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const ehAcesso = a.tipo === "acesso";
  const sugestoes = useMemo(() => (ehAcesso ? SUGESTOES_ACESSO : SUGESTOES_LINK), [ehAcesso]);
  const muda = (c: Partial<Acesso>) => setA((x) => ({ ...x, ...c }));

  async function salvar() {
    if (!a.titulo?.trim()) return avisar("Dê um nome (ex.: Instagram, Landing page).");
    setSalvando(true);
    try {
      const id = await tabela.salvar(a.id ?? null, {
        cliente_id: a.cliente_id,
        tipo: a.tipo,
        titulo: a.titulo.trim(),
        url: a.url?.trim() || null,
        usuario: ehAcesso ? a.usuario?.trim() || null : null,
        observacao: a.observacao?.trim() || null,
      });
      if (ehAcesso && trocarSenha && supabase && (senha || inicial.tem_senha)) {
        const { error } = await supabase.rpc("acesso_definir_senha", { p_acesso: id, p_senha: senha });
        if (error) throw new Error(error.message);
      }
      await tabela.recarregar();
      avisar(ehAcesso ? "Acesso salvo" : "Link salvo");
      fechar();
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }
  async function excluir() {
    if (!a.id) return;
    try {
      await tabela.excluir(a.id);
      avisar("Removido");
      fechar();
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  return (
    <Painel aberto fechar={fechar} titulo={a.id ? `Editar ${ehAcesso ? "acesso" : "link"}` : ehAcesso ? "Novo acesso" : "Novo link"} largura={520}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-1">
          {(["acesso", "link"] as const).map((t) => (
            <button key={t} onClick={() => muda({ tipo: t })} disabled={!!a.id} className={`h-8 rounded-lg border px-3 text-[12.5px] disabled:opacity-60 ${a.tipo === t ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>
              {t === "acesso" ? "Acesso (login e senha)" : "Link"}
            </button>
          ))}
        </div>
        <Rotulo texto="Nome">
          <Entrada value={a.titulo ?? ""} onChange={(e) => muda({ titulo: e.target.value })} placeholder={ehAcesso ? "Ex.: Instagram" : "Ex.: Landing page Black Friday"} list="sugestoes-acesso" autoFocus />
          <datalist id="sugestoes-acesso">{sugestoes.map((x) => <option key={x} value={x} />)}</datalist>
        </Rotulo>
        <Rotulo texto={ehAcesso ? "Endereço de login (opcional)" : "Link"}>
          <Entrada value={a.url ?? ""} onChange={(e) => muda({ url: e.target.value })} placeholder="https://…" inputMode="url" />
        </Rotulo>
        {ehAcesso && (
          <>
            <Rotulo texto="Usuário / e-mail">
              <Entrada value={a.usuario ?? ""} onChange={(e) => muda({ usuario: e.target.value })} autoComplete="off" />
            </Rotulo>
            {trocarSenha ? (
              <Rotulo texto={inicial.tem_senha ? "Nova senha (deixe vazio para apagar a senha)" : "Senha"}>
                <div className="relative">
                  <Entrada type={verSenha ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" className="pr-9" />
                  <button type="button" onClick={() => setVerSenha((x) => !x)} className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-muted" aria-label={verSenha ? "Esconder" : "Mostrar"}>
                    {verSenha ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </Rotulo>
            ) : (
              <div className="flex items-center justify-between rounded-lg bg-raised px-3 py-2 text-[12.5px]">
                <span className="flex items-center gap-1.5 text-muted"><Lock size={13} /> Senha salva no cofre</span>
                <button onClick={() => setTrocarSenha(true)} className="font-medium text-accent hover:underline">Trocar senha</button>
              </div>
            )}
          </>
        )}
        <Rotulo texto="Observação">
          <textarea value={a.observacao ?? ""} onChange={(e) => muda({ observacao: e.target.value })} rows={3} placeholder={ehAcesso ? "Ex.: autenticação em 2 etapas no celular da Carol" : "Ex.: campanha de novembro, formulário integrado ao CRM"} className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent" />
        </Rotulo>
        <div className="mt-1 flex items-center gap-2">
          {a.id && (confirmarExclusao ? (
            <span className="flex items-center gap-2 text-[12.5px]">
              Remover de vez?
              <button onClick={excluir} className="rounded-lg bg-bad px-2.5 py-1 text-[12.5px] font-medium text-white">Remover</button>
              <button onClick={() => setConfirmarExclusao(false)} className="text-muted">Cancelar</button>
            </span>
          ) : (
            <Botao variante="fantasma" onClick={() => setConfirmarExclusao(true)}><Trash2 size={14} /> Remover</Botao>
          ))}
          <div className="ml-auto flex gap-2">
            <Botao onClick={fechar}>Cancelar</Botao>
            <Botao variante="primario" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao>
          </div>
        </div>
      </div>
    </Painel>
  );
}
