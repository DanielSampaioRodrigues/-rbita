import { useEffect, useRef } from "react";
import { chaveDia } from "../agenda/datas";
import { api, type DoseDoDia } from "../api";
import { useMudancas } from "../dados";
import { notificar } from "../notificar";
import { textos } from "../textos/pt-BR";

const t = textos.saude.lembrete;
const CHAVE_AVISADOS = "orbita.remedios.avisados";

function lerAvisados(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_AVISADOS) ?? "[]"));
  } catch {
    return new Set();
  }
}

/** Hora do dia ("HH:MM") em milissegundos desde o começo de hoje. */
function minutosDoDia(horario: string): number | null {
  const [h, m] = horario.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  return h * 60 + m;
}

/**
 * Lembra do remédio na hora cadastrada, uma vez por dose e dia. Como os avisos
 * de compromisso, só funciona com o Órbita aberto e desbloqueado (os remédios
 * ficam no cofre). Com a bandeja ligada, a janela escondida continua avisando.
 */
export function LembretesRemedio({ aberto }: { aberto: boolean }) {
  const doses = useRef<DoseDoDia[]>([]);
  const avisados = useRef(lerAvisados());
  const mudancas = useMudancas();

  // Recarrega as doses de hoje de tempos em tempos (e quando algo muda).
  useEffect(() => {
    if (!aberto) return;
    const buscar = () => {
      api.dosesDoDia(chaveDia(new Date())).then((ds) => (doses.current = ds), () => {});
    };
    buscar();
    const intervalo = setInterval(buscar, 5 * 60_000);
    return () => clearInterval(intervalo);
  }, [aberto, mudancas]);

  // Confere a cada 30 segundos se chegou a hora de algum remédio ainda não tomado.
  useEffect(() => {
    if (!aberto) return;
    const conferir = () => {
      const agora = new Date();
      const hoje = chaveDia(agora);
      const agoraMin = agora.getHours() * 60 + agora.getMinutes();
      for (const d of doses.current) {
        if (d.tomada) continue;
        const alvo = minutosDoDia(d.horario);
        if (alvo === null) continue;
        const atraso = agoraMin - alvo; // minutos desde a hora marcada
        const chave = `${d.remedioId}|${d.horario}|${hoje}`;
        // Avisa da hora marcada até 2 minutos depois, uma vez só.
        if (atraso >= 0 && atraso <= 2 && !avisados.current.has(chave)) {
          avisados.current.add(chave);
          try {
            localStorage.setItem(CHAVE_AVISADOS, JSON.stringify([...avisados.current].slice(-200)));
          } catch {
            // Sem armazenamento: no pior caso, avisa de novo depois de reabrir.
          }
          void notificar(t.titulo(d.nome), t.corpo(d.dose));
        }
      }
    };
    conferir();
    const intervalo = setInterval(conferir, 30_000);
    return () => clearInterval(intervalo);
  }, [aberto, mudancas]);

  return null;
}
