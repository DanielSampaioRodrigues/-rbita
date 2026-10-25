import { Mic, Square } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "react-aria-components";
import { api, ErroOrbita } from "../api";
import { Aviso } from "../componentes/Campo";
import { textos } from "../textos/pt-BR";
import { JanelaRevisao } from "./JanelaRevisao";
import { marcarGravando, useRecursos } from "./recursos";

const t = textos.ditado;

type Fase = "parado" | "gravando" | "transcrevendo";

/** Junta o texto ditado ao que já estava no campo. */
export function juntarDitado(antes: string, ditado: string): string {
  const a = antes.trimEnd();
  if (!a) return ditado;
  const fimDeFrase = /[.!?]$/.test(a);
  const novo = fimDeFrase ? ditado.charAt(0).toUpperCase() + ditado.slice(1) : ditado;
  return `${a} ${novo}`;
}

/**
 * Microfone de um campo de texto: grava, transcreve no computador e junta ao
 * texto. Depois oferece desfazer e, com a IA de revisão escolhida, revisar.
 * Devolve o botão (vai dentro do campo), a linha de situação (vai embaixo) e
 * o tratamento de teclas (Ctrl + Shift + M e Esc).
 */
export function useDitar(valor: string, aoMudar: (v: string) => void, ativo: boolean) {
  const recursos = useRecursos();
  const id = useId();
  const [fase, setFase] = useState<Fase>("parado");
  const [erro, setErro] = useState<string | null>(null);
  /** Valor antes do último ditado (para desfazer) e depois (para saber se a pessoa mexeu). */
  const [ultimo, setUltimo] = useState<{ antes: string; depois: string } | null>(null);
  const [revisando, setRevisando] = useState<string | null>(null);
  const valorAtual = useRef(valor);
  valorAtual.current = valor;
  const recursosGravandoAqui = useRef(false);
  const ancora = useRef<HTMLDivElement>(null);

  const disponivel = ativo && !!recursos.ditado?.instalado;
  const outroGravando = recursos.gravandoEm !== null && recursos.gravandoEm !== id;

  // Se a pessoa digitar depois do ditado, as ações de desfazer e revisar somem.
  useEffect(() => {
    if (ultimo && valor !== ultimo.depois) setUltimo(null);
  }, [valor, ultimo]);

  // Ao sair da tela gravando, a gravação é descartada.
  useEffect(
    () => () => {
      if (recursosGravandoAqui.current) {
        void api.ditadoDescartar();
        marcarGravando(null);
      }
    },
    [],
  );

  const comecar = async () => {
    setErro(null);
    setUltimo(null);
    try {
      await api.ditadoComecar();
      recursosGravandoAqui.current = true;
      marcarGravando(id);
      setFase("gravando");
    } catch (e) {
      setErro(e instanceof ErroOrbita ? e.message : String(e));
    }
  };

  const parar = async () => {
    setFase("transcrevendo");
    try {
      const texto = await api.ditadoParar();
      const antes = valorAtual.current;
      const depois = juntarDitado(antes, texto);
      aoMudar(depois);
      setUltimo({ antes, depois });
    } catch (e) {
      setErro(e instanceof ErroOrbita ? e.message : String(e));
    } finally {
      recursosGravandoAqui.current = false;
      marcarGravando(null);
      setFase("parado");
    }
  };

  const cancelar = async () => {
    await api.ditadoDescartar();
    recursosGravandoAqui.current = false;
    marcarGravando(null);
    setFase("parado");
  };

  const alternar = () => (fase === "gravando" ? parar() : fase === "parado" && !outroGravando ? comecar() : undefined);

  // O React Aria segura as teclas no campo quando há um tratamento próprio; as
  // que não são do ditado seguem adiante (Esc fecha janelas, atalhos gerais).
  const aoTeclar = (e: KeyboardEvent & { continuePropagation?: () => void }) => {
    if (disponivel && e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === "m") {
      e.preventDefault();
      void alternar();
    } else if (disponivel && e.key === "Escape" && fase === "gravando") {
      e.preventDefault();
      void cancelar();
    } else {
      e.continuePropagation?.();
    }
  };

  const botao = disponivel ? (
    <Button
      className={fase === "gravando" ? "entrada-botao gravando" : "entrada-botao"}
      onPress={alternar}
      isDisabled={fase === "transcrevendo" || outroGravando}
      aria-label={fase === "gravando" ? t.parar : t.ditar}
      aria-pressed={fase === "gravando"}
    >
      {fase === "gravando" ? <Square aria-hidden="true" size="1em" /> : <Mic aria-hidden="true" size="1.1em" />}
    </Button>
  ) : null;

  // Desfazer e revisar fazem os próprios botões sumirem: o foco volta ao campo,
  // senão quem usa teclado fica sem ponto de partida (e o Esc para de fechar a janela).
  const focarCampo = () =>
    setTimeout(() => ancora.current?.closest(".campo")?.querySelector<HTMLElement>("input, textarea")?.focus(), 0);

  const situacao = disponivel ? (
    <div ref={ancora} className="ditado-ancora">
      {fase === "gravando" && <p className="ditado-situacao gravando" role="status">{t.gravando}</p>}
      {fase === "transcrevendo" && <p className="ditado-situacao" role="status">{t.transcrevendo}</p>}
      {erro && <Aviso>{erro}</Aviso>}
      {ultimo && fase === "parado" && (
        <div className="botoes ditado-acoes">
          {recursos.revisor && (
            <Button className="botao pequeno" onPress={() => setRevisando(valorAtual.current)}>{t.revisar}</Button>
          )}
          <Button className="botao pequeno" onPress={() => (aoMudar(ultimo.antes), setUltimo(null), focarCampo())}>{t.desfazer}</Button>
        </div>
      )}
      {recursos.revisor && (
        <JanelaRevisao
          texto={revisando}
          revisor={recursos.revisor}
          bloquearSensivel={recursos.bloquearSensivel}
          aoFechar={() => (setRevisando(null), focarCampo())}
          aoUsar={(revisado) => {
            aoMudar(revisado);
            setUltimo(null);
            setRevisando(null);
            focarCampo();
          }}
        />
      )}
    </div>
  ) : null;

  return { botao, situacao, aoTeclar };
}
