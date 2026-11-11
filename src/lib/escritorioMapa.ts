// Mapa do escritório virtual em tiles (16 px cada), estilo pixel art visto de cima.
export const TILE = 16;
export const COLS = 62;
export const ROWS = 36;

export type Piso = "grama" | "madeira" | "carpete_cinza" | "carpete_azul" | "carpete_roxo" | "carpete_rosa" | "carpete_verde" | "ladrilho" | "ladrilho_claro" | "madeira_escura" | "carpete_lounge";
export type Lado = "cima" | "baixo" | "esquerda" | "direita";
export interface SalaMapa {
  id: string; nome: string; icone: string; cor: string; piso: Piso;
  x: number; y: number; w: number; h: number; // inclui as paredes
  portas: { lado: Lado; pos: number; largura?: number }[];
}
export type TipoMovel =
  | "mesa" | "monitor" | "monitor2" | "notebook" | "cadeira" | "cadeira_chefe" | "planta" | "planta_grande" | "estante" | "sofa" | "sofa_v" | "poltrona" | "mesa_redonda"
  | "mesa_reuniao" | "tv" | "balcao" | "cafeteira" | "geladeira" | "bebedouro" | "pingpong" | "pufe" | "tapete" | "quadro" | "janela" | "relogio" | "abajur" | "mesa_centro" | "arvore" | "pinheiro" | "bambu" | "aquario" | "recepcao" | "divisoria" | "lousa";
export interface Movel { t: TipoMovel; x: number; y: number; w: number; h: number; bloqueia: boolean; cor?: string; parede?: boolean }
export interface Assento { id: string; x: number; y: number; sala: string; olha: Lado }

export const SALAS_MAPA: SalaMapa[] = [
  { id: "diretoria", nome: "Diretoria", icone: "🧭", cor: "#8a63d2", piso: "carpete_roxo", x: 3, y: 2, w: 12, h: 10, portas: [{ lado: "baixo", pos: 5 }] },
  { id: "comercial", nome: "Comercial", icone: "💼", cor: "#2f9e6e", piso: "carpete_cinza", x: 16, y: 2, w: 16, h: 10, portas: [{ lado: "baixo", pos: 7 }] },
  { id: "trafego", nome: "Tráfego", icone: "📈", cor: "#3b6fe0", piso: "carpete_azul", x: 33, y: 2, w: 16, h: 10, portas: [{ lado: "baixo", pos: 7 }] },
  { id: "cafe", nome: "Copa", icone: "☕", cor: "#a16207", piso: "ladrilho", x: 50, y: 2, w: 8, h: 10, portas: [{ lado: "baixo", pos: 3 }] },
  { id: "reuniao", nome: "Sala de reunião", icone: "🗣️", cor: "#7c3aed", piso: "madeira_escura", x: 3, y: 14, w: 12, h: 11, portas: [{ lado: "direita", pos: 5 }] },
  { id: "operacional", nome: "Operacional · CS", icone: "🧩", cor: "#e07a3b", piso: "carpete_cinza", x: 16, y: 14, w: 16, h: 11, portas: [{ lado: "cima", pos: 7 }] },
  { id: "criacao", nome: "Criação e Social", icone: "🎨", cor: "#c2508a", piso: "carpete_rosa", x: 33, y: 14, w: 16, h: 11, portas: [{ lado: "cima", pos: 7 }] },
  { id: "foco", nome: "Foco · silêncio", icone: "🎧", cor: "#0d9488", piso: "carpete_verde", x: 50, y: 14, w: 8, h: 11, portas: [{ lado: "esquerda", pos: 5 }] },
  { id: "recepcao", nome: "Recepção", icone: "🚪", cor: "#64748b", piso: "ladrilho_claro", x: 16, y: 27, w: 16, h: 7, portas: [{ lado: "cima", pos: 7 }, { lado: "baixo", pos: 7 }] },
  { id: "lounge", nome: "Lounge", icone: "🏓", cor: "#2563eb", piso: "carpete_lounge", x: 33, y: 27, w: 25, h: 7, portas: [{ lado: "cima", pos: 6 }] },
];
// O lounge conta como "Café" no relatório de tempo
export const SALA_RELATORIO: Record<string, string> = { lounge: "cafe" };

export const PRedio = { x: 2, y: 1, w: 57, h: 33 };

