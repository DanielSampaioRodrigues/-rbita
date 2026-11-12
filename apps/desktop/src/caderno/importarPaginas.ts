// Importar PDF e imagens como páginas do caderno, para anotar por cima (slides da aula,
// apostila, foto do quadro). Cada página vira uma página do caderno com a folha
// "própria": a imagem da página fica como fundo (a borracha não apaga, mover não tira
// do lugar) e o que a pessoa escreve fica por cima.

/** Limites do tamanho personalizado (iguais aos do caderno). */
const MIN = 300, MAX_LARG = 1360, MAX_ALT = 1900;
/** Largura de referência: A4 em pé (794 px) e deitado (1123 px). */
const EM_PE = 794, DEITADO = 1123;

/** O tamanho da página do caderno para uma página de largura × altura (qualquer unidade). */
export function tamanhoImportado(largura: number, altura: number): string {
  if (!(largura > 0) || !(altura > 0)) return "a4";
  const proporcao = altura / largura;
  let w = largura >= altura ? DEITADO : EM_PE;
  let h = w * proporcao;
  // Muito comprida (ex.: print de celular): reduz até caber na altura máxima.
  if (h > MAX_ALT) { h = MAX_ALT; w = h / proporcao; }
  if (w > MAX_LARG) { w = MAX_LARG; h = w * proporcao; }
  w = Math.max(MIN, Math.round(w));
  h = Math.max(MIN, Math.round(h));
  return `custom:${w}x${h}`;
}

/** `n` valores de ordem entre `antes` e `depois` (qualquer um pode faltar). Nunca 0 (0 = "no fim" no banco). */
export function ordensEntre(antes: number | undefined, depois: number | undefined, n: number): number[] {
  const saida: number[] = [];
  for (let i = 1; i <= n; i++) {
    let v: number;
    if (antes !== undefined && depois !== undefined) v = antes + ((depois - antes) * i) / (n + 1);
    else if (antes !== undefined) v = antes + i;
    else if (depois !== undefined) v = depois > 0 ? (depois * i) / (n + 1) : depois - (n + 1 - i);
    else v = i;
    if (v === 0) v = -1e-6;
    saida.push(v);
  }
  return saida;
}

/** Quantas páginas de um PDF entram de uma vez (o resto a pessoa importa depois). */
export const MAXIMO_PAGINAS = 300;

export const ehPdf = (f: { name: string; type: string }) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
export const ehImagem = (f: { name: string; type: string }) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/i.test(f.name);
/** Nome sem a extensão, para o título das páginas ("Aula 3 · p. 2"). */
export const nomeSemExtensao = (nome: string) => nome.replace(/\.[^.]+$/, "").trim().slice(0, 60) || "Arquivo";
