// Mede uma página como ela aparece na tela e devolve uma "lista de desenho": cada
// palavra (com fonte, tamanho, cor e a posição exata da linha de base), cada fundo,
// borda, traço, forma e imagem. A mesma lista vira PDF (com texto de verdade, que dá
// para buscar e copiar) e imagem PNG. Medir é síncrono: lê o que o navegador já
// desenhou, sem esperar nada (as fontes e imagens já precisam estar carregadas).
//
// Coordenadas da lista: px da página (96 por polegada), origem no canto de cima à
// esquerda, y para baixo.

export interface Cor { r: number; g: number; b: number; a: number }
/** Matriz afim [a, b, c, d, e, f]: x' = a·x + c·y + e; y' = b·x + d·y + f. */
export type Matriz = [number, number, number, number, number, number];

export type ItemDesenho =
  | { tipo: "texto"; x: number; y: number; largura: number; texto: string; familia: string; peso: number; italico: boolean; tamanho: number; cor: Cor; versalete?: boolean; espacamento?: number }
  | { tipo: "retangulo"; x: number; y: number; w: number; h: number; cor: Cor; raio?: number }
  | { tipo: "linha"; x1: number; y1: number; x2: number; y2: number; cor: Cor; largura: number; ponta?: "round" | "butt"; tracejado?: number[] }
  | { tipo: "caminho"; d: string; matriz: Matriz; preencher?: Cor; contorno?: Cor; larguraContorno?: number; parImpar?: boolean; ponta?: "round" | "butt" | "square" }
  /** Imagem: a matriz leva o quadrado 0..1 (y para baixo) até a página. */
  | { tipo: "imagem"; src: string; matriz: Matriz; opacidade: number }
  /** Fundo com degradê ou imagem do CSS (vira imagem antes de desenhar). */
  | { tipo: "fundo"; x: number; y: number; w: number; h: number; imagem: string; tamanho: string; posicao: string; raio?: number; opacidade: number }
  | { tipo: "caixinha"; x: number; y: number; lado: number; marcada: boolean; cor: Cor };

export interface PaginaMedida { largura: number; altura: number; itens: ItemDesenho[] }

const TRANSPARENTE: Cor = { r: 0, g: 0, b: 0, a: 0 };

/** Lê uma cor do CSS calculado ("rgb(…)", "rgba(…)", "color(srgb …)", "#rrggbb"). */
export function lerCor(v: string | null | undefined): Cor {
  if (!v || v === "none" || v === "transparent") return TRANSPARENTE;
  let m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(v.trim());
  if (m) {
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    return { r: Number(m[1]) / 255, g: Number(m[2]) / 255, b: Number(m[3]) / 255, a };
  }
  m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i.exec(v.trim());
  if (m) {
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
  }
  m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (m) {
    const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
    return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: 1 };
  }
  return TRANSPARENTE;
}
const comAlfa = (c: Cor, a: number): Cor => ({ ...c, a: c.a * a });

/** Composição de matrizes: aplica B e depois A. */
export function compor(A: Matriz, B: Matriz): Matriz {
  return [
    A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
  ];
}

