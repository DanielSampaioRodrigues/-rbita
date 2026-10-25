import { useId } from "react";

/** Campo de data ou hora com o seletor do próprio sistema (acessível e conhecido). */
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
  return (
    <div className="campo">
      <label className="campo-rotulo" htmlFor={id}>{rotulo}</label>
      <input id={id} className="entrada-texto sozinha" type={tipo} value={valor} required={obrigatorio} onChange={(e) => aoMudar(e.target.value)} />
    </div>
  );
}
