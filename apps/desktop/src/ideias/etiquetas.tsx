import { Check } from "../icones";
import { useState } from "react";
import { Button, Form, Label, Radio, RadioGroup, Text, ToggleButton } from "react-aria-components";
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

const SEM_COR = "sem";

/** Cor própria de uma ideia: "Sem cor" e as 8 cores das etiquetas. Vale na hora (quem chama grava). */
export function EscolherCorIdeia({ valor, aoMudar }: { valor: CorEtiqueta | null; aoMudar: (c: CorEtiqueta | null) => void }) {
  return (
    <RadioGroup
      className="campo"
      value={valor ?? SEM_COR}
      onChange={(v) => aoMudar(v === SEM_COR ? null : (v as CorEtiqueta))}
      orientation="horizontal"
    >
      <Label className="campo-rotulo">{t.corIdeia}</Label>
      <div className="cores-etiqueta">
        <Radio value={SEM_COR} className="cor-opcao" aria-label={t.semCor}>
          <span className="etiqueta-cor grande cor-nenhuma" aria-hidden="true" />
          <span className="pequeno">{t.semCor}</span>
        </Radio>
        {CORES_ETIQUETA.map((c) => (
          <Radio key={c} value={c} className="cor-opcao" aria-label={t.cores[c]}>
            <span className={`etiqueta-cor grande cor-${c}`} aria-hidden="true" />
            <span className="pequeno">{t.cores[c]}</span>
          </Radio>
        ))}
      </div>
      <Text slot="description" className="campo-ajuda">{t.corIdeiaAjuda}</Text>
    </RadioGroup>
  );
}

/**
 * Criar uma etiqueta: nome, cor e botão, sempre à vista (nada escondido).
 * Se o nome já existe, usa a existente e avisa.
 */
export function NovaEtiqueta({
  todas,
  aoCriar,
  rotuloBotao,
}: {
  todas: Etiqueta[];
  aoCriar: (e: Etiqueta) => void | Promise<void>;
  rotuloBotao: string;
}) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<CorEtiqueta>("musgo");
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const criar = async () => {
    if (!nome.trim() || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const e = await api.criarEtiqueta(nome, cor);
      const jaExistia = todas.some((x) => x.id === e.id);
      await aoCriar(e);
      setNome("");
      setRecado(jaExistia ? t.etiquetaJaExiste(e.nome) : t.etiquetaCriada(e.nome));
    } catch (e) {
      setRecado(null);
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <fieldset className="grupo-campos nova-etiqueta">
      <legend className="campo-rotulo">{t.novaEtiqueta}</legend>
      <Form className="formulario" onSubmit={(ev) => (ev.preventDefault(), criar())}>
        <Campo rotulo={t.nomeEtiqueta} valor={nome} aoMudar={(n) => (setNome(n), setRecado(null))} maximo={40} semDitado />
        <EscolherCor valor={cor} aoMudar={setCor} />
        {erro && <p className="aviso aviso-erro" role="alert">{erro}</p>}
        <div className="botoes">
          <Button className="botao" type="submit" isDisabled={!nome.trim() || ocupado}>{rotuloBotao}</Button>
          <span className="texto-suave pequeno" role="status">{recado}</span>
        </div>
      </Form>
    </fieldset>
  );
}

/** Marcar e desmarcar etiquetas de um item, e criar uma nova na hora (já marcada). */
export function EscolherEtiquetas({
  todas,
  marcadas,
  aoMudar,
  aoCriar,
  ajuda,
}: {
  todas: Etiqueta[];
  marcadas: string[];
  aoMudar: (ids: string[]) => void;
  aoCriar: (e: Etiqueta) => void;
  /** Frase curta abaixo do título (ex.: "vale na hora"). */
  ajuda?: string;
}) {
  return (
    <fieldset className="grupo-campos">
      <legend className="campo-rotulo">{t.etiquetas}</legend>
      {ajuda && todas.length > 0 && <p className="texto-suave pequeno">{ajuda}</p>}
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
      <NovaEtiqueta
        todas={todas}
        rotuloBotao={t.criarEtiqueta}
        aoCriar={(e) => {
          aoCriar(e);
          if (!marcadas.includes(e.id)) aoMudar([...marcadas, e.id]);
        }}
      />
    </fieldset>
  );
}
