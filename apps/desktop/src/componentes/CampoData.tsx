import { useEffect, useId, useRef, useState } from "react";

/** Anos aceitos numa data. Fora disso, o ano ainda está sendo digitado (ou é engano). */
export const ANO_MIN = 1900;
export const ANO_MAX = 2200;

/**
 * Uma data "AAAA-MM-DD" que já pode ser usada: vazia (apagar) ou com o ano completo e plausível.
 * Enquanto a pessoa digita o ano, o navegador entrega valores como "0002-05-10"; esses não valem.
 */
export function dataPronta(v: string): boolean {
  if (v === "") return true;
  const m = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const ano = Number(m[1]);
  return ano >= ANO_MIN && ano <= ANO_MAX;
}

/**
 * Campo de data ou hora com o seletor do próprio sistema (acessível e conhecido).
 *
 * Guarda o que está sendo digitado num rascunho e só avisa quando a data está pronta.
 * Antes, cada tecla gravava uma data pela metade (ano 0002, 0020…), a tela recarregava
 * e o campo pulava. O ano também ficava aceitando 6 dígitos (275760).
 */
export function CampoData({
  rotulo,
  tipo,
  valor,
  aoMudar,
  obrigatorio,
}: {
  rotulo: string;
  tipo: "date" | "time";
  valor: string;
  aoMudar: (v: string) => void;
  obrigatorio?: boolean;
}) {
  const id = useId();
  const [rascunho, setRascunho] = useState(valor);
  const editando = useRef(false);
  const ultimoEnviado = useRef(valor);

  // Mudou por fora (outra tela, sincronização): acompanha, menos enquanto a pessoa digita.
  useEffect(() => {
    if (!editando.current) setRascunho(valor);
    ultimoEnviado.current = valor;
  }, [valor]);

  const mudar = (v: string) => {
    setRascunho(v);
    if (tipo === "time") {
      aoMudar(v);
      return;
    }
    if (dataPronta(v) && v !== ultimoEnviado.current) {
      ultimoEnviado.current = v;
      aoMudar(v);
    }
  };

  return (
    <div className="campo">
      <label className="campo-rotulo" htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        className="entrada-texto sozinha"
        type={tipo}
        value={rascunho}
        required={obrigatorio}
        min={tipo === "date" ? `${ANO_MIN}-01-01` : undefined}
        max={tipo === "date" ? `${ANO_MAX}-12-31` : undefined}
        onFocus={() => (editando.current = true)}
        onBlur={() => {
          editando.current = false;
          // Saiu com a data pela metade: volta para a última que valia.
          if (tipo === "date" && !dataPronta(rascunho)) setRascunho(valor);
        }}
        onChange={(e) => mudar(e.target.value)}
      />
    </div>
  );
}
