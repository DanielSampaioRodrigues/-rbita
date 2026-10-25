import { Plus, X } from "../icones";
import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, Input, TextField } from "react-aria-components";
import { api, ErroOrbita, type ProvedorVisivel } from "../api";
import { Aviso } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";

const t = textos.ia;

type Fase = { tipo: "inicio" } | { tipo: "pedindo" } | { tipo: "erro"; texto: string } | { tipo: "escolher" };
interface Linha {
  chave: number;
  texto: string;
  incluir: boolean;
}

/**
 * A IA sugere passos para um projeto (vira etapas) ou uma etapa (vira subtarefas).
 * Primeiro mostra o que vai ser enviado; depois a pessoa marca, edita e confirma.
 * Só o que foi confirmado é gravado.
 */
export function JanelaPassos({
  alvo,
  provedor,
  aoFechar,
  aoAdicionar,
}: {
  /** null = janela fechada. */
  alvo: { id: string; titulo: string; projeto: boolean } | null;
  provedor: ProvedorVisivel;
  aoFechar: () => void;
  aoAdicionar: (quantos: number) => void;
}) {
  const [fase, setFase] = useState<Fase>({ tipo: "inicio" });
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [gravando, setGravando] = useState(false);
  // Uma resposta que chega depois de cancelar (ou de pedir de novo) é ignorada.
  const pedidoAtual = useRef(0);

  useEffect(() => {
    pedidoAtual.current++;
    if (alvo) {
      setFase({ tipo: "inicio" });
      setLinhas([]);
    }
  }, [alvo]);

  const pedir = async () => {
    if (!alvo) return;
    const este = ++pedidoAtual.current;
    setFase({ tipo: "pedindo" });
    try {
      const s = await api.sugerirPassosIa(alvo.id);
      if (este !== pedidoAtual.current) return;
      setLinhas(s.passos.map((texto, i) => ({ chave: i, texto, incluir: true })));
      setFase({ tipo: "escolher" });
    } catch (e) {
      if (este === pedidoAtual.current) setFase({ tipo: "erro", texto: e instanceof ErroOrbita ? e.message : String(e) });
    }
  };

  const mudar = (chave: number, parte: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...parte } : l)));
  const escolhidas = linhas.filter((l) => l.incluir && l.texto.trim());

  const adicionar = async () => {
    if (!alvo) return;
    setGravando(true);
    try {
      for (const l of escolhidas) await api.criarTarefa(alvo.id, l.texto.trim());
      aoAdicionar(escolhidas.length);
    } catch (e) {
      setFase({ tipo: "erro", texto: e instanceof ErroOrbita ? e.message : String(e) });
    } finally {
      setGravando(false);
    }
  };

  return (
    <Janela titulo={alvo ? t.passosTitulo(alvo.titulo, alvo.projeto) : ""} aberta={alvo !== null} aoFechar={aoFechar}>
      {fase.tipo === "inicio" && (
        <>
          <p>{t.oQueVai(provedor.nome, provedor.local, alvo?.projeto ?? false)}</p>
          <div className="janela-acoes">
            <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
            <Button className="botao principal" onPress={pedir} autoFocus>{alvo?.projeto ? t.sugerirEtapas : t.sugerirPassos}</Button>
          </div>
        </>
      )}
      {fase.tipo === "pedindo" && (
        <>
          <p role="status">{t.pedindo(provedor.nome)}</p>
          {provedor.local && <p className="texto-suave">{t.pedindoLocal}</p>}
          <div className="janela-acoes">
            <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
          </div>
        </>
      )}
      {fase.tipo === "erro" && (
        <>
          <Aviso>{fase.texto}</Aviso>
          <div className="janela-acoes">
            <Button className="botao" onPress={aoFechar}>{textos.comum.fechar}</Button>
            <Button className="botao principal" onPress={pedir} autoFocus>{t.tentarDeNovo}</Button>
          </div>
        </>
      )}
      {fase.tipo === "escolher" && (
        <>
          <p className="texto-suave">{t.escolhaPassos}</p>
          <ul className="lista-passos-ia">
            {linhas.map((l, i) => (
              <li key={l.chave} className="passo-ia">
                <Checkbox className="caixa estreita" isSelected={l.incluir} onChange={(incluir) => mudar(l.chave, { incluir })} aria-label={t.incluir(l.texto || t.passo(i + 1))}>
                  <span className="caixa-quadrado" aria-hidden="true">
                    <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                  </span>
                </Checkbox>
                <TextField className="passo-ia-texto" value={l.texto} onChange={(texto) => mudar(l.chave, { texto })} aria-label={t.passo(i + 1)} autoFocus={i === 0}>
                  <Input className={l.incluir ? "entrada-texto sozinha" : "entrada-texto sozinha desmarcado"} maxLength={200} />
                </TextField>
                <Button className="botao-icone" onPress={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))} aria-label={t.tirar(i + 1)}>
                  <X aria-hidden="true" size="1.1em" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="botoes">
            <Button className="botao com-icone" onPress={() => setLinhas((ls) => [...ls, { chave: Date.now(), texto: "", incluir: true }])}>
              <Plus aria-hidden="true" size="1em" /> {t.maisUm}
            </Button>
          </div>
          <div className="janela-acoes">
            <Button className="botao separado" onPress={pedir}>{t.tentarDeNovo}</Button>
            <Button className="botao" onPress={aoFechar}>{t.descartar}</Button>
            <Button className="botao principal" isDisabled={gravando || escolhidas.length === 0} onPress={adicionar}>
              {t.adicionarPassos(escolhidas.length)}
            </Button>
          </div>
        </>
      )}
    </Janela>
  );
}
