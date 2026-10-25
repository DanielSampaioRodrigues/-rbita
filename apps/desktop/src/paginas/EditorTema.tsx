import { ajustarPaleta, CHAVES_PALETA, conferirPaleta, variaveisDaPaleta, type Paleta, type Tema, ICONES_PADRAO, type Icones, type FamiliaIcones, type PreenchimentoIcones, type EfeitoIcones } from "@orbita/temas";
import { CriarTemaIa } from "../ia/CriarTemaIa";
import { DesenharIconesIa } from "../ia/DesenharIconesIa";
import { Segmentado } from "../componentes/Segmentado";
import { EstiloIconesLocal, Check, TriangleAlert, Wand2, CalendarDays, FolderKanban, Home } from "../icones";
import { useEffect, useId, useState } from "react";
import { api, type EstadoIa } from "../api";
import { Button, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { Aviso, Campo } from "../componentes/Campo";
import { Interruptor } from "../componentes/Interruptor";
import { textos } from "../textos/pt-BR";

const t = textos.editorTema;
type Modo = "claro" | "escuro";

function CampoCor({ chave, valor, aoMudar, falha }: { chave: keyof Paleta; valor: string; aoMudar: (v: string) => void; falha: boolean }) {
  const id = useId();
  const [texto, setTexto] = useState(valor);
  // Quando a cor muda por fora (seletor ou "ajustar sozinho"), o campo de texto acompanha.
  useEffect(() => setTexto(valor), [valor]);
  return (
    <div className={falha ? "campo-cor falha" : "campo-cor"}>
      <input id={id} type="color" value={valor} onChange={(e) => (aoMudar(e.target.value), setTexto(e.target.value))} aria-label={t.rotulos[chave]} />
      <label htmlFor={`${id}-hex`} className="campo-cor-rotulo">
        {t.rotulos[chave]}
        {falha && <TriangleAlert aria-label={t.naoPassa} size="1em" />}
      </label>
      <input
        id={`${id}-hex`}
        className="entrada-texto sozinha campo-cor-hex"
        value={texto}
        spellCheck={false}
        maxLength={7}
        onChange={(e) => {
          setTexto(e.target.value);
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) aoMudar(e.target.value.toLowerCase());
        }}
        aria-describedby={id}
      />
    </div>
  );
}

/** Prévia ao vivo: um pedaço do app desenhado só com as cores em edição. */
function Previa({ paleta, cantos, sombra, icones }: { paleta: Paleta; cantos: number; sombra: boolean; icones: Icones }) {
  const estilo = {
    ...variaveisDaPaleta(paleta),
    "--multiplicador-cantos": String(cantos),
    "--traco-icone": String(icones.traco),
    "--pontas-icone": icones.pontas === "retas" ? "square" : "round",
    "--juncao-icone": icones.pontas === "retas" ? "miter" : "round",
    ...(sombra ? {} : { "--sombra": "none" }),
  } as React.CSSProperties;
  return (
    <EstiloIconesLocal.Provider value={icones}>
    <div className="previa-tema" style={estilo} aria-label={t.previa} role="img" data-icones-efeito={icones.efeito ?? "nenhum"}>
      <div className="previa-tema-lateral">
        <span className="previa-tema-item ativo com-icone"><Home aria-hidden="true" size="1em" /> Início</span>
        <span className="previa-tema-item com-icone"><FolderKanban aria-hidden="true" size="1em" /> Projetos</span>
        <span className="previa-tema-item com-icone"><CalendarDays aria-hidden="true" size="1em" /> Agenda</span>
      </div>
      <div className="previa-tema-conteudo">
        <div className="cartao compacto">
          <strong>{t.previaTitulo}</strong>
          <span style={{ color: "var(--cor-texto-suave)" }}>{t.previaTexto}</span>
          <span className="botao principal" style={{ alignSelf: "flex-start" }}>{t.previaBotao}</span>
          <span className="aviso">{t.previaAviso}</span>
        </div>
      </div>
    </div>
    </EstiloIconesLocal.Provider>
  );
}

