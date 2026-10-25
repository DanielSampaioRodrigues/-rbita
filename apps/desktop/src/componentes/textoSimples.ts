/** Tira a marcação do Markdown para prévias curtas (mural, listas). */
export function textoSimples(md: string): string {
  return md
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+/gm, "")
    .replace(/^[ \t]*([-*+]|\d+[.)])[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|==|\+\+|~~)(.+?)\1/g, "$2")
    .replace(/(^|[^*\w])[*_](\S(?:.*?\S)?)[*_](?=[^*\w]|$)/g, "$1$2")
    .replace(/<\/?u>/g, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, "$1")
    .trim();
}
