// Seletor de cor do caderno (folha, linha e capa). Cada amostra mostra a cor de
// verdade, também no baixo estímulo (é a cor que vai para a página, então precisa
// ser vista). A cor livre é um seletor visível de verdade (no iPad, o seletor
// escondido dentro de um rótulo não abria) e também aceita o código (#rrggbb).
import { useEffect, useId, useState } from "react";
import { Check } from "../icones";
import { textos } from "../textos/pt-BR";

const t = textos.caderno.cor;

export interface OpcaoCor {
  /** Valor guardado ("" = padrão). */
  valor: string;
  nome: string;
  /** Cor mostrada na amostra. */
  hex: string;
}

/** Cores de folha mais usadas (papéis de verdade e alguns tons claros). */
export const CORES_PAPEL: OpcaoCor[] = [
  { valor: "", nome: "Branco (padrão)", hex: "#ffffff" },
  { valor: "#fbf5e6", nome: "Creme", hex: "#fbf5e6" },
  { valor: "#f3e7c9", nome: "Pólen", hex: "#f3e7c9" },
  { valor: "#ece6da", nome: "Areia", hex: "#ece6da" },
  { valor: "#eceef1", nome: "Cinza claro", hex: "#eceef1" },
  { valor: "#e6eef8", nome: "Azul claro", hex: "#e6eef8" },
  { valor: "#e6f2e3", nome: "Verde claro", hex: "#e6f2e3" },
  { valor: "#f7e7ee", nome: "Rosa claro", hex: "#f7e7ee" },
  { valor: "#efe8f8", nome: "Lilás claro", hex: "#efe8f8" },
  { valor: "#3a3d43", nome: "Grafite", hex: "#3a3d43" },
  { valor: "#232529", nome: "Escuro", hex: "#232529" },
];

/** Cores de linha: tons suaves e um claro para folhas escuras. */
export const CORES_LINHA: OpcaoCor[] = [
  { valor: "", nome: "Cinza (padrão)", hex: "#c9ccd4" },
  { valor: "#9aa0aa", nome: "Cinza médio", hex: "#9aa0aa" },
  { valor: "#5f6570", nome: "Cinza escuro", hex: "#5f6570" },
  { valor: "#9db8d8", nome: "Azul", hex: "#9db8d8" },
  { valor: "#9cc3a2", nome: "Verde", hex: "#9cc3a2" },
  { valor: "#e2a9bd", nome: "Rosa", hex: "#e2a9bd" },
  { valor: "#c3a98c", nome: "Marrom", hex: "#c3a98c" },
  { valor: "#b9a6e0", nome: "Lilás", hex: "#b9a6e0" },
  { valor: "#e9c46a", nome: "Amarelo", hex: "#e9c46a" },
  { valor: "#ffffff", nome: "Branca (para folha escura)", hex: "#ffffff" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Hex de um valor guardado: o próprio hex, o da opção, ou o padrão. */
export function hexDoValor(valor: string, opcoes: OpcaoCor[], antigas: Record<string, string> = {}): string {
  if (HEX.test(valor)) return valor.toLowerCase();
  return antigas[valor] ?? opcoes.find((o) => o.valor === valor)?.hex ?? opcoes[0].hex;
}

export function SeletorCor({ rotulo, valor, opcoes, aoMudar, antigas }: {
  rotulo: string;
  valor: string;
  opcoes: OpcaoCor[];
  aoMudar: (v: string) => void;
  /** Nomes da paleta antiga ("musgo", "mar"...) → hex, para mostrar o que já estava guardado. */
  antigas?: Record<string, string>;
}) {
  const id = useId();
  const atual = hexDoValor(valor, opcoes, antigas);
  const escolhida = opcoes.find((o) => o.valor === valor || (o.valor && o.valor.toLowerCase() === valor.toLowerCase()));
  const livre = !escolhida;
  const [codigo, setCodigo] = useState(atual);
  useEffect(() => setCodigo(atual), [atual]);
  const confirmarCodigo = () => {
    const c = codigo.trim().startsWith("#") ? codigo.trim() : `#${codigo.trim()}`;
    if (HEX.test(c)) aoMudar(c.toLowerCase());
    else setCodigo(atual);
  };
  return (
    <div className="campo seletor-cor">
      <span className="campo-rotulo" id={`${id}-r`}>{rotulo} <span className="texto-suave">{escolhida ? escolhida.nome : t.livre(atual)}</span></span>
      <div className="seletor-cor-amostras" role="radiogroup" aria-labelledby={`${id}-r`}>
        {opcoes.map((o) => {
          const sel = escolhida === o;
          return (
            <button key={o.valor || "padrao"} type="button" role="radio" aria-checked={sel} aria-label={o.nome} title={o.nome}
              className={sel ? "amostra-cor atual" : "amostra-cor"} style={{ background: o.hex }} onClick={() => aoMudar(o.valor)}>
              {sel && <Check aria-hidden="true" size="0.95em" className="amostra-cor-marca" />}
            </button>
          );
        })}
      </div>
      <div className="seletor-cor-livre">
        <label className={livre ? "amostra-cor-livre atual" : "amostra-cor-livre"}>
          <input type="color" className="seletor-cor-nativo" value={atual} onChange={(e) => aoMudar(e.target.value.toLowerCase())} aria-label={t.outra(rotulo)} />
          <span>{t.outraCurta}</span>
        </label>
        <input className="entrada-texto seletor-cor-codigo" value={codigo} maxLength={7} spellCheck={false} autoComplete="off" inputMode="text"
          aria-label={t.codigo(rotulo)} onChange={(e) => setCodigo(e.target.value)} onBlur={confirmarCodigo}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmarCodigo(); } }} />
      </div>
    </div>
  );
}