export function EditorTema({ inicial, aoSalvar, aoGuardar, aoCancelar }: { inicial: Tema; aoSalvar: (tema: Tema) => void; aoGuardar: (tema: Tema) => void; aoCancelar: () => void }) {
  const [tema, setTema] = useState<Tema>(inicial);
  // O que a IA cria já vale no app e entra na lista de temas; aqui fica o último guardado.
  const [guardado, setGuardado] = useState<Tema | null>(null);
  const aplicarDaIa = (novo: Tema) => {
    setTema(novo);
    const passa = (["claro", "escuro"] as const).every((m) => conferirPaleta(novo[m]).every((r) => r.passa));
    if (passa && novo.nome.trim()) {
      const final = { ...novo, nome: novo.nome.trim() };
      aoGuardar(final);
      setGuardado(final);
    }
  };
  // Estado da IA: os dois painéis usam a IA e o modelo de "Personalização".
  const [ia, setIa] = useState<EstadoIa | null>(null);
  useEffect(() => {
    api.estadoIa().then(setIa, () => setIa(null));
  }, []);
  const [modo, setModo] = useState<Modo>("claro");
  const paleta = tema[modo];
  const resultados = conferirPaleta(paleta);
  const falhas = new Set(resultados.filter((r) => !r.passa).map((r) => r.frente));
  const tudoPassa = (["claro", "escuro"] as const).every((m) => conferirPaleta(tema[m]).every((r) => r.passa));

  const icones = tema.icones ?? ICONES_PADRAO;
  const mudarCor = (chave: keyof Paleta, valor: string) => setTema((x) => ({ ...x, [modo]: { ...x[modo], [chave]: valor } }));

  return (
    <div className="pagina pagina-larga">
      <h1>{t.titulo}</h1>
      <CriarTemaIa tema={tema} aoAplicar={aplicarDaIa} ia={ia} aoMudarIa={setIa} />
      <DesenharIconesIa tema={tema} aoAplicar={setTema} ia={ia} />
      <div className="editor-tema">
        <div className="formulario">
          <Campo rotulo={t.nome} valor={tema.nome} aoMudar={(nome) => setTema((x) => ({ ...x, nome }))} autoFocus />
          <div className="campo">
            <span className="campo-rotulo" id="modo-editor">{t.modo}</span>
            <ToggleButtonGroup aria-labelledby="modo-editor" selectionMode="single" disallowEmptySelection selectedKeys={[modo]} onSelectionChange={(k) => setModo([...k][0] as Modo)} className="segmentado">
              {(["claro", "escuro"] as const).map((m) => (
                <ToggleButton key={m} id={m} className="segmentado-opcao">{t.modos[m]}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
          <fieldset className="grupo-cores">
            <legend className="campo-rotulo">{t.cores}</legend>
            {CHAVES_PALETA.map((chave) => (
              <CampoCor key={`${modo}-${chave}`} chave={chave} valor={paleta[chave]} aoMudar={(v) => mudarCor(chave, v)} falha={falhas.has(chave)} />
            ))}
          </fieldset>
          <div className="campo">
            <span className="campo-rotulo" id="cantos-editor">{t.cantos}</span>
            <ToggleButtonGroup aria-labelledby="cantos-editor" selectionMode="single" disallowEmptySelection selectedKeys={[String(tema.cantos ?? 1)]} onSelectionChange={(k) => setTema((x) => ({ ...x, cantos: Number([...k][0]) }))} className="segmentado">
              {[["0.3", "Retos"], ["0.7", "Suaves"], ["1", "Médios"], ["1.4", "Redondos"]].map(([v, n]) => (
                <ToggleButton key={v} id={v} className="segmentado-opcao">{n}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
          <Interruptor rotulo={t.sombra} ligado={tema.sombra !== false} aoMudar={(sombra) => setTema((x) => ({ ...x, sombra }))} />
          <Segmentado
            rotulo={t.tracoIcones}
            valor={String(icones.traco)}
            opcoes={[["1.5", t.tracos.fino], ["2", t.tracos.medio], ["2.5", t.tracos.grosso]].map(([valor, nome]) => ({ valor, nome }))}
            aoMudar={(v) => setTema((x) => ({ ...x, icones: { ...icones, traco: Number(v) } }))}
          />
          <Segmentado<Icones["pontas"]>
            rotulo={t.pontasIcones}
            valor={icones.pontas}
            opcoes={[{ valor: "redondas", nome: t.pontas.redondas }, { valor: "retas", nome: t.pontas.retas }]}
            aoMudar={(pontas) => setTema((x) => ({ ...x, icones: { ...icones, pontas } }))}
          />
          <Segmentado<FamiliaIcones>
            rotulo={t.familiaIcones}
            valor={icones.familia ?? "lucide"}
            opcoes={(["lucide", "phosphor", "tabler"] as const).map((valor) => ({ valor, nome: t.familias[valor] }))}
            aoMudar={(familia) => setTema((x) => ({ ...x, icones: { ...icones, familia } }))}
          />
          {icones.familia === "phosphor" && (
            <Segmentado<PreenchimentoIcones>
              rotulo={t.preenchimentoIcones}
              valor={icones.preenchimento ?? "linha"}
              opcoes={(["linha", "cheio", "dois-tons"] as const).map((valor) => ({ valor, nome: t.preenchimentos[valor] }))}
              aoMudar={(preenchimento) => setTema((x) => ({ ...x, icones: { ...icones, preenchimento } }))}
            />
          )}
          <Segmentado<EfeitoIcones>
            rotulo={t.efeitoIcones}
            valor={icones.efeito ?? "nenhum"}
            opcoes={(["nenhum", "rabiscado", "carimbo", "brilho"] as const).map((valor) => ({ valor, nome: t.efeitos[valor] }))}
            aoMudar={(efeito) => setTema((x) => ({ ...x, icones: { ...icones, efeito } }))}
          />
          <p className="campo-ajuda">{t.efeitoAjuda}</p>
        </div>

        <div className="editor-lado">
          <Previa paleta={paleta} cantos={tema.cantos ?? 1} sombra={tema.sombra !== false} icones={icones} />
          <section className="cartao compacto" aria-labelledby="contraste-editor">
            <h2 id="contraste-editor">{t.contraste}</h2>
            {/* Rola sozinha quando é comprida: precisa receber foco para rolar pelo teclado. */}
            <ul className="lista-contraste" tabIndex={0} aria-labelledby="contraste-editor">
              {resultados.map((r) => (
                <li key={`${r.frente}-${r.fundo}`} className={r.passa ? "" : "falha"}>
                  {r.passa ? <Check aria-hidden="true" size="1em" /> : <TriangleAlert aria-hidden="true" size="1em" />}
                  <span>{t.par(t.rotulos[r.frente], t.rotulos[r.fundo].toLowerCase())}</span>
                  <span className="texto-suave">
                    {r.valor.toFixed(1)}:1 · {r.passa ? t.passa : t.naoPassa} ({t.minimo(r.minimo)})
                  </span>
                </li>
              ))}
            </ul>
            <Button className="botao" onPress={() => setTema((x) => ({ ...x, claro: ajustarPaleta(x.claro), escuro: ajustarPaleta(x.escuro) }))}>
              <Wand2 aria-hidden="true" size="1.1em" /> {t.ajustar}
            </Button>
            <p className="campo-ajuda">{t.ajustarExplicacao}</p>
          </section>
        </div>
      </div>
      {!tudoPassa && <Aviso>{t.faltam}</Aviso>}
      <div className="botoes">
        <Button className="botao" onPress={aoCancelar}>
          {!guardado ? t.cancelar : JSON.stringify(guardado) === JSON.stringify(tema) ? t.fechar : t.descartar}
        </Button>
        <Button className="botao principal" isDisabled={!tudoPassa || !tema.nome.trim()} onPress={() => aoSalvar({ ...tema, nome: tema.nome.trim() })}>{t.salvar}</Button>
      </div>
    </div>
  );
}
