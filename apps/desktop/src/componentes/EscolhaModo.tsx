import { Label, Radio, RadioGroup } from "react-aria-components";
import type { ModoAbrir } from "../api";
import { textos } from "../textos/pt-BR";

const t = textos.modos;
interface Props {
  valor: ModoAbrir;
  aoMudar: (m: ModoAbrir) => void;
  rotulo: string;
  /** Só mostra o Windows Hello quando o computador tem. */
  comHello: boolean;
}

export function EscolhaModo({ valor, aoMudar, rotulo, comHello }: Props) {
  const modos: ModoAbrir[] = comHello ? ["hello", "pin", "senha", "direto"] : ["pin", "senha", "direto"];
  const recomendado: ModoAbrir = comHello ? "hello" : "pin";
  return (
    <RadioGroup className="campo" value={valor} onChange={(v) => aoMudar(v as ModoAbrir)}>
      <Label className="visualmente-oculto">{rotulo}</Label>
      <div className="opcoes-cartao">
        {modos.map((m) => (
          <Radio key={m} value={m} className="opcao-cartao">
            <span className="opcao-cartao-marca" aria-hidden="true" />
            <span className="opcao-cartao-texto">
              <span className="opcao-cartao-nome">
                {t[m].nome}
                {m === recomendado && <span className="selo">{t.selo}</span>}
              </span>
              <span className="opcao-cartao-descricao">{t[m].descricao}</span>
            </span>
          </Radio>
        ))}
      </div>
      <p className="campo-ajuda">{t.aviso}</p>
    </RadioGroup>
  );
}
