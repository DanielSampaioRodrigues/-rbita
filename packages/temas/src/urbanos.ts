// Coleção "Rua": fundos coloridos de inspiração urbana (grafite, lambe-lambe, azulejo...).
// Tudo desenhado em SVG aqui mesmo, sem arquivos de fora. Cada fundo tem uma variante
// para tema claro (cores de tinta, mais fundas) e outra para tema escuro (cores de neon, suaves).
// No baixo estímulo, camadaDeFundo deixa tudo liso, como os outros fundos.

/** Cinco cores por variante: a ordem importa (a primeira é a principal). */
export type CoresUrbanas = [string, string, string, string, string];

export interface FundoUrbano {
  nome: string;
  /** Lado do ladrilho em px, ou "cover" (um desenho só, cobrindo a janela). */
  tamanho: { largura: number; altura: number } | "cover";
  claro: CoresUrbanas;
  escuro: CoresUrbanas;
  /** Desenha o SVG com as cores da variante, por cima da cor de fundo do tema. */
  desenho: (c: CoresUrbanas, fundo: string) => string;
}

// Sorteio sempre igual (mesma semente, mesmo desenho), para o fundo não mudar a cada abertura.
function sorteio(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Forma orgânica fechada (bolha) em volta de um centro, com curvas suaves. */
function bolha(cx: number, cy: number, raio: number, semente: number, pontas = 7): string {
  const s = sorteio(semente);
  const pts = Array.from({ length: pontas }, (_, i) => {
    const a = (i / pontas) * Math.PI * 2;
    const r = raio * (0.72 + s() * 0.5);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  // Catmull-Rom para Bézier: passa por todos os pontos, sem quinas.
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < pontas; i++) {
    const p0 = pts[(i - 1 + pontas) % pontas], p1 = pts[i], p2 = pts[(i + 1) % pontas], p3 = pts[(i + 2) % pontas];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d + "Z";
}

/** Respingo de tinta: mancha central, gotas em volta e um escorrido. */
function respingo(cx: number, cy: number, r: number, cor: string, semente: number): string {
  const s = sorteio(semente);
  let g = `<path d="${bolha(cx, cy, r, semente, 9)}" fill="${cor}"/>`;
  for (let i = 0; i < 7; i++) {
    const a = s() * Math.PI * 2;
    const dist = r * (1.25 + s() * 0.9);
    g += `<circle cx="${r1(cx + Math.cos(a) * dist)}" cy="${r1(cy + Math.sin(a) * dist)}" r="${r1(r * (0.08 + s() * 0.16))}" fill="${cor}"/>`;
  }
  const x = r1(cx + (s() - 0.5) * r * 0.8);
  const comp = r * (0.9 + s() * 1.1);
  const larg = r1(r * 0.14);
  g += `<path d="M${x - larg} ${cy}V${r1(cy + comp)}a${larg} ${larg} 0 0 0 ${2 * larg} 0V${cy}z" fill="${cor}"/>`;
  return g;
}

const svg = (largura: number, altura: number, fundo: string, corpo: string, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}"${extra}><rect width="${largura}" height="${altura}" fill="${fundo}"/>${corpo}</svg>`;

// Paletas reaproveitadas entre fundos.
const RUA: Pick<FundoUrbano, "claro" | "escuro"> = {
  claro: ["#d94a38", "#e89a10", "#22917f", "#3d5a9e", "#b5489a"],
  escuro: ["#ff6b5b", "#ffd047", "#3ee6c9", "#6d8dff", "#ff6ad5"],
};
const NEON: Pick<FundoUrbano, "claro" | "escuro"> = {
  claro: ["#c2185b", "#00897b", "#5e35b1", "#ef6c00", "#1e88e5"],
  escuro: ["#ff4fd8", "#39ffc8", "#9d7bff", "#ffb03b", "#44c7ff"],
};

export const URBANOS: Record<string, FundoUrbano> = {
  respingos: {
    nome: "Respingos",
    tamanho: { largura: 360, altura: 360 },
    ...RUA,
    desenho: (c, fundo) =>
      svg(360, 360, fundo, `<g fill-opacity="0.55">${[
        respingo(80, 80, 30, c[0], 11),
        respingo(260, 120, 22, c[1], 23),
        respingo(150, 250, 36, c[2], 37),
        respingo(300, 290, 16, c[3], 41),
        respingo(50, 300, 12, c[4], 53),
        respingo(210, 40, 10, c[4], 67),
      ].join("")}</g>`),
  },
  listras: {
    nome: "Listras",
    tamanho: { largura: 160, altura: 160 },
    ...RUA,
    desenho: (c, fundo) => {
      // Diagonais que emendam sem costura: cada listra aparece em três posições.
      const faixas = [[0, c[0], 18], [40, c[1], 8], [72, c[2], 18], [112, c[3], 8], [136, c[4], 4]] as const;
      const linhas = faixas
        .map(([o, cor, l]) => [-160, 0, 160].map((d) => `<path d="M${o + d - 10} 170L${o + d + 170} -10" stroke="${cor}" stroke-width="${l}"/>`).join(""))
        .join("");
      return svg(160, 160, fundo, `<g stroke-opacity="0.5" fill="none">${linhas}</g>`);
    },
  },
  bolhas: {
    nome: "Bolhas",
    tamanho: { largura: 420, altura: 420 },
    claro: ["#f28f6b", "#f6c453", "#7cc6a4", "#7c9ee6", "#d184c8"],
    escuro: ["#ff7f6e", "#ffcf5c", "#55e0b0", "#7f9dff", "#e37ae0"],
    desenho: (c, fundo) =>
      svg(420, 420, fundo, `<g fill-opacity="0.42">
<path d="${bolha(90, 100, 70, 3)}" fill="${c[0]}"/>
<path d="${bolha(310, 90, 50, 5)}" fill="${c[1]}"/>
<path d="${bolha(230, 250, 80, 7)}" fill="${c[2]}"/>
<path d="${bolha(80, 330, 50, 9)}" fill="${c[3]}"/>
<path d="${bolha(350, 360, 40, 13)}" fill="${c[4]}"/>
<path d="${bolha(170, 150, 22, 17)}" fill="${c[4]}"/>
</g>`),
  },
  recorte: {
    nome: "Papel recortado",
    tamanho: "cover",
    claro: ["#ef8354", "#f4b860", "#5fa8a0", "#3f6c9e", "#2d3a5c"],
    escuro: ["#ff8a5c", "#ffc46b", "#4fd1c5", "#5a8dd6", "#8b7cf6"],
    desenho: (c, fundo) => {
      // Camadas de papel com sombra, subindo de baixo e descendo do canto.
      const camada = (d: string, cor: string) => `<path d="${d}" fill="#000" fill-opacity="0.12" transform="translate(0 -8)"/><path d="${d}" fill="${cor}" fill-opacity="0.75"/>`;
      return svg(1600, 1000, fundo, [
        camada("M0 1000V700C200 640 360 760 560 720S900 600 1100 660 1440 760 1600 700V1000Z", c[0]),
        camada("M0 1000V790C240 740 420 840 660 800S1040 700 1260 760 1500 830 1600 800V1000Z", c[1]),
        camada("M0 1000V880C220 850 460 920 700 890S1120 830 1340 870 1520 900 1600 880V1000Z", c[2]),
        camada("M1600 0H1020C1060 90 1180 120 1280 110S1460 160 1520 240 1600 300 1600 300Z", c[3]),
        camada("M1600 0H1250C1280 60 1360 80 1430 80S1560 120 1600 170Z", c[4]),
        camada("M0 0H360C320 70 220 90 140 90S20 140 0 180Z", c[3]),
      ].join(""), ` preserveAspectRatio="xMidYMid slice"`);
    },
  },
  neon: {
    nome: "Neon",
    tamanho: { largura: 400, altura: 400 },
    ...NEON,
    desenho: (c, fundo) => {
      // Cada traço vai duas vezes: largo e bem transparente (o brilho) e fino (o tubo).
      const tubo = (d: string, cor: string) => `<path d="${d}" stroke="${cor}" stroke-width="12" stroke-opacity="0.16"/><path d="${d}" stroke="${cor}" stroke-width="3" stroke-opacity="0.85"/>`;
      return svg(400, 400, fundo, `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${[
        tubo("M40 70l30-30 30 30 30-30 30 30", c[0]),
        tubo("M300 60a36 36 0 1 0 0.1 0", c[1]),
        tubo("M60 250c30-40 70 40 100 0s70 40 100 0", c[2]),
        tubo("M300 230l40 70h-80z", c[3]),
        tubo("M110 340l24 24m0-24l-24 24", c[4]),
        tubo("M220 140h40", c[4]),
      ].join("")}</g>`);
    },
  },
  tijolos: {
    nome: "Tijolos",
    tamanho: { largura: 120, altura: 60 },
    claro: ["#c8553d", "#e38d4b", "#b4442e", "#d9a066", "#8f3b2b"],
    escuro: ["#e0694f", "#f2a35e", "#c75137", "#e8b77d", "#b4584a"],
    desenho: (c, fundo) => {
      const t = (x: number, y: number, cor: string) => `<rect x="${x}" y="${y}" width="56" height="26" rx="2" fill="${cor}"/>`;
      return svg(120, 60, fundo, `<g fill-opacity="0.38">${[t(2, 2, c[0]), t(62, 2, c[1]), t(-28, 32, c[2]), t(32, 32, c[3]), t(92, 32, c[4])].join("")}</g>`);
    },
  },
  azulejo: {
    nome: "Azulejo",
    tamanho: { largura: 96, altura: 96 },
    claro: ["#1f4e9c", "#e0a526", "#2f7fbf", "#1f4e9c", "#1f4e9c"],
    escuro: ["#6fa0ff", "#ffcb57", "#53c3ff", "#6fa0ff", "#6fa0ff"],
    desenho: (c, fundo) =>
      // Quartos de círculo nos cantos formam círculos inteiros quando os ladrilhos se juntam.
      svg(96, 96, fundo, `<g fill="none" stroke="${c[0]}" stroke-opacity="0.45" stroke-width="2">
<path d="M0 24A24 24 0 0 0 24 0M72 0A24 24 0 0 0 96 24M96 72A24 24 0 0 0 72 96M24 96A24 24 0 0 0 0 72"/>
<path d="M0 0.5H96M0.5 0V96" stroke-opacity="0.25"/>
</g>
<path d="M48 22L56 40 74 48 56 56 48 74 40 56 22 48 40 40Z" fill="${c[1]}" fill-opacity="0.5"/>
<circle cx="48" cy="48" r="5" fill="${c[2]}" fill-opacity="0.7"/>
<g fill="${c[0]}" fill-opacity="0.4"><circle cx="0" cy="0" r="7"/><circle cx="96" cy="0" r="7"/><circle cx="0" cy="96" r="7"/><circle cx="96" cy="96" r="7"/></g>`),
  },
  vivo: {
    nome: "Gradiente vivo",
    tamanho: "cover",
    claro: ["#ff8a65", "#ffd54f", "#4dd0b8", "#7986cb", "#f48fb1"],
    escuro: ["#ff5e7e", "#ffb547", "#2ee6c0", "#6a7dff", "#d16bff"],
    desenho: (c, fundo) => {
      const g = c.map((cor, i) => `<radialGradient id="g${i}"><stop offset="0" stop-color="${cor}" stop-opacity="0.75"/><stop offset="1" stop-color="${cor}" stop-opacity="0"/></radialGradient>`).join("");
      return svg(1600, 1000, fundo, `<defs>${g}</defs>
<ellipse cx="200" cy="160" rx="620" ry="460" fill="url(#g0)"/>
<ellipse cx="1350" cy="120" rx="560" ry="420" fill="url(#g1)"/>
<ellipse cx="900" cy="560" rx="600" ry="420" fill="url(#g2)"/>
<ellipse cx="260" cy="900" rx="560" ry="400" fill="url(#g3)"/>
<ellipse cx="1450" cy="900" rx="520" ry="400" fill="url(#g4)"/>`, ` preserveAspectRatio="xMidYMid slice"`);
    },
  },
  lambe: {
    nome: "Lambe-lambe",
    tamanho: { largura: 380, altura: 380 },
    ...RUA,
    desenho: (c, fundo) => {
      // Cartazes colados tortos, com listras e círculos, e pedacinhos de fita.
      const cartaz = (x: number, y: number, l: number, a: number, giro: number, cor: string, miolo: string) =>
        `<g transform="translate(${x} ${y}) rotate(${giro})"><rect width="${l}" height="${a}" fill="${cor}" fill-opacity="0.4"/>${miolo}<rect x="${l / 2 - 14}" y="-5" width="28" height="10" fill="${fundo}" fill-opacity="0.7"/></g>`;
      return svg(380, 380, fundo, [
        cartaz(30, 40, 110, 140, -6, c[0], `<circle cx="55" cy="60" r="28" fill="${fundo}" fill-opacity="0.45"/>`),
        cartaz(210, 30, 120, 90, 5, c[1], `<path d="M0 30H120M0 55H120" stroke="${fundo}" stroke-opacity="0.5" stroke-width="8"/>`),
        cartaz(200, 200, 130, 130, -4, c[2], `<path d="M20 110L65 20 110 110Z" fill="${fundo}" fill-opacity="0.4"/>`),
        cartaz(40, 230, 100, 110, 7, c[3], `<rect x="20" y="20" width="60" height="70" fill="${c[4]}" fill-opacity="0.6"/>`),
      ].join(""));
    },
  },
  memphis: {
    nome: "Confete",
    tamanho: { largura: 240, altura: 240 },
    ...NEON,
    desenho: (c, fundo) =>
      svg(240, 240, fundo, `<g fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.6">
<path d="M20 40l14-14 14 14 14-14 14 14" stroke="${c[0]}"/>
<circle cx="170" cy="50" r="16" stroke="${c[1]}"/>
<path d="M60 160c12-16 28 16 40 0s28 16 40 0" stroke="${c[2]}"/>
<path d="M190 150l14 14m0-14l-14 14" stroke="${c[3]}"/>
</g>
<g fill-opacity="0.55">
<path d="M110 70l16 28h-32z" fill="${c[4]}"/>
<circle cx="40" cy="110" r="7" fill="${c[1]}"/>
<rect x="150" y="196" width="22" height="22" rx="3" fill="${c[0]}" transform="rotate(20 161 207)"/>
<circle cx="30" cy="210" r="4" fill="${c[3]}"/>
<circle cx="220" cy="100" r="4" fill="${c[2]}"/>
</g>`),
  },
  spray: {
    nome: "Spray",
    tamanho: { largura: 320, altura: 320 },
    ...NEON,
    desenho: (c, fundo) => {
      // Nuvens de tinta em spray: muitos pontinhos em volta de um centro, mais densos no meio.
      const nuvem = (cx: number, cy: number, r: number, cor: string, semente: number) => {
        const s = sorteio(semente);
        let g = `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="${cor}" fill-opacity="0.25"/>`;
        for (let i = 0; i < 46; i++) {
          const a = s() * Math.PI * 2;
          const d = r * Math.sqrt(s());
          g += `<circle cx="${r1(cx + Math.cos(a) * d)}" cy="${r1(cy + Math.sin(a) * d)}" r="${r1(0.8 + s() * 1.8)}" fill="${cor}" fill-opacity="0.6"/>`;
        }
        return g;
      };
      return svg(320, 320, fundo, nuvem(80, 80, 55, c[0], 5) + nuvem(240, 150, 45, c[2], 8) + nuvem(120, 250, 50, c[1], 13) + nuvem(270, 280, 25, c[3], 21));
    },
  },
};

/** Variante do fundo urbano para a cor de fundo do tema: escura (neon) ou clara (tinta). */
export function varianteUrbana(corFundo: string): "claro" | "escuro" {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(corFundo.trim());
  if (!m) return "claro";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45 ? "escuro" : "claro";
}

/** SVG pronto do fundo urbano, na variante que combina com a cor de fundo. */
export function desenhoUrbano(nome: string, corFundo: string): string | null {
  const u = URBANOS[nome];
  if (!u) return null;
  return u.desenho(u[varianteUrbana(corFundo)], corFundo);
}
