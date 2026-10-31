import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardCopy, Compass, Link2, Lock, Target, Users, Wallet } from "lucide-react";
import { useDados } from "../lib/dados";
import { SISTEMA_URL, supabase } from "../lib/supabase";
import { useEstrategiaIA } from "./EstrategiaIA";
import { CAMPOS_BRIEFING, SECOES_BRIEFING, briefingEmTexto, completudeBriefing, useBriefings, type CampoBriefing } from "../lib/briefing";
import { Botao } from "./ui";

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const idSecao = (s: string) => "sec-" + s.toLowerCase().normalize("NFD").replace(/[^a-z]+/g, "-");

/** Briefing estratégico do cliente: edição direto na tela, salva ao sair de cada campo. */
export function BriefingCliente({ clienteId }: { clienteId: string }) {
  const d = useDados();
  const tb = useBriefings();
  const b = tb.linhas.find((x) => x.cliente_id === clienteId);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [link, setLink] = useState("");
  const editando = useRef(false);
  const cliente = d.cliente(clienteId);

  // Atualiza com o que veio do banco quando ninguém está digitando
  useEffect(() => {
    if (!editando.current) setValores({ ...(b?.campos ?? {}) });
  }, [b?.id, b?.atualizado_em]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvarCampo(chave: string) {
    editando.current = false;
    const novo = (valores[chave] ?? "").trim();
    if (novo === (b?.campos?.[chave] ?? "").trim()) return;
    setSalvando(chave);
    try {
      const campos = { ...(b?.campos ?? {}), ...valores, [chave]: novo };
      await tb.salvar(b?.id ?? null, { cliente_id: clienteId, campos, atualizado_por: d.eu });
    } catch (e) {
      setAviso(`Não salvou: ${(e as Error).message}`);
    }
    setSalvando(null);
  }

  async function aplicarEstrategia(novos: Record<string, string>) {
    const campos = { ...(b?.campos ?? {}), ...valores, ...novos };
    setValores(campos);
    try {
      await tb.salvar(b?.id ?? null, { cliente_id: clienteId, campos, atualizado_por: d.eu });
      setAviso("Estratégia aplicada no briefing.");
    } catch (e) {
      setAviso(`Não salvou: ${(e as Error).message}`);
    }
  }

  async function gerarLink() {
    if (!supabase) return setAviso("Na prévia não dá para gerar o link. Use o sistema em sistema.agenciavertente.com.br.");
    const { data, error } = await supabase.from("cadastro_links").insert({ cliente_id: clienteId, tipo: "briefing" }).select("token").single();
    if (error) return setAviso(error.message);
    setLink(`${SISTEMA_URL}/#briefing-publico-${(data as { token: string }).token}`);
  }

  function copiar(texto: string, msg: string) {
    navigator.clipboard?.writeText(texto).then(() => setAviso(msg), () => setAviso("Não consegui copiar."));
  }

  const base = { ...(b ?? { id: "", cliente_id: clienteId, atualizado_em: "", atualizado_por: null, respondido_cliente_em: null, campos: {} }), campos: valores };
  const comp = completudeBriefing(base);
  const autor = d.membros.find((m) => m.id === b?.atualizado_por)?.nome.split(" ")[0];
  const v = (k: string) => valores[k]?.trim();

  const resumo = [
    { icone: Target, rotulo: "Objetivo", texto: v("objetivo_principal"), chave: "objetivo_principal" },
    { icone: Compass, rotulo: "KPI principal", texto: v("kpi_principal"), chave: "kpi_principal" },
    { icone: Wallet, rotulo: "Verba de anúncios", texto: v("verba_midia"), chave: "verba_midia" },
    { icone: Users, rotulo: "Cliente ideal", texto: v("persona"), chave: "persona" },
  ];

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const ia = useEstrategiaIA({ cliente: cliente?.nome ?? "", clienteId, briefingTexto: briefingEmTexto(cliente?.nome ?? "", base), aplicar: aplicarEstrategia });

  if (tb.carregando) return <p className="p-4 text-[13px] text-muted">Carregando briefing…</p>;

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho: completude e ações */}
      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 lg:flex-row lg:items-center lg:justify-between" style={{ boxShadow: "var(--sombra)" }}>
        <div className="flex items-center gap-4">
          <Anel pct={comp.pct} />
          <div>
            <div className="text-[15px] font-semibold">Briefing estratégico</div>
            <div className="text-[12.5px] text-muted">
              {comp.feitos} de {comp.total} respostas
              {b?.atualizado_em && <> · atualizado {dataHora(b.atualizado_em)}{autor ? ` por ${autor}` : ""}</>}
              {b?.respondido_cliente_em && <> · cliente respondeu em {dataHora(b.respondido_cliente_em)}</>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ia.botao}
          <Botao onClick={() => copiar(briefingEmTexto(cliente?.nome ?? "", base), "Briefing copiado. Dá para colar no ChatGPT, num documento ou no WhatsApp.")}><ClipboardCopy size={14} /> Copiar briefing</Botao>
          <Botao variante="primario" onClick={gerarLink}><Link2 size={14} /> Enviar para o cliente preencher</Botao>
        </div>
      </div>

      {ia.painel}

      {link && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent-soft p-3 text-[13px]">
          <b>Link do briefing (vale 30 dias)</b>
          <div className="flex gap-2">
            <input readOnly value={link} className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[11.5px]" />
            <Botao onClick={() => copiar(link, "Link copiado.")}>Copiar</Botao>
            <Botao onClick={() => copiar(`Oi! Para a gente montar a estratégia certinha, preenche esse briefing rapidinho (leva uns 10 minutos): ${link}`, "Mensagem copiada.")}>Copiar mensagem</Botao>
          </div>
          <span className="text-[12px] text-muted">O cliente vê só as perguntas do negócio. A parte "Estratégia da Vertente" e o KPI ficam só para o time.</span>
        </div>
      )}
      {aviso && <div className="rounded-lg bg-raised px-3 py-2 text-[12.5px]">{aviso}</div>}

      {/* Resumo em 1 minuto */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {resumo.map((r) => (
          <a key={r.rotulo} href={`#campo-${r.chave}`} onClick={(e) => { e.preventDefault(); document.getElementById(`campo-${r.chave}`)?.focus(); }} className="flex flex-col gap-1 rounded-2xl bg-surface p-4 hover:ring-1 hover:ring-accent/40" style={{ boxShadow: "var(--sombra)" }}>
            <span className="flex items-center gap-1.5 text-[12px] text-muted"><r.icone size={14} className="text-accent" /> {r.rotulo}</span>
            <span className={`line-clamp-3 text-[13.5px] ${r.texto ? "font-medium" : "text-muted"}`}>{r.texto || "Ainda não definido"}</span>
          </a>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[210px_1fr]">
        {/* Navegação das seções */}
        <nav className="hidden xl:block">
          <div className="sticky top-4 flex flex-col gap-0.5 rounded-2xl bg-surface p-2" style={{ boxShadow: "var(--sombra)" }}>
            {SECOES_BRIEFING.map((s) => {
              const feitos = s.campos.filter((c) => v(c.chave)).length;
              return (
                <button key={s.secao} onClick={() => document.getElementById(idSecao(s.secao))?.scrollIntoView({ behavior: "smooth", block: "start" })} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-raised">
                  <span className="flex items-center gap-1.5">{s.interna && <Lock size={12} className="text-muted" />}{s.secao}</span>
                  <span className={`num text-[11.5px] ${feitos === s.campos.length ? "text-ok" : "text-muted"}`}>{feitos}/{s.campos.length}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex flex-col gap-4">
          {SECOES_BRIEFING.map((s) => (
            <section key={s.secao} id={idSecao(s.secao)} className={`scroll-mt-4 rounded-2xl p-4 sm:p-5 ${s.interna ? "border border-accent/25 bg-accent-soft/40" : "bg-surface"}`} style={s.interna ? undefined : { boxShadow: "var(--sombra)" }}>
              <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
                {s.interna && <Lock size={14} className="text-accent" />} {s.secao}
                {s.interna && <span className="text-[11.5px] font-normal text-muted">só o time vê</span>}
              </h3>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
                {s.campos.map((c) => (
                  <Campo
                    key={c.chave}
                    c={c}
                    valor={valores[c.chave] ?? ""}
                    salvando={salvando === c.chave}
                    mudar={(t) => { editando.current = true; setValores((x) => ({ ...x, [c.chave]: t })); }}
                    sair={() => salvarCampo(c.chave)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Campo({ c, valor, mudar, sair, salvando }: { c: CampoBriefing; valor: string; mudar: (t: string) => void; sair: () => void; salvando: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(c.grande ? 88 : 60, el.scrollHeight)}px`;
  }, [valor, c.grande]);
  const ok = Boolean(valor.trim());
  return (
    <label className={`flex flex-col gap-1 ${c.grande ? "md:col-span-2" : ""}`}>
      <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
        {ok ? <CheckCircle2 size={13} className="text-ok" /> : <span className="h-[13px] w-[13px] rounded-full border border-line" />}
        {c.rotulo}
        {salvando && <span className="text-[11px] font-normal text-muted">salvando…</span>}
      </span>
      <textarea
        id={`campo-${c.chave}`}
        ref={ref}
        rows={2}
        value={valor}
        placeholder={c.dica}
        onChange={(e) => mudar(e.target.value)}
        onBlur={sair}
        className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-[13.5px] leading-relaxed outline-none placeholder:text-muted/70 focus:border-accent"
      />
    </label>
  );
}

function Anel({ pct }: { pct: number }) {
  const r = 22, c = 2 * Math.PI * r;
  const cor = pct >= 80 ? "var(--color-ok, #16a34a)" : pct >= 40 ? "#d97706" : "#94a3b8";
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" className="text-line" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={cor} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 28 28)" />
      <text x="28" y="32.5" textAnchor="middle" className="fill-current text-[13px] font-semibold">{pct}%</text>
    </svg>
  );
}

export const CAMPOS_PUBLICOS_BRIEFING = CAMPOS_BRIEFING.filter((c) => c.cliente);
