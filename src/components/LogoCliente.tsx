import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { corDoNome, iniciaisCliente } from "../lib/logos";

/** Logo do cliente (ou monograma). Com `trocar`, mostra um botão para enviar a imagem. */
export function LogoCliente({ nome, url, tamanho = 48, trocar, className = "" }: { nome: string; url?: string; tamanho?: number; trocar?: (f: File) => Promise<void>; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const raio = Math.round(tamanho * 0.28);
  return (
    <span className={`group/logo relative inline-grid shrink-0 place-items-center overflow-hidden ${className}`} style={{ width: tamanho, height: tamanho, borderRadius: raio }}>
      {url ? (
        <span className="grid h-full w-full place-items-center border border-line bg-white" style={{ borderRadius: raio }}>
          <img src={url} alt={`Logo ${nome}`} className="max-h-[78%] max-w-[78%] object-contain" loading="lazy" />
        </span>
      ) : (
        <span className="grid h-full w-full place-items-center font-display font-semibold text-white" style={{ background: corDoNome(nome), borderRadius: raio, fontSize: tamanho * 0.36, letterSpacing: "0.02em" }}>
          {iniciaisCliente(nome)}
        </span>
      )}
      {trocar && (
        <>
          <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setEnviando(true); try { await trocar(f); } finally { setEnviando(false); } }} />
          <span role="button" tabIndex={0} title={url ? "Trocar logo" : "Colocar logo"} aria-label={url ? "Trocar logo" : "Colocar logo"}
            onClick={(e) => { e.stopPropagation(); ref.current?.click(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); ref.current?.click(); } }}
            className={`absolute inset-0 grid place-items-center bg-[rgb(12_14_20/0.55)] text-white transition-opacity ${enviando ? "opacity-100" : "opacity-0 focus:opacity-100 group-hover/logo:opacity-100"}`}
            style={{ borderRadius: raio }}>
            {enviando ? <span className="text-[10px]">enviando…</span> : <ImagePlus size={Math.max(14, tamanho * 0.32)} strokeWidth={1.8} />}
          </span>
        </>
      )}
    </span>
  );
}
