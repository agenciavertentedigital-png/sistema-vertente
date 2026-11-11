// Desenho em pixel art (canvas 2D, 1 unidade = 1 pixel do tile de 16 px).
import { COLS, MAPA, ROWS, SALAS_MAPA, TILE, type Lado, type Movel, type Piso } from "./escritorioMapa";
import simboloAzul from "../assets/simbolo-azul.png";
import simboloPrata from "../assets/simbolo-prata.png";
import logoPrata from "../assets/logo-prata.png";
import palavra from "../assets/escritorio-palavra.png";

type C = CanvasRenderingContext2D;
const r = (c: C, x: number, y: number, w: number, h: number, cor: string) => { c.fillStyle = cor; c.fillRect(Math.round(x), Math.round(y), w, h); };

// ------------------------------------------------------------------
// Pisos
// ------------------------------------------------------------------
const PISOS: Record<Piso, [string, string]> = {
  grama: ["#8fd18a", "#84c87f"],
  madeira: ["#f3e3c8", "#ead6b6"],
  carpete_cinza: ["#a9adb9", "#a1a5b2"],
  carpete_azul: ["#9fb0e6", "#97a8df"],
  carpete_roxo: ["#8f8fd8", "#8888d0"],
  carpete_rosa: ["#e9b9cd", "#e3b0c5"],
  carpete_verde: ["#9fd3c4", "#97cbbc"],
  ladrilho: ["#eef1f4", "#dfe4ea"],
  ladrilho_claro: ["#f4f1ea", "#e9e4d8"],
  madeira_escura: ["#c99a6b", "#bf9062"],
  carpete_lounge: ["#8a96e0", "#828fd8"],
  corredor: ["#eef1f7", "#e5e9f2"],
  calcada: ["#d9d4c7", "#cdc7b8"],
  carpete_marinho: ["#2a3778", "#26336f"],
};

function piso(c: C, p: Piso, x: number, y: number) {
  const [a, b] = PISOS[p];
  const px = x * TILE, py = y * TILE;
  r(c, px, py, TILE, TILE, a);
  if (p === "madeira" || p === "madeira_escura") {
    // tábuas
    const off = (y % 2) * 8;
    r(c, px, py + 7, TILE, 1, b); r(c, px, py + 15, TILE, 1, b);
    r(c, px + ((off + 4) % 16), py, 1, 7, b); r(c, px + ((off + 12) % 16), py + 8, 1, 7, b);
  } else if (p === "corredor" || p === "calcada") {
    if ((x + y) % 2) r(c, px, py, TILE, TILE, b);
    r(c, px, py, TILE, 1, "rgba(14,26,82,0.05)"); r(c, px, py, 1, TILE, "rgba(14,26,82,0.05)");
  } else if (p === "ladrilho" || p === "ladrilho_claro") {
    if ((x + y) % 2) r(c, px, py, TILE, TILE, b);
    r(c, px, py, TILE, 1, "rgba(0,0,0,0.04)"); r(c, px, py, 1, TILE, "rgba(0,0,0,0.04)");
  } else if (p === "grama") {
    const s = (x * 7 + y * 13) % 5;
    r(c, px + 3 + s, py + 4, 1, 2, "#6fb56a"); r(c, px + 10 - s, py + 11, 1, 2, "#6fb56a"); r(c, px + 7, py + 1 + s, 1, 1, "#a7e0a1");
  } else {
    // carpete: trama
    for (let i = 0; i < 4; i++) r(c, px + i * 4 + ((y % 2) * 2), py + i * 4, 2, 2, b);
  }
}

function parede(c: C, x: number, y: number) {
  const px = x * TILE, py = y * TILE;
  const baixo = MAPA.parede[y + 1]?.[x] === false && MAPA.piso[y + 1]?.[x] !== "grama";
  // topo da parede e face frontal (efeito de altura quando há piso embaixo)
  const cima = MAPA.parede[y - 1]?.[x] === true;
  r(c, px, py, TILE, TILE, "#16235f");
  if (!cima) { r(c, px, py, TILE, 3, "#2f42a0"); r(c, px, py + 3, TILE, 1, "#0e1a52"); }
  if (MAPA.parede[y]?.[x - 1] !== true) r(c, px, py, 1, TILE, "#2a3b8a");
  if (MAPA.parede[y]?.[x + 1] !== true) r(c, px + TILE - 1, py, 1, TILE, "#0e1a52");
  if (baixo) { r(c, px, py + 6, TILE, 10, "#e3e8f6"); r(c, px, py + 6, TILE, 1, "#c4cce4"); r(c, px, py + 13, TILE, 2, "#2747d6"); r(c, px, py + 15, TILE, 1, "#0e1a52"); }
}

