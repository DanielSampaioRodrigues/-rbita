// Aviso discreto da sincronização, ao lado das setas de navegação (aparece também com o
// menu recolhido). Sem animação e sem som (princípio 2): só o texto muda. Toque abre um
// painel pequeno com a última vez e o botão "Sincronizar agora".
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogTrigger, Heading, Popover } from "react-aria-components";
import { Cloud, CloudUpload, RefreshCw, TriangleAlert } from "../icones";
import { textos } from "../textos/pt-BR";
import type { Fase } from "./maestro";
import { useSincronia } from "./ProvedorSincronia";
import { quandoFoi, rotuloDoAviso } from "./rotulo";

const t = textos.sincronia;
/** "Sincronizando…" só aparece se o ciclo passa disso (os de todo minuto são rápidos). */
const DEMORA_MS = 1_200;

const EXPLICA: Partial<Record<Fase, string>> = {
  ok: t.explicaOk,
  "sem-internet": t.explicaSemInternet,
  "entrar-de-novo": t.explicaEntrar,
  erro: t.explicaErro,
};

export function AvisoSincronia() {
  const { ligada, estado, sincronizarAgora } = useSincronia();
  const [agora, setAgora] = useState(Date.now);
  const [demorando, setDemorando] = useState(false);
  const [pedido, setPedido] = useState(false);

  // O "há 1 min" anda sozinho, sem pressa.
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setAgora(Date.now());
    if (estado.fase !== "sincronizando") return setDemorando(false);
    const id = setTimeout(() => setDemorando(true), DEMORA_MS);
    return () => clearTimeout(id);
  }, [estado]);

  // Leitor de tela: avisa quando o tipo de estado muda, não a cada minuto que passa
  // (nem o primeiro "sincronizado" ao abrir, só a volta depois de um problema).
  const [anuncio, setAnuncio] = useState("");
  const faseAnunciada = useRef<Fase | null>(null);
  useEffect(() => {
    if (estado.fase === "sincronizando" || estado.fase === faseAnunciada.current) return;
    const antes = faseAnunciada.current;
    faseAnunciada.current = estado.fase;
    if (estado.fase === "ok") {
      if (antes === "sem-internet" || antes === "erro" || antes === "entrar-de-novo") setAnuncio(t.agora);
      return;
    }
    if (estado.fase !== "parado" && estado.fase !== "sem-chave") setAnuncio(rotuloDoAviso(estado, Date.now(), false));
  }, [estado]);

  // Durante um ciclo rápido, continua mostrando o estado de antes (nada pisca a cada minuto).
  const estavel = useRef<Fase>("ok");
  if (estado.fase !== "sincronizando") estavel.current = estado.fase;
  if (!ligada) return null;
  const mostrarCiclo = estado.fase === "sincronizando" && (demorando || pedido || estado.ultima === null);
  const visto = mostrarCiclo || estado.fase !== "sincronizando" ? estado : { ...estado, fase: estavel.current };
  const rotulo = rotuloDoAviso(visto, agora, mostrarCiclo);
  const f = visto.fase;
  const Icone = mostrarCiclo ? RefreshCw : f === "sem-internet" ? CloudUpload : f === "erro" || f === "entrar-de-novo" ? TriangleAlert : Cloud;
  const atencao = !mostrarCiclo && (f === "erro" || f === "entrar-de-novo" || f === "sem-internet");
  const explica = EXPLICA[f === "sincronizando" ? (estado.ultima ? "ok" : "parado") : f];

  const agoraSim = async () => {
    setPedido(true);
    try {
      await sincronizarAgora();
    } finally {
      setPedido(false);
    }
  };

  return (
    <div className="sinc-aviso">
      <span className="visualmente-oculto" role="status" aria-live="polite">
        {anuncio}
      </span>
      <DialogTrigger>
        <Button className={`sinc-botao${atencao ? " atencao" : ""}`} aria-label={t.abrirDetalhes(rotulo)}>
          <Icone aria-hidden="true" size="1em" strokeWidth={1.75} />
          <span className="sinc-texto">{rotulo}</span>
        </Button>
        <Popover className="menu-popover sinc-painel" placement="bottom start">
          <Dialog className="sinc-dialogo" aria-labelledby="sinc-titulo">
            <Heading slot="title" id="sinc-titulo" className="sinc-titulo">
              {t.titulo}
            </Heading>
            <p className="sinc-estado">{rotulo}</p>
            <p className="texto-suave pequeno">{estado.ultima ? t.ultimaVez(quandoFoi(estado.ultima, agora)) : t.nuncaAinda}</p>
            {explica && <p className="texto-suave pequeno">{explica}</p>}
            {/* Não desabilita durante o ciclo: o foco ficaria perdido fora do painel. */}
            <Button className="botao" onPress={() => void (pedido || agoraSim())}>
              <RefreshCw aria-hidden="true" size="1em" />
              {pedido ? t.sincronizando : t.sincronizarAgora}
            </Button>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  );
}
