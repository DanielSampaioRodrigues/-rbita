import { Check } from "../icones";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, ToggleButton } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { Segmentado } from "../componentes/Segmentado";
import { usePreferencias } from "../estado";
import { LEMBRETES_CORPO, type LembreteCorpo as Intervalo } from "../preferencias";
import { textos } from "../textos/pt-BR";
import { useLoja } from "../valores";
import { avancarRelogio, COISAS_DO_CORPO, corpoDoDia, lojaCorpo, marcarCorpo, type CoisaDoCorpo } from "./corpo";
import { juntar } from "./semanaDados";

const t = textos.energia.corpo;

/**
 * Faixa discreta "Como está o corpo?", de tempos em tempos (desligada por padrão).
 * Nunca usa notificação do sistema, não rouba o foco e não faz som. Só conta o
 * tempo com o cofre aberto. Fica no fim da página (último na ordem do Tab).
 */
export function LembreteCorpo({ aberto }: { aberto: boolean }) {
  const { prefs } = usePreferencias();
  const minutos = prefs.lembreteCorpo;
  const [visivel, setVisivel] = useState(false);
  const [agora, setAgora] = useState<CoisaDoCorpo[]>([]);
  const acumulado = useRef(0);
  const ultimo = useRef(Date.now());

  // Mudou o intervalo (ou desligou): começa a contar do zero.
  useEffect(() => {
    acumulado.current = 0;
    setVisivel(false);
    setAgora([]);
  }, [minutos]);

  useEffect(() => {
    if (!aberto || minutos === 0) return;
    ultimo.current = Date.now(); // o tempo com o cofre bloqueado não conta
    const passo = () => {
      const instante = Date.now();
      acumulado.current = avancarRelogio(acumulado.current, instante - ultimo.current);
      ultimo.current = instante;
      if (acumulado.current >= minutos * 60_000) setVisivel(true);
    };
    const id = setInterval(passo, 30_000);
    return () => clearInterval(id);
  }, [aberto, minutos]);

  if (!aberto || minutos === 0 || typeof document === "undefined") return null;

  const fechar = () => {
    acumulado.current = 0;
    setVisivel(false);
    setAgora([]);
  };
  const marcar = (coisa: CoisaDoCorpo) => {
    if (agora.includes(coisa)) return;
    lojaCorpo.mudar((d) => marcarCorpo(d, coisa, Date.now()));
    setAgora((a) => [...a, coisa]);
  };

  return createPortal(
    <>
      <p className="visualmente-oculto" role="status">
        {visivel ? (agora.length ? t.anotado(juntar(agora.map((c) => t.coisas[c].toLowerCase()))) : t.pergunta) : ""}
      </p>
      {visivel && (
        <section className="energia-corpo-faixa" aria-label={t.pergunta}>
          <p className="energia-corpo-pergunta" aria-hidden="true">
            {t.pergunta}
          </p>
          <div className="energia-corpo-botoes">
            {COISAS_DO_CORPO.map((c) => (
              <ToggleButton
                key={c}
                className="energia-corpo-coisa energia-alvo"
                isSelected={agora.includes(c)}
                onChange={() => marcar(c)}
                aria-label={t.fala[c]}
              >
                {agora.includes(c) && <Check aria-hidden="true" size="1em" />}
                {t.coisas[c]}
              </ToggleButton>
            ))}
            <Button className="botao energia-alvo energia-corpo-fechar" onPress={fechar}>
              {agora.length ? t.pronto : t.agoraNao}
            </Button>
          </div>
        </section>
      )}
    </>,
    document.body,
  );
}

/** Na página de Energia: ligar o lembrete e escolher de quanto em quanto tempo. */
export function AjusteLembreteCorpo() {
  const { prefs, mudar } = usePreferencias();
  const dados = useLoja(lojaCorpo);
  const hoje = corpoDoDia(dados, chaveDia(new Date()));

  return (
    <section className="cartao largura-leitura esticado energia-corpo" aria-labelledby="energia-corpo-titulo">
      <h2 id="energia-corpo-titulo">{t.titulo}</h2>
      <p className="campo-ajuda">{t.explicacao}</p>
      <Segmentado
        rotulo={t.intervalo}
        valor={String(prefs.lembreteCorpo)}
        opcoes={LEMBRETES_CORPO.map((m) => ({ valor: String(m), nome: t.opcoes[String(m)] }))}
        aoMudar={(v) => mudar({ lembreteCorpo: Number(v) as Intervalo })}
      />
      {hoje.length > 0 && <p className="texto-suave">{t.hoje(juntar(hoje.map((x) => t.vezes(t.coisas[x.coisa], x.vezes))))}</p>}
    </section>
  );
}
