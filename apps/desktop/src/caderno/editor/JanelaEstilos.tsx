// Janelas dos estilos da pessoa: criar ou editar um estilo (com prévia ao vivo) e a
// lista "Meus estilos" (editar, apagar, criar do zero).
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";
import { Campo } from "../../componentes/Campo";
import { Janela } from "../../componentes/Janela";
import { Segmentado } from "../../componentes/Segmentado";
import { textos } from "../../textos/pt-BR";
import { apagarEstilo, cssDosEstilos, ESTILO_VAZIO, novoIdEstilo, resumoDoEstilo, salvarEstilo, useMeusEstilos, type Alinhamento, type BaseEstilo, type EstiloProprio } from "./meusEstilos";
import { ESPACOS_LETRAS, nomeDoEspaco } from "./espacoLetras";
import { SeletorFonte } from "./SeletorFonte";

const t = textos.caderno.editor.meus;
const TAMANHOS = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const ENTRELINHAS = [1, 1.15, 1.5, 2, 2.5, 3];
const RECUOS_1A = [0, 0.5, 1, 1.25, 1.27, 2];
const RECUOS_ESQ = [0, 1, 2, 4, 6];
const ESPACOS = [0, 3, 6, 9, 12, 18, 24, 36];
const FUNDOS = ["#fef08a", "#fde68a", "#bbf7d0", "#a7f3d0", "#bae6fd", "#c7d2fe", "#fbcfe8", "#fed7aa", "#e9d5ff", "#e5e7eb"];
const CORES = ["#1f2937", "#4b5563", "#991b1b", "#c2410c", "#a16207", "#15803d", "#0f766e", "#1d4ed8", "#4338ca", "#7e22ce", "#be185d"];
const virgula = (n: number) => String(n).replace(".", ",");

/** Uma lista simples (o primeiro valor é o "do documento"). */
function Lista({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: number; opcoes: { v: number; nome: string }[]; aoMudar: (v: number) => void }) {
  return (
    <label className="campo estilo-campo">
      <span className="campo-rotulo">{rotulo}</span>
      <select className="entrada-texto sozinha" value={String(valor)} onChange={(e) => aoMudar(Number(e.target.value))}>
        {opcoes.map((o) => <option key={o.v} value={String(o.v)}>{o.nome}</option>)}
      </select>
    </label>
  );
}

