import { useEffect, useState } from "react";
import { api } from "../api";
import { Aviso } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { usePreferencias } from "../estado";
import { BLOQUEIO_LONGO, BLOQUEIOS } from "../preferencias";
import { textos } from "../textos/pt-BR";

const t = textos.janela;

/** Cartão em Ajustes: bandeja do sistema e bloqueio automático. */
export function AjustesJanela() {
  const { prefs, mudar } = usePreferencias();
  const [bandeja, setBandeja] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.bandejaLigada().then(setBandeja, () => setBandeja(null));
  }, []);

  return (
    <section className="cartao">
      <h2>{t.titulo}</h2>
      {bandeja !== null && (
        <div className="campo">
          <Interruptor
            rotulo={t.bandeja}
            ligado={bandeja}
            aoMudar={async (ligar) => {
              setErro(null);
              try {
                await api.definirBandeja(ligar);
                setBandeja(ligar);
              } catch (e) {
                setErro(e instanceof Error ? e.message : String(e));
              }
            }}
          />
          <p className="campo-ajuda">{t.bandejaAjuda}</p>
          {erro && <p className="aviso aviso-erro" role="alert">{erro}</p>}
        </div>
      )}
      <Segmentado
        rotulo={t.bloqueio}
        valor={String(prefs.bloqueioAuto)}
        opcoes={BLOQUEIOS.map((m) => ({ valor: String(m), nome: m === 0 ? t.nunca : t.minutos(m) }))}
        aoMudar={(v) => mudar({ bloqueioAuto: Number(v) })}
      />
      {prefs.bloqueioAuto >= BLOQUEIO_LONGO && <Aviso tipo="info">{t.bloqueioLongo}</Aviso>}
      <p className="campo-ajuda">{t.bloqueioAjuda}</p>
    </section>
  );
}
