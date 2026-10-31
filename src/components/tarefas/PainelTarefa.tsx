import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Plus, Repeat, Trash2 } from "lucide-react";
import { repo } from "../../lib/repo";
import { MarcarTemperatura } from "../Temperatura";
import { useDados } from "../../lib/dados";
import {
  CANAL,
  PILAR,
  PILARES,
  PRIORIDADE,
  STATUS,
  type CamposTarefa,
  type Comentario,
  type ItemChecklist,
  type Tarefa,
} from "../../lib/tipos";
import { Botao, Entrada, Painel, PontoSituacao, Rotulo, Selecao, campo } from "../ui";
import { CampoMencao, TextoComMencoes } from "../LinhaDoTempo";
import { RegistroRapido, tipoDeRegistro } from "./RegistroRapido";
import { SITUACAO } from "../../lib/tipos";

export function PainelTarefa({ id, fechar }: { id: string | null; fechar: () => void }) {
  const d = useDados();
  const tarefa = d.tarefas.find((t) => t.id === id) ?? null;
  return (
    <Painel aberto={Boolean(tarefa)} fechar={fechar} titulo={tarefa ? d.cliente(tarefa.cliente_id)?.nome ?? "Tarefa" : "Tarefa"}>
      {tarefa && <Conteudo key={tarefa.id} t={tarefa} fechar={fechar} />}
    </Painel>
  );
}