export function JanelaEstilo({ inicial, aberta, aoFechar, aoSalvar }: {
  /** Estilo a editar, ou o rascunho de um novo (sem id). */
  inicial: (Omit<EstiloProprio, "id"> & { id?: string }) | null;
  aberta: boolean;
  aoFechar: () => void;
  aoSalvar?: (e: EstiloProprio) => void;
}) {
  const [e, setE] = useState<Omit<EstiloProprio, "id"> & { id?: string }>(() => inicial ?? { ...ESTILO_VAZIO, nome: "" });
  useEffect(() => { if (aberta && inicial) setE(inicial); }, [aberta, inicial]);
  const mudar = (p: Partial<EstiloProprio>) => setE((x) => ({ ...x, ...p }));
  const salvar = async () => {
    const final: EstiloProprio = { ...e, id: e.id ?? novoIdEstilo(), nome: e.nome.trim() || t.nomePadrao(1) };
    await salvarEstilo(final);
    aoSalvar?.(final);
    aoFechar();
  };
  const previa = { ...e, id: "previa", nome: e.nome } as EstiloProprio;
  const doc = t.doDocumento;
  return (
    <Janela titulo={e.id ? t.editar(e.nome) : e.letra ? t.novoLetra : t.novo} aberta={aberta} aoFechar={aoFechar} larga>
      <div className="estilo-janela">
        <Campo rotulo={t.nome} valor={e.nome} aoMudar={(v) => mudar({ nome: v })} maximo={60} semDitado autoFocus />
        <div className="estilo-grade">
          {!e.letra && (
            <label className="campo estilo-campo">
              <span className="campo-rotulo">{t.tipo}</span>
              <select className="entrada-texto sozinha" value={e.base} onChange={(ev) => mudar({ base: ev.target.value as BaseEstilo })}>
                {(Object.keys(t.tipos) as BaseEstilo[]).map((k) => <option key={k} value={k}>{t.tipos[k]}</option>)}
              </select>
            </label>
          )}
          <div className="campo estilo-campo">
            <span className="campo-rotulo">{t.fonte}</span>
            <SeletorFonte atual={e.fonte} aoEscolher={(css) => mudar({ fonte: css ?? "" })} />
          </div>
          <Lista rotulo={t.tamanho} valor={e.tamanho} aoMudar={(v) => mudar({ tamanho: v })} opcoes={[{ v: 0, nome: doc }, ...TAMANHOS.map((n) => ({ v: n, nome: String(n) }))]} />
          <Lista rotulo={textos.caderno.editor.espacoLetras} valor={e.espacoLetras ?? 0} aoMudar={(v) => mudar({ espacoLetras: v })} opcoes={[{ v: 0, nome: textos.caderno.editor.espacoNormal }, ...ESPACOS_LETRAS.map((n) => ({ v: n, nome: nomeDoEspaco(n) }))]} />
          {!e.letra && <>
          <Lista rotulo={t.entrelinha} valor={e.entrelinha} aoMudar={(v) => mudar({ entrelinha: v })} opcoes={[{ v: 0, nome: doc }, ...ENTRELINHAS.map((n) => ({ v: n, nome: virgula(n) }))]} />
          <Lista rotulo={t.recuoPrimeira} valor={e.recuoPrimeira} aoMudar={(v) => mudar({ recuoPrimeira: v })} opcoes={[{ v: -1, nome: doc }, ...RECUOS_1A.map((n) => ({ v: n, nome: n ? `${virgula(n)} cm` : t.semRecuo }))]} />
          <Lista rotulo={t.recuoEsquerda} valor={e.recuoEsquerda} aoMudar={(v) => mudar({ recuoEsquerda: v })} opcoes={RECUOS_ESQ.map((n) => ({ v: n, nome: n ? `${virgula(n)} cm` : t.semRecuo }))} />
          <Lista rotulo={t.espacoAntes} valor={e.espacoAntes} aoMudar={(v) => mudar({ espacoAntes: v })} opcoes={[{ v: -1, nome: doc }, ...ESPACOS.map((n) => ({ v: n, nome: `${n} pt` }))]} />
          <Lista rotulo={t.espacoDepois} valor={e.espacoDepois} aoMudar={(v) => mudar({ espacoDepois: v })} opcoes={[{ v: -1, nome: doc }, ...ESPACOS.map((n) => ({ v: n, nome: `${n} pt` }))]} />
          </>}
        </div>
        <div className="campo">
          <span className="campo-rotulo">{t.letra}</span>
          <div className="estilo-letra">
            {(["negrito", "italico", "sublinhado"] as const).map((k) => (
              <label key={k} className="estilo-marca"><input type="checkbox" checked={e[k]} onChange={(ev) => mudar({ [k]: ev.target.checked })} /> {t[k]}</label>
            ))}
          </div>
        </div>
        <div className="campo">
          <span className="campo-rotulo" id="estilo-cor">{t.cor}</span>
          <div className="estilo-cores" role="radiogroup" aria-labelledby="estilo-cor">
            <button type="button" role="radio" aria-checked={!e.cor} className={!e.cor ? "estilo-cor padrao atual" : "estilo-cor padrao"} onClick={() => mudar({ cor: "" })} aria-label={t.corPadrao} title={t.corPadrao}>×</button>
            {CORES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={e.cor === c} aria-label={c} title={c} className={e.cor === c ? "estilo-cor atual" : "estilo-cor"} style={{ background: c }} onClick={() => mudar({ cor: c })} />
            ))}
          </div>
        </div>
        <Segmentado rotulo={t.caixa} valor={e.caixa || "normal"} aoMudar={(v) => mudar({ caixa: v === "normal" ? "" : (v as EstiloProprio["caixa"]) })}
          opcoes={(["", "maiusculas", "versalete"] as const).map((k) => ({ valor: k || "normal", nome: t.caixas[k] }))} />
        {e.letra && (
          <div className="campo">
            <span className="campo-rotulo" id="estilo-fundo">{t.fundo}</span>
            <div className="estilo-cores" role="radiogroup" aria-labelledby="estilo-fundo">
              <button type="button" role="radio" aria-checked={!e.fundo} className={!e.fundo ? "estilo-cor padrao atual" : "estilo-cor padrao"} onClick={() => mudar({ fundo: "" })} aria-label={t.semFundo} title={t.semFundo}>×</button>
              {FUNDOS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={e.fundo === c} aria-label={c} title={c} className={e.fundo === c ? "estilo-cor atual" : "estilo-cor"} style={{ background: c }} onClick={() => mudar({ fundo: c })} />
              ))}
            </div>
          </div>
        )}
        {!e.letra && <>
        <Segmentado rotulo={t.alinhamento} valor={e.alinhamento || "doc"} aoMudar={(v) => mudar({ alinhamento: v === "doc" ? "" : (v as Alinhamento) })}
          opcoes={(["", "left", "center", "right", "justify"] as const).map((k) => ({ valor: k || "doc", nome: t.alinhamentos[k] }))} />
        <Segmentado rotulo={t.capitular} valor={String(e.capitular)} aoMudar={(v) => mudar({ capitular: Number(v) })} opcoes={(["0", "2", "3", "4"] as const).map((k) => ({ valor: k, nome: t.capitulares[k] }))} />
        </>}
        <div className="campo">
          <span className="campo-rotulo">{t.previa}</span>
          <style>{cssDosEstilos([previa])}</style>
          <div className="estilo-previa doc-conteudo">
            {e.letra
              ? <p>{t.exemploAntes}<span data-meu-estilo-letra="previa">{t.exemploTrecho}</span>{t.exemploDepois}</p>
              : <p data-meu-estilo="previa">{t.exemplo}</p>}
          </div>
        </div>
        <div className="janela-acoes">
          <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
          <Button className="botao principal" onPress={() => void salvar()}>{e.id ? t.salvar : t.criarBotao}</Button>
        </div>
      </div>
    </Janela>
  );
}

