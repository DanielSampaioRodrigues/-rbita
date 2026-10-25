import { limparDesenhoIcone, type Tema } from "@orbita/temas";
import { useRef, useState, type ComponentType } from "react";
import { Button } from "react-aria-components";
import { api, type EstadoIa } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { EstiloIconesLocal, NOMES_ICONES, TABELA, Wand2, type NomeIcone } from "../icones";
import * as TODOS from "../icones/lista";
import { SENTIDOS } from "../icones/sentidos";
import { textos } from "../textos/pt-BR";

const t = textos.iconesIa;
/** Cada ícone do Órbita pelo nome (o componente que já sabe usar desenhos próprios). */
const ICONES_POR_NOME = TODOS as unknown as Record<NomeIcone, ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" }>>;
/** Ícones por pedido: lotes pequenos desenham melhor e falham menos. */
const POR_LOTE = 12;

function lerResposta(texto: string): Record<string, string> {
  const i = texto.indexOf("{");
  const j = texto.lastIndexOf("}");
  if (i < 0 || j <= i) return {};
  try {
    const bruto = JSON.parse(texto.slice(i, j + 1)) as { icones?: Record<string, unknown> };
    const saida: Record<string, string> = {};
    for (const [nome, svg] of Object.entries(bruto.icones ?? {})) {
      if (!(nome in TABELA) || typeof svg !== "string") continue;
      const limpo = limparDesenhoIcone(svg);
      if (limpo) saida[nome] = limpo;
    }
    return saida;
  } catch {
    return {};
  }
}

/**
 * Experimental: a IA desenha todos os ícones do Órbita num estilo pedido.
 * Mostra antes de aplicar; o que ela não conseguir desenhar fica com o ícone pronto.
 */
export function DesenharIconesIa({ tema, aoAplicar, ia }: { tema: Tema; aoAplicar: (t: Tema) => void; ia: EstadoIa | null }) {
  // Usa a IA e o modelo de "Personalização", escolhidos no painel "Criar com IA".
  const provedorId = ia?.funcoes.personalizacao ?? null;
  const [estilo, setEstilo] = useState("");
  const [lote, setLote] = useState<{ atual: number; total: number } | null>(null);
  const [prontos, setProntos] = useState<Record<string, string> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pedidoAtual = useRef(0);

  const provedor = ia?.provedores.find((p) => p.id === provedorId) ?? null;
  if (!ia || !provedor) return null;
  const temDesenhos = !!tema.icones?.desenhos && Object.keys(tema.icones.desenhos).length > 0;

  const desenhar = async () => {
    const este = ++pedidoAtual.current;
    setErro(null);
    setProntos(null);
    const grupos: NomeIcone[][] = [];
    for (let i = 0; i < NOMES_ICONES.length; i += POR_LOTE) grupos.push(NOMES_ICONES.slice(i, i + POR_LOTE));
    const feitos: Record<string, string> = {};
    try {
      for (let g = 0; g < grupos.length; g++) {
        if (este !== pedidoAtual.current) return;
        setLote({ atual: g + 1, total: grupos.length });
        // Os primeiros desenhos vão junto como modelo, para todos ficarem da mesma família.
        const exemplos = Object.entries(feitos).slice(0, 4);
        const referencia = exemplos.length ? JSON.stringify(Object.fromEntries(exemplos)) : null;
        const resposta = await api.desenharIconesIa(provedor.id, estilo, grupos[g].map((n) => [n, SENTIDOS[n]]), referencia);
        Object.assign(feitos, lerResposta(resposta));
      }
      if (este !== pedidoAtual.current) return;
      if (Object.keys(feitos).length === 0) setErro(t.nenhum);
      else setProntos(feitos);
    } catch (e) {
      if (este === pedidoAtual.current) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (este === pedidoAtual.current) setLote(null);
    }
  };

  const icones = tema.icones ?? { traco: 2, pontas: "redondas" as const };

  return (
    <section className="cartao compacto tema-ia" aria-labelledby="icones-ia-titulo">
      <h2 id="icones-ia-titulo" className="com-icone"><Wand2 aria-hidden="true" size="1em" /> {t.titulo}</h2>
      <Aviso tipo="info">{t.aviso(provedor.nome)}</Aviso>
      <p className="campo-ajuda">{t.qualIa(provedor.nome, ia.modelos.personalizacao ?? provedor.modelo)}</p>
      <Campo rotulo={t.estilo} valor={estilo} aoMudar={setEstilo} descricao={t.estiloAjuda} maximo={600} />
      {lote && <p role="status">{t.desenhando(lote.atual, lote.total)}</p>}
      <Aviso>{erro}</Aviso>
      <div className="botoes">
        <Button className="botao principal com-icone" onPress={desenhar} isDisabled={!!lote || !estilo.trim()}>
          <Wand2 aria-hidden="true" size="1em" /> {t.desenhar}
        </Button>
        {lote && <Button className="botao" onPress={() => (pedidoAtual.current++, setLote(null))}>{textos.comum.cancelar}</Button>}
        {temDesenhos && !lote && (
          <Button className="botao" onPress={() => aoAplicar({ ...tema, icones: { ...icones, desenhos: undefined } })}>{t.voltarProntos}</Button>
        )}
      </div>

      {prontos && (
        <div className="grupo">
          <p>{t.resultado(Object.keys(prontos).length, NOMES_ICONES.length)}</p>
          <EstiloIconesLocal.Provider value={{ ...icones, desenhos: prontos }}>
            <ul className="grade-icones-ia" aria-label={t.previa}>
              {NOMES_ICONES.map((n) => {
                const Icone = TABELA[n][0];
                const Desenhado = ICONES_POR_NOME[n];
                return (
                  <li key={n} title={SENTIDOS[n]} className={prontos[n] ? "" : "faltou"}>
                    {prontos[n] ? <Desenhado aria-hidden="true" size={24} /> : <Icone aria-hidden="true" size={24} />}
                    <span className="visualmente-oculto">{SENTIDOS[n]}</span>
                  </li>
                );
              })}
            </ul>
          </EstiloIconesLocal.Provider>
          <div className="botoes">
            <Button className="botao principal" onPress={() => (aoAplicar({ ...tema, icones: { ...icones, desenhos: prontos } }), setProntos(null))}>{t.usar}</Button>
            <Button className="botao" onPress={() => setProntos(null)}>{t.descartar}</Button>
          </div>
        </div>
      )}
    </section>
  );
}
