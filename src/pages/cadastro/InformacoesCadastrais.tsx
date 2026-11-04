import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Copy, ExternalLink, IdCard, Link2, MessageCircle, RefreshCw, Sparkles, UserPlus } from "lucide-react";
import { useDados } from "../../lib/dados";
import { SISTEMA_URL, supabase } from "../../lib/supabase";
import { Botao, Entrada, Rotulo, Selecao, Vazio } from "../../components/ui";
import { Cabecalho, Selo } from "../../components/visual";

interface LinkCadastro {
  token: string;
  cliente_id: string | null;
  tipo: "cadastro" | "briefing" | "novo_cliente";
  apelido: string | null;
  criado_em: string;
  expira_em: string;
  preenchido_em: string | null;
}

const urlDe = (token: string) => `${SISTEMA_URL}/#cadastro-publico-${token}`;
const mensagemDe = (url: string, novo: boolean) =>
  novo
    ? `Oi, tudo bem? 😊\n\nSeja bem-vindo(a) à Vertente Digital! Para começarmos, preencha os dados da sua empresa neste link (leva 2 minutos):\n${url}\n\nCom isso já deixamos seu cadastro e o contrato prontos. Qualquer dúvida é só chamar!`
    : `Oi, tudo bem? 😊\n\nPara deixarmos tudo certinho no seu cadastro e no contrato, confira e complete seus dados neste link (leva 2 minutos):\n${url}\n\nQualquer dúvida é só chamar!`;
const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

