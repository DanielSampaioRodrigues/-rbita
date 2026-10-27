import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { api, ErroOrbita, type EstadoIa } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Escolha } from "../componentes/Escolha";
import { Segmentado } from "../componentes/Segmentado";
import { Sparkles } from "../icones";
import { EscolherIaDaFuncao } from "../ia/AjustesIa";
import { maisNovos } from "../ia/modelos";
import { modeloDe } from "../ia/provedores";
import { textos } from "../textos/pt-BR";

const t = textos.caderno.imagemIa;
type Tipo = "imagem" | "adesivo";
type Cores = "suaves" | "vivas";

const chaveModelo = (id: string) => `orbita.modeloImagem.${id}`;
const ler = (c: string) => { try { return localStorage.getItem(c); } catch { return null; } };
const guardar = (c: string, v: string) => { try { localStorage.setItem(c, v); } catch { /* sessão */ } };

/** Painel de IA generativa do caderno: cria uma imagem ou adesivo e, só depois
 *  de a pessoa aprovar a prévia, insere na página. A IA é opcional. */
export function CriarImagemIa({ ia, aoMudarIa, aoInserir }: {
  ia: EstadoIa | null; aoMudarIa: (e: EstadoIa) => void; aoInserir: (dataUrl: string, tipo: Tipo) => Promise<void> | void;
}) {
  const provedorId = ia?.funcoes.personalizacao ?? null;
  const provedor = ia?.provedores.find((p) => p.id === provedorId) ?? null;
  const podeImagem = provedor ? ["gpt", "gemini", "grok"].includes(modeloDe(provedor.tipo, provedor.url).id) : false;

  const [modelos, setModelos] = useState<string[] | null>(null);
  const [modelo, setModelo] = useState<string | null>(null);
  const [tipo, setTipo] = useState<Tipo>("imagem");
  const [cores, setCores] = useState<Cores>(() => (ler("orbita.coresImagem") === "vivas" ? "vivas" : "suaves"));
  const [pedido, setPedido] = useState("");
  const [fase, setFase] = useState<"parado" | "criando" | "inserindo">("parado");
  const [previa, setPrevia] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const pedidoAtual = useRef(0);

  useEffect(() => {
    setModelos(null);
    setModelo(null);
    if (!provedor || !podeImagem) return;
    let vivo = true;
    api.modelosImagemIa(provedor.id).then(
      (lista) => {
        if (!vivo) return;
        setModelos(lista);
        const guardado = ler(chaveModelo(provedor.id));
        const curta = maisNovos(lista, [], true);
        setModelo(guardado && lista.includes(guardado) ? guardado : curta.find((m) => !/latest|mini|lite|fast/.test(m)) ?? curta[0] ?? null);
      },
      () => vivo && setModelos([]),
    );
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provedorId]);

  if (!ia || ia.provedores.length === 0) return <p className="texto-suave">{t.semProvedor}</p>;

  const seletor = <EscolherIaDaFuncao funcao="personalizacao" estado={ia} aoMudar={aoMudarIa} legenda={t.provedor} />;
  if (!provedor) return <div className="formulario">{seletor}<p className="texto-suave">{t.escolhaUmaIa}</p></div>;

  const criar = async () => {
    if (!pedido.trim() || !modelo) return;
    const este = ++pedidoAtual.current;
    setAviso(null);
    setPrevia(null);
    setFase("criando");
    try {
      const extra = tipo === "adesivo"
        ? ". Estilo de adesivo (sticker): ilustração simples e limpa, com contorno, fundo transparente, sem texto."
        : "";
      const url = await api.gerarImagemIa(provedor.id, modelo, pedido.trim() + extra, false, cores === "vivas");
      if (este !== pedidoAtual.current) return;
      setPrevia(url);
    } catch (e) {
      if (este === pedidoAtual.current) setAviso({ tipo: "erro", texto: e instanceof ErroOrbita || e instanceof Error ? e.message : String(e) });
    } finally {
      if (este === pedidoAtual.current) setFase("parado");
    }
  };

  const inserir = async () => {
    if (!previa) return;
    setFase("inserindo");
    try {
      await aoInserir(previa, tipo);
      setPrevia(null);
      setPedido("");
      setAviso({ tipo: "ok", texto: t.inserir });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof ErroOrbita || e instanceof Error ? e.message : String(e) });
    } finally {
      setFase("parado");
    }
  };

  const nome = provedor.nome;
  return (
    <div className="formulario">
      {seletor}
      {!podeImagem ? (
        <p className="campo-ajuda">{t.semImagem}</p>
      ) : modelos === null ? (
        <p className="campo-ajuda" role="status">{t.conferindo}</p>
      ) : !modelos.length ? (
        <p className="campo-ajuda">{t.semImagem}</p>
      ) : (
        <>
          <Segmentado<Tipo> rotulo={t.tipo} valor={tipo} opcoes={[{ valor: "imagem", nome: t.tipos.imagem }, { valor: "adesivo", nome: t.tipos.adesivo }]} aoMudar={setTipo} />
          <p className="campo-ajuda">{t.tipoAjuda}</p>
          {modelo && (
            <Escolha rotulo={t.modelo} valor={modelo} opcoes={maisNovos(modelos, [modelo], true).map((m) => ({ valor: m, nome: m }))} aoMudar={(m) => (setModelo(m), guardar(chaveModelo(provedor.id), m))} />
          )}
          <Segmentado<Cores> rotulo={t.cores} valor={cores} opcoes={[{ valor: "suaves", nome: t.coresOpcoes.suaves }, { valor: "vivas", nome: t.coresOpcoes.vivas }]} aoMudar={(c) => (setCores(c), guardar("orbita.coresImagem", c))} />
          <Campo rotulo={t.pedido} valor={pedido} aoMudar={setPedido} multilinha descricao={t.pedidoAjuda} />
          {fase === "criando" && <p role="status">{t.criando(nome)}</p>}
          {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
          {previa && (
            <div className="grupo">
              <span className="campo-rotulo">{t.previa}</span>
              <img className="caderno-ia-previa" src={previa} alt={t.previa} />
            </div>
          )}
          <div className="botoes">
            {previa ? (
              <>
                <Button className="botao principal com-icone" onPress={() => void inserir()} isDisabled={fase !== "parado"}><Sparkles aria-hidden="true" size="1em" /> {t.inserir}</Button>
                <Button className="botao" onPress={() => void criar()} isDisabled={fase !== "parado" || !pedido.trim()}>{t.criarOutra}</Button>
              </>
            ) : (
              <Button className="botao principal com-icone" onPress={() => void criar()} isDisabled={fase !== "parado" || !pedido.trim() || !modelo}><Sparkles aria-hidden="true" size="1em" /> {t.criar}</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