export function JanelaMeusEstilos({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const estilos = useMeusEstilos();
  const [editando, setEditando] = useState<(Omit<EstiloProprio, "id"> & { id?: string }) | null>(null);
  const [apagando, setApagando] = useState<EstiloProprio | null>(null);
  return (
    <>
      <Janela titulo={t.listaTitulo} aberta={aberta && !editando} aoFechar={aoFechar}>
        <p className="campo-ajuda">{t.ajuda}</p>
        {!estilos.length && <p className="texto-suave">{t.vazio}</p>}
        <style>{cssDosEstilos(estilos)}</style>
        <ul className="estilo-lista">
          {estilos.map((e) => (
            <li key={e.id} className="estilo-item">
              <div className="estilo-item-texto doc-conteudo">
                {e.letra
                  ? <p className="estilo-item-nome"><span data-meu-estilo-letra={e.id}>{e.nome}</span></p>
                  : <p data-meu-estilo={e.id} data-capitular="0" className="estilo-item-nome">{e.nome}</p>}
                <span className="texto-suave pequeno">{resumoDoEstilo(e, t.resumo)}</span>
              </div>
              {apagando?.id === e.id ? (
                <div className="estilo-item-acoes" role="group" aria-label={t.apagarPergunta(e.nome)}>
                  <span className="pequeno">{t.apagarPergunta(e.nome)}</span>
                  <Button className="botao pequeno" onPress={() => setApagando(null)}>{textos.comum.cancelar}</Button>
                  <Button className="botao pequeno perigo" onPress={() => { void apagarEstilo(e.id); setApagando(null); }}>{t.apagarSim}</Button>
                </div>
              ) : (
                <div className="estilo-item-acoes">
                  <Button className="botao pequeno" onPress={() => setEditando(e)}>{t.editarBotao}</Button>
                  <Button className="botao pequeno" onPress={() => setApagando(e)}>{t.apagar}</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="janela-acoes">
          <Button className="botao separado" onPress={() => setEditando({ ...ESTILO_VAZIO, nome: t.nomePadrao(estilos.length + 1) })}>{t.novo}</Button>
          <Button className="botao" onPress={() => setEditando({ ...ESTILO_VAZIO, letra: true, nome: t.nomePadraoLetra(estilos.filter((x) => x.letra).length + 1) })}>{t.novoLetra}</Button>
          <Button className="botao principal" onPress={aoFechar}>{textos.comum.fechar}</Button>
        </div>
      </Janela>
      <JanelaEstilo inicial={editando} aberta={!!editando} aoFechar={() => setEditando(null)} />
    </>
  );
}
