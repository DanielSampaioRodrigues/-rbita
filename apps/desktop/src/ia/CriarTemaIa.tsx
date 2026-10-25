import { RefreshCw, Sparkles } from "../icones";
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { gravarArquivoTema, svgComoUrl, temaDaIa, type Fundo, type Tema } from "@orbita/temas";
import { api, ErroOrbita, type EstadoIa } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Escolha } from "../componentes/Escolha";
import { Segmentado } from "../componentes/Segmentado";
import { reduzirImagem } from "../fundo";
import { textos } from "../textos/pt-BR";
import { modeloDe } from "./provedores";
import { EscolherIaDaFuncao } from "./AjustesIa";

const t = textos.temaIa;
type TipoFundo = "nenhum" | "svg" | "png";

// O modelo de imagem escolhido fica guardado por provedor (é só o nome do modelo, nada pessoal).
const chaveImagem = (id: string) => `orbita.modeloImagem.${id}`;
function lerModeloImagem(id: string): string | null {
  try {
    return localStorage.getItem(chaveImagem(id));
  } catch {
    return null;
  }
}
function guardarModeloImagem(id: string, modelo: string) {
  try {
    localStorage.setItem(chaveImagem(id), modelo);
  } catch {
    // Sem acesso: vale só nesta sessão.
  }
}

/**
 * Painel do editor de tema: conversa com a IA para criar ou ajustar o tema.
 * Cada pedido manda junto o tema atual, para a IA ajustar em vez de recomeçar.
 */