// ------------------------------------------------------------------
// Móveis
// ------------------------------------------------------------------
function sombra(c: C, x: number, y: number, w: number, h: number) { r(c, x + 1, y + h, w - 1, 2, "rgba(0,0,0,0.12)"); }

function movel(c: C, m: Movel) {
  const x = m.x * TILE, y = m.y * TILE, w = m.w * TILE, h = m.h * TILE;
  switch (m.t) {
    case "tapete": r(c, x + 2, y + 2, w - 4, h - 4, m.cor ?? "#ddd"); r(c, x + 5, y + 5, w - 10, 1, "rgba(255,255,255,0.45)"); r(c, x + 5, y + h - 6, w - 10, 1, "rgba(255,255,255,0.45)"); break;
    case "mesa": sombra(c, x, y + 2, w, h - 2); r(c, x, y + 2, w, h - 4, m.cor ?? "#f4f4f2"); r(c, x, y + h - 3, w, 2, "#c9c9c4"); r(c, x + 1, y + h - 1, 2, 1, "#8a8a85"); r(c, x + w - 3, y + h - 1, 2, 1, "#8a8a85"); r(c, x, y + 2, w, 1, "rgba(255,255,255,0.7)"); break;
    case "monitor": r(c, x + 3, y - 2, 10, 7, "#2b2f3a"); r(c, x + 4, y - 1, 8, 5, "#5fa8ff"); r(c, x + 5, y, 3, 1, "#c6e2ff"); r(c, x + 7, y + 5, 2, 2, "#2b2f3a"); r(c, x + 5, y + 7, 6, 1, "#2b2f3a"); r(c, x + 2, y + 9, 12, 3, "#3a3f4d"); r(c, x + 3, y + 10, 10, 1, "#6b7180"); break;
    case "monitor2": for (const dx of [-4, 6]) { r(c, x + dx + 2, y - 3, 10, 8, "#2b2f3a"); r(c, x + dx + 3, y - 2, 8, 6, dx < 0 ? "#7c5cff" : "#2fd18f"); r(c, x + dx + 4, y, 6, 1, "rgba(255,255,255,0.6)"); r(c, x + dx + 6, y + 5, 2, 2, "#2b2f3a"); } r(c, x + 1, y + 9, 14, 3, "#3a3f4d"); break;
    case "notebook": r(c, x + 3, y + 3, 10, 6, "#9aa0ad"); r(c, x + 4, y + 4, 8, 4, "#e8f1ff"); r(c, x + 2, y + 9, 12, 2, "#6b7180"); break;
    case "abajur": r(c, x + 6, y + 6, 4, 6, "#7a5c3a"); r(c, x + 4, y + 1, 8, 6, "#ffd36b"); r(c, x + 5, y + 2, 6, 1, "#fff2c2"); break;
    case "cadeira": {
      const o = m.cor as Lado;
      r(c, x + 4, y + 4, 8, 8, "#3d4352"); r(c, x + 5, y + 5, 6, 6, "#4d5466");
      if (o === "cima") r(c, x + 3, y + 11, 10, 3, "#2f3441"); else if (o === "baixo") r(c, x + 3, y + 2, 10, 3, "#2f3441"); else if (o === "esquerda") r(c, x + 11, y + 3, 3, 10, "#2f3441"); else r(c, x + 2, y + 3, 3, 10, "#2f3441");
      r(c, x + 7, y + 12, 2, 2, "#22262f");
      break;
    }
    case "cadeira_chefe": r(c, x + 3, y + 2, 10, 12, "#7a3e2a"); break;
    case "poltrona": r(c, x + 1, y + 2, 14, 12, "#e07a3b"); r(c, x + 3, y + 4, 10, 8, "#f29a5e"); r(c, x + 1, y + 2, 14, 3, "#c4622a"); break;
    case "pufe": r(c, x + 3, y + 4, 10, 9, m.cor ?? "#3b6fe0"); r(c, x + 2, y + 6, 12, 5, m.cor ?? "#3b6fe0"); r(c, x + 5, y + 5, 4, 2, "rgba(255,255,255,0.35)"); break;
    case "planta": r(c, x + 5, y + 9, 6, 5, "#c8693a"); r(c, x + 5, y + 9, 6, 1, "#a8552e"); r(c, x + 3, y + 2, 4, 6, "#3faa4f"); r(c, x + 8, y + 1, 4, 8, "#2f9a43"); r(c, x + 6, y + 4, 4, 5, "#52c062"); break;
    case "planta_grande": sombra(c, x + 2, y + 6, 12, 8); r(c, x + 4, y + 9, 8, 6, "#5b6378"); r(c, x + 4, y + 9, 8, 1, "#7a8399"); r(c, x + 1, y - 4, 6, 9, "#2f9a43"); r(c, x + 9, y - 6, 6, 11, "#3faa4f"); r(c, x + 5, y - 8, 6, 14, "#52c062"); r(c, x + 7, y - 6, 2, 4, "#7ad686"); break;
    case "bambu": for (let i = 0; i < 4; i++) { r(c, x + 2 + i * 3, y - 10 + (i % 2) * 3, 2, h + 8, "#5fbf55"); r(c, x + 2 + i * 3, y - 2 + i * 4, 2, 1, "#3e9b3a"); } r(c, x, y + h - 6, w, 6, "#4b5263"); break;
    case "estante": r(c, x, y - 6, w, h + 4, "#6a4a32"); for (let i = 0; i < 2; i++) { r(c, x + 1, y - 5 + i * 8, w - 2, 7, "#3b2a1d"); for (let k = 0; k < w - 3; k += 3) r(c, x + 2 + k, y - 4 + i * 8, 2, 6, ["#e05a4f", "#3b6fe0", "#f2b33d", "#2f9e6e", "#8a63d2"][(k + i) % 5]); } break;
    case "sofa": sombra(c, x, y, w, h); r(c, x, y + 1, w, h - 2, m.cor ?? "#d9734a"); r(c, x + 2, y + 4, w - 4, h - 7, "rgba(255,255,255,0.18)"); r(c, x, y + 1, 3, h - 2, "rgba(0,0,0,0.15)"); r(c, x + w - 3, y + 1, 3, h - 2, "rgba(0,0,0,0.15)"); break;
    case "mesa_redonda": sombra(c, x + 2, y + 2, w - 4, h - 4); r(c, x + 4, y + 2, w - 8, h - 4, "#e9c58f"); r(c, x + 2, y + 4, w - 4, h - 8, "#e9c58f"); r(c, x + 6, y + 6, 6, 2, "#fff3dc"); r(c, x + w / 2 - 2, y + h / 2 - 2, 4, 4, "#8a63d2"); break;
    case "mesa_centro": sombra(c, x, y + 2, w, h - 2); r(c, x + 1, y + 3, w - 2, h - 5, "#a0673a"); r(c, x + 4, y + 5, 4, 3, "#f5f5f5"); break;
    case "mesa_reuniao": sombra(c, x, y, w, h); r(c, x, y + 1, w, h - 2, "#8b5a3c"); r(c, x + 2, y + 3, w - 4, h - 6, "#a46c48"); for (let i = 0; i < 4; i++) r(c, x + 18 + i * 16, y + 8, 6, 4, "#f5f5f5"); break;
    case "tv": r(c, x + 4, y + 3, w - 8, 11, "#1d212b"); r(c, x + 6, y + 5, w - 12, 7, "#4b7bec"); r(c, x + 8, y + 6, 14, 2, "#9cc0ff"); break;
    case "lousa": r(c, x + 1, y + 4, w - 2, 10, "#fafafa"); r(c, x + 1, y + 13, w - 2, 1, "#9aa2b3"); r(c, x + 5, y + 6, 12, 1, "#3b6fe0"); r(c, x + 5, y + 9, 18, 1, "#e05a4f"); r(c, x + 26, y + 6, 10, 5, "#f2b33d"); break;
    case "quadro": r(c, x + 2, y + 3, w - 4, 10, "#3a2f28"); r(c, x + 3, y + 4, w - 6, 8, m.cor ?? "#f2b33d"); r(c, x + 6, y + 6, 6, 4, "#fff"); r(c, x + 14, y + 8, 8, 2, "rgba(0,0,0,0.25)"); break;
    case "janela": r(c, x + 1, y + 2, w - 2, 12, "#3f4b63"); r(c, x + 2, y + 3, w - 4, 10, "#9fd8ff"); for (let k = 16; k < w - 2; k += 16) r(c, x + k, y + 3, 1, 10, "#3f4b63"); r(c, x + 4, y + 4, 4, 2, "rgba(255,255,255,0.7)"); break;
    case "relogio": r(c, x + 4, y + 2, 8, 12, "#6a4a32"); r(c, x + 5, y + 3, 6, 6, "#fff4dc"); r(c, x + 7, y + 4, 1, 3, "#333"); break;
    case "balcao": r(c, x, y, w, h + 2, "#d9dee7"); r(c, x, y, w, 3, "#f5f7fa"); r(c, x + 2, y + 10, w - 4, 1, "#b8c0cc"); break;
    case "cafeteira": r(c, x + 3, y - 4, 10, 12, "#2b2f3a"); r(c, x + 5, y - 2, 6, 3, "#e05a4f"); r(c, x + 6, y + 4, 4, 3, "#f5f5f5"); break;
    case "geladeira": r(c, x + 1, y - 6, w - 2, h + 4, "#e4e9f0"); r(c, x + 1, y + 6, w - 2, 1, "#b8c0cc"); r(c, x + 12, y - 2, 1, 6, "#8a92a3"); r(c, x + 12, y + 9, 1, 6, "#8a92a3"); break;
    case "bebedouro": r(c, x + 4, y - 6, 8, 8, "#7cc4ff"); r(c, x + 5, y - 5, 3, 3, "#c8e8ff"); r(c, x + 3, y + 2, 10, 12, "#e4e9f0"); r(c, x + 6, y + 6, 4, 2, "#8a92a3"); break;
    case "aquario": r(c, x, y + 1, w, h - 2, "#3a4a63"); r(c, x + 1, y + 2, w - 2, h - 5, "#5ec8e8"); r(c, x + 4, y + 6, 3, 2, "#ff8a3d"); r(c, x + (w > 20 ? 20 : 8), y + 10, 3, 2, "#ffd23d"); r(c, x + 1, y + h - 5, w - 2, 2, "#d8c38f"); break;
    case "pingpong": sombra(c, x, y, w, h); r(c, x + 1, y + 1, w - 2, h - 3, "#2f9e6e"); r(c, x + 2, y + 2, w - 4, h - 5, "#38b47e"); r(c, x + w / 2 - 1, y, 2, h - 1, "#f5f5f5"); r(c, x + 2, y + h / 2 - 1, w - 4, 1, "rgba(255,255,255,0.7)"); break;
    case "recepcao": sombra(c, x, y, w, h); r(c, x, y, w, h, "#e9edf2"); r(c, x, y, w, 4, "#ffffff"); r(c, x, y + h - 3, w, 3, "#3b6fe0"); r(c, x + w / 2 - 6, y + 5, 12, 4, "#3b6fe0"); break;
    case "divisoria": r(c, x + 2, y + 6, w - 4, 3, "#b8c0cc"); r(c, x + 2, y + 6, w - 4, 1, "#e4e9f0"); break;
    case "arvore": r(c, x + 13, y + 18, 6, 12, "#7a5230"); r(c, x + 2, y + 2, 28, 18, "#3f9b3a"); r(c, x + 5, y - 3, 22, 10, "#4fb548"); r(c, x + 9, y - 6, 12, 6, "#62c75b"); r(c, x + 7, y + 3, 6, 4, "#7ad86f"); r(c, x + 4, y + 18, 24, 3, "rgba(0,0,0,0.12)"); break;
    case "trofeu": r(c, x + 4, y - 2, 8, 6, "#f2c23d"); r(c, x + 2, y - 1, 2, 3, "#f2c23d"); r(c, x + 12, y - 1, 2, 3, "#f2c23d"); r(c, x + 5, y - 1, 2, 2, "#fff3b0"); r(c, x + 7, y + 4, 2, 4, "#d9a21f"); r(c, x + 4, y + 8, 8, 4, "#0e1a52"); break;
    case "logo": if (m.parede) { r(c, x + 3, y + 2, w - 6, 12, "#ffffff"); r(c, x + 3, y + 13, w - 6, 1, "#c4cce4"); } break; // a imagem entra em desenharMarcas
    case "letreiro": r(c, x + 1, y + 2, w - 2, 12, "#0e1a52"); r(c, x + 1, y + 13, w - 2, 1, "#2747d6"); break;
    case "neon": r(c, x + 1, y + 2, w - 2, 12, "#141a3a"); break;
    case "pinheiro": r(c, x + 14, y + 22, 4, 8, "#7a5230"); for (let i = 0; i < 4; i++) r(c, x + 4 + i * 3, y - 4 + i * 6, 24 - i * 6, 7, i % 2 ? "#2f7d43" : "#3a8f4f"); r(c, x + 6, y + 27, 20, 3, "rgba(0,0,0,0.12)"); break;
  }
}

