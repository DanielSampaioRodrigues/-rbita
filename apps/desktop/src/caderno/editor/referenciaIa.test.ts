import { describe, expect, it } from "vitest";
import { referenciaDaResposta } from "./referenciaIa";

describe("referência pela IA", () => {
  it("lê o JSON mesmo dentro de HTML, com cerca e entidades", () => {
    const r = referenciaDaResposta(`json\n<p>{&quot;type&quot;: &quot;book&quot;, &quot;title&quot;: &quot;Pedagogia do oprimido&quot;, &quot;author&quot;: [{&quot;family&quot;: &quot;Freire&quot;, &quot;given&quot;: &quot;Paulo&quot;}], &quot;issued&quot;: {&quot;date-parts&quot;: [[1987]]}, &quot;publisher&quot;: &quot;Paz e Terra&quot;, &quot;publisher-place&quot;: &quot;Rio de Janeiro&quot;, &quot;edition&quot;: &quot;17&quot;}</p>`);
    expect(r).toMatchObject({ tipo: "book", titulo: "Pedagogia do oprimido", ano: "1987", editora: "Paz e Terra", local: "Rio de Janeiro", edicao: "17" });
    expect(r?.autores).toEqual([{ family: "Freire", given: "Paulo" }]);
  });
  it("artigo com revista, volume e páginas; o que falta fica vazio", () => {
    const r = referenciaDaResposta(`{"type":"article-journal","title":"Atenção e memória","author":[{"family":"Silva","given":"Ana"}],"container-title":"Psicologia em Estudo","volume":"20","issue":"3","page":"45-60","issued":{"date-parts":[[2015]]},"DOI":"[falta: DOI]"}`);
    expect(r).toMatchObject({ tipo: "article-journal", container: "Psicologia em Estudo", volume: "20", numero: "3", paginas: "45-60", ano: "2015" });
    expect(r?.doi).toBeUndefined();
  });
  it("sem JSON ou sem nada útil: nada", () => {
    expect(referenciaDaResposta("<p>Não entendi.</p>")).toBeNull();
    expect(referenciaDaResposta("{}")).toBeNull();
    expect(referenciaDaResposta("{quebrado")).toBeNull();
  });
});
