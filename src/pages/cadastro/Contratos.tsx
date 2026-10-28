import { useState } from "react";
import { Copy, FileSignature, Plus, Printer, Trash2 } from "lucide-react";
import { useDados } from "../../lib/dados";
import { moedaBR, useTabela } from "../../lib/tabela";
import { hoje } from "../../lib/tipos";
import { useFichas, type Ficha } from "../../lib/cadastro";
import { SERVICOS } from "../../lib/financeiro";
import { Botao, Entrada, Painel, Rotulo, Selecao, Vazio, campo } from "../../components/ui";
import { Abas, Cabecalho, Kpi, Selo, MESES_LONGOS } from "../../components/visual";

interface Modelo {
  id: string;
  nome: string;
  corpo: string;
}
interface Contrato {
  id: string;
  cliente_id: string;
  modelo_id: string | null;
  titulo: string;
  corpo: string;
  valor_mensal: number | null;
  inicio: string | null;
  meses: number | null;
  status: "rascunho" | "enviado" | "assinado" | "cancelado";
  enviado_em: string | null;
  assinado_em: string | null;
  criado_em?: string;
}

const STATUS = {
  rascunho: { nome: "Rascunho", cor: "var(--muted)" },
  enviado: { nome: "Aguardando assinatura", cor: "var(--warn)" },
  assinado: { nome: "Assinado", cor: "var(--ok)" },
  cancelado: { nome: "Cancelado", cor: "var(--bad)" },
} as const;

const MODELO_DEMO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MARKETING DIGITAL

CONTRATANTE: {{razao_social}}, CPF/CNPJ {{documento}}, com endereço em {{endereco}}, {{cidade}}, representada por {{contato_nome}}.

CONTRATADA: VERTENTE DIGITAL.

1. OBJETO
1.1. Serviços: {{servicos}}.

2. VALOR
2.1. Valor mensal de {{valor_mensal}}, com vencimento todo dia {{dia_vencimento}}, por {{forma_pagamento}}.

3. PRAZO
3.1. Vigência de {{meses}} meses a partir de {{inicio}}.

{{cidade_agencia}}, {{data_hoje}}.`;

const VARIAVEIS = ["razao_social", "documento", "endereco", "cidade", "contato_nome", "servicos", "valor_mensal", "dia_vencimento", "forma_pagamento", "meses", "inicio", "data_hoje", "cidade_agencia"];

function dataPorExtenso(iso: string) {
  return `${Number(iso.slice(8, 10))} de ${MESES_LONGOS[Number(iso.slice(5, 7)) - 1].toLowerCase()} de ${iso.slice(0, 4)}`;
}

function preencher(modelo: string, f: Ficha, servicos: string[], valor: number, inicio: string, meses: number) {
  const v: Record<string, string> = {
    razao_social: f.razao_social ?? f.nome,
    documento: f.documento ?? "_____________",
    endereco: f.endereco ?? "_____________",
    cidade: f.cidade ?? "_____________",
    contato_nome: f.contato_nome ?? "_____________",
    servicos: servicos.join(", ") || "_____________",
    valor_mensal: moedaBR(valor),
    dia_vencimento: String(f.dia_vencimento ?? 10),
    forma_pagamento: f.forma_pagamento ?? "PIX",
    meses: String(meses),
    inicio: dataPorExtenso(inicio),
    data_hoje: dataPorExtenso(hoje()),
    cidade_agencia: "Ipatinga/MG",
  };
  return modelo.replace(/\{\{(\w+)\}\}/g, (_, k: string) => v[k] ?? `{{${k}}}`);
}

function imprimir(titulo: string, corpo: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const esc = corpo.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet"><style>body{font-family:Poppins,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#0e1533;line-height:1.65;font-size:13px}pre{white-space:pre-wrap;font-family:inherit}h1{font-size:15px;letter-spacing:.06em}</style></head><body><pre>${esc}</pre><script>setTimeout(()=>print(),400)</script></body></html>`);
  w.document.close();
}

type Aba = "contratos" | "contratos-modelos";

