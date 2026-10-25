import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Input, Label, Text, TextArea, TextField } from "react-aria-components";
import { useDitar } from "../ditado/Ditar";
import { textos } from "../textos/pt-BR";

interface Props {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  descricao?: ReactNode;
  /** Esconde o que é digitado, com botão para mostrar. */
  secreto?: boolean;
  numerico?: boolean;
  autoFocus?: boolean;
  maximo?: number;
  autoComplete?: string;
  /** Várias linhas (Enter quebra a linha em vez de enviar). */
  multilinha?: boolean;
  /** Sem microfone (campos curtos como nomes de modelo ou endereços). */
  semDitado?: boolean;
}

export function Campo({ rotulo, valor, aoMudar, descricao, secreto, numerico, autoFocus, maximo, autoComplete, multilinha, semDitado }: Props) {
  const [visivel, setVisivel] = useState(false);
  // Senhas e números nunca recebem ditado.
  const ditar = useDitar(valor, aoMudar, !secreto && !numerico && !semDitado);
  if (multilinha) {
    return (
      <TextField className="campo" value={valor} onChange={aoMudar} autoFocus={autoFocus} maxLength={maximo} onKeyDown={ditar.aoTeclar}>
        <Label className="campo-rotulo">{rotulo}</Label>
        {ditar.botao ? (
          <div className="entrada">
            <TextArea className="entrada-texto multilinha" rows={3} />
            {ditar.botao}
          </div>
        ) : (
          <TextArea className="entrada-texto sozinha multilinha" rows={3} />
        )}
        {descricao && <Text slot="description" className="campo-ajuda">{descricao}</Text>}
        {ditar.situacao}
      </TextField>
    );
  }
  return (
    <TextField className="campo" value={valor} onChange={aoMudar} autoFocus={autoFocus} maxLength={maximo} onKeyDown={ditar.aoTeclar}>
      <Label className="campo-rotulo">{rotulo}</Label>
      <div className="entrada">
        <Input
          className="entrada-texto"
          type={secreto && !visivel ? "password" : "text"}
          inputMode={numerico ? "numeric" : undefined}
          autoComplete={autoComplete ?? (secreto ? "off" : undefined)}
          spellCheck={false}
        />
        {secreto && (
          <Button className="entrada-botao" onPress={() => setVisivel((v) => !v)} aria-label={visivel ? textos.comum.esconder : textos.comum.mostrar}>
            {visivel ? <EyeOff aria-hidden="true" size="1.1em" /> : <Eye aria-hidden="true" size="1.1em" />}
          </Button>
        )}
        {ditar.botao}
      </div>
      {descricao && <Text slot="description" className="campo-ajuda">{descricao}</Text>}
      {ditar.situacao}
    </TextField>
  );
}

/** Mensagem de erro ou aviso, lida por leitores de tela assim que aparece. */
export function Aviso({ children, tipo = "erro" }: { children: ReactNode; tipo?: "erro" | "info" | "ok" }) {
  if (!children) return null;
  return (
    <p className={`aviso aviso-${tipo}`} role={tipo === "erro" ? "alert" : "status"}>
      {children}
    </p>
  );
}