/** Informações Cadastrais: link para o cliente preencher os dados e o cadastro ser criado sozinho. */
export function InformacoesCadastrais({ ir }: { ir: (r: string) => void }) {
  const d = useDados();
  const [links, setLinks] = useState<LinkCadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [apelido, setApelido] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [gerado, setGerado] = useState<{ url: string; novo: boolean } | null>(null);
  const [ocupado, setOcupado] = useState("");

  const carregar = useCallback(async () => {
    if (!supabase) {
      setLinks([]);
      setCarregando(false);
      return;
    }
    const { data, error } = await supabase.from("cadastro_links").select("token, cliente_id, tipo, apelido, criado_em, expira_em, preenchido_em").neq("tipo", "briefing").order("criado_em", { ascending: false }).limit(60);
    if (error) d.avisar(error.message);
    setLinks((data ?? []) as LinkCadastro[]);
    setCarregando(false);
  }, [d]);
  useEffect(() => { carregar(); }, [carregar]);

  async function gerar(novo: boolean) {
    if (!supabase) return d.avisar("Na prévia não dá para gerar link de verdade. Gere pelo sistema em sistema.agenciavertente.com.br.");
    if (!novo && !clienteId) return d.avisar("Escolha o cliente.");
    setOcupado(novo ? "novo" : "existente");
    const linha = novo ? { tipo: "novo_cliente", apelido: apelido.trim() || null } : { tipo: "cadastro", cliente_id: clienteId };
    const { data, error } = await supabase.from("cadastro_links").insert(linha).select("token").single();
    setOcupado("");
    if (error) return d.avisar(error.message.includes("check") ? "Falta aplicar a atualização do banco para links de cliente novo." : error.message);
    setGerado({ url: urlDe((data as { token: string }).token), novo });
    setApelido("");
    carregar();
  }

  const copiar = (texto: string, aviso: string) => {
    navigator.clipboard?.writeText(texto);
    d.avisar(aviso);
  };
  const clientesAtivos = [...d.clientes].sort((a, b) => a.nome.localeCompare(b.nome));
  const aguardando = links.filter((l) => !l.preenchido_em && new Date(l.expira_em) > new Date()).length;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <Cabecalho
        icone={IdCard}
        titulo="Informações Cadastrais"
        descricao="Gere um link, mande para o cliente e ele mesmo preenche os dados. O cadastro é criado sozinho no sistema e o time é avisado."
        acoes={<Botao onClick={() => ir("cadastro")}>Ver fichas dos clientes</Botao>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Cliente novo */}
        <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5" style={{ boxShadow: "var(--sombra)" }}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.12]" style={{ background: "radial-gradient(closest-side, var(--accent), transparent)" }} />
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg"><UserPlus size={18} /></span>
            <div>
              <h2 className="text-[16px] font-semibold">Cadastro de cliente novo</h2>
              <p className="text-[13px] text-muted">O cliente preenche empresa, CNPJ/CPF, responsável, contato, endereço e redes. Ao enviar, ele entra na carteira como cliente ativo.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Rotulo texto="Para quem é (só para você identificar, opcional)">
                <Entrada value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Ex.: João · Clínica Sorriso" />
              </Rotulo>
            </div>
            <Botao variante="primario" onClick={() => gerar(true)} disabled={ocupado === "novo"}><Sparkles size={14} /> {ocupado === "novo" ? "Gerando…" : "Gerar link de cadastro"}</Botao>
          </div>
        </section>

        {/* Cliente existente */}
        <section className="rounded-2xl border border-line bg-surface p-5" style={{ boxShadow: "var(--sombra)" }}>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-raised text-fg"><RefreshCw size={17} /></span>
            <div>
              <h2 className="text-[16px] font-semibold">Atualizar dados de um cliente</h2>
              <p className="text-[13px] text-muted">Para quem já está no sistema: o cliente confere e completa a própria ficha.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Rotulo texto="Cliente">
                <Selecao value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {clientesAtivos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Selecao>
              </Rotulo>
            </div>
            <Botao onClick={() => gerar(false)} disabled={ocupado === "existente"}><Link2 size={14} /> Gerar link</Botao>
          </div>
        </section>
      </div>

      {gerado && (
        <section className="anim-entrar flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent-soft/40 p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold"><CheckCircle2 size={16} className="text-ok" /> Link pronto. Vale por 30 dias.</div>
          <input readOnly value={gerado.url} onFocus={(e) => e.target.select()} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px]" />
          <div className="flex flex-wrap gap-2">
            <Botao variante="primario" onClick={() => copiar(mensagemDe(gerado.url, gerado.novo), "Mensagem com o link copiada")}><MessageCircle size={14} /> Copiar mensagem para o WhatsApp</Botao>
            <Botao onClick={() => copiar(gerado.url, "Link copiado")}><Copy size={14} /> Copiar só o link</Botao>
            <Botao onClick={() => window.open(gerado.url, "_blank")}><ExternalLink size={14} /> Ver como o cliente vê</Botao>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold">Links enviados</h2>
          {aguardando > 0 && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11.5px] font-medium text-warn">{aguardando} aguardando o cliente</span>}
        </div>
        {carregando ? (
          <Vazio>Carregando…</Vazio>
        ) : links.length === 0 ? (
          <Vazio>Nenhum link gerado ainda.</Vazio>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-muted">
                  <th className="px-4 py-2.5 font-medium">Para</th>
                  <th className="px-2 font-medium">Tipo</th>
                  <th className="px-2 font-medium">Gerado</th>
                  <th className="px-2 font-medium">Situação</th>
                  <th className="px-4 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const nomeCli = l.cliente_id ? d.cliente(l.cliente_id)?.nome : null;
                  const expirado = !l.preenchido_em && new Date(l.expira_em) < new Date();
                  const novo = l.tipo === "novo_cliente" || !!l.apelido;
                  return (
                    <tr key={l.token} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{nomeCli ?? l.apelido ?? "Cliente novo"}</div>
                        {nomeCli && l.apelido && <div className="text-[11.5px] text-muted">{l.apelido}</div>}
                      </td>
                      <td className="px-2">{novo ? "Cliente novo" : "Atualização"}</td>
                      <td className="px-2 text-muted">{dataBR(l.criado_em)}</td>
                      <td className="px-2">
                        {l.preenchido_em ? (
                          <Selo cor="var(--ok)">Preenchido {dataBR(l.preenchido_em)}</Selo>
                        ) : expirado ? (
                          <Selo cor="var(--muted)">Expirado</Selo>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[12.5px] text-warn"><Clock size={13} /> Aguardando</span>
                        )}
                      </td>
                      <td className="px-4 text-right">
                        <div className="flex justify-end gap-1">
                          {l.cliente_id && <button onClick={() => ir(`cliente-${l.cliente_id}`)} className="rounded-lg px-2 py-1 text-[12.5px] text-accent hover:bg-raised">Abrir cliente</button>}
                          {!l.preenchido_em && !expirado && (
                            <button onClick={() => copiar(mensagemDe(urlDe(l.token), l.tipo === "novo_cliente"), "Mensagem com o link copiada")} className="rounded-lg px-2 py-1 text-[12.5px] text-muted hover:bg-raised hover:text-fg">Copiar de novo</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
