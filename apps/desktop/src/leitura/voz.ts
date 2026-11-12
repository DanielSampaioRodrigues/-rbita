// Ler em voz alta no leitor: a voz do próprio aparelho (Windows, iPad, Android), sem
// mandar o texto para fora. O texto vai em frases curtas: assim dá para pausar e parar
// na hora, e o Chrome não corta a fala no meio (ele para falas muito longas).

/** Frases de até `maximo` caracteres (corta em vírgula ou espaço se precisar). */
export function dividirEmFrases(texto: string, maximo = 220): string[] {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (!limpo) return [];
  const frases = limpo.match(/[^.!?…;:]+[.!?…;:]*["”’)]*\s*/g) ?? [limpo];
  const saida: string[] = [];
  for (const f0 of frases) {
    let f = f0.trim();
    while (f.length > maximo) {
      let corte = f.lastIndexOf(", ", maximo);
      if (corte < maximo / 2) corte = f.lastIndexOf(" ", maximo);
      if (corte < maximo / 2) corte = maximo;
      saida.push(f.slice(0, corte + 1).trim());
      f = f.slice(corte + 1).trim();
    }
    if (f) saida.push(f);
  }
  return saida;
}

/** As vozes em português, as do Brasil primeiro. */
export function vozesEmPortugues<V extends { lang: string; name: string }>(vozes: V[]): V[] {
  const pt = vozes.filter((v) => v.lang.toLowerCase().startsWith("pt"));
  return [...pt.filter((v) => /br/i.test(v.lang)), ...pt.filter((v) => !/br/i.test(v.lang))];
}