/** Caminho SVG de um retângulo de cantos arredondados. */
export function caminhoRetangulo(x: number, y: number, w: number, h: number, r = 0): string {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!k) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  return `M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
}

// ---------- Linha de base de cada fonte (medida no próprio navegador) ----------

const sondas = new Map<string, { subida: number; altura: number }>();
/** Quanto a linha de base fica abaixo do topo da caixa do texto, em fração do tamanho. */
function sondar(familia: string, peso: string, estilo: string): { subida: number; altura: number } {
  const chave = `${familia}|${peso}|${estilo}`;
  const ja = sondas.get(chave);
  if (ja) return ja;
  const fora = document.createElement("div");
  fora.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden;white-space:nowrap";
  const span = document.createElement("span");
  span.style.cssText = `font-family:${familia};font-weight:${peso};font-style:${estilo};font-size:100px;line-height:normal`;
  span.textContent = "Hg";
  const marca = document.createElement("span");
  marca.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
  span.appendChild(marca);
  fora.appendChild(span);
  document.body.appendChild(fora);
  const r = span.getBoundingClientRect();
  const m = marca.getBoundingClientRect();
  const v = { subida: (m.top - r.top) / 100, altura: r.height / 100 };
  fora.remove();
  sondas.set(chave, v);
  return v;
}

// ---------- A medição ----------

const IGNORAR = ".ProseMirror-gapcursor, .column-resize-handle, [data-resize-handle], [data-exportar='nao'], .ProseMirror-separator, .ProseMirror-trailingBreak";
const SVG_FORA = new Set(["defs", "clippath", "pattern", "mask", "filter", "style", "title", "desc", "lineargradient", "radialgradient", "foreignobject", "text"]);

export interface Regiao { x: number; y: number; largura: number; altura: number }

/** Desloca um item (coordenadas da página). */
function deslocar(it: ItemDesenho, dx: number, dy: number): ItemDesenho {
  switch (it.tipo) {
    case "texto": case "retangulo": case "fundo": case "caixinha": return { ...it, x: it.x + dx, y: it.y + dy };
    case "linha": return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy };
    case "caminho": case "imagem": return { ...it, matriz: [it.matriz[0], it.matriz[1], it.matriz[2], it.matriz[3], it.matriz[4] + dx, it.matriz[5] + dy] };
  }
}

/**
 * Mede o que está dentro de cada uma das `regioes` (px da tela), andando uma vez só
 * por `raiz`. `escala`: quantos px da tela valem 1 px da página (o zoom). Cada item
 * vai para a página onde fica o seu centro; o que não cai em nenhuma fica de fora.
 */
export function medirPaginas(raiz: Element, regioes: Regiao[], escala: number, larguraPagina: number, alturaPagina: number): PaginaMedida[] {
  const paginas: PaginaMedida[] = regioes.map(() => ({ largura: larguraPagina, altura: alturaPagina, itens: [] }));
  // Coordenadas "globais": px da tela divididos pela escala.
  const px = (cx: number) => cx / escala;
  const py = (cy: number) => cy / escala;
  const paginaDe = (cx: number, cy: number) => regioes.findIndex((r) => cx >= r.x - 1 && cx <= r.x + r.largura + 1 && cy >= r.y - 1 && cy <= r.y + r.altura + 1);
  let atual = -1;
  // A página do item que está sendo medido (pelo centro da caixa dele, em px da tela).
  const dentro = (r: { left: number; top: number; width: number; height: number }) => {
    atual = paginaDe(r.left + r.width / 2, r.top + r.height / 2);
    return atual >= 0;
  };
  const itens = {
    push(it: ItemDesenho) {
      if (atual < 0) return;
      const reg = regioes[atual];
      paginas[atual].itens.push(deslocar(it, -reg.x / escala, -reg.y / escala));
    },
  };
  const daTela: Matriz = [1 / escala, 0, 0, 1 / escala, 0, 0];
  const faixa = document.createRange();

  const fundoEBordas = (el: HTMLElement, cs: CSSStyleDeclaration, op: number) => {
    const fundo = comAlfa(lerCor(cs.backgroundColor), op);
    const temImagem = cs.backgroundImage && cs.backgroundImage !== "none";
    const inline = cs.display === "inline";
    const caixas = inline ? Array.from(el.getClientRects()) : [el.getBoundingClientRect()];
    const raio = parseFloat(cs.borderTopLeftRadius) || 0;
    for (const r of caixas) {
      if (r.width < 0.5 || r.height < 0.5 || !dentro(r)) continue;
      const x = px(r.left), y = py(r.top), w = r.width / escala, h = r.height / escala;
      if (fundo.a > 0.004) itens.push({ tipo: "retangulo", x, y, w, h, cor: fundo, raio: raio || undefined });
      if (temImagem) {
        const papel = /url\("?data:image\/svg\+xml[^"]*"?\)/.exec(cs.backgroundImage);
        if (papel) desenharSvgDeFundo(cs.backgroundImage, x, y, w, h, op);
        else itens.push({ tipo: "fundo", x, y, w, h, imagem: cs.backgroundImage, tamanho: cs.backgroundSize, posicao: cs.backgroundPosition, raio: raio || undefined, opacidade: op });
      }
      if (inline) continue;
      // Bordas (tabela, citação, destaque, linha separadora).
      const lados: [string, number, number, number, number][] = [
        ["Top", x, y, x + w, y], ["Bottom", x, y + h, x + w, y + h], ["Left", x, y, x, y + h], ["Right", x + w, y, x + w, y + h],
      ];
      for (const [lado, x1, y1, x2, y2] of lados) {
        const lw = parseFloat(cs.getPropertyValue(`border-${lado.toLowerCase()}-width`)) || 0;
        const estilo = cs.getPropertyValue(`border-${lado.toLowerCase()}-style`);
        const cor = comAlfa(lerCor(cs.getPropertyValue(`border-${lado.toLowerCase()}-color`)), op);
        if (lw < 0.3 || cor.a < 0.004 || estilo === "none" || estilo === "hidden") continue;
        // Célula de tabela com bordas juntas: a borda fica em cima da linha (a da vizinha cai no mesmo lugar).
        const junta = (el.tagName === "TD" || el.tagName === "TH") && cs.borderCollapse === "collapse";
        const meio = junta ? 0 : lw / escala / 2;
        const dx = lado === "Left" ? meio : lado === "Right" ? -meio : 0;
        const dy = lado === "Top" ? meio : lado === "Bottom" ? -meio : 0;
        // Pontilhada (os pontos do sumário) e tracejada saem como na tela.
        const l = lw / escala;
        const tracejado = estilo === "dotted" ? [0.01, l * 2.2] : estilo === "dashed" ? [l * 3, l * 2] : undefined;
        itens.push({ tipo: "linha", x1: x1 + dx, y1: y1 + dy, x2: x2 + dx, y2: y2 + dy, cor, largura: l, ponta: estilo === "dotted" ? "round" : "butt", ...(tracejado ? { tracejado } : {}) });
      }
    }
  };

  // O papel do caderno é um SVG simples (retângulo, linhas e pontos) no fundo do CSS.
  const desenharSvgDeFundo = (css: string, x: number, y: number, w: number, h: number, op: number) => {
    // O SVG tem parênteses dentro ("url(#folha)"): lê até a aspa que fecha.
    const m = /url\("(data:image\/svg\+xml[^"]*)"\)/.exec(css) ?? /url\((data:image\/svg\+xml.*)\)\s*$/.exec(css);
    if (!m) return;
    const bruto = m[1];
    const virgula = bruto.indexOf(",");
    const texto = /;base64/.test(bruto.slice(0, virgula)) ? atob(bruto.slice(virgula + 1)) : decodeURIComponent(bruto.slice(virgula + 1));
    const doc = new DOMParser().parseFromString(texto, "image/svg+xml");
    const svg = doc.documentElement;
    const vb = (svg.getAttribute("viewBox") ?? `0 0 ${w} ${h}`).split(/[\s,]+/).map(Number);
    const sx = w / (vb[2] || w), sy = h / (vb[3] || h);
    const M: Matriz = [sx, 0, 0, sy, x - vb[0] * sx, y - vb[1] * sy];
    const visitar = (n: Element, opAcum: number) => {
      const nome = n.tagName.toLowerCase();
      if (SVG_FORA.has(nome)) return;
      const o = opAcum * (Number(n.getAttribute("opacity") ?? 1) || 0);
      if (nome === "g" || nome === "svg") { for (const f of Array.from(n.children)) visitar(f, o); return; }
      const d = caminhoDeElemento(n);
      if (!d) return;
      const fill = n.getAttribute("fill"); const stroke = n.getAttribute("stroke");
      itens.push({
        tipo: "caminho", d, matriz: M,
        preencher: fill && fill !== "none" ? comAlfa(lerCor(fill), o) : nome === "circle" || nome === "rect" ? comAlfa(lerCor(fill ?? "#000"), o) : undefined,
        contorno: stroke && stroke !== "none" ? comAlfa(lerCor(stroke), o) : undefined,
        larguraContorno: Number(n.getAttribute("stroke-width") ?? 1),
      });
    };
    visitar(svg, op);
  };

  const visitarSvg = (el: SVGElement, op: number) => {
    const nome = el.tagName.toLowerCase();
    if (SVG_FORA.has(nome)) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const o = op * (Number(cs.opacity) || 0);
    if (o <= 0.002) return;
    if (nome === "svg" || nome === "g" || nome === "a") { for (const f of Array.from(el.children)) visitarSvg(f as SVGElement, o); return; }
    const ctm = (el as SVGGraphicsElement).getScreenCTM?.();
    if (!ctm) return;
    const M = compor(daTela, [ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f]);
    if (!dentro((el as SVGGraphicsElement).getBoundingClientRect())) return;
    if (nome === "image") {
      const href = el.getAttribute("href") ?? el.getAttribute("xlink:href");
      if (!href) return;
      const ix = Number(el.getAttribute("x") ?? 0), iy = Number(el.getAttribute("y") ?? 0);
      const iw = Number(el.getAttribute("width") ?? 0), ih = Number(el.getAttribute("height") ?? 0);
      if (!iw || !ih) return;
      itens.push({ tipo: "imagem", src: href, matriz: compor(M, [iw, 0, 0, ih, ix, iy]), opacidade: o });
      return;
    }
    const d = caminhoDeElemento(el);
    if (!d) return;
    const fill = lerCor(cs.fill); const stroke = lerCor(cs.stroke);
    const fo = Number(cs.fillOpacity) || (cs.fillOpacity === "0" ? 0 : 1);
    const so = Number(cs.strokeOpacity) || (cs.strokeOpacity === "0" ? 0 : 1);
    const lw = parseFloat(cs.strokeWidth) || 0;
    itens.push({
      tipo: "caminho", d, matriz: M,
      preencher: cs.fill !== "none" && fill.a * fo * o > 0.002 ? comAlfa(fill, fo * o) : undefined,
      contorno: cs.stroke !== "none" && stroke.a * so * o > 0.002 && lw > 0 ? comAlfa(stroke, so * o) : undefined,
      larguraContorno: lw,
      parImpar: cs.fillRule === "evenodd",
      ponta: cs.strokeLinecap === "round" ? "round" : cs.strokeLinecap === "square" ? "square" : "butt",
    });
  };

  // Uma palavra (ou um pedaço dela, se a linha quebrou no meio).
  const empurrarTexto = (texto: string, r: DOMRect, el: HTMLElement, cs: CSSStyleDeclaration, op: number, decoracoes: Set<string>) => {
    if (!dentro(r) || r.width <= 0) return;
    const tamanhoCss = parseFloat(cs.fontSize) || 16;
    const s = sondar(cs.fontFamily, cs.fontWeight, cs.fontStyle);
    const tamanho = tamanhoCss;
    const cor = comAlfa(lerCor(cs.color), op);
    const transformar = cs.textTransform;
    let t = texto;
    if (transformar === "uppercase") t = t.toLocaleUpperCase("pt-BR");
    else if (transformar === "lowercase") t = t.toLocaleLowerCase("pt-BR");
    const x = px(r.left), topo = py(r.top), w = r.width / escala;
    const base = topo + s.subida * tamanho;
    itens.push({
      tipo: "texto", x, y: base, largura: w, texto: t, familia: cs.fontFamily,
      peso: Number(cs.fontWeight) || 400, italico: cs.fontStyle !== "normal", tamanho, cor,
      versalete: /small-caps/.test(cs.fontVariantCaps || cs.fontVariant) || undefined,
      // Espaço entre letras (px de tela, já com o zoom): o PDF usa o espaçamento de verdade.
      espacamento: (parseFloat(cs.letterSpacing) || 0) / escala || undefined,
    });
    const grossura = Math.max(0.6, tamanho / 16);
    if (decoracoes.has("underline")) itens.push({ tipo: "linha", x1: x, y1: base + tamanho * 0.12, x2: x + w, y2: base + tamanho * 0.12, cor, largura: grossura, ponta: "butt" });
    if (decoracoes.has("line-through")) itens.push({ tipo: "linha", x1: x, y1: base - tamanho * 0.3, x2: x + w, y2: base - tamanho * 0.3, cor, largura: grossura, ponta: "butt" });
    void el;
  };

  // Capitular: o bloco cuja primeira letra ocupa N linhas (CSS initial-letter).
  let capitular: { n: number; bloco: HTMLElement } | null = null;
  const desenharCapitular = (no: Text, i: number, el: HTMLElement, cs: CSSStyleDeclaration, op: number) => {
    const cap = capitular!;
    capitular = null;
    faixa.setStart(no, i); faixa.setEnd(no, i + 1);
    const rl = faixa.getClientRects()[0];
    // A linha de base da primeira linha vem do texto que segue a letra.
    let rr: DOMRect | undefined;
    if (i + 1 < no.length) { faixa.setStart(no, i + 1); faixa.setEnd(no, Math.min(no.length, i + 2)); rr = faixa.getClientRects()[0]; }
    if (!rl || !dentro(rl)) return;
    const csB = getComputedStyle(cap.bloco);
    const fs = parseFloat(cs.fontSize) || 16;
    const lh = parseFloat(csB.lineHeight) || fs * 1.2;
    const s = sondar(cs.fontFamily, cs.fontWeight, cs.fontStyle);
    const altaH = alturaDoH(cs.fontFamily, cs.fontWeight, cs.fontStyle);
    const tamanho = ((cap.n - 1) * lh) / altaH + fs;
    const base1 = (rr ? py(rr.top) : py(rl.top)) + s.subida * fs;
    itens.push({
      tipo: "texto", x: px(rl.left), y: base1 + (cap.n - 1) * lh, largura: rl.width / escala, texto: no.data[i],
      familia: cs.fontFamily, peso: Number(cs.fontWeight) || 400, italico: cs.fontStyle !== "normal", tamanho, cor: comAlfa(lerCor(cs.color), op),
    });
    void el;
  };

  const visitarTexto = (no: Text, el: HTMLElement, cs: CSSStyleDeclaration, op: number, decoracoes: Set<string>) => {
    const dados = no.data;
    let pular = 0;
    if (capitular) {
      const i = dados.search(/\S/);
      if (i >= 0) {
        desenharCapitular(no, i, el, cs, op);
        pular = i + 1;
      }
    }
    for (const m of dados.matchAll(/\S+/g)) {
      let ini = m.index ?? 0; const fim = ini + m[0].length;
      if (fim <= pular) continue;
      if (ini < pular) ini = pular;
      faixa.setStart(no, ini); faixa.setEnd(no, fim);
      const rs = Array.from(faixa.getClientRects()).filter((r) => r.width > 0.1);
      if (!rs.length) continue;
      if (rs.length === 1) { empurrarTexto(dados.slice(ini, fim), rs[0], el, cs, op, decoracoes); continue; }
      // A palavra se dividiu (quebra no meio ou capitular): letra por letra, juntando por caixa.
      let grupo = ""; let caixa: DOMRect | null = null;
      for (let i = ini; i < fim; i++) {
        faixa.setStart(no, i); faixa.setEnd(no, i + 1);
        const r = faixa.getClientRects()[0];
        if (!r) continue;
        if (caixa && Math.abs(r.top - caixa.top) < 1 && Math.abs(r.height - caixa.height) < 1 && r.left >= caixa.right - 1) {
          grupo += dados[i];
          caixa = new DOMRect(caixa.left, caixa.top, r.right - caixa.left, caixa.height);
        } else {
          if (caixa && grupo) empurrarTexto(grupo, caixa, el, cs, op, decoracoes);
          grupo = dados[i]; caixa = r;
        }
      }
      if (caixa && grupo) empurrarTexto(grupo, caixa, el, cs, op, decoracoes);
    }
  };

  // Marcador da lista (•, ◦, 1.), que o navegador desenha fora do texto.
  const marcador = (li: HTMLElement, cs: CSSStyleDeclaration, op: number) => {
    const lista = li.parentElement;
    if (!lista || lista.getAttribute("data-type") === "taskList") return;
    const tipo = cs.listStyleType;
    if (tipo === "none") return;
    let texto = "•";
    if (lista.tagName === "OL") {
      const irmaos = Array.from(lista.children).filter((c) => c.tagName === "LI");
      const inicio = Number(lista.getAttribute("start") ?? 1) || 1;
      const n = inicio + irmaos.indexOf(li);
      texto = tipo === "lower-alpha" || tipo === "lower-latin" ? `${String.fromCharCode(96 + ((n - 1) % 26) + 1)}.` : tipo === "lower-roman" ? `${romano(n)}.` : `${n}.`;
    } else if (tipo === "circle") texto = "◦";
    else if (tipo === "square") texto = "▪";
    // A primeira linha de texto do item dá a linha de base.
    const andar = document.createTreeWalker(li, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const primeiro = andar.nextNode() as Text | null;
    if (!primeiro) return;
    faixa.setStart(primeiro, 0); faixa.setEnd(primeiro, Math.min(1, primeiro.length));
    const r = faixa.getClientRects()[0];
    if (!r || !dentro(r)) return;
    const csT = getComputedStyle(primeiro.parentElement ?? li);
    const tamanho = parseFloat(csT.fontSize) || 16;
    const s = sondar(csT.fontFamily, "400", "normal");
    const caixaLi = li.getBoundingClientRect();
    const largura = medirLargura(texto, `${tamanho}px ${csT.fontFamily}`);
    const direita = px(caixaLi.left) - tamanho * 0.35;
    itens.push({ tipo: "texto", x: direita - largura, y: py(r.top) + s.subida * tamanho, largura, texto, familia: csT.fontFamily, peso: 400, italico: false, tamanho, cor: comAlfa(lerCor(csT.color), op) });
  };

  const visitar = (el: Element, op: number, decoracoes: Set<string>) => {
    if (el instanceof SVGElement) { visitarSvg(el, op); return; }
    if (!(el instanceof HTMLElement) || el.matches(IGNORAR)) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return;
    const o = op * (Number(cs.opacity) || 0);
    if (o <= 0.002) return;
    const visivel = cs.visibility !== "hidden";
    const decs = new Set(decoracoes);
    for (const d of (cs.textDecorationLine || "").split(/\s+/)) if (d === "underline" || d === "line-through") decs.add(d);
    if (visivel && el !== raiz) fundoEBordas(el, cs, o);
    if (/^(P|H[1-6]|LI|BLOCKQUOTE|DIV)$/.test(el.tagName)) {
      const pl = getComputedStyle(el, "::first-letter") as CSSStyleDeclaration & { initialLetter?: string; webkitInitialLetter?: string };
      const n = parseFloat(pl.initialLetter || pl.webkitInitialLetter || "");
      if (n >= 2) capitular = { n, bloco: el };
    }
    if (visivel && el.tagName === "LI") marcador(el, cs, o);
    if (visivel && el instanceof HTMLImageElement) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && dentro(r) && el.currentSrc) itens.push({ tipo: "imagem", src: el.currentSrc, matriz: compor(daTela, [r.width, 0, 0, r.height, r.left, r.top]), opacidade: o });
      return;
    }
    if (visivel && el instanceof HTMLInputElement && el.type === "checkbox") {
      const r = el.getBoundingClientRect();
      if (dentro(r)) itens.push({ tipo: "caixinha", x: px(r.left), y: py(r.top), lado: r.width / escala, marcada: el.checked, cor: comAlfa(lerCor(cs.color), o) });
      return;
    }
    for (const f of Array.from(el.childNodes)) {
      if (f.nodeType === Node.TEXT_NODE) { if (visivel) visitarTexto(f as Text, el, cs, o, decs); }
      else if (f.nodeType === Node.ELEMENT_NODE) visitar(f as Element, o, decs);
    }
    // Bloco sem texto: a capitular não passa para o próximo.
    if (capitular?.bloco === el) capitular = null;
  };

  visitar(raiz, 1, new Set());
  return paginas;
}

/** Uma página só (o caderno): a região é a própria página. */
export function medir(raiz: Element, regiao: Regiao, escala: number, larguraPagina: number, alturaPagina: number): PaginaMedida {
  return medirPaginas(raiz, [regiao], escala, larguraPagina, alturaPagina)[0];
}

const alturasH = new Map<string, number>();
/** Altura da letra H (altura das maiúsculas), em fração do tamanho da fonte. */
function alturaDoH(familia: string, peso: string, estilo: string): number {
  const k = `${familia}|${peso}|${estilo}`;
  const ja = alturasH.get(k);
  if (ja) return ja;
  telaMedida ??= document.createElement("canvas").getContext("2d");
  let v = 0.7;
  if (telaMedida) {
    telaMedida.font = `${estilo} ${peso} 100px ${familia}`;
    const m = telaMedida.measureText("H");
    if (m.actualBoundingBoxAscent > 0) v = m.actualBoundingBoxAscent / 100;
  }
  alturasH.set(k, v);
  return v;
}

let telaMedida: CanvasRenderingContext2D | null = null;
function medirLargura(texto: string, fonte: string): number {
  telaMedida ??= document.createElement("canvas").getContext("2d");
  if (!telaMedida) return texto.length * 8;
  telaMedida.font = fonte;
  return telaMedida.measureText(texto).width;
}

function romano(n: number): string {
  const t: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let s = ""; let v = n;
  for (const [k, l] of t) while (v >= k) { s += l; v -= k; }
  return s;
}

/** O caminho SVG ("d") de um elemento simples (path, linha, círculo, retângulo...). */
export function caminhoDeElemento(el: Element): string | null {
  const n = el.tagName.toLowerCase();
  const a = (k: string) => Number(el.getAttribute(k) ?? 0);
  if (n === "path") return el.getAttribute("d");
  if (n === "line") return `M${a("x1")} ${a("y1")}L${a("x2")} ${a("y2")}`;
  if (n === "rect") return caminhoRetangulo(a("x"), a("y"), a("width"), a("height"), a("rx"));
  if (n === "circle" || n === "ellipse") {
    const cx = a("cx"), cy = a("cy"), rx = n === "circle" ? a("r") : a("rx"), ry = n === "circle" ? a("r") : a("ry");
    if (!rx || !ry) return null;
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  }
  if (n === "polyline" || n === "polygon") {
    const pts = (el.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number);
    if (pts.length < 4) return null;
    let d = `M${pts[0]} ${pts[1]}`;
    for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
    return n === "polygon" ? `${d}Z` : d;
  }
  return null;
}

/**
 * Recorta a página medida: fica só o retângulo `caixa` (em unidades da página), que
 * vira a página inteira. Usado no quadro infinito, para exportar só a área com conteúdo.
 */
export function recortarPagina(pag: PaginaMedida, caixa: { x: number; y: number; w: number; h: number }): PaginaMedida {
  const dx = -caixa.x, dy = -caixa.y;
  const T: Matriz = [1, 0, 0, 1, dx, dy];
  const itens = pag.itens.map((it): ItemDesenho => {
    switch (it.tipo) {
      case "linha": return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy };
      case "caminho": return { ...it, matriz: compor(T, it.matriz) };
      case "imagem": return { ...it, matriz: compor(T, it.matriz) };
      default: return { ...it, x: it.x + dx, y: it.y + dy };
    }
  });
  return { largura: caixa.w, altura: caixa.h, itens };
}
