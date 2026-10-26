import { Check } from "../icones";
import { useState } from "react";
import { Button, Form, Label, Radio, RadioGroup, ToggleButton } from "react-aria-components";
import { api, CORES_ETIQUETA, type CorEtiqueta, type Etiqueta } from "../api";
import { Campo } from "../componentes/Campo";
import { textos } from "../textos/pt-BR";

const t = textos.ideias;

/** Bolinha de cor + nome. A cor nunca aparece sozinha (quem não distingue cores lê o nome). */
export function ChipEtiqueta({ etiqueta }: { etiqueta: Etiqueta }) {
  return (
    <span className="etiqueta-chip">
      <span className={`etiqueta-cor cor-${etiqueta.cor}`} aria-hidden="true" />
      {etiqueta.nome}
    </span>
  );
}

/** Escolha de cor com as 8 cores, pelo nome e pela bolinha. Setas trocam. */
export function EscolherCor({ valor, aoMudar, rotulo }: { valor: CorEtiqueta; aoMudar: (c: CorEtiqueta) => void; rotulo?: string }) {
  return (
    <RadioGroup className="campo" value={valor} onChange={(v) => aoMudar(v as CorEtiqueta)} orientation="horizontal">
      <Label className="campo-rotulo">{rotulo ?? t.corEtiqueta}</Label>
      <div className="cores-etiqueta">
        {CORES_ETIQUETA.map((c) => (
          <Radio key={c} value={c} className="cor-opcao" aria-label={t.cores[c]}>
            <span className={`etiqueta-cor grande cor-${c}`} aria-hidden="true" />
            <span className="pequeno">{t.cores[c]}</span>
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}

/** Marcar e desmarcar etiquetas de uma ideia, e criar uma nova na hora. */
export function EscolherEtiquetas({
  todas,
  marcadas,
  aoMudar,
  aoCriar,
}: {
  todas: Etiqueta[];
  marcadas: string[];
  aoMudar: (ids: string[]) => void;
  aoCriar: (e: Etiqueta) => void;
}) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<CorEtiqueta>("musgo");
  const [erro, setErro] = useState<string | null>(null);

  const criar = async () => {
    if (!nome.trim()) return;
    try {
      const e = await api.criarEtiqueta(nome, cor);
      aoCriar(e);
      if (!marcadas.includes(e.id)) aoMudar([...marcadas, e.id]);
      setNome("");
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <fieldset className="grupo-campos">
      <legend className="campo-rotulo">{t.etiquetas}</legend>
      {todas.length === 0 ? (
        <p className="texto-suave pequeno">{t.semEtiquetas}</p>
      ) : (
        <div className="botoes">
          {todas.map((e) => {
            const ligada = marcadas.includes(e.id);
            return (
              <ToggleButton
                key={e.id}
                className="etiqueta-alternar"
                isSelected={ligada}
                onChange={(sim) => aoMudar(sim ? [...marcadas, e.id] : marcadas.filter((x) => x !== e.id))}
              >
                {ligada && <Check aria-hidden="true" size="0.9em" />}
                <ChipEtiqueta etiqueta={e} />
              </ToggleButton>
            );
          })}
        </div>
      )}
      <details className="nova-etiqueta">
        <summary>{t.novaEtiqueta}</summary>
        <Form className="formulario" onSubmit={(ev) => (ev.preventDefault(), criar())}>
          <Campo rotulo={t.nomeEtiqueta} valor={nome} aoMudar={setNome} maximo={40} semDitado />
          <EscolherCor valor={cor} aoMudar={setCor} />
          {erro && <p className="aviso aviso-erro" role="alert">{erro}</p>}
          <div className="botoes">
            <Button className="botao" type="submit" isDisabled={!nome.trim()}>{t.criarEtiqueta}</Button>
          </div>
        </Form>
      </details>
    </fieldset>
  );
}
