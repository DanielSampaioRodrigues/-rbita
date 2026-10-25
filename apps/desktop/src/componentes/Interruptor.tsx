import { Switch } from "react-aria-components";

interface Props {
  rotulo: string;
  ligado: boolean;
  aoMudar: (ligado: boolean) => void;
  compacto?: boolean;
}

export function Interruptor({ rotulo, ligado, aoMudar, compacto }: Props) {
  return (
    <Switch isSelected={ligado} onChange={aoMudar} className={compacto ? "interruptor compacto" : "interruptor"}>
      <span className="interruptor-trilho" aria-hidden="true">
        <span className="interruptor-bolinha" />
      </span>
      <span>{rotulo}</span>
    </Switch>
  );
}