// ------------------------------------------------------------------
// Bonequinho (16 x 22) com 4 direções e passos
// ------------------------------------------------------------------
export interface Visual { pele: string; cabelo: string; estilo: number; camisa: string; calca: string; sapato: string }
const PELES = ["#f2c9a0", "#e0ac7e", "#c68a5c", "#8d5a3b", "#f6d6b8"];
const CABELOS = ["#2b1d14", "#5a3a22", "#a8692e", "#e2b049", "#1b1b1b", "#7a3b8f", "#c0392b"];
const CAMISAS = ["#3b6fe0", "#e05a4f", "#2f9e6e", "#f2b33d", "#8a63d2", "#ff7aa8", "#1fb5c9", "#ffffff", "#334155"];
const CALCAS = ["#2b3a67", "#3a3a3a", "#5a4632", "#1f4f8a"];
export function visualDe(chave: string): Visual {
  let h = 0;
  for (const ch of chave) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const p = (arr: string[], s: number) => arr[(h >>> s) % arr.length];
  return { pele: p(PELES, 0), cabelo: p(CABELOS, 3), estilo: (h >>> 7) % 3, camisa: p(CAMISAS, 9), calca: p(CALCAS, 13), sapato: "#22262f" };
}

export function boneco(c: C, cx: number, base: number, v: Visual, dir: Lado, passo: number, sentado: boolean, ausente: boolean) {
  const x = Math.round(cx - 8), y = Math.round(base - 22 + (sentado ? 3 : 0));
  c.globalAlpha = ausente ? 0.55 : 1;
  // sombra
  r(c, x + 3, base - 1, 10, 2, "rgba(0,0,0,0.18)");
  const andando = !sentado && passo % 2 === 1;
  const perna = (passo % 4) < 2 ? 1 : -1;
  // pernas
  if (!sentado) {
    if (dir === "esquerda" || dir === "direita") {
      r(c, x + 6 + (andando ? perna : 0), y + 16, 2, 5, v.calca); r(c, x + 8 - (andando ? perna : 0), y + 16, 2, 5, v.calca);
      r(c, x + 6 + (andando ? perna : 0), y + 21, 3, 1, v.sapato); r(c, x + 8 - (andando ? perna : 0), y + 21, 3, 1, v.sapato);
    } else {
      r(c, x + 5, y + 16 - (andando && perna > 0 ? 1 : 0), 3, 5, v.calca); r(c, x + 8, y + 16 - (andando && perna < 0 ? 1 : 0), 3, 5, v.calca);
      r(c, x + 5, y + 21 - (andando && perna > 0 ? 1 : 0), 3, 1, v.sapato); r(c, x + 8, y + 21 - (andando && perna < 0 ? 1 : 0), 3, 1, v.sapato);
    }
  } else {
    r(c, x + 5, y + 16, 6, 3, v.calca);
  }
  // corpo
  r(c, x + 4, y + 10, 8, 7, v.camisa);
  r(c, x + 4, y + 10, 8, 1, "rgba(255,255,255,0.25)");
  // braços
  const b = andando ? perna : 0;
  if (dir === "esquerda") { r(c, x + 5, y + 11 + b, 2, 5, v.camisa); r(c, x + 5, y + 16 + b, 2, 1, v.pele); }
  else if (dir === "direita") { r(c, x + 9, y + 11 + b, 2, 5, v.camisa); r(c, x + 9, y + 16 + b, 2, 1, v.pele); }
  else { r(c, x + 2, y + 11 + b, 2, 5, v.camisa); r(c, x + 12, y + 11 - b, 2, 5, v.camisa); r(c, x + 2, y + 16 + b, 2, 1, v.pele); r(c, x + 12, y + 16 - b, 2, 1, v.pele); }
  // cabeça
  r(c, x + 4, y + 2, 8, 8, v.pele);
  r(c, x + 3, y + 4, 1, 4, v.pele); r(c, x + 12, y + 4, 1, 4, v.pele);
  // cabelo
  r(c, x + 3, y + 1, 10, 3, v.cabelo); r(c, x + 4, y, 8, 1, v.cabelo);
  if (v.estilo === 1) { r(c, x + 3, y + 1, 2, 7, v.cabelo); r(c, x + 11, y + 1, 2, 7, v.cabelo); }
  if (v.estilo === 2) { r(c, x + 3, y + 1, 10, 2, v.cabelo); r(c, x + 2, y + 2, 1, 3, v.cabelo); r(c, x + 13, y + 2, 1, 3, v.cabelo); }
  if (dir === "cima") r(c, x + 3, y + 1, 10, 9, v.cabelo);
  else if (dir === "esquerda") { r(c, x + 8, y + 1, 5, 7, v.cabelo); r(c, x + 5, y + 5, 1, 2, "#1d1d1d"); r(c, x + 3, y + 7, 1, 1, v.pele); }
  else if (dir === "direita") { r(c, x + 3, y + 1, 5, 7, v.cabelo); r(c, x + 10, y + 5, 1, 2, "#1d1d1d"); r(c, x + 12, y + 7, 1, 1, v.pele); }
  else { r(c, x + 5, y + 5, 1, 2, "#1d1d1d"); r(c, x + 10, y + 5, 1, 2, "#1d1d1d"); r(c, x + 7, y + 8, 2, 1, "#c86b5a"); }
  c.globalAlpha = 1;
}

