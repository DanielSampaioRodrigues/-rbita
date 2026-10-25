import { BellRing } from "../icones";
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { expandir, somarDias, type Ocorrencia } from "../agenda/datas";
import { api } from "../api";
import { useMudancas } from "../dados";
import { notificar } from "../notificar";
import type { Preferencias } from "../preferencias";
import { textos } from "../textos/pt-BR";

const t = textos.avisos;
const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const CHAVE_AVISADOS = "orbita.avisados";

function lerAvisados(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_AVISADOS) ?? "[]"));
  } catch {
    return new Set();
  }
}

/**
 * Avisa antes de cada compromisso (uma vez só por compromisso e dia).
 * Só funciona com o Órbita aberto e desbloqueado: a agenda fica no cofre.
 */
export function AvisosDeTransicao({ config, aberto }: { config: Preferencias["avisos"]; aberto: boolean }) {
  const [aviso, setAviso] = useState<Ocorrencia | null>(null);
  const [proximos, setProximos] = useState<Ocorrencia[]>([]);
  const avisados = useRef(lerAvisados());
  const mudancas = useMudancas();

  // Busca os compromissos das próximas horas de tempos em tempos.
  useEffect(() => {
    if (!aberto || !config.ligado) return;
    const buscar = () => {
      const de = new Date();
      const ate = somarDias(de, 1);
      api.listarEventos(de.getTime() - 3_600_000, ate.getTime()).then(
        (es) => setProximos(expandir(es, new Date(de.getTime() - 3_600_000), ate).filter((o) => !o.evento.diaInteiro)),
        () => {},
      );
    };
    buscar();
    const intervalo = setInterval(buscar, 5 * 60_000);
    return () => clearInterval(intervalo);
  }, [aberto, config.ligado, mudancas]);

  // Confere a cada 20 segundos se algum compromisso está chegando.
  useEffect(() => {
    if (!aberto || !config.ligado) return;
    const conferir = () => {
      const agora = Date.now();
      for (const o of proximos) {
        const chave = `${o.evento.id}|${o.dia}`;
        const falta = o.inicio.getTime() - agora;
        if (falta <= config.minutos * 60_000 && falta > -60_000 && !avisados.current.has(chave)) {
          avisados.current.add(chave);
          try {
            localStorage.setItem(CHAVE_AVISADOS, JSON.stringify([...avisados.current].slice(-200)));
          } catch {
            // Sem armazenamento: no pior caso, avisa de novo depois de reabrir.
          }
          setAviso(o);
          if (config.notificacao) {
            const minutos = Math.max(0, Math.round(falta / 60_000));
            void notificar(t.daquiA(minutos, o.evento.titulo), t.as(fmtHora.format(o.inicio)));
          }
        }
      }
    };
    conferir();
    const intervalo = setInterval(conferir, 20_000);
    return () => clearInterval(intervalo);
  }, [aberto, config, proximos]);

  if (!aviso) return null;
  const minutos = Math.max(0, Math.round((aviso.inicio.getTime() - Date.now()) / 60_000));
  return (
    <div className="aviso-transicao" role="status">
      <BellRing aria-hidden="true" size="1.2em" />
      <p>
        <strong>{t.daquiA(minutos, aviso.evento.titulo)}</strong> {t.as(fmtHora.format(aviso.inicio))}
      </p>
      <Button className="botao" onPress={() => setAviso(null)}>{t.ok}</Button>
    </div>
  );
}
