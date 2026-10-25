import { ChevronDown } from "../icones";
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, Text } from "react-aria-components";

interface Props<T extends string> {
  rotulo: string;
  valor: T | null;
  opcoes: { valor: T; nome: string }[];
  aoMudar: (valor: T) => void;
  descricao?: string;
  /** Texto quando nada foi escolhido. */
  vazio?: string;
}

/** Lista que abre para escolher uma opção. Para listas longas (modelos, provedores). */
export function Escolha<T extends string>({ rotulo, valor, opcoes, aoMudar, descricao, vazio }: Props<T>) {
  return (
    <Select className="campo" selectedKey={valor} onSelectionChange={(k) => k != null && aoMudar(k as T)} placeholder={vazio}>
      <Label className="campo-rotulo">{rotulo}</Label>
      <Button className="botao escolha-botao">
        <SelectValue className="escolha-valor" />
        <ChevronDown aria-hidden="true" size="1em" />
      </Button>
      {descricao && <Text slot="description" className="campo-ajuda">{descricao}</Text>}
      <Popover className="menu-popover escolha-popover" placement="bottom start">
        <ListBox className="menu">
          {opcoes.map((o) => (
            <ListBoxItem key={o.valor} id={o.valor} className="menu-item" textValue={o.nome}>
              {o.nome}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
