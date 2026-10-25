import { Label, Radio, RadioGroup } from "react-aria-components";

interface Props<T extends string> {
  rotulo: string;
  valor: T;
  /** `fonte` mostra a opção escrita nessa fonte (usado na escolha de fonte). */
  opcoes: { valor: T; nome: string; fonte?: string }[];
  aoMudar: (valor: T) => void;
  /** Rótulo só para leitores de tela (quando o contexto já diz o que é). */
  rotuloOculto?: boolean;
}

/** Grupo de opções lado a lado. Setas do teclado trocam a opção. */
export function Segmentado<T extends string>({ rotulo, valor, opcoes, aoMudar, rotuloOculto }: Props<T>) {
  return (
    <RadioGroup className="campo" value={valor} onChange={(v) => aoMudar(v as T)} orientation="horizontal">
      <Label className={rotuloOculto ? "visualmente-oculto" : "campo-rotulo"}>{rotulo}</Label>
      <div className="segmentado">
        {opcoes.map((o) => (
          <Radio key={o.valor} value={o.valor} className="segmentado-opcao" style={o.fonte ? { fontFamily: o.fonte } : undefined}>
            {o.nome}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
