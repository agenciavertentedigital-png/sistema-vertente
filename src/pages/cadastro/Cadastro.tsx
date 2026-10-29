import { useState } from "react";
import { Copy, IdCard, Link2, Plus, Search } from "lucide-react";
import { useDados } from "../../lib/dados";
import { completude, useFichas, type Ficha } from "../../lib/cadastro";
import { SERVICOS } from "../../lib/financeiro";
import { moedaBR } from "../../lib/tabela";
import { SISTEMA_URL, supabase } from "../../lib/supabase";
import { Botao, Entrada, Painel, Rotulo, Selecao, Vazio, campo } from "../../components/ui";
import { Anel, Cabecalho, Kpi, Selo } from "../../components/visual";

const STATUS: Record<Ficha["status"], { nome: string; cor: string }> = {
  ativo: { nome: "Ativo", cor: "var(--ok)" },
  pausado: { nome: "Pausado", cor: "var(--warn)" },
  encerrado: { nome: "Encerrado", cor: "var(--muted)" },
};

export function Cadastro({ ir }: { ir: (r: string) => void }) {
  const fichas = useFichas();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"ativo" | "todos">("ativo");
  const [aberta, setAberta] = useState<Ficha | "nova" | null>(null);
  const lista = fichas.fichas.filter((f) => (status === "todos" || f.status === "ativo") && f.nome.toLowerCase().includes(busca.toLowerCase()));
  const ativos = fichas.fichas.filter((f) => f.status === "ativo");
  const completas = ativos.filter((f) => completude(f).pct === 100).length;
  const media = ativos.length ? Math.round(ativos.reduce((s, f) => s + completude(f).pct, 0) / ativos.length) : null;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <Cabecalho
        icone={IdCard}
        rotulo="Fase 7 · Gerencial"
        titulo="Informações Cadastrais"
        descricao="Ficha completa de cada cliente. Envie o link de cadastro para o cliente preencher os próprios dados."
        acoes={
          <>
            <Botao onClick={() => ir("contratos")}>Contratos</Botao>
            <Botao variante="primario" onClick={() => setAberta("nova")}><Plus size={15} /> Novo cliente</Botao>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 lg:col-span-1" style={{ boxShadow: "var(--sombra)" }}>
          <Anel nota={media} tamanho={58} espessura={6} />
          <div>
            <div className="text-[12px] text-muted">Fichas preenchidas</div>
            <div className="text-[14px] font-semibold">média dos ativos</div>
          </div>
        </div>
        <Kpi rotulo="Clientes ativos" valor={ativos.length} />
        <Kpi rotulo="Fichas completas" valor={`${completas} de ${ativos.length}`} tom={completas === ativos.length ? "ok" : "warn"} />
        <Kpi rotulo="Sem CNPJ/CPF" valor={ativos.filter((f) => !f.documento).length} tom={ativos.some((f) => !f.documento) ? "warn" : "ok"} detalhe="necessário para o contrato" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" className="!w-[240px] pl-8" />
        </div>
        <Selecao value={status} onChange={(e) => setStatus(e.target.value as "ativo" | "todos")} className="!w-auto">
          <option value="ativo">Só ativos</option>
          <option value="todos">Todos (inclui encerrados)</option>
        </Selecao>
      </div>
      {fichas.carregando ? (
        <Vazio>Carregando…</Vazio>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((f) => {
            const c = completude(f);
            return (
              <button key={f.id} onClick={() => setAberta(f)} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent" style={{ boxShadow: "var(--sombra)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold">{f.nome}</div>
                    <div className="truncate text-[12px] text-muted">{[f.segmento, f.cidade, f.origem === "parceria_marcone" ? "Parceria Marcone" : null].filter(Boolean).join(" · ") || "Ficha a completar"}</div>
                  </div>
                  <Selo cor={STATUS[f.status].cor}>{STATUS[f.status].nome}</Selo>
                </div>
                <div>
                  <div className="flex justify-between text-[11.5px] text-muted">
                    <span>Ficha {c.pct}%</span>
                    {fichas.mensalidade(f.id) > 0 && <span className="num font-medium text-fg">{moedaBR(fichas.mensalidade(f.id), 0)}/mês</span>}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-raised">
                    <div className="h-1.5 rounded-full" style={{ width: `${c.pct}%`, background: c.pct === 100 ? "var(--ok)" : c.pct >= 60 ? "var(--warn)" : "var(--bad)" }} />
                  </div>
                  {c.faltam.length > 0 && <div className="mt-1.5 truncate text-[11.5px] text-muted">Falta: {c.faltam.slice(0, 3).map((x) => x.nome).join(", ")}{c.faltam.length > 3 ? "…" : ""}</div>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {fichas.servicos.filter((s) => s.cliente_id === f.id).map((s) => (
                    <span key={s.servico_codigo} className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">{SERVICOS[s.servico_codigo] ?? s.servico_codigo}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {aberta && <EditorFicha ficha={aberta === "nova" ? null : aberta} fichas={fichas} fechar={() => setAberta(null)} />}
    </div>
  );
}

function EditorFicha({ ficha, fichas, fechar }: { ficha: Ficha | null; fichas: ReturnType<typeof useFichas>; fechar: () => void }) {
  const d = useDados();
  const [f, setF] = useState<Partial<Ficha>>(ficha ?? { status: "ativo", origem: "vertente" });
  const [link, setLink] = useState("");
  const set = (c: Partial<Ficha>) => setF({ ...f, ...c });
  const texto = (campo: keyof Ficha, nome: string, tipo = "text") => (
    <Rotulo texto={nome}>
      <Entrada type={tipo} value={(f[campo] as string | number | null) ?? ""} onChange={(e) => set({ [campo]: e.target.value === "" ? null : tipo === "number" ? Number(e.target.value) : e.target.value })} />
    </Rotulo>
  );

  async function salvar() {
    if (!f.nome?.trim()) return;
    try {
      const { id, ...campos } = f;
      await fichas.salvarFicha(id ?? null, campos);
      d.recarregar();
      d.avisar("Ficha salva");
      fechar();
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  async function gerarLink() {
    if (!ficha) return;
    if (!supabase) {
      d.avisar("Na prévia não dá para gerar link de verdade. Gere pelo sistema em sistema.agenciavertente.com.br.");
      return;
    }
    const { data, error } = await supabase.from("cadastro_links").insert({ cliente_id: ficha.id }).select("token").single();
    if (error) return d.avisar(error.message);
    setLink(`${SISTEMA_URL}/#cadastro-publico-${(data as { token: string }).token}`);
  }
  const mensagem = `Oi, tudo bem? 😊\n\nPara deixarmos tudo certinho no seu cadastro e no contrato, preencha seus dados neste link (leva 2 minutos):\n${link}\n\nQualquer dúvida é só chamar!`;

  return (
    <Painel aberto fechar={fechar} titulo={ficha ? ficha.nome : "Novo cliente"} largura={620}>
      <div className="flex flex-col gap-4">
        {ficha && (
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-medium">Link de cadastro para o cliente</div>
                <div className="text-[12px] text-muted">Ele preenche os dados e a ficha atualiza sozinha. Vale por 30 dias.</div>
              </div>
              <Botao onClick={gerarLink}><Link2 size={14} /> Gerar link</Botao>
            </div>
            {link && (
              <div className="mt-2 flex flex-col gap-2">
                <input readOnly value={link} className={campo} onFocus={(e) => e.target.select()} />
                <Botao onClick={() => { navigator.clipboard?.writeText(mensagem); d.avisar("Mensagem com o link copiada"); }}><Copy size={14} /> Copiar mensagem para o WhatsApp</Botao>
              </div>
            )}
          </div>
        )}
        <h3 className="eyebrow">Empresa</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {texto("nome", "Nome no sistema")}
          {texto("razao_social", "Razão social / nome completo")}
          {texto("documento", "CNPJ ou CPF")}
          {texto("segmento", "Segmento")}
          {texto("endereco", "Endereço")}
          {texto("cidade", "Cidade")}
        </div>
        <h3 className="eyebrow">Responsável</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {texto("contato_nome", "Nome")}
          {texto("contato_telefone", "WhatsApp")}
          {texto("contato_email", "E-mail", "email")}
        </div>
        <h3 className="eyebrow">Presença digital</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {texto("instagram", "Instagram")}
          {texto("site", "Site")}
          {texto("link_gmn", "Link do Google Meu Negócio")}
          {texto("pasta_drive", "Pasta no Google Drive")}
        </div>
        <h3 className="eyebrow">Contrato e cobrança</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Rotulo texto="Situação">
            <Selecao value={f.status ?? "ativo"} onChange={(e) => set({ status: e.target.value as Ficha["status"] })}>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="encerrado">Encerrado</option>
            </Selecao>
          </Rotulo>
          <Rotulo texto="Origem">
            <Selecao value={f.origem ?? "vertente"} onChange={(e) => set({ origem: e.target.value as Ficha["origem"] })}>
              <option value="vertente">Vertente</option>
              <option value="parceria_marcone">Parceria Marcone</option>
            </Selecao>
          </Rotulo>
          {texto("cliente_desde", "Cliente desde", "date")}
          {texto("dia_vencimento", "Vence dia", "number")}
        </div>
        <Rotulo texto="Observações"><textarea rows={3} value={f.observacoes ?? ""} onChange={(e) => set({ observacoes: e.target.value || null })} className={campo} /></Rotulo>
        {ficha && (
          <p className="text-[12px] text-muted">
            Faltando: {completude(ficha).faltam.map((x) => x.nome).join(", ") || "nada, ficha completa"}. Os valores dos serviços ficam em Financeiro → Mensalidades.
          </p>
        )}
        <Botao variante="primario" onClick={salvar} disabled={!f.nome?.trim()}>Salvar ficha</Botao>
      </div>
    </Painel>
  );
}

