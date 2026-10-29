import { useState, type ReactNode } from "react";
import { Button, Label, Radio, RadioGroup, Tab, TabList, TabPanel, Tabs, ToggleButton } from "react-aria-components";
import type { Tema } from "@orbita/temas";
import { Confirmar } from "../componentes/Janela";
import { Interruptor } from "../componentes/Interruptor";
import { Segmentado } from "../componentes/Segmentado";
import { usePreferencias } from "../estado";
import { GRUPOS_FONTES } from "../fontes/catalogo";
import { Check, ImagePlus, Moon, Palette, RotateCcw, Sun, Type, type LucideIcon } from "../icones";
import {
  DENSIDADES,
  ESPACO_LETRAS,
  ESPACO_LINHAS,
  FONTES,
  temaDasPreferencias,
  type Densidade,
  type EspacoLetras,
  type EspacoLinhas,
  type Fonte,
  type ModoCor,
} from "../preferencias";
import { textos } from "../textos/pt-BR";
import { EditorTema } from "./EditorTema";
import { nomeDoFundo, TemaFundo } from "./TemaFundo";

const t = textos.ajustes;
const ta = textos.aparencia;
const chaves = <T extends string>(o: Record<T, unknown>) => Object.keys(o) as T[];

type Aba = keyof typeof ta.secoes;
const ABAS: { id: Aba; icone: LucideIcon }[] = [
  { id: "tema", icone: Palette },
  { id: "fundo", icone: ImagePlus },
  { id: "letras", icone: Type },
  { id: "tela", icone: Sun },
  { id: "baixoEstimulo", icone: Moon },
];

// A aba aberta fica lembrada só neste aparelho (conveniência; se falhar, abre no Tema).
const CHAVE_ABA = "orbita.aparencia.aba";
function abaGuardada(): Aba {
  try {
    const v = localStorage.getItem(CHAVE_ABA);
    return ABAS.some((a) => a.id === v) ? (v as Aba) : "tema";
  } catch {
    return "tema";
  }
}

/** Prévia ao vivo: uma janelinha do Órbita com o tema, o fundo e a letra em uso agora. */
function PreviaAoVivo() {
  const { prefs } = usePreferencias();
  const tema = temaDasPreferencias(prefs);
  return (
    <aside className="aparencia-previa" aria-label={ta.previaRotulo}>
      <p className="aparencia-previa-rotulo">{ta.previaRotulo}</p>
      {/* Exemplo visual: os leitores de tela leem só a legenda embaixo. */}
      <div className="aparencia-previa-janela" aria-hidden="true">
        <div className="aparencia-previa-fundo" />
        <div className="aparencia-previa-lateral">
          <span className="aparencia-previa-marca" />
          {ta.previaMenu.map((item, i) => (
            <span key={item} className={i === 0 ? "aparencia-previa-item ativo" : "aparencia-previa-item"}>{item}</span>
          ))}
        </div>
        <div className="aparencia-previa-conteudo">
          <div className="cartao aparencia-previa-cartao">
            <span className="aparencia-previa-titulo">{t.previaTitulo}</span>
            <span className="aparencia-previa-texto">{t.previaTexto}</span>
            <span className="aparencia-previa-etiquetas">
              {ta.previaEtiquetas.map((e) => <span key={e} className="aparencia-previa-etiqueta">{e}</span>)}
            </span>
            <span className="aparencia-previa-botoes">
              <span className="botao principal">{t.previaBotao}</span>
              <span className="botao">{ta.previaSecundario}</span>
            </span>
          </div>
        </div>
      </div>
      <p className="aparencia-previa-legenda">{ta.previaLegenda(tema.nome, nomeDoFundo(prefs.fundo), FONTES[prefs.fonte].nome)}</p>
    </aside>
  );
}

/** Cabeçalho de cada aba: ícone, título e uma linha dizendo para que serve. */
function CabecalhoSecao({ aba, icone: Icone }: { aba: Aba; icone: LucideIcon }) {
  return (
    <div className="aparencia-secao-topo">
      <span className="aparencia-secao-icone" aria-hidden="true"><Icone size="1.25em" /></span>
      <div>
        <h2>{ta.secoes[aba].nome}</h2>
        <p className="campo-ajuda">{ta.secoes[aba].descricao}</p>
      </div>
    </div>
  );
}

