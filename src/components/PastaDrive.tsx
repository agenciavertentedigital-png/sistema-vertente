import { useState } from "react";
import { ExternalLink, FolderOpen } from "lucide-react";
import { useFichas } from "../lib/cadastro";
import { useDados } from "../lib/dados";
import { Botao, Entrada } from "./ui";

/** Id da pasta a partir do link do Drive (…/folders/ID ou ?id=ID). */
export function idPasta(link: string | null | undefined) {
  if (!link) return null;
  return link.match(/\/folders\/([A-Za-z0-9_-]{10,})/)?.[1] ?? link.match(/[?&]id=([A-Za-z0-9_-]{10,})/)?.[1] ?? null;
}

/**
 * Pasta do cliente no Google Drive, vista dentro do sistema (visualização do próprio Google).
 * O Drive só mostra os arquivos para quem tem acesso à pasta e está logado no Google neste navegador.
 */
export function PastaDrive({ clienteId }: { clienteId: string }) {
  const d = useDados();
  const fichas = useFichas();
  const ficha = fichas.fichas.find((f) => f.id === clienteId);
  const [link, setLink] = useState("");
  const [modo, setModo] = useState<"list" | "grid">("list");
  const id = idPasta(ficha?.pasta_drive);

  async function salvar() {
    if (!idPasta(link)) return d.avisar("Cole o link de uma pasta do Drive (drive.google.com/drive/folders/…)");
    try {
      await fichas.salvarFicha(clienteId, { pasta_drive: link.trim() });
      d.avisar("Pasta ligada ao cliente");
    } catch (e) {
      d.avisar((e as Error).message);
    }
  }

  if (fichas.carregando) return null;
  if (!id)
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
        <FolderOpen size={32} className="text-muted" />
        <div>
          <div className="text-[15px] font-semibold">Ligue a pasta do Drive deste cliente</div>
          <p className="mt-1 max-w-[56ch] text-[13px] text-muted">Cole o link da pasta onde ficam estratégias, roteiros, criativos e relatórios. Ela passa a abrir aqui dentro.</p>
        </div>
        <div className="flex w-full max-w-[560px] gap-2">
          <Entrada value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
          <Botao variante="primario" onClick={salvar} disabled={!link.trim()}>Ligar pasta</Botao>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted">Mostra os arquivos para quem tem acesso à pasta e está logado no Google neste navegador. Para enviar ou editar, abra no Drive.</p>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-line bg-surface p-0.5 text-[12px]">
            {(["list", "grid"] as const).map((m) => (
              <button key={m} onClick={() => setModo(m)} className={`rounded-md px-2 py-1 ${modo === m ? "bg-accent text-accent-fg" : "text-muted"}`}>{m === "list" ? "Lista" : "Grade"}</button>
            ))}
          </div>
          <a href={`https://drive.google.com/drive/folders/${id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-fg">
            <ExternalLink size={14} /> Abrir no Drive
          </a>
          <Botao variante="fantasma" onClick={() => fichas.salvarFicha(clienteId, { pasta_drive: null })}>Trocar pasta</Botao>
        </div>
      </div>
      <iframe
        key={modo}
        src={`https://drive.google.com/embeddedfolderview?id=${id}#${modo}`}
        title="Pasta do cliente no Google Drive"
        className="h-[560px] w-full rounded-xl border border-line bg-white"
      />
    </div>
  );
}
