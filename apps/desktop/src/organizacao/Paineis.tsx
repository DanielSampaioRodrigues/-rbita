// Janelas do quadro: filtro, arquivados, etiquetas do quadro e fundo.
import { useState } from "react";
import { Button, Checkbox } from "react-aria-components";
import { api, escolherArquivoParaAnexar, type CartaoOrg, type Coluna, type EtiquetaOrg, type FundoOrg, type Quadro } from "../api";
import { Aviso } from "../componentes/Campo";
import { Confirmar } from "../componentes/Janela";
import { amostraGradiente, GRADIENTES_QUADRO, LIMITE_FUNDO_BYTES } from "../hobbies/aparencia";
import { reduzirImagem } from "../hobbies/midia";
import { Check, ImagePlus, Plus, RotateCcw, Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";
import { CORES_ORG, PALETA_ORG } from "./cores";
import { ChipEtiqueta, EscolherCor, useImagemAnexo } from "./partes";
import type { Filtro } from "./regras";

const t = textos.organizacao;
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Caixa({ marcada, aoMudar, children }: { marcada: boolean; aoMudar: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Checkbox className="org-caixa" isSelected={marcada} onChange={aoMudar}>
      <span className="org-caixa-marca" aria-hidden="true">{marcada && <Check size="0.9em" />}</span>
      <span>{children}</span>
    </Checkbox>
  );
}

export function PainelFiltro({ filtro, etiquetas, aoMudar, aoLimpar, aoFechar }: { filtro: Filtro; etiquetas: EtiquetaOrg[]; aoMudar: (f: Filtro) => void; aoLimpar: () => void; aoFechar: () => void }) {
  return (
    <div className="formulario">
      <label className="campo">
        <span className="campo-rotulo">{t.filtro.texto}</span>
        <input className="entrada-texto sozinha" type="search" value={filtro.texto} onChange={(e) => aoMudar({ ...filtro, texto: e.target.value })} />
      </label>
      <fieldset className="hobby-grupo">
        <legend>{t.filtro.etiquetas}</legend>
        {etiquetas.length === 0 ? (
          <p className="texto-suave pequeno">{t.filtro.semEtiquetas}</p>
        ) : (
          <div className="org-filtro-etiquetas">
            {etiquetas.map((e) => (
              <Caixa key={e.id} marcada={filtro.etiquetas.includes(e.id)} aoMudar={(v) => aoMudar({ ...filtro, etiquetas: v ? [...filtro.etiquetas, e.id] : filtro.etiquetas.filter((x) => x !== e.id) })}>
                <ChipEtiqueta etiqueta={e} />
              </Caixa>
            ))}
          </div>
        )}
      </fieldset>
      <Caixa marcada={filtro.semana} aoMudar={(v) => aoMudar({ ...filtro, semana: v })}>{t.filtro.semana}</Caixa>
      <Caixa marcada={filtro.semFeitos} aoMudar={(v) => aoMudar({ ...filtro, semFeitos: v })}>{t.filtro.semFeitos}</Caixa>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoLimpar}>{t.filtro.limpar}</Button>
        <Button className="botao principal" onPress={aoFechar}>{t.filtro.pronto}</Button>
      </div>
    </div>
  );
}