function construir() {
  const piso: Piso[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => "grama" as Piso));
  const parede: boolean[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false));
  const salaDe: (string | null)[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
  const moveis: Movel[] = [];
  const assentos: Assento[] = [];
  const add = (t: TipoMovel, x: number, y: number, w = 1, h = 1, bloqueia = true, extra: Partial<Movel> = {}) => moveis.push({ t, x, y, w, h, bloqueia, ...extra });
  const sentar = (sala: string, x: number, y: number, olha: Lado) => { assentos.push({ id: `${sala}-${x}-${y}`, x, y, sala, olha }); add("cadeira", x, y, 1, 1, false, { cor: olha }); };

  // Prédio: piso de madeira nos corredores
  for (let y = PRedio.y; y < PRedio.y + PRedio.h; y++) for (let x = PRedio.x; x < PRedio.x + PRedio.w; x++) piso[y][x] = "madeira";
  // Paredes externas
  for (let x = PRedio.x; x < PRedio.x + PRedio.w; x++) { parede[PRedio.y][x] = true; parede[PRedio.y + PRedio.h - 1][x] = true; }
  for (let y = PRedio.y; y < PRedio.y + PRedio.h; y++) { parede[y][PRedio.x] = true; parede[y][PRedio.x + PRedio.w - 1] = true; }
  // Entrada principal (embaixo, alinhada com a recepção)
  for (const x of [23, 24]) parede[PRedio.y + PRedio.h - 1][x] = false;

  for (const s of SALAS_MAPA) {
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) {
      piso[y][x] = s.piso; salaDe[y][x] = s.id;
      if (y === s.y || y === s.y + s.h - 1 || x === s.x || x === s.x + s.w - 1) parede[y][x] = true;
    }
    for (const p of s.portas) {
      const l = p.largura ?? 2;
      for (let i = 0; i < l; i++) {
        const [px, py] = p.lado === "cima" ? [s.x + p.pos + i, s.y] : p.lado === "baixo" ? [s.x + p.pos + i, s.y + s.h - 1] : p.lado === "esquerda" ? [s.x, s.y + p.pos + i] : [s.x + s.w - 1, s.y + p.pos + i];
        parede[py][px] = false;
      }
    }
  }

  // ---------- Mobília ----------
  // Diretoria
  add("tapete", 5, 5, 8, 5, false, { cor: "#c9b8f0" });
  add("estante", 4, 3, 2, 1, true, { parede: true }); add("estante", 6, 3, 2, 1, true, { parede: true });
  add("janela", 9, 2, 3, 1, true, { parede: true }); add("relogio", 13, 3, 1, 1, true);
  add("mesa", 7, 5, 4, 2, true, { cor: "#a0673a" }); add("notebook", 8, 5, 1, 1, true); add("abajur", 10, 5, 1, 1, true);
  sentar("diretoria", 9, 4, "baixo");
  sentar("diretoria", 7, 8, "cima"); sentar("diretoria", 10, 8, "cima");
  add("planta_grande", 4, 9, 1, 1); add("planta", 13, 9, 1, 1); add("aquario", 4, 6, 1, 2);

  // Salas de mesas (comercial, tráfego, operacional, criação)
  const sala = (id: string, x0: number, y0: number, w: number, monitor: TipoMovel, corMesa: string, cima: boolean) => {
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const mx = x0 + 2 + c * 4, my = y0 + (cima ? 3 : 2) + r * 4;
      add("mesa", mx, my, 3, 1, true, { cor: corMesa });
      add(monitor, mx + 1, my, 1, 1, true);
      if (c !== 1) add(r === 0 ? "planta" : "notebook", mx + (c === 0 ? 0 : 2), my, 1, 1, true);
      sentar(id, mx + 1, my + 1, "cima");
    }
    add("planta_grande", x0 + 1, y0 + 1, 1, 1); add("planta_grande", x0 + w - 2, y0 + 1, 1, 1);
  };
  sala("comercial", 16, 2, 16, "monitor", "#f4f4f2", false); add("quadro", 20, 2, 2, 1, true, { parede: true, cor: "#2f9e6e" }); add("lousa", 25, 2, 3, 1, true, { parede: true });
  sala("trafego", 33, 2, 16, "monitor2", "#f4f4f2", false); add("janela", 37, 2, 3, 1, true, { parede: true }); add("janela", 42, 2, 3, 1, true, { parede: true });
  sala("operacional", 16, 14, 16, "monitor", "#f4f4f2", true); add("quadro", 27, 15, 2, 1, true, { cor: "#e07a3b" });
  sala("criacao", 33, 14, 16, "monitor2", "#fbe7f1", true); add("quadro", 44, 15, 2, 1, true, { cor: "#c2508a" });

  // Copa
  add("balcao", 51, 3, 5, 1, true); add("cafeteira", 52, 3, 1, 1, true); add("geladeira", 56, 3, 1, 2, true); add("bebedouro", 51, 9, 1, 1, true);
  add("mesa_redonda", 53, 6, 2, 2, true); sentar("cafe", 52, 6, "direita"); sentar("cafe", 55, 7, "esquerda");
  add("planta", 56, 9, 1, 1);

  // Sala de reunião
  add("tapete", 4, 17, 10, 6, false, { cor: "#d8b98f" });
  add("tv", 7, 14, 4, 1, true, { parede: true });
  add("mesa_reuniao", 6, 18, 6, 2, true);
  for (let i = 0; i < 4; i++) { sentar("reuniao", 7 + i, 17, "baixo"); sentar("reuniao", 7 + i, 20, "cima"); }
  sentar("reuniao", 5, 18, "direita"); sentar("reuniao", 12, 19, "esquerda");
  add("planta_grande", 4, 15, 1, 1); add("planta_grande", 13, 23, 1, 1); add("estante", 4, 23, 2, 1, true);

  // Foco: cabines
  for (let i = 0; i < 3; i++) {
    const y = 15 + i * 3;
    add("mesa", 54, y, 2, 1, true, { cor: "#d7efe9" }); add("notebook", 55, y, 1, 1, true);
    add("divisoria", 53, y + 2, 4, 1, i < 2);
    sentar("foco", 55, y + 1, "cima");
  }
  add("planta_grande", 51, 15, 1, 1); add("bambu", 51, 22, 1, 2);

  // Recepção
  add("tapete", 19, 29, 10, 3, false, { cor: "#cfd8e3" });
  add("recepcao", 21, 29, 6, 1, true); sentar("recepcao", 23, 30, "cima");
  add("sofa", 17, 31, 3, 1, false, { cor: "#d9734a" }); assentos.push({ id: "recepcao-17-31", x: 17, y: 31, sala: "recepcao", olha: "cima" }, { id: "recepcao-19-31", x: 19, y: 31, sala: "recepcao", olha: "cima" });
  add("sofa", 28, 31, 3, 1, false, { cor: "#d9734a" }); assentos.push({ id: "recepcao-28-31", x: 28, y: 31, sala: "recepcao", olha: "cima" }, { id: "recepcao-30-31", x: 30, y: 31, sala: "recepcao", olha: "cima" });
  add("planta_grande", 17, 28, 1, 1); add("planta_grande", 30, 28, 1, 1);

  // Lounge
  add("pingpong", 35, 29, 4, 2, true);
  add("bambu", 34, 28, 1, 2); add("planta_grande", 56, 28, 1, 1); add("planta", 41, 28, 1, 1);
  add("tapete", 43, 28, 12, 5, false, { cor: "#b9cdf5" });
  add("sofa", 45, 28, 4, 1, false, { cor: "#e8a15a" }); assentos.push({ id: "lounge-45-28", x: 45, y: 28, sala: "lounge", olha: "baixo" }, { id: "lounge-47-28", x: 47, y: 28, sala: "lounge", olha: "baixo" });
  add("mesa_centro", 46, 30, 2, 1, true);
  add("sofa", 45, 32, 4, 1, false, { cor: "#e8a15a" }); assentos.push({ id: "lounge-45-32", x: 45, y: 32, sala: "lounge", olha: "cima" }, { id: "lounge-48-32", x: 48, y: 32, sala: "lounge", olha: "cima" });
  add("poltrona", 50, 30, 1, 1, false); assentos.push({ id: "lounge-50-30", x: 50, y: 30, sala: "lounge", olha: "esquerda" });
  for (const [x, y, c] of [[53, 29, "#3b6fe0"], [54, 31, "#c2508a"], [52, 32, "#8a63d2"]] as [number, number, string][]) { add("pufe", x, y, 1, 1, false, { cor: c }); assentos.push({ id: `lounge-${x}-${y}`, x, y, sala: "lounge", olha: "baixo" }); }

  // Corredor: plantas e bebedouro
  add("planta_grande", 15, 13, 1, 1); add("planta_grande", 49, 13, 1, 1); add("bebedouro", 32, 12, 1, 1);
  add("planta", 3, 26, 1, 1); add("planta", 14, 26, 1, 1); add("aquario", 5, 27, 3, 1, true); add("estante", 9, 27, 4, 1, true);
  add("poltrona", 4, 30, 1, 1, false); assentos.push({ id: "corredor-4-30", x: 4, y: 30, sala: "corredor", olha: "direita" });
  add("mesa_centro", 6, 30, 2, 1, true); add("poltrona", 9, 30, 1, 1, false); assentos.push({ id: "corredor-9-30", x: 9, y: 30, sala: "corredor", olha: "esquerda" });

  // Jardim ao redor
  const arvores: [number, number, TipoMovel][] = [[0, 2, "arvore"], [0, 9, "pinheiro"], [0, 15, "arvore"], [0, 22, "pinheiro"], [0, 29, "arvore"], [60, 4, "pinheiro"], [60, 12, "arvore"], [60, 20, "pinheiro"], [60, 27, "arvore"], [7, 34, "arvore"], [14, 34, "pinheiro"], [36, 34, "arvore"], [46, 34, "pinheiro"], [54, 34, "arvore"]];
  for (const [x, y, t] of arvores) add(t, x, y, 2, 2, true);

  // Bloqueios
  const bloqueado: boolean[][] = parede.map((l, y) => l.map((p, x) => p || piso[y][x] === "grama"));
  for (const m of moveis) if (m.bloqueia) for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) if (bloqueado[y]?.[x] !== undefined) bloqueado[y][x] = true;
  // Calçada da entrada liberada
  for (const x of [23, 24]) bloqueado[PRedio.y + PRedio.h - 1][x] = false;
  return { piso, parede, salaDe, moveis, assentos, bloqueado };
}
export const MAPA = construir();
export const ASSENTOS = MAPA.assentos;
export const ENTRADA = { x: 23, y: 32 };
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
