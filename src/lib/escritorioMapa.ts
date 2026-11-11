// Mapa do escritório virtual em tiles (16 px cada), estilo pixel art visto de cima.
export const TILE = 16;
export const COLS = 45;
export const ROWS = 32;

export type Piso = "grama" | "madeira" | "carpete_cinza" | "carpete_azul" | "carpete_roxo" | "carpete_rosa" | "carpete_verde" | "ladrilho" | "ladrilho_claro" | "madeira_escura" | "carpete_lounge" | "corredor" | "calcada" | "carpete_marinho";
export type Lado = "cima" | "baixo" | "esquerda" | "direita";
export interface SalaMapa {
  id: string; nome: string; icone: string; cor: string; piso: Piso;
  x: number; y: number; w: number; h: number; // inclui as paredes
  portas: { lado: Lado; pos: number; largura?: number }[];
}
export type TipoMovel =
  | "mesa" | "monitor" | "monitor2" | "notebook" | "cadeira" | "cadeira_chefe" | "planta" | "planta_grande" | "estante" | "sofa" | "sofa_v" | "poltrona" | "mesa_redonda"
  | "mesa_reuniao" | "tv" | "balcao" | "cafeteira" | "geladeira" | "bebedouro" | "pingpong" | "pufe" | "tapete" | "quadro" | "janela" | "relogio" | "abajur" | "mesa_centro" | "arvore" | "pinheiro" | "bambu" | "aquario" | "recepcao" | "divisoria" | "lousa"
  | "logo" | "letreiro" | "trofeu" | "neon";
export interface Movel { t: TipoMovel; x: number; y: number; w: number; h: number; bloqueia: boolean; cor?: string; parede?: boolean }
export interface Assento { id: string; x: number; y: number; sala: string; olha: Lado }

// Salas coladas (paredes compartilhadas) e corredores curtos: tudo fica perto.
// Corredores: faixa de cima (y 11–12), faixa de baixo (y 22) e passagens nas laterais (x 2 e x 41).
export const SALAS_MAPA: SalaMapa[] = [
  { id: "diretoria", nome: "Diretoria", icone: "🧭", cor: "#0e1a52", piso: "carpete_marinho", x: 2, y: 2, w: 10, h: 9, portas: [{ lado: "baixo", pos: 4 }] },
  { id: "comercial", nome: "Comercial", icone: "💼", cor: "#2f9e6e", piso: "carpete_verde", x: 11, y: 2, w: 12, h: 9, portas: [{ lado: "baixo", pos: 5 }] },
  { id: "trafego", nome: "Tráfego", icone: "📈", cor: "#2747d6", piso: "carpete_azul", x: 22, y: 2, w: 12, h: 9, portas: [{ lado: "baixo", pos: 5 }] },
  { id: "cafe", nome: "Copa", icone: "☕", cor: "#a16207", piso: "ladrilho", x: 33, y: 2, w: 9, h: 9, portas: [{ lado: "baixo", pos: 3 }] },
  { id: "reuniao", nome: "Reunião", icone: "🗣️", cor: "#7c3aed", piso: "madeira_escura", x: 3, y: 13, w: 9, h: 9, portas: [{ lado: "cima", pos: 3 }] },
  { id: "operacional", nome: "Operacional · CS", icone: "🧩", cor: "#e07a3b", piso: "carpete_cinza", x: 11, y: 13, w: 12, h: 9, portas: [{ lado: "cima", pos: 5 }] },
  { id: "criacao", nome: "Criação e Social", icone: "🎨", cor: "#c2508a", piso: "carpete_rosa", x: 22, y: 13, w: 12, h: 9, portas: [{ lado: "cima", pos: 5 }] },
  { id: "foco", nome: "Foco", icone: "🎧", cor: "#0d9488", piso: "carpete_roxo", x: 33, y: 13, w: 8, h: 9, portas: [{ lado: "cima", pos: 3 }] },
  { id: "recepcao", nome: "Recepção", icone: "🚪", cor: "#2747d6", piso: "ladrilho_claro", x: 11, y: 23, w: 12, h: 6, portas: [{ lado: "cima", pos: 5 }, { lado: "baixo", pos: 5 }] },
  { id: "lounge", nome: "Lounge", icone: "🏓", cor: "#2563eb", piso: "carpete_lounge", x: 22, y: 23, w: 20, h: 6, portas: [{ lado: "cima", pos: 4 }] },
];
// O lounge conta como "Café" no relatório de tempo
export const SALA_RELATORIO: Record<string, string> = { lounge: "cafe" };

