import type { CSSProperties } from "react";
import { Check } from "../icones";
import { textos } from "../textos/pt-BR";
import { corDaCapa, padraoDoTitulo, tamanhoDoTitulo, type PadraoCapa } from "./capa";

const t = textos.leitura;

/** Textura sutil da capa gerada: linhas brancas bem transparentes, desenhadas em SVG. */
function Textura({ padrao }: { padrao: PadraoCapa }) {
  return (
    <svg className="livro-capa-textura" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {padrao === "orbita" && (
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          {[34, 62, 92, 124, 158].map((r) => <circle key={r} cx="172" cy="262" r={r} />)}
          <circle cx="172" cy="262" r="10" fill="currentColor" stroke="none" />
          <circle cx="110" cy="208" r="4" fill="currentColor" stroke="none" />
        </g>
      )}
      {padrao === "linhas" && (
        <g stroke="currentColor" strokeWidth="1">
          {Array.from({ length: 22 }, (_, i) => <line key={i} x1={-120 + i * 16} y1="300" x2={60 + i * 16} y2="0" />)}
        </g>
      )}
      {padrao === "pontos" && (
        <g fill="currentColor">
          {Array.from({ length: 12 * 18 }, (_, i) => {
            const x = (i % 12) * 18 + 6;
            const y = Math.floor(i / 12) * 18 + 6;
            return <circle key={i} cx={x} cy={y} r={1.4} />;
          })}
        </g>
      )}
      {padrao === "ondas" && (
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          {Array.from({ length: 9 }, (_, i) => {
            const y = 150 + i * 18;
            return <path key={i} d={`M -10 ${y} q 27 -14 55 0 t 55 0 t 55 0 t 55 0`} />;
          })}
        </g>
      )}
    </svg>
  );
}

/**
 * Capa de um livro. Por enquanto, sempre gerada: cor e textura tiradas do título
 * (ou a cor escolhida na ficha), título grande e autor pequeno. Nunca um buraco cinza.
 */
export function CapaLivro({ titulo, autor, cor, status, progresso, compacta }: {
  titulo: string;
  autor: string;
  cor: string;
  /** Mostra o selo do status na capa (omitido = sem selo). */
  status?: string;
  /** 0 a 100: barra fina de progresso (só em "lendo"). */
  progresso?: number | null;
  /** Capa pequena (cartão "Continuar lendo", prévia da ficha): sem selo. */
  compacta?: boolean;
}) {
  const nome = titulo.trim() || t.capaSemTitulo;
  const c = corDaCapa(cor, nome);
  const estilo = { "--capa": `var(--capa-${c})` } as CSSProperties;
  const nomeStatus = status ? t.status[status as keyof typeof t.status] : undefined;
  return (
    <div className={`livro-capa${compacta ? " compacta" : ""}`} style={estilo} data-tamanho={tamanhoDoTitulo(nome)}>
      <Textura padrao={padraoDoTitulo(nome)} />
      <span className="livro-capa-lombada" aria-hidden="true" />
      <span className="livro-capa-texto" aria-hidden="true">
        <span className="livro-capa-titulo" lang="pt-BR">{nome}</span>
        <span className="livro-capa-filete" />
        {autor.trim() && <span className="livro-capa-autor">{autor.trim()}</span>}
      </span>
      {nomeStatus && !compacta && (
        <span className={`livro-capa-selo selo-${status}`} aria-hidden="true">
          {status === "lido" && <Check size="0.95em" aria-hidden="true" />}
          {nomeStatus}
        </span>
      )}
      {status === "lendo" && progresso != null && (
        <span className="livro-capa-progresso" aria-hidden="true">
          <span style={{ width: `${progresso}%` }} />
        </span>
      )}
    </div>
  );
}
