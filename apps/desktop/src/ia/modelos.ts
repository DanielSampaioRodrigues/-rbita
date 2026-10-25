// Listas de modelos mais curtas: só a família mais nova de cada linha.
// Os nomes mudam com o tempo, por isso a regra olha o formato do nome, não uma lista fixa.

/** Modelos que não servem para conversar nem para desenhar (voz, busca, código, testes...). */
const FORA = /embed|tts|audio|realtime|transcri|whisper|moderation|search|davinci|babbage|computer-use|codex|deep-research|native|live|robotics|aqa|learnlm|guard|veo|sora|lyria|vision/i;

/** Data no fim do nome ("-2025-08-06", "-20250805", "-0613", "-09-2025"): é uma cópia congelada. */
const DATA = /-(\d{4}-\d{2}-\d{2}|\d{8}|\d{4}|\d{2}-\d{4})$/;

/** Família, versão e o resto do nome. "gemini-2.5-flash-lite" → gemini · [2,5] · flash-lite. */
function partes(nome: string): { familia: string; versao: number[]; linha: string } | null {
  const m = /^(.*?)(\d+(?:[.-]\d{1,2})*)(?=$|[^\d])(.*)$/.exec(nome);
  if (!m) return null;
  const versao = m[2].split(/[.-]/).map(Number);
  return { familia: m[1], versao, linha: `${m[1]}#${m[3]}` };
}

const compara = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
};

/**
 * Deixa só os modelos mais novos: tira cópias com data quando há a versão sem data,
 * prévias quando há a versão final, e versões antigas de cada linha (gpt-5.5-mini sai se há gpt-5.6-mini;
 * linhas inteiras de uma geração anterior saem se a família já tem uma mais nova).
 * `manter` sempre fica (o modelo em uso e o padrão do provedor).
 */
export function maisNovos(todos: string[], manter: (string | null | undefined)[] = [], imagem = false): string[] {
  let unicos = [...new Set(todos)];
  // DALL·E é a geração antiga de imagem da OpenAI: sai quando há gpt-image.
  if (imagem && unicos.some((m) => m.includes("gpt-image"))) unicos = unicos.filter((m) => !m.startsWith("dall-e"));
  const conjunto = new Set(unicos);
  let lista = imagem ? unicos.filter((m) => !/embed|tts|audio/i.test(m)) : unicos.filter((m) => !FORA.test(m) && !/image|imagen|dall-e/i.test(m));
  lista = lista.filter((m) => !(DATA.test(m) && conjunto.has(m.replace(DATA, ""))));
  lista = lista.filter((m) => !(/-(preview|exp)(-|$)/.test(m) && conjunto.has(m.replace(/-(preview|exp)(-.*)?$/, ""))));

  const info = new Map(lista.map((m) => [m, partes(m.replace(DATA, ""))]));
  const maiorDaLinha = new Map<string, number[]>();
  const maiorDaFamilia = new Map<string, number>();
  for (const [, p] of info) {
    if (!p) continue;
    const atual = maiorDaLinha.get(p.linha);
    if (!atual || compara(p.versao, atual) > 0) maiorDaLinha.set(p.linha, p.versao);
    maiorDaFamilia.set(p.familia, Math.max(maiorDaFamilia.get(p.familia) ?? 0, p.versao[0]));
  }
  lista = lista.filter((m) => {
    const p = info.get(m);
    if (!p) return true;
    return compara(p.versao, maiorDaLinha.get(p.linha)!) === 0 && p.versao[0] === maiorDaFamilia.get(p.familia);
  });

  for (const m of manter) if (m && !lista.includes(m)) lista.push(m);
  return lista.sort();
}
