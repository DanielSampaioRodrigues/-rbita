// Desenho de pasta com cara de 3D e a paleta das pastas, divididos entre o
// Caderno (estante) e Projetos (pastas de atalho). Mudar aqui muda os dois.
import { useId } from "react";

/** Cores das pastas: dez tons suaves. O nome da pasta fica embaixo do
 *  desenho, na cor de texto do tema, então o contraste não depende da cor. */
export const CORES_PASTA = {
  areia: "#e2c27d", pessego: "#f0b48c", rosa: "#eaa8bd", lavanda: "#b9a8e3", ceu: "#9cc0ea",
  mar: "#86c9c4", menta: "#a7d8b2", musgo: "#b5c47a", terra: "#cfa182", cinza: "#b9bec7",
} as const;
export type CorPasta = keyof typeof CORES_PASTA;
export const NOMES_COR_PASTA = Object.keys(CORES_PASTA) as CorPasta[];
export const corDaPasta = (c?: string) => CORES_PASTA[(c && c in CORES_PASTA ? c : "areia") as CorPasta];
/** Mistura um hex com preto (f < 0) ou branco (f > 0). */
function misturar(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const alvo = f < 0 ? 0 : 255, k = Math.abs(f);
  const c = (v: number) => Math.round(v + (alvo - v) * k).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** Desenho da pasta com cara de 3D: o fundo com a aba, folhas de papel
 *  aparecendo e a frente levemente inclinada, com gradiente e sombra suaves.
 *  No baixo estímulo, o CSS tira gradiente, brilho e sombra (fica chapada). */
export function IconePasta({ cor, quantidade }: { cor?: string; quantidade?: number }) {
  const base = corDaPasta(cor);
  const escura = misturar(base, -0.22);
  const clara = misturar(base, 0.28);
  const id = useId().replace(/:/g, "");
  const estilo = { "--pasta-cor": base, "--pasta-escura": escura } as React.CSSProperties;
  return (
    <svg className="pasta3d" viewBox="0 0 120 100" style={estilo} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={clara} />
          <stop offset="1" stopColor={base} />
        </linearGradient>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={base} />
          <stop offset="1" stopColor={escura} />
        </linearGradient>
      </defs>
      <ellipse className="pasta3d-sombra" cx="60" cy="93" rx="50" ry="5" />
      <path className="pasta3d-fundo" fill={`url(#${id}-t)`} d="M8 24 Q8 14 18 14 H42 Q48 14 51 19 L54 24 H102 Q112 24 112 34 V80 Q112 88 104 88 H16 Q8 88 8 80 Z" />
      <rect className="pasta3d-papel" x="18" y="22" width="80" height="52" rx="2" transform="rotate(-3 58 48)" />
      <rect className="pasta3d-papel claro" x="22" y="27" width="78" height="50" rx="2" transform="rotate(2 61 52)" />
      <path className="pasta3d-frente" fill={`url(#${id}-f)`} d="M5 44 Q5 38 11 38 H109 Q115 38 115 44 L109 84 Q108 91 100 91 H20 Q12 91 11 84 Z" />
      <path className="pasta3d-brilho" d="M12 40.5 H108" />
      {quantidade !== undefined && <text className="pasta3d-qtd" x="101" y="83" textAnchor="end" fill={corContraste(base)}>{quantidade}</text>}
    </svg>
  );
}

/** Cor de ícone que contrasta com um fundo hex (claro → escuro, escuro → claro). */
export function corContraste(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#1f2937";
  const n = parseInt(m[1], 16);
  const canal = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  return lum > 0.4 ? "#1f2937" : "#f5f3ee";
}
