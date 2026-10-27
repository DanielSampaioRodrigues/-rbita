// Editor da capa: a pessoa escreve um título sobre a capa escolhida, escolhe
// fonte, cor, tamanho e posição (arrastando). O pincel entra no próximo passo.
import { useRef } from "react";
import { Button } from "react-aria-components";
import { FONTES } from "../preferencias";
import { AlignCenter, AlignLeft, AlignRight, Bold, Plus, Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";
import type { AlinharTexto } from "@orbita/caderno";
import { fonteCapaCss, tituloPadrao, type CenaCapa, type TituloCapa } from "./capa";

const t = textos.caderno.capaEditor;
const FONTES_CAPA: { chave: string; nome: string }[] = [
  { chave: "", nome: t.fontePadrao },
  ...Object.entries(FONTES).map(([chave, f]) => ({ chave, nome: f.nome })),
];

const alinhaCss = (a?: AlinharTexto): "left" | "center" | "right" => (a === "esquerda" ? "left" : a === "direita" ? "right" : "center");

/** Desenha o título sobre a capa. Em `arrastavel`, pode ser movido com o ponteiro. */
export function RenderCapaCena({ cena, aoMover }: { cena: CenaCapa; aoMover?: (x: number, y: number) => void }) {
  const tit = cena.titulo;
  const ref = useRef<HTMLSpanElement>(null);
  if (!tit?.texto.trim()) return null;
  const arrastar = (e: React.PointerEvent) => {
    if (!aoMover) return;
    const pai = ref.current?.offsetParent as HTMLElement | null;
    if (!pai) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const mover = (ev: PointerEvent) => {
      const r = pai.getBoundingClientRect();
      aoMover(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
    };
    const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };
  return (
    <span
      ref={ref}
      className={`capa-titulo${aoMover ? " arrastavel" : ""}`}
      onPointerDown={arrastar}
      style={{
        left: `${tit.x * 100}%`,
        top: `${tit.y * 100}%`,
        fontSize: `${(tit.tamanho || 0.12) * 100}cqh`,
        color: tit.cor,
        fontFamily: fonteCapaCss(tit.fonte),
        fontWeight: tit.negrito ? 800 : 500,
        textAlign: alinhaCss(tit.alinhamento),
      }}
    >
      {tit.texto}
    </span>
  );
}

export function CapaEditor({ nome, cena, aoMudar, previa }: { nome: string; cena: CenaCapa; aoMudar: (c: CenaCapa) => void; previa: React.ReactNode }) {
  const tit = cena.titulo;
  const mudarTitulo = (patch: Partial<TituloCapa>) => aoMudar({ ...cena, titulo: { ...(tit ?? tituloPadrao(nome)), ...patch } });

  return (
    <div className="campo capa-editor">
      <span className="campo-rotulo">{t.titulo}</span>
      <div className="capa-editor-previa" style={{ position: "relative" }}>
        {previa}
        <RenderCapaCena cena={cena} aoMover={tit ? (x, y) => mudarTitulo({ x, y }) : undefined} />
      </div>

      {!tit ? (
        <Button className="botao com-icone" onPress={() => aoMudar({ ...cena, titulo: tituloPadrao(nome) })}>
          <Plus aria-hidden="true" size="1em" /> {t.adicionar}
        </Button>
      ) : (
        <div className="formulario capa-editor-controles">
          <input className="entrada-texto sozinha" value={tit.texto} maxLength={60} aria-label={t.texto} onChange={(e) => mudarTitulo({ texto: e.target.value })} />
          <div className="linha-ajuste capa-editor-linha">
            <select className="entrada-texto" aria-label={t.fonte} value={tit.fonte ?? ""} onChange={(e) => mudarTitulo({ fonte: e.target.value })}>
              {FONTES_CAPA.map((f) => <option key={f.chave} value={f.chave}>{f.nome}</option>)}
            </select>
            <label className="caderno-cor-escolher grande" title={t.cor} style={{ background: /^#[0-9a-fA-F]{6}$/.test(tit.cor) ? tit.cor : "#ffffff" }}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(tit.cor) ? tit.cor : "#ffffff"} onChange={(e) => mudarTitulo({ cor: e.target.value })} aria-label={t.cor} />
            </label>
            <Button className={tit.negrito ? "botao-icone ativo" : "botao-icone"} onPress={() => mudarTitulo({ negrito: !tit.negrito })} aria-label={t.negrito} aria-pressed={!!tit.negrito}><Bold aria-hidden="true" size="1.1em" /></Button>
            {(["esquerda", "centro", "direita"] as AlinharTexto[]).map((a) => {
              const Icone = a === "esquerda" ? AlignLeft : a === "direita" ? AlignRight : AlignCenter;
              const atual = (tit.alinhamento ?? "centro") === a;
              return <Button key={a} className={atual ? "botao-icone ativo" : "botao-icone"} onPress={() => mudarTitulo({ alinhamento: a })} aria-label={t.alinhar[a]} aria-pressed={atual}><Icone aria-hidden="true" size="1.1em" /></Button>;
            })}
            <Button className="botao-icone" onPress={() => aoMudar({ ...cena, titulo: undefined })} aria-label={t.remover}><Trash2 aria-hidden="true" size="1.1em" /></Button>
          </div>
          <label className="campo-rotulo deslizante-rotulo" htmlFor="capa-tam">{t.tamanho} <span className="texto-suave">{Math.round((tit.tamanho || 0.12) * 100)}%</span></label>
          <input id="capa-tam" type="range" className="deslizante" min={5} max={28} step={1} value={Math.round((tit.tamanho || 0.12) * 100)} onChange={(e) => mudarTitulo({ tamanho: Number(e.target.value) / 100 })} />
          <p className="campo-ajuda">{t.ajuda}</p>
        </div>
      )}
    </div>
  );
}