export const PRedio = { x: 1, y: 1, w: 42, h: 29 };
const PORTA_RUA = [16, 17];

function construir() {
  const piso: Piso[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => "grama" as Piso));
  const parede: boolean[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false));
  const salaDe: (string | null)[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
  const moveis: Movel[] = [];
  const assentos: Assento[] = [];
  const add = (t: TipoMovel, x: number, y: number, w = 1, h = 1, bloqueia = true, extra: Partial<Movel> = {}) => moveis.push({ t, x, y, w, h, bloqueia, ...extra });
  const sentar = (sala: string, x: number, y: number, olha: Lado, cadeira = true) => { assentos.push({ id: `${sala}-${x}-${y}`, x, y, sala, olha }); if (cadeira) add("cadeira", x, y, 1, 1, false, { cor: olha }); };

  // Prédio: corredores em piso claro
  for (let y = PRedio.y; y < PRedio.y + PRedio.h; y++) for (let x = PRedio.x; x < PRedio.x + PRedio.w; x++) piso[y][x] = "corredor";
  for (let x = PRedio.x; x < PRedio.x + PRedio.w; x++) { parede[PRedio.y][x] = true; parede[PRedio.y + PRedio.h - 1][x] = true; }
  for (let y = PRedio.y; y < PRedio.y + PRedio.h; y++) { parede[y][PRedio.x] = true; parede[y][PRedio.x + PRedio.w - 1] = true; }
  for (const x of PORTA_RUA) { parede[PRedio.y + PRedio.h - 1][x] = false; for (let y = PRedio.y + PRedio.h; y < ROWS; y++) piso[y][x] = "calcada"; }

  for (const s of SALAS_MAPA) {
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) {
      const borda = y === s.y || y === s.y + s.h - 1 || x === s.x || x === s.x + s.w - 1;
      if (borda) parede[y][x] = true;
      else { piso[y][x] = s.piso; salaDe[y][x] = s.id; }
    }
    for (const p of s.portas) {
      const l = p.largura ?? 2;
      for (let i = 0; i < l; i++) {
        const [px, py] = p.lado === "cima" ? [s.x + p.pos + i, s.y] : p.lado === "baixo" ? [s.x + p.pos + i, s.y + s.h - 1] : p.lado === "esquerda" ? [s.x, s.y + p.pos + i] : [s.x + s.w - 1, s.y + p.pos + i];
        parede[py][px] = false; piso[py][px] = s.piso; salaDe[py][px] = s.id;
      }
    }
  }

  // ---------- Mobília ----------
  // Diretoria (marinho Vertente)
  add("tapete", 4, 4, 6, 5, false, { cor: "#2747d6" });
  add("estante", 3, 3, 2, 1, true, { parede: true });
  add("logo", 6, 2, 2, 1, true, { parede: true });
  add("janela", 8, 2, 2, 1, true, { parede: true });
  add("mesa", 5, 5, 4, 2, true, { cor: "#3a2a1e" }); add("notebook", 6, 5, 1, 1, true); add("abajur", 8, 5, 1, 1, true);
  sentar("diretoria", 7, 4, "baixo");
  sentar("diretoria", 5, 8, "cima"); sentar("diretoria", 8, 8, "cima");
  add("planta_grande", 3, 9, 1, 1); add("trofeu", 10, 3, 1, 1); add("aquario", 10, 6, 1, 2);

  // Salas de mesas: 4 lugares cada
  const sala = (id: string, x0: number, y0: number, monitor: TipoMovel, corMesa: string, portaEmCima: boolean) => {
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      const mx = x0 + 2 + c * 4, my = y0 + (portaEmCima ? 3 : 2) + r * 3;
      add("mesa", mx, my, 3, 1, true, { cor: corMesa });
      add(monitor, mx + 1, my, 1, 1, true);
      add(r === 0 ? "planta" : "notebook", mx + (c === 0 ? 0 : 2), my, 1, 1, true);
      sentar(id, mx + 1, my + 1, "cima");
    }
    add("planta_grande", x0 + 10, y0 + (portaEmCima ? 7 : 1), 1, 1);
  };
  sala("comercial", 11, 2, "monitor", "#f4f4f2", false); add("quadro", 13, 2, 2, 1, true, { parede: true, cor: "#2f9e6e" }); add("lousa", 17, 2, 3, 1, true, { parede: true });
  sala("trafego", 22, 2, "monitor2", "#f4f4f2", false); add("letreiro", 24, 2, 4, 1, true, { parede: true }); add("janela", 29, 2, 3, 1, true, { parede: true });
  sala("operacional", 11, 13, "monitor", "#f4f4f2", true); add("quadro", 20, 14, 2, 1, true, { cor: "#e07a3b" });
  sala("criacao", 22, 13, "monitor2", "#fbe7f1", true); add("quadro", 31, 14, 2, 1, true, { cor: "#c2508a" });

  // Copa
  add("balcao", 34, 3, 5, 1, true); add("cafeteira", 35, 3, 1, 1, true); add("geladeira", 40, 3, 1, 2, true); add("bebedouro", 34, 9, 1, 1, true);
  add("mesa_redonda", 37, 6, 2, 2, true); sentar("cafe", 36, 6, "direita"); sentar("cafe", 39, 7, "esquerda");
  add("planta", 40, 9, 1, 1);

  // Sala de reunião
  add("tapete", 4, 15, 7, 5, false, { cor: "#d8b98f" });
  add("tv", 8, 13, 3, 1, true, { parede: true });
  add("mesa_reuniao", 5, 16, 4, 2, true);
  for (let i = 0; i < 4; i++) { sentar("reuniao", 5 + i, 15, "baixo"); sentar("reuniao", 5 + i, 18, "cima"); }
  sentar("reuniao", 4, 16, "direita"); sentar("reuniao", 9, 17, "esquerda");
  add("planta_grande", 4, 20, 1, 1); add("planta_grande", 10, 20, 1, 1);

  // Foco: 3 cabines
  for (let i = 0; i < 3; i++) {
    const y = 15 + i * 2;
    add("mesa", 37, y, 3, 1, true, { cor: "#e6e3f7" }); add("notebook", 38, y, 1, 1, true);
    sentar("foco", 38, y + 1, "cima");
  }
  add("planta_grande", 34, 15, 1, 1); add("bambu", 34, 19, 1, 2);

  // Recepção: tapete com a logo Vertente no centro
  add("tapete", 14, 24, 6, 4, false, { cor: "#0e1a52" });
  add("logo", 15, 24, 4, 4, false);
  add("recepcao", 19, 25, 3, 1, true); sentar("recepcao", 20, 24, "baixo");
  add("sofa", 12, 27, 2, 1, false, { cor: "#2747d6" }); assentos.push({ id: "recepcao-12-27", x: 12, y: 27, sala: "recepcao", olha: "cima" }, { id: "recepcao-13-27", x: 13, y: 27, sala: "recepcao", olha: "cima" });
  add("planta_grande", 12, 24, 1, 1); add("planta_grande", 21, 27, 1, 1);

  // Lounge
  add("neon", 30, 23, 4, 1, true, { parede: true });
  add("pingpong", 29, 25, 4, 2, true);
  add("bambu", 23, 24, 1, 2); add("planta", 40, 27, 1, 1);
  add("tapete", 34, 24, 6, 4, false, { cor: "#b9cdf5" });
  add("sofa", 35, 24, 3, 1, false, { cor: "#2747d6" }); assentos.push({ id: "lounge-35-24", x: 35, y: 24, sala: "lounge", olha: "baixo" }, { id: "lounge-37-24", x: 37, y: 24, sala: "lounge", olha: "baixo" });
  add("mesa_centro", 35, 25, 2, 1, true);
  add("sofa", 35, 27, 3, 1, false, { cor: "#2747d6" }); assentos.push({ id: "lounge-35-27", x: 35, y: 27, sala: "lounge", olha: "cima" }, { id: "lounge-37-27", x: 37, y: 27, sala: "lounge", olha: "cima" });
  add("poltrona", 39, 25, 1, 1, false); assentos.push({ id: "lounge-39-25", x: 39, y: 25, sala: "lounge", olha: "esquerda" });
  for (const [x, y, c] of [[24, 27, "#2747d6"], [26, 27, "#c2508a"]] as [number, number, string][]) { add("pufe", x, y, 1, 1, false, { cor: c }); assentos.push({ id: `lounge-${x}-${y}`, x, y, sala: "lounge", olha: "cima" }); }

  // Hall de espera (à esquerda da recepção)
  add("aquario", 3, 24, 3, 1, true); add("estante", 7, 24, 3, 1, true);
  add("poltrona", 3, 26, 1, 1, false); assentos.push({ id: "corredor-3-26", x: 3, y: 26, sala: "corredor", olha: "direita" });
  add("mesa_centro", 4, 26, 2, 1, true); add("poltrona", 6, 26, 1, 1, false); assentos.push({ id: "corredor-6-26", x: 6, y: 26, sala: "corredor", olha: "esquerda" });
  add("planta_grande", 10, 28, 1, 1); add("planta", 2, 28, 1, 1);
  // Corredores
  add("planta_grande", 2, 11, 1, 1); add("planta_grande", 41, 11, 1, 1); add("bebedouro", 9, 27, 1, 1);

  // Jardim
  const arvores: [number, number, TipoMovel][] = [[43, 3, "pinheiro"], [43, 10, "arvore"], [43, 17, "pinheiro"], [43, 24, "arvore"], [4, 30, "arvore"], [10, 30, "pinheiro"], [24, 30, "arvore"], [32, 30, "pinheiro"], [39, 30, "arvore"]];
  for (const [x, y, t] of arvores) add(t, x, y, 2, 2, true);