export function CriarTemaIa({ tema, aoAplicar, ia, aoMudarIa }: { tema: Tema; aoAplicar: (t: Tema) => void; ia: EstadoIa | null; aoMudarIa: (e: EstadoIa) => void }) {
  // A IA e o modelo da função "Personalização" (os mesmos de Ajustes).
  const provedorId = ia?.funcoes.personalizacao ?? null;
  const [modelosImagem, setModelosImagem] = useState<string[] | null>(null);
  const [modeloImagem, setModeloImagem] = useState<string | null>(null);
  const [atualizado, setAtualizado] = useState(false);
  const [fundo, setFundo] = useState<TipoFundo>("svg");
  const [pedido, setPedido] = useState("");
  const [historico, setHistorico] = useState<string[]>([]);
  const [fase, setFase] = useState<"parado" | "tema" | "imagem">("parado");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const pedidoAtual = useRef(0);

  const provedor = ia?.provedores.find((p) => p.id === provedorId) ?? null;
  const podeImagem = provedor ? ["gpt", "gemini", "grok"].includes(modeloDe(provedor.tipo, provedor.url).id) : false;

  // Para quem pode gerar imagem, busca na conta a lista atual de modelos de imagem.
  const buscarModelosImagem = (id: string) => {
    setModelosImagem(null);
    return api.modelosImagemIa(id).then(
      (lista) => {
        setModelosImagem(lista);
        const guardado = lerModeloImagem(id);
        setModeloImagem(guardado && lista.includes(guardado) ? guardado : (lista[0] ?? null));
        if (!lista.length) setFundo((f) => (f === "png" ? "svg" : f));
      },
      () => setModelosImagem([]),
    );
  };

  useEffect(() => {
    setModelosImagem(null);
    setAtualizado(false);
    if (fundo === "png") setFundo("svg");
    if (!provedor || !podeImagem) return;
    void buscarModelosImagem(provedor.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provedorId]);

  if (!ia) return null;
  if (ia.provedores.length === 0) return <p className="texto-suave">{t.semProvedor}</p>;
  const seletor = <EscolherIaDaFuncao funcao="personalizacao" estado={ia} aoMudar={aoMudarIa} legenda={t.provedor} />;
  if (!provedor) {
    return (
      <section className="cartao compacto tema-ia" aria-labelledby="tema-ia-titulo">
        <h2 id="tema-ia-titulo" className="com-icone"><Sparkles aria-hidden="true" size="1em" /> {t.titulo}</h2>
        {seletor}
        <p className="texto-suave">{t.escolhaUmaIa}</p>
      </section>
    );
  }

  const temImagem = podeImagem && !!modelosImagem?.length;
  const fundos: TipoFundo[] = temImagem ? ["nenhum", "svg", "png"] : ["nenhum", "svg"];

  const pedir = async () => {
    if (!pedido.trim()) return;
    const este = ++pedidoAtual.current;
    setAviso(null);
    setFase("tema");
    try {
      const anterior = historico.length ? gravarArquivoTema(tema) : null;
      const resposta = await api.gerarTemaIa(provedor.id, pedido, anterior, fundo === "svg");
      if (este !== pedidoAtual.current) return;
      const { tema: novo, ajustado } = temaDaIa(resposta);
      let fundoNovo: Fundo | undefined = fundo === "svg" ? novo.fundoPadrao : undefined;
      if (fundo === "png" && modeloImagem) {
        setFase("imagem");
        const imagem = await api.gerarImagemIa(provedor.id, modeloImagem, historico.concat(pedido).join(". "));
        if (este !== pedidoAtual.current) return;
        fundoNovo = { tipo: "imagem", dados: await reduzirImagem(imagem), desfoque: 0, escurecimento: 0 };
      }
      // Fica o id do tema que está sendo editado; o resto vem da IA.
      aoAplicar({ ...novo, id: tema.id, fundoPadrao: fundoNovo ?? (fundo === "nenhum" ? { tipo: "cor" } : tema.fundoPadrao) });
      setHistorico((h) => [...h, pedido.trim()]);
      setPedido("");
      setAviso({ tipo: "ok", texto: ajustado ? t.aplicadoAjustado : t.aplicado });
    } catch (e) {
      if (este === pedidoAtual.current) setAviso({ tipo: "erro", texto: e instanceof ErroOrbita || e instanceof Error ? e.message : String(e) });
    } finally {
      if (este === pedidoAtual.current) setFase("parado");
    }
  };

  const ajustando = historico.length > 0;
  const nomeProvedor = provedor.nome;

  return (
    <section className="cartao compacto tema-ia" aria-labelledby="tema-ia-titulo">
      <h2 id="tema-ia-titulo" className="com-icone"><Sparkles aria-hidden="true" size="1em" /> {t.titulo}</h2>
      <p className="texto-suave">{t.explicacao}</p>
      {seletor}
      <p className="campo-ajuda">{podeImagem ? t.pode_png(nomeProvedor) : t.so_svg(nomeProvedor)}</p>
      <Segmentado<TipoFundo> rotulo={t.fundo} valor={fundo} opcoes={fundos.map((f) => ({ valor: f, nome: t.fundos[f] }))} aoMudar={setFundo} />
      {fundo === "png" && modelosImagem && modeloImagem && (
        <Escolha
          rotulo={t.modeloImagem}
          valor={modeloImagem}
          opcoes={modelosImagem.map((m) => ({ valor: m, nome: m }))}
          descricao={t.modeloImagemAjuda}
          aoMudar={(m) => (setModeloImagem(m), guardarModeloImagem(provedor.id, m))}
        />
      )}
      {podeImagem && (
        <div className="linha-ajuste">
          <p className="campo-ajuda" role="status">
            {modelosImagem === null
              ? t.conferindoImagem
              : modelosImagem.length
                ? `${t.quantosImagem(modelosImagem.length)}${atualizado ? ` ${t.listaAtualizada}` : ""}`
                : t.semImagem}
          </p>
          <Button
            className="botao com-icone"
            isDisabled={modelosImagem === null || fase !== "parado"}
            onPress={() => buscarModelosImagem(provedor.id).then(() => setAtualizado(true))}
          >
            <RefreshCw aria-hidden="true" size="1em" /> {t.atualizarImagem}
          </Button>
        </div>
      )}
      {ajustando && (
        <div className="grupo">
          <span className="campo-rotulo">{t.historico}</span>
          <ol className="lista-simples pequeno">{historico.map((h, i) => <li key={i}>{h}</li>)}</ol>
        </div>
      )}
      <Campo
        rotulo={ajustando ? t.ajuste : t.pedido}
        valor={pedido}
        aoMudar={setPedido}
        multilinha
        descricao={`${ajustando ? t.ajusteAjuda : t.pedidoAjuda} ${t.oQueVai(nomeProvedor)}`}
      />
      {fase !== "parado" && <p role="status">{fase === "imagem" ? t.criandoImagem(nomeProvedor) : t.criando(nomeProvedor)}</p>}
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      <div className="botoes">
        <Button className="botao principal com-icone" onPress={pedir} isDisabled={fase !== "parado" || !pedido.trim()}>
          <Sparkles aria-hidden="true" size="1em" /> {ajustando ? t.ajustar : t.criar}
        </Button>
        {ajustando && fase === "parado" && (
          <Button className="botao" onPress={() => (setHistorico([]), setAviso(null))}>{t.recomecar}</Button>
        )}
      </div>
      {(tema.fundoPadrao?.tipo === "svg" || tema.fundoPadrao?.tipo === "imagem") && (
        <div className="grupo">
          <span className="campo-rotulo">{t.fundoDoTema}</span>
          <div
            className="tema-ia-fundo"
            role="img"
            aria-label={t.fundoDoTema}
            style={
              tema.fundoPadrao.tipo === "imagem"
                ? { backgroundImage: `url("${tema.fundoPadrao.dados}")`, backgroundSize: "cover" }
                : { backgroundImage: svgComoUrl(tema.fundoPadrao.conteudo), backgroundRepeat: "repeat", backgroundColor: tema.claro.fundo }
            }
          />
        </div>
      )}
    </section>
  );
}
