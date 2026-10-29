import { Group, Input, Label, NumberField } from "react-aria-components";
import { LIMITE_MAX, LIMITE_MIN } from "../preferencias";
import { textos } from "../textos/pt-BR";

/** Campo numérico do limite de projetos ativos (1 a 50). Muda ao sair do campo ou apertar Enter. */
export function SeletorLimite({ valor, aoMudar, rotulo }: { valor: number; aoMudar: (n: number) => void; rotulo?: string }) {
  return (
    <NumberField
      className="campo"
      value={valor}
      minValue={LIMITE_MIN}
      maxValue={LIMITE_MAX}
      step={1}
      onChange={(n) => {
        // Campo vazio ou inválido volta sozinho ao valor guardado ao sair dele.
        if (Number.isFinite(n) && n !== valor) aoMudar(Math.round(n));
      }}
    >
      <Label className="campo-rotulo">{rotulo ?? textos.limite.campo}</Label>
      <Group>
        <Input className="entrada-texto" inputMode="numeric" style={{ maxWidth: "6rem" }} />
      </Group>
    </NumberField>
  );
}