/** Escolha da fonte em cartões: cada um escrito na própria fonte, com a frase de exemplo. */
function EscolhaDeFonte() {
  const { prefs, mudar } = usePreferencias();
  return (
    <RadioGroup className="campo" value={prefs.fonte} onChange={(v) => mudar({ fonte: v as Fonte })}>
      <Label className="visualmente-oculto">{t.fonte}</Label>
      {GRUPOS_FONTES.map(({ grupo, fontes }) => (
        <div key={grupo} className="aparencia-grupo-fontes" role="group" aria-labelledby={`grupo-fonte-${grupo}`}>
          <h3 id={`grupo-fonte-${grupo}`} className="aparencia-subtitulo">{ta.gruposFontes[grupo]}</h3>
          <div className="aparencia-grade-fontes">
            {fontes.map((f) => (
              <Radio key={f} value={f} className="aparencia-fonte">
                {({ isSelected }) => (
                  <>
                    <span className="aparencia-fonte-nome" style={{ fontFamily: FONTES[f].css }}>
                      {FONTES[f].nome}
                      {isSelected && (
                        <span className="aparencia-fonte-uso">
                          <Check aria-hidden="true" size="0.9em" /> {ta.fonteEmUso}
                        </span>
                      )}
                    </span>
                    <span className="aparencia-fonte-frase" style={{ fontFamily: FONTES[f].css }}>{ta.frasePrevia}</span>
                    <span className="aparencia-fonte-descricao">{ta.fontes[f]}</span>
                  </>
                )}
              </Radio>
            ))}
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}

/** Tudo o que muda o visual: tema e fundo, letras, tela e baixo estímulo. Ajustes fica com o funcionamento. */
export function Aparencia() {
  const { prefs, mudar, voltarAoPadrao } = usePreferencias();
  const [confirmando, setConfirmando] = useState(false);
  const [editandoTema, setEditandoTema] = useState<Tema | null>(null);
  const [aba, setAba] = useState<Aba>(abaGuardada);

  const trocarAba = (nova: Aba) => {
    setAba(nova);
    try {
      localStorage.setItem(CHAVE_ABA, nova);
    } catch {
      // Sem armazenamento: só não lembra a aba.
    }
  };

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

  const paineis: Record<Aba, ReactNode> = {
    tema: <TemaFundo parte="tema" aoEditarTema={setEditandoTema} />,
    fundo: <TemaFundo parte="fundo" aoEditarTema={setEditandoTema} />,
    letras: (
      <>
        <EscolhaDeFonte />
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
      </>
    ),
    tela: (
      <>
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
        <Button className="botao com-icone" onPress={() => setConfirmando(true)}>
          <RotateCcw aria-hidden="true" size="1.1em" /> {t.voltarPadrao}
        </Button>
      </>
    ),
    baixoEstimulo: (
      <>
        <div className="aparencia-baixo-estimulo">
          <Interruptor rotulo={t.baixoEstimulo} ligado={prefs.baixoEstimulo} aoMudar={(baixoEstimulo) => mudar({ baixoEstimulo })} />
          <p className="campo-ajuda">{t.baixoEstimuloExplicacao}</p>
        </div>
        <div>
          <p className="aparencia-subtitulo">{ta.baixoEstimuloOQueMuda}</p>
          <ul className="aparencia-lista">
            {ta.baixoEstimuloLista.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <p className="campo-ajuda">{ta.baixoEstimuloVolta}</p>
      </>
    ),
  };

  return (
    <div className="pagina aparencia">
      <header className="aparencia-topo">
        <div className="aparencia-topo-texto">
          <h1>{ta.titulo}</h1>
          <p className="pagina-intro">{ta.descricao}</p>
        </div>
        {/* Saída rápida: sempre no alto da página, para deixar tudo calmo sem procurar. */}
        <div className="aparencia-saida">
          <ToggleButton className="botao aparencia-saida-botao" isSelected={prefs.baixoEstimulo} onChange={(baixoEstimulo) => mudar({ baixoEstimulo })}>
            <Moon aria-hidden="true" size="1.1em" />
            {prefs.baixoEstimulo ? ta.saidaRapidaDesligar : ta.saidaRapidaLigar}
          </ToggleButton>
          <span className="aparencia-saida-dica">{ta.saidaRapidaDica}</span>
        </div>
        <span className="aparencia-topo-formas" aria-hidden="true">
          <span /><span /><span />
        </span>
      </header>

      {prefs.baixoEstimulo && <p className="aparencia-aviso" role="status">{ta.baixoEstimuloLigado}</p>}

      <Tabs className="aparencia-abas" selectedKey={aba} onSelectionChange={(k) => trocarAba(k as Aba)}>
        <TabList className="aparencia-abas-lista" aria-label={ta.secoesRotulo}>
          {ABAS.map(({ id, icone: Icone }) => (
            <Tab key={id} id={id} className="aparencia-aba">
              <Icone aria-hidden="true" size="1.1em" />
              <span>{ta.secoes[id].nome}</span>
            </Tab>
          ))}
        </TabList>
        <div className="aparencia-corpo">
          <div className="aparencia-paineis">
            {ABAS.map(({ id, icone }) => (
              <TabPanel key={id} id={id} className="cartao aparencia-painel">
                <CabecalhoSecao aba={id} icone={icone} />
                {paineis[id]}
              </TabPanel>
            ))}
          </div>
          <PreviaAoVivo />
        </div>
      </Tabs>

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