export function PainelArquivados({ colunas, cartoes, aoRestaurarColuna, aoApagarColuna, aoRestaurarCartao, aoApagarCartao, aoFechar }: {
  colunas: Coluna[];
  cartoes: CartaoOrg[];
  aoRestaurarColuna: (c: Coluna) => void;
  aoApagarColuna: (c: Coluna) => void;
  aoRestaurarCartao: (c: CartaoOrg) => void;
  aoApagarCartao: (c: CartaoOrg) => void;
  aoFechar: () => void;
}) {
  const [apagando, setApagando] = useState<{ nome: string; acao: () => void } | null>(null);
  const colArq = colunas.filter((c) => c.arquivada);
  const cartArq = cartoes.filter((c) => c.arquivado);
  const nomeCol = (id: string) => colunas.find((c) => c.id === id)?.nome || t.coluna.semNome;
  return (
    <div className="formulario">
      <p className="texto-suave">{t.arquivados.ajuda}</p>
      <h3 className="org-det-subtitulo">{t.arquivados.cartoes}</h3>
      {cartArq.length === 0 ? (
        <p className="texto-suave pequeno">{t.arquivados.semCartoes}</p>
      ) : (
        <ul className="org-arquivados">
          {cartArq.map((c) => (
            <li key={c.id}>
              <span className="org-arquivado-nome">
                <span className="quebra">{c.texto}</span>
                <span className="texto-suave pequeno">{t.arquivados.naColuna(nomeCol(c.colunaId))}</span>
              </span>
              <Button className="botao pequeno com-icone" onPress={() => aoRestaurarCartao(c)} aria-label={t.arquivados.restaurarNome(c.texto)}><RotateCcw aria-hidden="true" size="1em" /> {t.arquivados.restaurar}</Button>
              <Button className="botao-icone org-icone" onPress={() => setApagando({ nome: c.texto, acao: () => aoApagarCartao(c) })} aria-label={t.arquivados.apagarNome(c.texto)}><Trash2 aria-hidden="true" size="1em" /></Button>
            </li>
          ))}
        </ul>
      )}
      <h3 className="org-det-subtitulo">{t.arquivados.colunas}</h3>
      {colArq.length === 0 ? (
        <p className="texto-suave pequeno">{t.arquivados.semColunas}</p>
      ) : (
        <ul className="org-arquivados">
          {colArq.map((c) => {
            const nome = c.nome || t.coluna.semNome;
            return (
              <li key={c.id}>
                <span className="org-arquivado-nome"><span className="quebra">{nome}</span></span>
                <Button className="botao pequeno com-icone" onPress={() => aoRestaurarColuna(c)} aria-label={t.arquivados.restaurarNome(nome)}><RotateCcw aria-hidden="true" size="1em" /> {t.arquivados.restaurar}</Button>
                <Button className="botao-icone org-icone" onPress={() => setApagando({ nome, acao: () => aoApagarColuna(c) })} aria-label={t.arquivados.apagarNome(nome)}><Trash2 aria-hidden="true" size="1em" /></Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="janela-acoes"><Button className="botao principal" onPress={aoFechar}>{t.arquivados.fechar}</Button></div>
      <Confirmar
        titulo={textos.organizacao.excluir}
        texto={apagando ? t.arquivados.confirmarApagar(apagando.nome) : ""}
        confirmar={textos.organizacao.excluir}
        aberta={apagando !== null}
        aoCancelar={() => setApagando(null)}
        aoConfirmar={() => {
          apagando?.acao();
          setApagando(null);
        }}
      />
    </div>
  );
}

/** Criar, renomear, trocar a cor e apagar as etiquetas do quadro. */
export function PainelEtiquetas({ etiquetas, aoMudar, aoFechar }: { etiquetas: EtiquetaOrg[]; aoMudar: (e: EtiquetaOrg[]) => void; aoFechar: () => void }) {
  const [lista, setLista] = useState(etiquetas);
  const [pintando, setPintando] = useState<string | null>(null);
  const [apagando, setApagando] = useState<EtiquetaOrg | null>(null);
  const mudar = (nova: EtiquetaOrg[], guardar = true) => {
    setLista(nova);
    if (guardar) aoMudar(nova);
  };
  return (
    <div className="formulario">
      <p className="texto-suave">{t.etiquetas.ajuda}</p>
      {lista.length === 0 && <p className="texto-suave pequeno">{t.etiquetas.vazio}</p>}
      <ul className="org-etiquetas-editar">
        {lista.map((e) => (
          <li key={e.id}>
            <div className="org-etiqueta-linha">
              <ChipEtiqueta etiqueta={e} />
              <input
                className="entrada-texto sozinha"
                value={e.nome}
                onChange={(ev) => mudar(lista.map((x) => (x.id === e.id ? { ...x, nome: ev.target.value } : x)), false)}
                onBlur={() => aoMudar(lista)}
                aria-label={`${t.etiquetas.nome}: ${e.nome || t.etiquetas.semNome}`}
                maxLength={40}
              />
              <Button className="botao pequeno" onPress={() => setPintando(pintando === e.id ? null : e.id)} aria-expanded={pintando === e.id}>{t.etiquetas.cor}</Button>
              <Button className="botao-icone org-icone" onPress={() => setApagando(e)} aria-label={t.etiquetas.apagar(e.nome || t.etiquetas.semNome)}><Trash2 aria-hidden="true" size="1em" /></Button>
            </div>
            {pintando === e.id && <EscolherCor rotulo={`${t.etiquetas.cor}: ${e.nome || t.etiquetas.semNome}`} valor={e.cor} aoMudar={(cor) => mudar(lista.map((x) => (x.id === e.id ? { ...x, cor } : x)))} ajuda="" semVazio />}
          </li>
        ))}
      </ul>
      <Button
        className="botao com-icone"
        onPress={() => {
          const nova = { id: crypto.randomUUID(), nome: "", cor: CORES_ORG[lista.length % CORES_ORG.length] };
          mudar([...lista, nova]);
          setPintando(nova.id);
        }}
      >
        <Plus aria-hidden="true" size="1em" /> {t.etiquetas.nova}
      </Button>
      <div className="janela-acoes"><Button className="botao principal" onPress={() => (aoMudar(lista), aoFechar())}>{t.etiquetas.pronto}</Button></div>
      <Confirmar
        titulo={t.etiquetas.apagar(apagando?.nome || "")}
        texto={apagando ? t.etiquetas.confirmarApagar(apagando.nome || t.etiquetas.semNome) : ""}
        confirmar={textos.organizacao.excluir}
        aberta={apagando !== null}
        aoCancelar={() => setApagando(null)}
        aoConfirmar={() => {
          if (apagando) mudar(lista.filter((x) => x.id !== apagando.id));
          setApagando(null);
        }}
      />
    </div>
  );
}

const FUNDO_MAX = 2400;
const semExtensao = (n: string) => n.replace(/\.[^.]+$/, "");

/** Fundo do quadro: do tema, cor da paleta, gradiente suave ou imagem própria (até 8 MB). */
export function PainelFundo({ quadro, fundo, aoMudar, aoFechar }: { quadro: Quadro; fundo: FundoOrg; aoMudar: (f: FundoOrg) => void; aoFechar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [tipo, setTipo] = useState<FundoOrg["tipo"]>(fundo.tipo);
  const urlImagem = useImagemAnexo(fundo.tipo === "imagem" ? fundo.valor : "");

  const escolherImagem = async () => {
    setErro(null);
    setOcupado(true);
    try {
      const caminho = await escolherArquivoParaAnexar(true);
      if (!caminho) return;
      const anexo = await api.anexarArquivo(quadro.id, caminho);
      if (anexo.tipo !== "imagem") {
        await api.excluirAnexo(anexo.id).catch(() => {});
        throw new Error(t.fundo.naoImagem);
      }
      if (anexo.tamanho > LIMITE_FUNDO_BYTES) {
        await api.excluirAnexo(anexo.id).catch(() => {});
        throw new Error(t.fundo.grande);
      }
      let id = anexo.id;
      // Imagem grande é reduzida (fica leve para abrir no iPad); a original sai.
      const r = await reduzirImagem(await api.imagemAnexo(anexo.id), FUNDO_MAX);
      if (r) {
        const reduzida = await api.anexarBytes(quadro.id, `fundo-${semExtensao(anexo.nome)}.${r.ext}`, r.base64);
        await api.excluirAnexo(anexo.id).catch(() => {});
        id = reduzida.id;
      }
      const antiga = fundo.tipo === "imagem" ? fundo.valor : "";
      aoMudar({ tipo: "imagem", valor: id });
      if (antiga && antiga !== id) api.excluirAnexo(antiga).catch(() => {});
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  };

  const tipos: FundoOrg["tipo"][] = ["tema", "cor", "gradiente", "imagem"];
  return (
    <div className="formulario">
      <fieldset className="hobby-grupo">
        <legend>{t.fundo.tipo}</legend>
        <div className="hobby-escolhas" role="group" aria-label={t.fundo.tipo}>
          {tipos.map((tp) => (
            <Button
              key={tp}
              className={tipo === tp ? "botao pequeno principal" : "botao pequeno"}
              aria-pressed={tipo === tp}
              onPress={() => {
                setTipo(tp);
                if (tp === "tema") aoMudar({ tipo: "tema", valor: "" });
                else if (tp === "cor") aoMudar({ tipo: "cor", valor: fundo.tipo === "cor" ? fundo.valor : "mar" });
                else if (tp === "gradiente") aoMudar({ tipo: "gradiente", valor: fundo.tipo === "gradiente" ? fundo.valor : GRADIENTES_QUADRO[0].id });
              }}
            >
              {t.fundo.tipos[tp]}
            </Button>
          ))}
        </div>
      </fieldset>
      {tipo === "cor" && (
        <fieldset className="hobby-grupo">
          <legend>{t.fundo.cor}</legend>
          <div className="hobby-amostras">
            {CORES_ORG.map((c) => (
              <Button key={c} className="hobby-amostra-botao" aria-pressed={fundo.tipo === "cor" && fundo.valor === c} onPress={() => aoMudar({ tipo: "cor", valor: c })}>
                <span className="hobby-amostra" style={{ background: PALETA_ORG[c].claro }} aria-hidden="true" />
                <span className="hobby-amostra-nome">{t.cores[c]}</span>
              </Button>
            ))}
          </div>
        </fieldset>
      )}
      {tipo === "gradiente" && (
        <fieldset className="hobby-grupo">
          <legend>{t.fundo.gradiente}</legend>
          <div className="hobby-amostras">
            {GRADIENTES_QUADRO.map((g) => (
              <Button key={g.id} className="hobby-amostra-botao" aria-pressed={fundo.tipo === "gradiente" && fundo.valor === g.id} onPress={() => aoMudar({ tipo: "gradiente", valor: g.id })}>
                <span className="hobby-amostra" style={{ background: amostraGradiente(g.id) }} aria-hidden="true" />
                <span className="hobby-amostra-nome">{textos.hobbies.quadro.fundo.gradientes[g.id as keyof typeof textos.hobbies.quadro.fundo.gradientes] ?? g.id}</span>
              </Button>
            ))}
          </div>
        </fieldset>
      )}
      {tipo === "imagem" && (
        <fieldset className="hobby-grupo">
          <legend>{t.fundo.imagem}</legend>
          {urlImagem && <span className="hobby-fundo-previa" style={{ backgroundImage: `url("${urlImagem}")` }} aria-hidden="true" />}
          <p className="texto-suave pequeno">{t.fundo.imagemAjuda}</p>
          <Button className="botao com-icone" onPress={() => void escolherImagem()} isDisabled={ocupado}>
            <ImagePlus aria-hidden="true" size="1em" /> {ocupado ? t.fundo.enviando : fundo.tipo === "imagem" ? t.fundo.trocarImagem : t.fundo.escolherImagem}
          </Button>
          <Aviso>{erro}</Aviso>
        </fieldset>
      )}
      <p className="texto-suave pequeno">{t.fundo.baixoEstimulo}</p>
      <div className="janela-acoes"><Button className="botao principal" onPress={aoFechar}>{t.fundo.pronto}</Button></div>
    </div>
  );
}
