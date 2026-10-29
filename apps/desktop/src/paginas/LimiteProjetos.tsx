import { useEffect, useState } from "react";
import { api } from "../api";
import { Aviso } from "../componentes/Campo";
import { SeletorLimite } from "../projetos/SeletorLimite";
import { textos } from "../textos/pt-BR";

const t = textos.limite;

export function LimiteProjetos() {
  const [limite, setLimite] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.limiteProjetos().then(setLimite, (e) => setErro(String(e?.message ?? e)));
  }, []);

  const mudar = async (n: number) => {
    setErro(null);
    try {
      await api.definirLimiteProjetos(n);
      setLimite(n);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="cartao">
      <h2>{textos.secoes.projetos}</h2>
      {limite !== null && (
        <SeletorLimite rotulo={t.campo} valor={limite} aoMudar={mudar} />
      )}
      <p className="campo-ajuda">{t.explicacao}</p>
      <Aviso>{erro}</Aviso>
    </section>
  );
}
