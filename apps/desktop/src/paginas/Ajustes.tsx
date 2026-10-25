import { useState } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { usePreferencias } from "../estado";
import {
  DENSIDADES,
  ESPACO_LETRAS,
  ESPACO_LINHAS,
  FONTES,
  type Densidade,
  type EspacoLetras,
  type EspacoLinhas,
  type Fonte,
  type ModoCor,
} from "../preferencias";
import { textos } from "../textos/pt-BR";

const t = textos.ajustes;
const chaves = <T extends string>(o: Record<T, unknown>) => Object.keys(o) as T[];

export function Ajustes() {
  const { prefs, mudar, voltarAoPadrao } = usePreferencias();
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.descricao}</p>

      <div className="ajustes-grade">
        <section className="cartao previa" aria-label={t.previa}>
          <p className="previa-rotulo">{t.previa}</p>
          <h3>{t.previaTitulo}</h3>
          <p>{t.previaTexto}</p>
          <Button className="botao principal">{t.previaBotao}</Button>
        </section>

          <section className="cartao">
            <h2>{t.leitura}</h2>
            <Segmentado<Fonte>
              rotulo={t.fonte}
              valor={prefs.fonte}
              opcoes={chaves(FONTES).map((f) => ({ valor: f, nome: FONTES[f].nome, fonte: FONTES[f].css }))}
              aoMudar={(fonte) => mudar({ fonte })}
            />
            <Segmentado
              rotulo={t.tamanho}
              valor={String(prefs.tamanho)}
              opcoes={t.tamanhos.map((nome, i) => ({ valor: String(i), nome }))}
              aoMudar={(v) => mudar({ tamanho: Number(v) })}
            />
            <Segmentado<EspacoLetras>
              rotulo={t.espacoLetras}
              valor={prefs.espacoLetras}
              opcoes={chaves(ESPACO_LETRAS).map((e) => ({ valor: e, nome: t.espacos[e] }))}
              aoMudar={(espacoLetras) => mudar({ espacoLetras })}
            />
            <Segmentado<EspacoLinhas>
              rotulo={t.espacoLinhas}
              valor={prefs.espacoLinhas}
              opcoes={chaves(ESPACO_LINHAS).map((e) => ({ valor: e, nome: t.espacos[e] }))}
              aoMudar={(espacoLinhas) => mudar({ espacoLinhas })}
            />
          </section>

          <section className="cartao">
            <h2>{t.tela}</h2>
            <Segmentado<ModoCor>
              rotulo={t.modoCor}
              valor={prefs.modoCor}
              opcoes={(["sistema", "claro", "escuro"] as const).map((m) => ({ valor: m, nome: t.modos[m] }))}
              aoMudar={(modoCor) => mudar({ modoCor })}
            />
            <Segmentado<Densidade>
              rotulo={t.densidade}
              valor={prefs.densidade}
              opcoes={chaves(DENSIDADES).map((d) => ({ valor: d, nome: t.densidades[d] }))}
              aoMudar={(densidade) => mudar({ densidade })}
            />
            <div className="campo">
              <Interruptor
                rotulo={t.baixoEstimulo}
                ligado={prefs.baixoEstimulo}
                aoMudar={(baixoEstimulo) => mudar({ baixoEstimulo })}
              />
              <p className="campo-ajuda">{t.baixoEstimuloExplicacao}</p>
            </div>
          </section>
      </div>

      <Button className="botao" onPress={() => setConfirmando(true)}>
        {t.voltarPadrao}
      </Button>

      <ModalOverlay className="sobreposicao" isOpen={confirmando} onOpenChange={setConfirmando} isDismissable>
        <Modal className="janela pequena">
          <Dialog className="janela-dialogo" role="alertdialog">
            <Heading slot="title">{t.confirmarPadraoTitulo}</Heading>
            <p>{t.confirmarPadraoTexto}</p>
            <div className="janela-acoes">
              <Button className="botao" onPress={() => setConfirmando(false)} autoFocus>
                {t.cancelar}
              </Button>
              <Button
                className="botao principal"
                onPress={() => {
                  voltarAoPadrao();
                  setConfirmando(false);
                }}
              >
                {t.confirmar}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}