function Conteudo({ t, fechar }: { t: Tarefa; fechar: () => void }) {
  const d = useDados();
  const [titulo, setTitulo] = useState(t.titulo);
  const [descricao, setDescricao] = useState(t.descricao ?? "");
  const [itens, setItens] = useState<ItemChecklist[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [coments, setComents] = useState<Comentario[]>([]);
  const [novoComent, setNovoComent] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const carregarExtras = useCallback(async () => {
    const [i, c] = await Promise.all([repo.checklist(t.id), repo.comentarios(t.id)]);
    setItens(i);
    setComents(c);
  }, [t.id]);

  useEffect(() => {
    carregarExtras().catch((e) => d.avisar((e as Error).message));
  }, [carregarExtras]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar(campos: CamposTarefa, aviso?: string) {
    try {
      await repo.salvarTarefa(t.id, campos);
      await d.recarregar();
      if (aviso) d.avisar(aviso);
    } catch (e) {
      d.avisar(`Não foi possível salvar: ${(e as Error).message}`);
    }
  }

  async function mudarItem(acao: () => Promise<void>) {
    try {
      await acao();
      await carregarExtras();
      await d.recarregar();
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  const rotina = t.cliente_rotina_id
    ? d.rotinas.find((r) => r.id === d.clienteRotinas.find((c) => c.id === t.cliente_rotina_id)?.rotina_id)
    : undefined;
  const aberta = t.status !== "feita" && t.status !== "nao_feita";
  const tipoReg = tipoDeRegistro(t, rotina?.nome);
  const registroFeito = d.registros.find((r) => r.tarefa_id === t.id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <textarea
          id="tarefa-titulo"
          value={titulo}
          rows={2}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => titulo.trim() && titulo !== t.titulo && salvar({ titulo: titulo.trim() })}
          className="w-full resize-none rounded-lg border border-transparent bg-transparent px-1 font-display text-[19px] font-semibold leading-snug outline-none hover:border-line focus:border-accent"
        />
        {rotina && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            <Repeat size={13} /> Rotina: {rotina.nome}. Ao concluir, a próxima é criada na data certa.
          </div>
        )}
        {t.triagem && (
          <div className="rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
            Na caixa de entrada. Defina responsável e prazo e clique em "Tirar da caixa de entrada".
          </div>
        )}
      </div>

      {registroFeito && (
        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px]">
          <PontoSituacao situacao={registroFeito.situacao} tamanho={12} />
          <div className="min-w-0 leading-snug">
            <div className="font-medium">{registroFeito.situacao ? SITUACAO[registroFeito.situacao] : "Registrado"}</div>
            {registroFeito.acoes.length > 0 && <div className="text-muted">{registroFeito.acoes.join(" · ")}</div>}
            {registroFeito.alteracoes.map((a, i) => (
              <div key={i} className="text-muted">{a.tipo}: {a.descricao}{a.antes || a.depois ? ` (${a.antes || "?"} → ${a.depois || "?"})` : ""}</div>
            ))}
            {registroFeito.nota && <p className="mt-1 whitespace-pre-wrap">{registroFeito.nota}</p>}
          </div>
        </div>
      )}

      {registrando && tipoReg && <RegistroRapido t={t} tipo={tipoReg} cancelar={() => setRegistrando(false)} concluido={() => setRegistrando(false)} />}

      <div className={`flex flex-wrap gap-2 ${registrando ? "hidden" : ""}`}>
        {aberta ? (
          <>
            <Botao variante="primario" onClick={() => (tipoReg ? setRegistrando(true) : salvar({ status: "feita" }, "Tarefa concluída"))}>
              {tipoReg ? "Registrar e concluir" : "Concluir"}
            </Botao>
            <Botao onClick={() => salvar({ status: "nao_feita" }, "Marcada como não feita")}>Não feita</Botao>
          </>
        ) : (
          <Botao onClick={() => salvar({ status: "a_fazer" }, "Tarefa reaberta")}>Reabrir</Botao>
        )}
        {t.triagem && <Botao onClick={() => salvar({ triagem: false }, "Saiu da caixa de entrada")}>Tirar da caixa de entrada</Botao>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Rotulo texto="Status">
          <Selecao id="tarefa-status" value={t.status} onChange={(e) => salvar({ status: e.target.value as Tarefa["status"] })}>
            {Object.entries(STATUS).map(([v, n]) => (
              <option key={v} value={v}>{n}</option>
            ))}
          </Selecao>
        </Rotulo>
        <Rotulo texto="Prazo">
          <Entrada id="tarefa-prazo" type="date" value={t.prazo ?? ""} onChange={(e) => salvar({ prazo: e.target.value || null })} />
        </Rotulo>
        <Rotulo texto="Responsável">
          <Selecao id="tarefa-responsavel" value={t.responsavel_id ?? ""} onChange={(e) => salvar({ responsavel_id: e.target.value || null })}>
            <option value="">Sem responsável</option>
            {d.membros.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </Selecao>
        </Rotulo>
        <Rotulo texto="Prioridade">
          <Selecao id="tarefa-prioridade" value={t.prioridade} onChange={(e) => salvar({ prioridade: e.target.value as Tarefa["prioridade"] })}>
            {Object.entries(PRIORIDADE).map(([v, n]) => (
              <option key={v} value={v}>{n}</option>
            ))}
          </Selecao>
        </Rotulo>
        <Rotulo texto="Pilar">
          <Selecao id="tarefa-pilar" value={t.pilar} onChange={(e) => salvar({ pilar: e.target.value as Tarefa["pilar"] })}>
            {PILARES.map((p) => (
              <option key={p} value={p}>{PILAR[p]}</option>
            ))}
          </Selecao>
        </Rotulo>
        <Rotulo texto="Canal">
          <Selecao id="tarefa-canal" value={t.canal ?? ""} onChange={(e) => salvar({ canal: (e.target.value || null) as Tarefa["canal"] })}>
            <option value="">Nenhum</option>
            {Object.entries(CANAL).map(([v, n]) => (
              <option key={v} value={v}>{n}</option>
            ))}
          </Selecao>
        </Rotulo>
        <div className="col-span-2">
          <Rotulo texto="Cliente">
            <Selecao id="tarefa-cliente" value={t.cliente_id} onChange={(e) => salvar({ cliente_id: e.target.value })}>
              {d.clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Selecao>
          </Rotulo>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">Descrição {rotina?.mensagem ? "e mensagem" : ""}</h3>
          {descricao && (
            <button
              className="flex items-center gap-1 text-[12px] text-accent"
              onClick={() =>
                navigator.clipboard.writeText(descricao).then(
                  () => d.avisar("Texto copiado"),
                  () => d.avisar("Selecione o texto e copie manualmente"),
                )
              }
            >
              <Copy size={13} /> Copiar
            </button>
          )}
        </div>
        <textarea
          id="tarefa-descricao"
          value={descricao}
          rows={Math.min(10, Math.max(3, descricao.split("\n").length + 1))}
          placeholder="Detalhes, links, combinados…"
          onChange={(e) => setDescricao(e.target.value)}
          onBlur={() => descricao !== (t.descricao ?? "") && salvar({ descricao: descricao || null })}
          className={`${campo} resize-y leading-relaxed`}
        />
        {t.clickup_id && (
          <a href={`https://app.clickup.com/t/${t.clickup_id}`} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1 text-[12px] text-muted hover:text-fg">
            <ExternalLink size={12} /> Ver a tarefa original no ClickUp
          </a>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold">
          Checklist <span className="num font-normal text-muted">{itens.filter((i) => i.feito).length}/{itens.length}</span>
        </h3>
        <ul className="flex flex-col gap-1">
          {itens.map((i) => (
            <li key={i.id} className="group flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-raised">
              <input
                id={`item-${i.id}`}
                type="checkbox"
                checked={i.feito}
                onChange={(e) => mudarItem(() => repo.marcarItem(i.id, e.target.checked))}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <label htmlFor={`item-${i.id}`} className={`flex-1 text-[13px] leading-snug ${i.feito ? "text-muted line-through" : ""}`}>
                {i.texto}
              </label>
              <button
                onClick={() => mudarItem(() => repo.removerItem(i.id))}
                className="rounded p-0.5 text-muted opacity-0 hover:text-warn focus:opacity-100 group-hover:opacity-100"
                aria-label={`Remover ${i.texto}`}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!novoItem.trim()) return;
            const texto = novoItem.trim();
            setNovoItem("");
            mudarItem(() => repo.adicionarItem(t.id, texto, itens.length));
          }}
        >
          <Entrada id="novo-item" value={novoItem} onChange={(e) => setNovoItem(e.target.value)} placeholder="Novo item" />
          <Botao type="submit" aria-label="Adicionar item">
            <Plus size={14} />
          </Botao>
        </form>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
        <h3 className="text-[13px] font-semibold">Como está o cliente?</h3>
        <MarcarTemperatura clienteId={t.cliente_id} tarefaId={t.id} compacto />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold">Comentários</h3>
        {coments.length === 0 && <p className="text-[12.5px] text-muted">Nenhum comentário ainda.</p>}
        <ul className="flex flex-col gap-2">
          {coments.map((c) => (
            <li key={c.id} className="rounded-lg bg-surface px-3 py-2 text-[13px]">
              <div className="mb-0.5 text-[11.5px] text-muted">
                {c.autor ?? "Alguém"} · {new Date(c.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
              <p className="whitespace-pre-wrap leading-snug"><TextoComMencoes texto={c.texto} /></p>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!novoComent.trim()) return;
            const texto = novoComent.trim();
            setNovoComent("");
            mudarItem(() => repo.comentar(t.id, texto));
          }}
        >
          <CampoMencao id="novo-comentario" rows={2} valor={novoComent} mudar={setNovoComent} placeholder="Escreva um comentário. Use @Nome para avisar alguém" />
          <Botao type="submit" className="self-end">Comentar</Botao>
        </form>
      </section>

      <div className="border-t border-line pt-3">
        {confirmarExclusao ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            Excluir esta tarefa de vez?
            <Botao
              onClick={async () => {
                await repo.excluirTarefa(t.id);
                fechar();
                await d.recarregar();
                d.avisar("Tarefa excluída");
              }}
            >
              Sim, excluir
            </Botao>
            <Botao variante="fantasma" onClick={() => setConfirmarExclusao(false)}>Cancelar</Botao>
          </div>
        ) : (
          <Botao variante="fantasma" onClick={() => setConfirmarExclusao(true)}>
            <Trash2 size={14} /> Excluir tarefa
          </Botao>
        )}
      </div>
    </div>
  );
}
