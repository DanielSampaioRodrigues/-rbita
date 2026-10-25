// Limpeza de segurança de SVG importado: SVG pode carregar scripts e links
// escondidos. Só sobra desenho. Funciona onde houver DOM (app e testes com jsdom).
import DOMPurify from "dompurify";

export const TAMANHO_MAXIMO_SVG = 1024 * 1024;

const ANIMACOES = ["animate", "animateTransform", "animateMotion", "set"];

/** Links só para dentro do próprio arquivo (#id) ou imagens embutidas. */
const linkSeguro = (v: string) => /^#|^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v.trim());

/** Tira de CSS qualquer coisa que busque algo fora do arquivo. */
const cssSeguro = (css: string) =>
  css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)(?!#|data:image\/)[^)]*\1\s*\)/gi, "none")
    .replace(/expression\s*\(/gi, "");

export class SvgInvalido extends Error {}

/**
 * Devolve só o desenho: sem scripts, sem eventos (onclick...), sem objetos
 * externos (foreignObject, iframe) e sem links para fora do arquivo.
 */
export function limparSvg(texto: string): string {
  if (texto.length > TAMANHO_MAXIMO_SVG) throw new SvgInvalido("O arquivo SVG é grande demais (máximo de 1 MB).");
  const purificador = DOMPurify(globalThis.window);
  purificador.addHook("uponSanitizeAttribute", (_no, dado) => {
    const nome = dado.attrName.toLowerCase();
    if ((nome === "href" || nome === "xlink:href") && !linkSeguro(dado.attrValue)) dado.keepAttr = false;
    if (nome === "style") dado.attrValue = cssSeguro(dado.attrValue);
  });
  purificador.addHook("uponSanitizeElement", (no) => {
    if (no.nodeName.toLowerCase() === "style" && no.textContent) no.textContent = cssSeguro(no.textContent);
  });
  const limpo = purificador.sanitize(texto, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: [...ANIMACOES, "style", "use"],
    FORBID_TAGS: ["script", "foreignObject", "iframe", "object", "embed", "audio", "video", "a"],
  });
  const resultado = typeof limpo === "string" ? limpo.trim() : "";
  if (!/^<svg[\s>]/i.test(resultado)) throw new SvgInvalido("Este arquivo não parece um SVG.");
  return resultado;
}

/** Tira as animações (para baixo estímulo e para quem não pediu animação). */
export function congelarSvg(svg: string): string {
  return svg
    .replace(new RegExp(`<(${ANIMACOES.join("|")})\\b[^>]*/>`, "gi"), "")
    .replace(new RegExp(`<(${ANIMACOES.join("|")})\\b[^>]*>[\\s\\S]*?</\\1>`, "gi"), "")
    .replace(/<svg\b([^>]*)>/i, "<svg$1><style>*{animation:none!important;transition:none!important}</style>");
}

/** O SVG que usa a cor neutra (currentColor) muda junto com o tema. */
export function pintarSvg(svg: string, cor: string): string {
  return svg.replace(/currentColor/gi, cor);
}

/** Para usar como imagem de fundo no CSS. */
export function svgComoUrl(svg: string): string {
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