export function Contratos({ rota, ir }: { rota: string; ir: (r: string) => void }) {
  const d = useDados();
  const aba: Aba = rota === "contratos-modelos" ? "contratos-modelos" : "contratos";
  const fichas = useFichas();
  const modelos = useTabela<Modelo>("contrato_modelos", "id, nome, corpo", () => [{ id: "m1", nome: "Prestação de serviços de marketing digital", corpo: MODELO_DEMO }], { ordem: { coluna: "nome" } });
  const contratos = useTabela<Contrato>("contratos", "id, cliente_id, modelo_id, titulo, corpo, valor_mensal, inicio, meses, status, enviado_em, assinado_em, criado_em", () => [], { ordem: { coluna: "criado_em", asc: false } });
  const [aberto, setAberto] = useState<Contrato | "novo" | null>(null);
  const [modelo, setModelo] = useState<Modelo | "novo" | null>(null);
  const nome = (id: string) => fichas.fichas.find((f) => f.id === id)?.nome ?? d.cliente(id)?.nome ?? "Cliente";
  const ativosSem = fichas.fichas.filter((f) => f.status === "ativo" && f.nome !== "Agência Vertente Digital" && !contratos.linhas.some((c) => c.cliente_id === f.id && c.status === "assinado"));

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
      <Cabecalho
        icone={FileSignature}
        rotulo="Fase 7 · Gerencial"
        titulo="Contratos"
        descricao="Contrato gerado do modelo com os dados da ficha e os serviços contratados. Imprima em PDF ou copie para a plataforma de assinatura."
        acoes={
          <>
            <Botao onClick={() => ir("cadastro")}>Fichas dos clientes</Botao>
            <Botao variante="primario" onClick={() => setAberto("novo")}><Plus size={15} /> Novo contrato</Botao>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Assinados" valor={contratos.linhas.filter((c) => c.status === "assinado").length} tom="ok" />
        <Kpi rotulo="Aguardando assinatura" valor={contratos.linhas.filter((c) => c.status === "enviado").length} tom="warn" />
        <Kpi rotulo="Rascunhos" valor={contratos.linhas.filter((c) => c.status === "rascunho").length} />
        <Kpi rotulo="Clientes ativos sem contrato assinado" valor={ativosSem.length} tom={ativosSem.length ? "bad" : "ok"} />
      </div>
      <Abas<Aba> abas={[{ id: "contratos", nome: "Contratos" }, { id: "contratos-modelos", nome: "Modelos" }]} ativa={aba} mudar={ir} />
      {contratos.erro && <Vazio>{contratos.erro}</Vazio>}
      {aba === "contratos" ? (
        contratos.linhas.length === 0 ? (
          <Vazio>Nenhum contrato ainda. Clique em Novo contrato: o texto sai pronto com os dados da ficha do cliente.</Vazio>
        ) : (
          <section className="rounded-2xl border border-line bg-surface p-2">
            <ul className="divide-y divide-line">
              {contratos.linhas.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setAberto(c)} className="flex w-full flex-wrap items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-raised">
                    <FileSignature size={18} className="text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{nome(c.cliente_id)}</div>
                      <div className="truncate text-[12px] text-muted">{c.titulo}{c.valor_mensal ? ` · ${moedaBR(c.valor_mensal)}/mês` : ""}{c.meses ? ` · ${c.meses} meses` : ""}</div>
                    </div>
                    <Selo cor={STATUS[c.status].cor}>{STATUS[c.status].nome}</Selo>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end"><Botao onClick={() => setModelo("novo")}><Plus size={14} /> Novo modelo</Botao></div>
          {modelos.linhas.map((m) => (
            <button key={m.id} onClick={() => setModelo(m)} className="rounded-2xl border border-line bg-surface p-4 text-left hover:border-accent">
              <div className="text-[14px] font-semibold">{m.nome}</div>
              <div className="mt-1 line-clamp-2 text-[12px] text-muted">{m.corpo.slice(0, 220)}…</div>
            </button>
          ))}
        </div>
      )}
      {aberto && <EditorContrato contrato={aberto === "novo" ? null : aberto} fichas={fichas} modelos={modelos.linhas} contratos={contratos} nome={nome} fechar={() => setAberto(null)} />}
      {modelo && <EditorModelo modelo={modelo === "novo" ? null : modelo} modelos={modelos} fechar={() => setModelo(null)} />}
    </div>
  );
}

function EditorContrato({ contrato, fichas, modelos, contratos, nome, fechar }: { contrato: Contrato | null; fichas: ReturnType<typeof useFichas>; modelos: Modelo[]; contratos: ReturnType<typeof useTabela<Contrato>>; nome: (id: string) => string; fechar: () => void }) {
  const d = useDados();
  const [c, setC] = useState<Partial<Contrato>>(contrato ?? { inicio: hoje(), meses: 6, status: "rascunho", modelo_id: modelos[0]?.id ?? null });
  const set = (x: Partial<Contrato>) => setC({ ...c, ...x });

  function gerar(parcial: Partial<Contrato>) {
    const n = { ...c, ...parcial };
    const f = fichas.fichas.find((x) => x.id === n.cliente_id);
    const m = modelos.find((x) => x.id === n.modelo_id);
    if (!f || !m) return setC(n);
    const servs = fichas.servicos.filter((s) => s.cliente_id === f.id).map((s) => SERVICOS[s.servico_codigo] ?? s.servico_codigo);
    const valor = n.valor_mensal ?? fichas.mensalidade(f.id);
    setC({ ...n, valor_mensal: valor, titulo: n.titulo || m.nome, corpo: preencher(m.corpo, f, servs, valor, n.inicio ?? hoje(), n.meses ?? 6) });
  }

  async function salvar(status?: Contrato["status"]) {
    if (!c.cliente_id || !c.corpo) return;
    const { id, criado_em: _, ...campos } = c;
    void _;
    if (status) {
      campos.status = status;
      if (status === "enviado") campos.enviado_em = new Date().toISOString();
      if (status === "assinado") campos.assinado_em = hoje();
    }
    try {
      await contratos.salvar(id ?? null, { ...campos, titulo: c.titulo || "Contrato" });
      d.avisar("Contrato salvo");
      fechar();
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  const pendencias = /_{5,}|\{\{\w+\}\}/.test(c.corpo ?? "");

  return (
    <Painel aberto fechar={fechar} titulo={contrato ? `Contrato · ${nome(contrato.cliente_id)}` : "Novo contrato"} largura={760}>
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Rotulo texto="Cliente">
            <Selecao value={c.cliente_id ?? ""} onChange={(e) => gerar({ cliente_id: e.target.value, valor_mensal: null })} disabled={Boolean(contrato)}>
              <option value="">Escolha…</option>
              {fichas.fichas.filter((f) => f.status !== "encerrado").map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Selecao>
          </Rotulo>
          <Rotulo texto="Modelo">
            <Selecao value={c.modelo_id ?? ""} onChange={(e) => gerar({ modelo_id: e.target.value })}>
              {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Selecao>
          </Rotulo>
          <Rotulo texto="Valor mensal (R$)"><Entrada type="number" value={c.valor_mensal ?? ""} onChange={(e) => set({ valor_mensal: Number(e.target.value) })} /></Rotulo>
          <div className="grid grid-cols-2 gap-3">
            <Rotulo texto="Início"><Entrada type="date" value={c.inicio ?? ""} onChange={(e) => set({ inicio: e.target.value })} /></Rotulo>
            <Rotulo texto="Meses"><Entrada type="number" value={c.meses ?? ""} onChange={(e) => set({ meses: Number(e.target.value) })} /></Rotulo>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Botao onClick={() => gerar({})} disabled={!c.cliente_id}>Gerar texto com os dados atuais</Botao>
          {pendencias && <span className="text-[12px] text-warn">Há campos em branco (____). Complete a ficha do cliente e gere de novo, ou edite o texto.</span>}
        </div>
        <Rotulo texto="Texto do contrato">
          <textarea value={c.corpo ?? ""} onChange={(e) => set({ corpo: e.target.value })} rows={18} className={`${campo} text-[12.5px] leading-relaxed`} placeholder="Escolha o cliente para gerar o texto." />
        </Rotulo>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => imprimir(c.titulo ?? "Contrato", c.corpo ?? "")} disabled={!c.corpo}><Printer size={14} /> PDF / imprimir</Botao>
            <Botao onClick={() => { navigator.clipboard?.writeText(c.corpo ?? ""); d.avisar("Texto copiado"); }} disabled={!c.corpo}><Copy size={14} /> Copiar texto</Botao>
            {contrato && <Botao variante="fantasma" onClick={async () => { await contratos.excluir(contrato.id); fechar(); }}><Trash2 size={14} /></Botao>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => salvar()} disabled={!c.cliente_id || !c.corpo}>Salvar rascunho</Botao>
            {c.status !== "assinado" && <Botao onClick={() => salvar("enviado")} disabled={!c.cliente_id || !c.corpo}>Marcar como enviado</Botao>}
            <Botao variante="primario" onClick={() => salvar("assinado")} disabled={!c.cliente_id || !c.corpo}>Marcar como assinado</Botao>
          </div>
        </div>
        <p className="text-[11.5px] text-muted">A assinatura eletrônica direto daqui entra quando a conta da Autentique (ou D4Sign/ZapSign) for conectada.</p>
      </div>
    </Painel>
  );
}

function EditorModelo({ modelo, modelos, fechar }: { modelo: Modelo | null; modelos: ReturnType<typeof useTabela<Modelo>>; fechar: () => void }) {
  const d = useDados();
  const [m, setM] = useState<Partial<Modelo>>(modelo ?? { nome: "", corpo: MODELO_DEMO });
  return (
    <Painel aberto fechar={fechar} titulo={modelo ? "Editar modelo" : "Novo modelo"} largura={760}>
      <div className="flex flex-col gap-3.5">
        <Rotulo texto="Nome do modelo"><Entrada value={m.nome ?? ""} onChange={(e) => setM({ ...m, nome: e.target.value })} /></Rotulo>
        <div className="flex flex-wrap gap-1">
          <span className="text-[12px] text-muted">Variáveis:</span>
          {VARIAVEIS.map((v) => (
            <button key={v} onClick={() => navigator.clipboard?.writeText(`{{${v}}}`)} className="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px] text-muted hover:text-fg" title="Copiar">{`{{${v}}}`}</button>
          ))}
        </div>
        <textarea value={m.corpo ?? ""} onChange={(e) => setM({ ...m, corpo: e.target.value })} rows={22} className={`${campo} font-mono text-[12px] leading-relaxed`} />
        <div className="flex justify-between">
          {modelo ? <Botao variante="fantasma" onClick={async () => { await modelos.excluir(modelo.id); fechar(); }}><Trash2 size={14} /> Apagar</Botao> : <span />}
          <Botao variante="primario" disabled={!m.nome?.trim() || !m.corpo?.trim()} onClick={async () => {
            try {
              await modelos.salvar(modelo?.id ?? null, { nome: m.nome!.trim(), corpo: m.corpo! });
              fechar();
            } catch (e) {
              d.avisar((e as Error).message);
            }
          }}>Salvar modelo</Botao>
        </div>
      </div>
    </Painel>
  );
}
