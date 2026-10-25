import { ICONES_PADRAO, type Icones } from "@orbita/temas";
import type { Icon as IconePhosphor } from "@phosphor-icons/react";
import type { Icon as IconeTabler } from "@tabler/icons-react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { createContext, forwardRef, useContext, useSyncExternalStore } from "react";

/** O mesmo ícone nas três famílias: Lucide, Phosphor e Tabler. */
export type Familias = readonly [LucideIcon, IconePhosphor, IconeTabler];

// Estilo dos ícones do tema em uso. Fica fora do React para todo ícone ler direto,
// sem passar por cada tela; muda quando a aparência é aplicada.
let estilo: Icones = ICONES_PADRAO;
const ouvintes = new Set<() => void>();

export function definirEstiloIcones(novo: Icones | undefined) {
  const proximo = novo ?? ICONES_PADRAO;
  if (JSON.stringify(proximo) === JSON.stringify(estilo)) return;
  estilo = proximo;
  garantirFiltros();
  ouvintes.forEach((f) => f());
}

/** Para a prévia do editor de tema mostrar os ícones do tema que está sendo editado. */
export const EstiloIconesLocal = createContext<Icones | null>(null);

function useEstiloIcones(): Icones {
  const local = useContext(EstiloIconesLocal);
  const global = useSyncExternalStore(
    (f) => (ouvintes.add(f), () => void ouvintes.delete(f)),
    () => estilo,
  );
  return local ?? global;
}

/** Peso da Phosphor a partir do traço e do preenchimento escolhidos. */
function pesoPhosphor(i: Icones): "light" | "regular" | "bold" | "fill" | "duotone" {
  if (i.preenchimento === "cheio") return "fill";
  if (i.preenchimento === "dois-tons") return "duotone";
  return i.traco < 1.8 ? "light" : i.traco > 2.2 ? "bold" : "regular";
}

/**
 * Cria o componente de um ícone. Aceita as mesmas propriedades de um ícone Lucide
 * (size, strokeWidth, className, aria-hidden...), para nada mudar em quem usa.
 */
export function criarIcone(nome: string, [Lucide, Phosphor, Tabler]: Familias): LucideIcon {
  const Componente = forwardRef<SVGSVGElement, LucideProps>(function Icone({ size = 24, strokeWidth, className, ...resto }, ref) {
    const i = useEstiloIcones();
    const classe = className ? `icone ${className}` : "icone";
    const desenho = i.desenhos?.[nome];
    if (desenho) {
      // Desenho próprio (feito pela IA), já limpo ao ler o tema.
      return (
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth ?? i.traco}
          strokeLinecap={i.pontas === "retas" ? "square" : "round"}
          strokeLinejoin={i.pontas === "retas" ? "miter" : "round"}
          className={`${classe} icone-desenhado`}
          {...resto}
          dangerouslySetInnerHTML={{ __html: desenho }}
        />
      );
    }
    if (i.familia === "phosphor") return <Phosphor ref={ref} size={size} weight={pesoPhosphor(i)} className={classe} {...(resto as object)} />;
    if (i.familia === "tabler") return <Tabler size={size} stroke={Number(strokeWidth ?? i.traco)} className={classe} {...(resto as object)} />;
    return <Lucide ref={ref} size={size} strokeWidth={strokeWidth} className={classe} {...resto} />;
  });
  Componente.displayName = nome;
  return Componente as unknown as LucideIcon;
}

/** Filtros SVG dos efeitos ("rabiscado"), postos uma vez na página. */
function garantirFiltros() {
  if (typeof document === "undefined" || document.getElementById("orbita-filtros-icones")) return;
  const div = document.createElement("div");
  div.innerHTML = `<svg id="orbita-filtros-icones" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <filter id="orbita-rabiscado" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="ruido"/>
      <feDisplacementMap in="SourceGraphic" in2="ruido" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </svg>`;
  document.body.appendChild(div.firstElementChild!);
}

export type { LucideIcon, LucideProps };
