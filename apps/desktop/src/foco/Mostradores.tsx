import { useId } from "react";
import type { EstiloFoco } from "../preferencias";

// Quatro jeitos de ver o mesmo tempo. Todos são desenhos parados que só mudam
// quando o segundo vira: nada pisca, nada gira sozinho, nada faz barulho.

interface PropsMostrador {
  /** Quanto do tempo ainda falta, de 0 a 1. */
  fracao: number;
  /** O que o leitor de tela diz (ex.: "12:30 restantes"). */
  rotulo: string;
  /** Correndo (e não pausado): só a ampulheta usa, para mostrar o fio de areia. */
  correndo?: boolean;
  /** Baixo estímulo: tira até o fio de areia parado. */
  baixoEstimulo?: boolean;
}

const prender = (f: number) => (Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 1);

/** Disco que diminui conforme o tempo passa (como um timer de cozinha visto de cima). */
export function Relogio({ fracao, rotulo }: PropsMostrador) {
  const f = prender(fracao);
  const angulo = f * 2 * Math.PI;
  const x = 50 + 45 * Math.sin(angulo);
  const y = 50 - 45 * Math.cos(angulo);
  const caminho =
    f >= 0.9999 ? "M50 5 A45 45 0 1 1 49.99 5 Z" : f <= 0 ? "" : `M50 50 L50 5 A45 45 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
  return (
    <svg className="relogio" viewBox="0 0 100 100" role="img" aria-label={rotulo}>
      <circle cx="50" cy="50" r="47" className="relogio-fundo" />
      {caminho && <path d={caminho} className="relogio-tempo" />}
      <circle cx="50" cy="50" r="47" className="relogio-borda" />
    </svg>
  );
}

/** Ângulo do ponteiro em graus, a partir do 12, no sentido do relógio. O mostrador inteiro é o tempo todo. */
export const anguloPonteiro = (fracao: number) => prender(fracao) * 360;

/** Relógio de ponteiro: o ponteiro volta até o 12 conforme o tempo acaba; um arco fino mostra o que falta. */
export function RelogioPonteiro({ fracao, rotulo }: PropsMostrador) {
  const f = prender(fracao);
  const rad = (anguloPonteiro(f) * Math.PI) / 180;
  const px = 50 + 34 * Math.sin(rad);
  const py = 50 - 34 * Math.cos(rad);
  const ax = 50 + 40 * Math.sin(rad);
  const ay = 50 - 40 * Math.cos(rad);
  const arco =
    f >= 0.9999 ? "M50 10 A40 40 0 1 1 49.99 10" : f <= 0 ? "" : `M50 10 A40 40 0 ${f > 0.5 ? 1 : 0} 1 ${ax} ${ay}`;
  return (
    <svg className="relogio foco-analogico" viewBox="0 0 100 100" role="img" aria-label={rotulo}>
      <circle cx="50" cy="50" r="47" className="relogio-fundo" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const dentro = i % 3 === 0 ? 37 : 40;
        return (
          <line
            key={i}
            x1={50 + dentro * Math.sin(a)}
            y1={50 - dentro * Math.cos(a)}
            x2={50 + 43 * Math.sin(a)}
            y2={50 - 43 * Math.cos(a)}
            className="foco-analogico-marca"
          />
        );
      })}
      {arco && <path d={arco} className="foco-analogico-arco" />}
      <line x1="50" y1="50" x2={px} y2={py} className="foco-analogico-ponteiro" />
      <circle cx="50" cy="50" r="3.5" className="foco-analogico-centro" />
      <circle cx="50" cy="50" r="47" className="relogio-borda" />
    </svg>
  );
}

/**
 * Areia da ampulheta. Os dois bulbos são triângulos com a ponta no gargalo (50, 60),
 * altura 48 e meia largura 36. Num triângulo, a área perto da ponta cresce com o
 * quadrado da altura; por isso a altura da areia usa a raiz da fração.
 */
export function areiaAmpulheta(fracao: number): { cima: string; baixo: string } {
  const s = Math.sqrt(prender(fracao));
  const h = 48 * s;
  const l = 36 * s;
  const cima = s > 0 ? `${50 - l},${60 - h} ${50 + l},${60 - h} 50,60` : "";
  const baixo = s < 1 ? `${50 - l},${60 + h} ${50 + l},${60 + h} 86,108 14,108` : "";
  return { cima, baixo };
}

/** Ampulheta: a areia de cima desce para baixo, um passo a cada segundo. */
export function Ampulheta({ fracao, rotulo, correndo, baixoEstimulo }: PropsMostrador) {
  const { cima, baixo } = areiaAmpulheta(fracao);
  const recorte = useId();
  return (
    <svg className="relogio foco-ampulheta" viewBox="0 0 100 120" role="img" aria-label={rotulo}>
      <defs>
        <clipPath id={recorte}>
          <path d="M14 12 H86 L52.5 60 L86 108 H14 L47.5 60 Z" />
        </clipPath>
      </defs>
      <path d="M14 12 H86 L52.5 60 L86 108 H14 L47.5 60 Z" className="relogio-fundo" />
      <g clipPath={`url(#${recorte})`}>
        {cima && <polygon points={cima} className="relogio-tempo" />}
        {baixo && <polygon points={baixo} className="foco-ampulheta-baixo" />}
        {correndo && !baixoEstimulo && cima && <line x1="50" y1="60" x2="50" y2="106" className="foco-ampulheta-fio" />}
      </g>
      <path d="M14 12 H86 L52.5 60 L86 108 H14 L47.5 60 Z" className="foco-ampulheta-vidro" />
      <rect x="8" y="5" width="84" height="7" rx="2" className="foco-ampulheta-moldura" />
      <rect x="8" y="108" width="84" height="7" rx="2" className="foco-ampulheta-moldura" />
    </svg>
  );
}

/** Barra fina que encurta da direita para a esquerda. */
export function Barra({ fracao, rotulo }: PropsMostrador) {
  const f = prender(fracao);
  return (
    <div className="foco-barra" role="img" aria-label={rotulo}>
      {f > 0 && <div className="foco-barra-tempo" style={{ width: `${f * 100}%` }} />}
    </div>
  );
}

export function Mostrador({ estilo, ...props }: PropsMostrador & { estilo: EstiloFoco }) {
  switch (estilo) {
    case "analogico":
      return <RelogioPonteiro {...props} />;
    case "ampulheta":
      return <Ampulheta {...props} />;
    case "barra":
      return <Barra {...props} />;
    default:
      return <Relogio {...props} />;
  }
}

/** Desenho pequeno de cada estilo, para os botões de escolha. Usa a cor do texto do botão. */
export function Miniatura({ estilo }: { estilo: EstiloFoco }) {
  const comum = { width: "1.4em", height: "1.4em", viewBox: "0 0 24 24", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (estilo) {
    case "analogico":
      return (
        <svg {...comum}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 12 L12 6.5 M12 12 L16 14" />
        </svg>
      );
    case "ampulheta":
      return (
        <svg {...comum}>
          <path d="M6 3 H18 M6 21 H18 M7 3 L12 12 L7 21 M17 3 L12 12 L17 21" />
          <path d="M9.5 18 H14.5" />
        </svg>
      );
    case "barra":
      return (
        <svg {...comum}>
          <rect x="3" y="9" width="18" height="6" rx="3" />
          <path d="M6 12 H12" strokeWidth={3} />
        </svg>
      );
    default:
      return (
        <svg {...comum}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 12 V3 A9 9 0 0 1 20.5 15 Z" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
