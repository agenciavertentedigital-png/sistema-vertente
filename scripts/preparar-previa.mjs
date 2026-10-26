// Converte o build de prévia (dist-preview/index.html) no formato de página publicada no Claude:
// sem <!doctype>, <html>, <head> e <body> próprios (a publicação adiciona esse esqueleto).
import { readFileSync, writeFileSync } from "node:fs";
let html = readFileSync("dist-preview/index.html", "utf8");
html = html
  .replace(/<!doctype html>/i, "")
  .replace(/<\/?html[^>]*>/gi, "")
  .replace(/<\/?head>/gi, "")
  .replace(/<\/?body>/gi, "")
  .replace(/<meta charset="UTF-8"\s*\/?>/i, "")
  .replace(/<meta name="viewport"[^>]*>/i, "");
writeFileSync("dist-preview/sistema-vertente.html", html.trim() + "\n");
console.log("ok", html.length);