// Bloqueios
  const bloqueado: boolean[][] = parede.map((l, y) => l.map((p, x) => p || piso[y][x] === "grama"));
  for (const m of moveis) if (m.bloqueia) for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) if (bloqueado[y]?.[x] !== undefined) bloqueado[y][x] = true;
  // Porta da rua e calçada liberadas
  for (const x of PORTA_RUA) for (let y = PRedio.y + PRedio.h - 1; y < ROWS; y++) bloqueado[y][x] = false;
  return { piso, parede, salaDe, moveis, assentos, bloqueado };
}
export const MAPA = construir();
export const ASSENTOS = MAPA.assentos;
export const ENTRADA = { x: 16, y: 26 };
export const salaNoTile = (x: number, y: number) => MAPA.salaDe[Math.round(y)]?.[Math.round(x)] ?? null;

/** Caminho mais curto entre dois tiles (A*, 4 direções). Destino pode ser um assento. */
export function caminho(de: { x: number; y: number }, para: { x: number; y: number }): { x: number; y: number }[] {
  const livre = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS && (!MAPA.bloqueado[y][x] || (x === para.x && y === para.y));
  if (!livre(para.x, para.y)) return [];
  const chave = (x: number, y: number) => y * COLS + x;
  const aberto: { x: number; y: number; f: number; g: number }[] = [{ ...de, g: 0, f: 0 }];
  const veio = new Map<number, number>();
  const g = new Map<number, number>([[chave(de.x, de.y), 0]]);
  let voltas = 0;
  while (aberto.length && voltas++ < 6000) {
    aberto.sort((a, b) => a.f - b.f);
    const n = aberto.shift()!;
    if (n.x === para.x && n.y === para.y) {
      const r: { x: number; y: number }[] = [];
      let k = chave(n.x, n.y);
      while (k !== chave(de.x, de.y)) { r.unshift({ x: k % COLS, y: Math.floor(k / COLS) }); k = veio.get(k)!; }
      return r;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = n.x + dx, y = n.y + dy;
      if (!livre(x, y)) continue;
      const ng = n.g + 1, k = chave(x, y);
      if (ng < (g.get(k) ?? Infinity)) { g.set(k, ng); veio.set(k, chave(n.x, n.y)); aberto.push({ x, y, g: ng, f: ng + Math.abs(x - para.x) + Math.abs(y - para.y) }); }
    }
  }
  return [];
}
