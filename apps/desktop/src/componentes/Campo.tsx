import { Eye, EyeOff } from "../icones";
import { useRef, useState, type ReactNode } from "react";
import { Button, Input, Label, Text, TextArea, TextField } from "react-aria-components";
import { useDitar } from "../ditado/Ditar";
import { useReescrever } from "../ia/Reescrever";
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
  /** Sem microfone nem IA (campos como endereços, nomes de modelo, buscas). */
  semDitado?: boolean;
}

export function Campo({ rotulo, valor, aoMudar, descricao, secreto, numerico, autoFocus, maximo, autoComplete, multilinha, semDitado }: Props) {
  const [visivel, setVisivel] = useState(false);
  // Senhas e números nunca recebem ditado.
  const comAjuda = !secreto && !numerico && !semDitado;
  const ditar = useDitar(valor, aoMudar, comAjuda);
  const caixa = useRef<HTMLDivElement>(null);
  // Depois de reescrever, o foco volta ao campo (a janela some e o botão do menu também pode sumir).
  const focar = () => setTimeout(() => caixa.current?.querySelector<HTMLElement>("input, textarea")?.focus(), 0);
  const reescrever = useReescrever(valor, aoMudar, comAjuda, focar);
  const botoes = ditar.botao || reescrever.botao ? <>{reescrever.botao}{ditar.botao}</> : null;
  if (multilinha) {
    return (
      <TextField ref={caixa} className="campo" value={valor} onChange={aoMudar} autoFocus={autoFocus} maxLength={maximo} onKeyDown={ditar.aoTeclar}>
        <Label className="campo-rotulo">{rotulo}</Label>
        {botoes ? (
          <div className="entrada">
            <TextArea className="entrada-texto multilinha" rows={3} />
            <div className="entrada-botoes-coluna">{botoes}</div>
          </div>
        ) : (
          <TextArea className="entrada-texto sozinha multilinha" rows={3} />
        )}
        {descricao && <Text slot="description" className="campo-ajuda">{descricao}</Text>}
        {ditar.situacao}
        {reescrever.janelas}
      </TextField>
    );
  }
  return (
    <TextField ref={caixa} className="campo" value={valor} onChange={aoMudar} autoFocus={autoFocus} maxLength={maximo} onKeyDown={ditar.aoTeclar}>
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
        {reescrever.botao}
        {ditar.botao}
      </div>
      {descricao && <Text slot="description" className="campo-ajuda">{descricao}</Text>}
      {ditar.situacao}
      {reescrever.janelas}
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
