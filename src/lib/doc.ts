import DOMPurify from "dompurify";

/** Converte o texto simples das anotações antigas em HTML do editor (um parágrafo por linha). */
export function textoParaHtml(texto: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return texto
    .split(/\n{2,}/)
    .map((bloco) => {
      const linhas = bloco.split("\n");
      if (linhas.every((l) => /^\s*[-•*]\s+/.test(l))) return `<ul>${linhas.map((l) => `<li><p>${esc(l.replace(/^\s*[-•*]\s+/, ""))}</p></li>`).join("")}</ul>`;
      return `<p>${linhas.map(esc).join("<br>")}</p>`;
    })
    .join("");
}

/** HTML do documento para mostrar: o que foi salvo pelo editor ou, nas anotações antigas, o texto convertido. */
export function htmlDoDocumento(conteudo: string | null | undefined, texto: string | null | undefined): string {
  return conteudo?.trim() ? conteudo : textoParaHtml(texto ?? "");
}

// No atributo style só passa o alinhamento do texto (o editor não usa outro estilo)
DOMPurify.addHook("uponSanitizeAttribute", (_no, dados) => {
  if (dados.attrName === "style" && !/^\s*text-align:\s*(left|center|right|justify);?\s*$/i.test(dados.attrValue)) dados.keepAttr = false;
});

/** Limpa o HTML antes de mostrar (sem scripts, eventos ou estilos externos). */
export function htmlLimpo(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "mark", "code", "pre", "blockquote", "h1", "h2", "h3", "ul", "ol", "li", "a", "hr", "table", "thead", "tbody", "tr", "th", "td", "label", "input", "div", "span"],
    ALLOWED_ATTR: ["href", "target", "rel", "data-type", "data-checked", "type", "checked", "disabled", "colspan", "rowspan", "style", "class"],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:|#)/i,
  });
}

/** Endereço público do documento compartilhado. */
export function linkDoDocumento(codigo: string) {
  const base = /^https?:$/.test(window.location.protocol) && import.meta.env.MODE !== "preview" ? window.location.origin : "https://sistema.agenciavertente.com.br";
  return `${base}/d/${codigo}`;
}
