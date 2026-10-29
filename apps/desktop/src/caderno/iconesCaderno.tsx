// Ícones próprios do caderno que não existem na lista geral (cursor de seleção,
// grupos, camadas por nível e as formas). Traço simples em currentColor, no
// mesmo jeito dos ícones de linha do app.

type P = { size?: string | number; "aria-hidden"?: boolean | "true" | "false" };

function Base({ size = "1em", children, ...resto }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" focusable="false" {...resto}>
      {children}
    </svg>
  );
}

export const IconeCursor = (p: P) => <Base {...p}><path d="M5 3l14 7.5-6.2 1.8L10 18.5z" /><path d="M12.8 12.3l5 5" /></Base>;
export const IconeAgrupar = (p: P) => <Base {...p}><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" /><rect x="7" y="7" width="5" height="5" rx="1" /><rect x="12" y="12" width="5" height="5" rx="1" /></Base>;
export const IconeDesagrupar = (p: P) => <Base {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><path d="M14 4h6v6M4 14v6h6" strokeDasharray="2 2.5" /></Base>;
export const IconeNivelFrente = (p: P) => <Base {...p}><rect x="4" y="9" width="11" height="11" rx="1.5" strokeDasharray="2.5 2.5" /><rect x="9" y="4" width="11" height="11" rx="1.5" fill="currentColor" fillOpacity="0.25" /></Base>;
export const IconeNivelTras = (p: P) => <Base {...p}><rect x="9" y="4" width="11" height="11" rx="1.5" strokeDasharray="2.5 2.5" /><rect x="4" y="9" width="11" height="11" rx="1.5" fill="currentColor" fillOpacity="0.25" /></Base>;
export const IconeTudoFrente = (p: P) => <Base {...p}><path d="M12 20V8M7 12l5-5 5 5M5 3.5h14" /></Base>;
export const IconeTudoTras = (p: P) => <Base {...p}><path d="M12 4v12M7 12l5 5 5-5M5 20.5h14" /></Base>;
export const IconeEngrenagem = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Base>
);
export const IconeSeta = (p: P) => <Base {...p}><path d="M4 20L19 5M10 5h9v9" /></Base>;

/** Ícone de cada forma (o desenho da própria forma). */
export const ICONES_FORMA: Record<"reta" | "retangulo" | "elipse" | "triangulo" | "losango" | "estrela", (p: P) => React.ReactElement> = {
  retangulo: (p) => <Base {...p}><rect x="3.5" y="5.5" width="17" height="13" rx="0.5" /></Base>,
  elipse: (p) => <Base {...p}><ellipse cx="12" cy="12" rx="9" ry="7" /></Base>,
  triangulo: (p) => <Base {...p}><path d="M12 4l9 16H3z" /></Base>,
  reta: (p) => <Base {...p}><path d="M4 20L20 4" /></Base>,
  losango: (p) => <Base {...p}><path d="M12 3l9 9-9 9-9-9z" /></Base>,
  estrela: (p) => <Base {...p}><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /></Base>,
};
