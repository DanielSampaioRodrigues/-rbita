import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { usePreferencias } from "../estado";
import type { ModoAbrir } from "../api";
import { textos } from "../textos/pt-BR";
import { Backup } from "./Backup";
import { AjustesAtualizacao } from "../atualizacao/TelasAtualizacao";
import { AjustesNuvem } from "../nuvem/Nuvem";
import { LimiteProjetos } from "./LimiteProjetos";
import { ANTECEDENCIAS } from "../preferencias";
import { Seguranca } from "./Seguranca";
import { AjustesIa } from "../ia/AjustesIa";
import { AjustesJanela } from "../app/AjustesJanela";
import { AjustesDitado } from "../ditado/AjustesDitado";

const t = textos.ajustes;

interface Props {
  modo: ModoAbrir | null;
  temSenha: boolean;
  aoMudarSeguranca: () => void;
  aoRestaurar: () => void;
}

/** O funcionamento do Órbita. O visual fica em Aparência. */
export function Ajustes({ modo, temSenha, aoMudarSeguranca, aoRestaurar }: Props) {
  const { prefs, mudar } = usePreferencias();

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.descricao}</p>

      <div className="ajustes-grade">
          <section className="cartao">
            <h2>{textos.avisos.titulo}</h2>
            <p className="campo-ajuda">{textos.avisos.explicacao}</p>
            <Interruptor
              rotulo={textos.avisos.ligado}
              ligado={prefs.avisos.ligado}
              aoMudar={(ligado) => mudar({ avisos: { ...prefs.avisos, ligado } })}
            />
            {prefs.avisos.ligado && (
              <>
                <Segmentado
                  rotulo={textos.avisos.antecedencia}
                  valor={String(prefs.avisos.minutos)}
                  opcoes={ANTECEDENCIAS.map((m) => ({ valor: String(m), nome: textos.avisos.min(m) }))}
                  aoMudar={(m) => mudar({ avisos: { ...prefs.avisos, minutos: Number(m) } })}
                />
                <div className="campo">
                  <Interruptor
                    rotulo={textos.avisos.notificacao}
                    ligado={prefs.avisos.notificacao}
                    aoMudar={(notificacao) => mudar({ avisos: { ...prefs.avisos, notificacao } })}
                  />
                  <p className="campo-ajuda">{textos.avisos.notificacaoExplicacao}</p>
                </div>
              </>
            )}
          </section>

          <LimiteProjetos />
          <Seguranca modo={modo} temSenha={temSenha} aoMudar={aoMudarSeguranca} />
          <AjustesJanela />
          <AjustesAtualizacao />
          <Backup aoRestaurar={aoRestaurar} />
          <AjustesNuvem />
          <AjustesIa />
          <AjustesDitado />
      </div>
    </div>
  );
}
