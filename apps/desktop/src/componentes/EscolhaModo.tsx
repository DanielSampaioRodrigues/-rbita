import { Label, Radio, RadioGroup } from "react-aria-components";
import type { ModoAbrir } from "../api";
import { textos } from "../textos/pt-BR";

const t = textos.modos;
const MODOS: ModoAbrir[] = ["pin", "senha", "direto"];

export function EscolhaModo({ valor, aoMudar, rotulo }: { valor: ModoAbrir; aoMudar: (m: ModoAbrir) => void; rotulo: string }) {
  return (
    <RadioGroup className="campo" value={valor} onChange={(v) => aoMudar(v as ModoAbrir)}>
      <Label className="visualmente-oculto">{rotulo}</Label>
      <div className="opcoes-cartao">
        {MODOS.map((m) => (
          <Radio key={m} value={m} className="opcao-cartao">
            <span className="opcao-cartao-marca" aria-hidden="true" />
            <span className="opcao-cartao-texto">
              <span className="opcao-cartao-nome">
                {t[m].nome}
                {m === "pin" && <span className="selo">{t.pin.selo}</span>}
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