// ------------------------------------------------------------------
// Camada fixa (piso, paredes, móveis que ficam atrás das pessoas)
// ------------------------------------------------------------------
export function desenharFundo(c: C) {
  c.imageSmoothingEnabled = false;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) piso(c, MAPA.piso[y][x], x, y);
  // contorno suave das salas
  for (const s of SALAS_MAPA) { c.fillStyle = s.cor; c.globalAlpha = 0.06; c.fillRect((s.x + 1) * TILE, (s.y + 1) * TILE, (s.w - 2) * TILE, (s.h - 2) * TILE); c.globalAlpha = 1; }
  for (const m of MAPA.moveis) if (m.t === "tapete") movel(c, m);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (MAPA.parede[y][x]) parede(c, x, y);
  for (const m of MAPA.moveis) if (m.parede) movel(c, m);
}

/** Móveis que entram na ordenação por profundidade junto com as pessoas. */
export const MOVEIS_CENA = MAPA.moveis.filter((m) => m.t !== "tapete" && !m.parede);
export const desenharMovel = movel;

// ------------------------------------------------------------------
// Marcas Vertente (imagens em alta resolução por cima do piso)
// ------------------------------------------------------------------
const carregar = (src: string) => { const i = new Image(); i.src = src; return i; };
const IMG = typeof Image === "undefined" ? null : { azul: carregar(simboloAzul), prata: carregar(simboloPrata), logo: carregar(logoPrata), palavra: carregar(palavra) };
const MARCAS = MAPA.moveis.filter((m) => m.t === "logo" || m.t === "letreiro" || m.t === "neon");
const pronta = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;

