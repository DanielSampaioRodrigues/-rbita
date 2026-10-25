import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Input, Label, Text, TextField } from "react-aria-components";
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
}

export function Campo({ rotulo, valor, aoMudar, descricao, secreto, numerico, autoFocus, maximo, autoComplete }: Props) {
  const [visivel, setVisivel] = useState(false);
  return (
    <TextField className="campo" value={valor} onChange={aoMudar} autoFocus={autoFocus} maxLength={maximo}>
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
      </div>
      {descricao && <Text slot="description" className="campo-ajuda">{descricao}</Text>}
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
