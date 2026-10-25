import { useState } from "react";
import { Button } from "react-aria-components";
import type { Tema } from "@orbita/temas";
import { Confirmar } from "../componentes/Janela";
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
import { EditorTema } from "./EditorTema";
import { TemaFundo } from "./TemaFundo";

const t = textos.ajustes;
const chaves = <T extends string>(o: Record<T, unknown>) => Object.keys(o) as T[];

/** Tudo o que muda o visual: tema e fundo, leitura e tela. Ajustes fica com o funcionamento. */
export function Aparencia() {
  const { prefs, mudar, voltarAoPadrao } = usePreferencias();
  const [confirmando, setConfirmando] = useState(false);
  const [editandoTema, setEditandoTema] = useState<Tema | null>(null);

  // Guarda o tema na lista e passa a usá-lo no app inteiro.
  const guardarTema = (tema: Tema) => {
    const outros = prefs.temasProprios.filter((x) => x.id !== tema.id);
    // Imagem (foto ou gerada pela IA) fica como fundo escolhido, não dentro do tema:
    // assim o arquivo de tema continua leve e sem fotos.
    if (tema.fundoPadrao?.tipo === "imagem") {
      const { fundoPadrao, ...semImagem } = tema;
      mudar({ temasProprios: [...outros, semImagem], tema: tema.id, fundo: fundoPadrao });
    } else {
      // Só troca o fundo escolhido se o fundo do tema mudou no editor (por exemplo, pela IA).
      const fundoMudou = JSON.stringify(tema.fundoPadrao) !== JSON.stringify(editandoTema?.fundoPadrao);
      mudar({ temasProprios: [...outros, tema], tema: tema.id, ...(fundoMudou ? { fundo: null } : {}) });
    }
  };

  if (editandoTema) {
    return (
      <EditorTema
        inicial={editandoTema}
        aoCancelar={() => setEditandoTema(null)}
        aoGuardar={guardarTema}
        aoSalvar={(tema) => (guardarTema(tema), setEditandoTema(null))}
      />
    );
  }

  return (
    <div className="pagina">
      <h1>{textos.aparencia.titulo}</h1>
      <p className="pagina-intro">{textos.aparencia.descricao}</p>

      <div className="ajustes-grade">
        <section className="cartao previa" aria-label={t.previa}>
          <p className="previa-rotulo">{t.previa}</p>
          {/* Exemplo de título, não um título da página (fica fora da ordem dos títulos). */}
          <p className="previa-titulo">{t.previaTitulo}</p>
          <p>{t.previaTexto}</p>
          <Button className="botao principal">{t.previaBotao}</Button>
        </section>

          <TemaFundo aoEditarTema={setEditandoTema} />

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
            <Button className="botao" onPress={() => setConfirmando(true)}>
              {t.voltarPadrao}
            </Button>
          </section>

      </div>

      <Confirmar
        titulo={t.confirmarPadraoTitulo}
        texto={t.confirmarPadraoTexto}
        confirmar={t.confirmar}
        aberta={confirmando}
        aoCancelar={() => setConfirmando(false)}
        aoConfirmar={() => (voltarAoPadrao(), setConfirmando(false))}
      />
    </div>
  );
}