export function desenharMarcas(c: C, t: number) {
  if (!IMG) return;
  const antes = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  for (const m of MARCAS) {
    const x = m.x * TILE, y = m.y * TILE, w = m.w * TILE, h = m.h * TILE;
    if (m.t === "logo" && !m.parede && pronta(IMG.logo)) {
      const lw = w - 6, lh = lw * (IMG.logo.naturalHeight / IMG.logo.naturalWidth);
      c.globalAlpha = 0.95; c.drawImage(IMG.logo, x + 3, y + (h - lh) / 2, lw, lh); c.globalAlpha = 1;
    } else if (m.t === "logo" && pronta(IMG.azul)) {
      c.drawImage(IMG.azul, x + w / 2 - 5, y + 3, 10, 10);
    } else if (m.t === "letreiro" && pronta(IMG.prata) && pronta(IMG.palavra)) {
      c.drawImage(IMG.prata, x + 4, y + 3.5, 9, 9);
      const pw = w - 22, ph = pw * (IMG.palavra.naturalHeight / IMG.palavra.naturalWidth);
      c.drawImage(IMG.palavra, x + 16, y + 8 - ph / 2, pw, ph);
    } else if (m.t === "neon" && pronta(IMG.prata)) {
      const brilho = 0.75 + 0.25 * Math.sin(t / 500);
      c.save(); c.shadowColor = `rgba(90,140,255,${brilho})`; c.shadowBlur = 8;
      c.drawImage(IMG.prata, x + w / 2 - 6, y + 2, 12, 12); c.restore();
      c.fillStyle = `rgba(90,140,255,${0.18 * brilho})`; c.fillRect(x - 4, y + 15, w + 8, 10);
    }
  }
  c.imageSmoothingEnabled = antes;
}
