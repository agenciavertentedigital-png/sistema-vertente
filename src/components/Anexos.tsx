import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useDados } from "../lib/dados";

/** A que o PDF pertence. cliente_id vai junto sempre que houver, para aparecer em "Arquivos do cliente". */
export type AlvoAnexo = { cliente_id?: string | null; tarefa_id?: string; registro_id?: string; reuniao_id?: string };
export type Anexo = { id: string; nome: string; caminho: string; tamanho: number | null; criado_em: string; cliente_id: string | null; tarefa_id: string | null; registro_id: string | null; reuniao_id: string | null; autor?: { nome: string } | null };

const LIMITE = 20 * 1024 * 1024;
const CAMPOS = "id, nome, caminho, tamanho, criado_em, cliente_id, tarefa_id, registro_id, reuniao_id, autor:membros!anexos_criado_por_fkey(nome)";

function validar(f: File) {
  if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) return `"${f.name}" não é PDF.`;
  if (f.size > LIMITE) return `"${f.name}" passa de 20 MB.`;
  return null;
}

export function tamanhoLegivel(b: number | null) {
  if (!b) return "";
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Envia os PDFs e grava a referência. Devolve quantos foram. */
export async function enviarAnexos(arquivos: File[], alvo: AlvoAnexo) {
  if (!supabase || !arquivos.length) return 0;
  const pasta = alvo.cliente_id ?? "geral";
  for (const f of arquivos) {
    const erro = validar(f);
    if (erro) throw new Error(erro);
    const caminho = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${f.name.replace(/[^\w.-]+/g, "_")}`;
    const up = await supabase.storage.from("anexos").upload(caminho, f, { contentType: "application/pdf" });
    if (up.error) throw new Error(/bucket/i.test(up.error.message) ? "Falta aplicar a atualização do banco dos anexos." : up.error.message);
    const ins = await supabase.from("anexos").insert({ ...alvo, cliente_id: alvo.cliente_id ?? null, nome: f.name, caminho, tamanho: f.size });
    if (ins.error) {
      await supabase.storage.from("anexos").remove([caminho]);
      throw new Error(ins.error.message);
    }
  }
  return arquivos.length;
}

export async function abrirAnexo(a: Pick<Anexo, "caminho">) {
  if (!supabase) return;
  const aba = window.open("", "_blank");
  const r = await supabase.storage.from("anexos").createSignedUrl(a.caminho, 60 * 10);
  if (r.data?.signedUrl) {
    if (aba) aba.location.href = r.data.signedUrl;
    else window.location.href = r.data.signedUrl;
  } else aba?.close();
}

/** Lista anexos filtrando por uma coluna (tarefa_id, registro_id, reuniao_id ou cliente_id). */
export function useAnexos(coluna: "tarefa_id" | "registro_id" | "reuniao_id" | "cliente_id", valor: string | null | undefined) {
  const [lista, setLista] = useState<Anexo[]>([]);
  const [disponivel, setDisponivel] = useState(true);
  const carregar = useCallback(async () => {
    if (!supabase || !valor) return setLista([]);
    const r = await supabase.from("anexos").select(CAMPOS).eq(coluna, valor).order("criado_em", { ascending: false }).limit(200);
    if (r.error) { setDisponivel(false); return setLista([]); }
    setLista(r.data as unknown as Anexo[]);
  }, [coluna, valor]);
  useEffect(() => { carregar(); }, [carregar]);
  return { lista, carregar, disponivel };
}

/** Botão "Anexar PDF" (só escolhe o arquivo). */
export function BotaoPdf({ escolher, ocupado, rotulo = "Anexar PDF" }: { escolher: (f: File[]) => void; ocupado?: boolean; rotulo?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  if (!supabase) return null;
  return (
    <>
      <input ref={ref} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; if (fs.length) escolher(fs); }} />
      <button type="button" disabled={ocupado} onClick={() => ref.current?.click()} className="inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-[12.5px] text-muted hover:bg-raised hover:text-fg disabled:opacity-50">
        <Paperclip size={13} /> {ocupado ? "Enviando…" : rotulo}
      </button>
    </>
  );
}

/** PDFs escolhidos num formulário que ainda não foi salvo (vão junto ao salvar). */
export function PdfsPendentes({ arquivos, mudar }: { arquivos: File[]; mudar: (f: File[]) => void }) {
  const d = useDados();
  if (!supabase) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {arquivos.map((f, i) => (
        <span key={i} className="inline-flex max-w-[240px] items-center gap-1 rounded-lg border border-line bg-raised px-2 py-0.5 text-[12px]">
          <FileText size={12} className="shrink-0 text-warn" /><span className="truncate">{f.name}</span>
          <button type="button" onClick={() => mudar(arquivos.filter((_, k) => k !== i))} className="text-muted hover:text-fg" aria-label={`Tirar ${f.name}`}><X size={12} /></button>
        </span>
      ))}
      <BotaoPdf escolher={(fs) => {
        const erro = fs.map(validar).find(Boolean);
        if (erro) d.avisar(erro);
        mudar([...arquivos, ...fs.filter((f) => !validar(f))]);
      }} />
    </div>
  );
}

/** Chips clicáveis de anexos já salvos. */
export function ChipsAnexos({ lista, remover }: { lista: Anexo[]; remover?: (a: Anexo) => void }) {
  if (!lista.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {lista.map((a) => (
        <span key={a.id} className="group inline-flex max-w-[280px] items-center gap-1 rounded-lg border border-line bg-surface px-2 py-0.5 text-[12px] hover:border-line-forte">
          <button type="button" onClick={() => abrirAnexo(a)} className="inline-flex min-w-0 items-center gap-1" title={`Abrir ${a.nome}`}>
            <FileText size={12} className="shrink-0 text-warn" /><span className="truncate">{a.nome}</span>
            {a.tamanho ? <span className="num shrink-0 text-muted">{tamanhoLegivel(a.tamanho)}</span> : null}
          </button>
          {remover && <button type="button" onClick={() => remover(a)} className="text-muted opacity-0 hover:text-warn focus:opacity-100 group-hover:opacity-100" aria-label={`Remover ${a.nome}`}><Trash2 size={12} /></button>}
        </span>
      ))}
    </div>
  );
}

/** Bloco completo para algo que já existe: lista + anexar + remover. */
export function Anexos({ alvo, coluna, titulo }: { alvo: AlvoAnexo; coluna: "tarefa_id" | "registro_id" | "reuniao_id" | "cliente_id"; titulo?: string }) {
  const d = useDados();
  const valor = alvo[coluna] ?? null;
  const { lista, carregar, disponivel } = useAnexos(coluna, valor);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<Anexo | null>(null);
  if (!supabase || !disponivel) return null;

  async function enviar(fs: File[]) {
    setOcupado(true);
    try {
      const n = await enviarAnexos(fs, alvo);
      await carregar();
      d.avisar(n === 1 ? "PDF anexado" : `${n} PDFs anexados`);
    } catch (e) { d.avisar((e as Error).message); } finally { setOcupado(false); }
  }
  async function remover(a: Anexo) {
    if (!supabase) return;
    const r = await supabase.from("anexos").delete().eq("id", a.id);
    if (r.error) return d.avisar(r.error.message);
    await supabase.storage.from("anexos").remove([a.caminho]);
    setConfirmar(null);
    await carregar();
    d.avisar("Anexo removido");
  }

  return (
    <div className="flex flex-col gap-1.5">
      {titulo && <h3 className="text-[13px] font-semibold">{titulo} {lista.length > 0 && <span className="num font-normal text-muted">{lista.length}</span>}</h3>}
      <ChipsAnexos lista={lista} remover={setConfirmar} />
      {confirmar && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-warn-soft px-2.5 py-1.5 text-[12.5px] text-warn">
          Remover "{confirmar.nome}"? Não dá para desfazer.
          <button className="font-semibold underline" onClick={() => remover(confirmar)}>Remover</button>
          <button className="text-fg" onClick={() => setConfirmar(null)}>Cancelar</button>
        </div>
      )}
      <BotaoPdf escolher={enviar} ocupado={ocupado} />
    </div>
  );
}
