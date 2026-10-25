import { useEffect, useState } from "react";
import { api } from "../api";
import { Aviso } from "../componentes/Campo";
import { Segmentado } from "../componentes/Segmentado";
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
        <Segmentado
          rotulo={t.rotulo}
          valor={String(limite)}
          opcoes={["1", "2", "3", "4", "5", "6"].map((n) => ({ valor: n, nome: n }))}
          aoMudar={(n) => mudar(Number(n))}
        />
      )}
      <p className="campo-ajuda">{t.explicacao}</p>
      <Aviso>{erro}</Aviso>
    </section>
  );
}
