// Camada do corretor da escrita à mão, por cima da página: um sublinhado ondulado
// (vermelho suave; ainda mais suave no baixo estímulo) embaixo de cada palavra que a IA
// achou escrita errada. Tocar na palavra abre as sugestões; escolher troca a palavra
// escrita à mão pela certa, em letra cursiva, no mesmo lugar e na mesma cor (dá para
// desfazer). "Ignorar" tira só a marca.
import { useState } from "react";
import { textos } from "../textos/pt-BR";

const t = textos.caderno.correcao;

export interface MarcaEscrita { n: number; ids: string[]; x: number; y: number; w: number; h: number; cor: string; lido: string; sugestoes: string[] }

/** Linha ondulada de `x` até `x + w`, na altura `y`. */
function ondulada(x: number, y: number, w: number): string {
  const passo = 3;
  let d = `M${x} ${y}`;
  for (let i = 0, sobe = true; i < w; i += passo, sobe = !sobe) d += ` L${Math.min(x + w, x + i + passo)} ${y + (sobe ? -1.6 : 1.6)}`;
  return d;
}

export function CamadaCorrecao({ marcas, escala, largura, altura, aoEscolher, aoIgnorar }: {
  marcas: MarcaEscrita[];
  escala: number;
  largura: number;
  altura: number;
  aoEscolher: (m: MarcaEscrita, palavra: string) => void;
  aoIgnorar: (m: MarcaEscrita) => void;
}) {
  const [aberta, setAberta] = useState<number | null>(null);
  const atual = marcas.find((m) => m.n === aberta);
  return (
    <div className="caderno-correcao">
      <svg viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" aria-hidden="true">
        {marcas.map((m) => <path key={m.n} d={ondulada(m.x, m.y + m.h + 3, m.w)} className="caderno-correcao-onda" vectorEffect="non-scaling-stroke" />)}
      </svg>
      {marcas.map((m) => (
        <button key={m.n} type="button" className="caderno-correcao-palavra" aria-label={t.palavra(m.lido)} aria-expanded={aberta === m.n}
          style={{ left: (m.x - 3) * escala, top: (m.y - 3) * escala, width: (m.w + 6) * escala, height: (m.h + 9) * escala }}
          onClick={() => setAberta(aberta === m.n ? null : m.n)} />
      ))}
      {atual && (
        <div className="caderno-correcao-menu" role="group" aria-label={t.sugestoes(atual.lido)}
          style={{ left: Math.max(4, atual.x * escala), top: (atual.y + atual.h + 10) * escala }}
          onKeyDown={(e) => { if (e.key === "Escape") setAberta(null); }}>
          <span className="caderno-correcao-lido">{t.lido(atual.lido)}</span>
          {atual.sugestoes.map((s) => (
            <button key={s} type="button" className="botao pequeno principal" autoFocus={s === atual.sugestoes[0]} onClick={() => { aoEscolher(atual, s); setAberta(null); }}>{s}</button>
          ))}
          <button type="button" className="botao pequeno" onClick={() => { aoIgnorar(atual); setAberta(null); }}>{t.ignorar}</button>
        </div>
      )}
    </div>
  );
}
