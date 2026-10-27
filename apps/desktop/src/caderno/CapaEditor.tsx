// Editor da capa: a pessoa escreve um título sobre a capa escolhida (fonte,
// cor, tamanho, posição) e pode pincelar à mão por cima. A cena é guardada em
// capaCena e desenhada também na estante.
import { useRef, useState } from "react";
import { Button } from "react-aria-components";
import { caminhoDeTraco, type Traco } from "@orbita/caderno";
import { FONTES } from "../preferencias";
import { AlignCenter, AlignLeft, AlignRight, Bold, Eraser, Pencil, Plus, Trash2, Undo2 } from "../icones";
import { textos } from "../textos/pt-BR";
import type { AlinharTexto } from "@orbita/caderno";
import { CAPA_REF, fonteCapaCss, tituloPadrao, type CenaCapa, type TituloCapa } from "./capa";

const t = textos.caderno.capaEditor;
const FONTES_CAPA: { chave: string; nome: string }[] = [
  { chave: "", nome: t.fontePadrao },
  ...Object.entries(FONTES).map(([chave, f]) => ({ chave, nome: f.nome })),
];
const CORES_PINCEL = ["#ffffff", "#1f2937", "#e8386d", "#f4b400", "#2e8a99", "#7c68a8"];

const alinhaCss = (a?: AlinharTexto): "left" | "center" | "right" => (a === "esquerda" ? "left" : a === "direita" ? "right" : "center");
type Ponto = { x: number; y: number; p: number };
const fazTraco = (pontos: Ponto[], cor: string, espessura: number): Traco => ({ tipo: "traco", id: crypto.randomUUID(), ferramenta: "caneta", cor, espessura, opacidade: 1, pontos });

/** Desenha os traços e o título sobre a capa. Em `aoMover`, o título arrasta. */
export function RenderCapaCena({ cena, aoMover, extra }: { cena: CenaCapa; aoMover?: (x: number, y: number) => void; extra?: React.ReactNode }) {
  const tit = cena.titulo;
  const tracos = cena.tracos ?? [];
  const ref = useRef<HTMLSpanElement>(null);
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
    <>
      {(tracos.length > 0 || extra) && (
        <svg className="capa-tracos" viewBox={`0 0 ${CAPA_REF.largura} ${CAPA_REF.altura}`} preserveAspectRatio="none" aria-hidden="true">
          {tracos.map((tr) => <path key={tr.id} d={caminhoDeTraco(tr)} fill={tr.cor} opacity={tr.opacidade ?? 1} />)}
          {extra}
        </svg>
      )}
      {tit?.texto.trim() && (
        <span
          ref={ref}
          className={`capa-titulo${aoMover ? " arrastavel" : ""}`}
          onPointerDown={arrastar}
          style={{ left: `${tit.x * 100}%`, top: `${tit.y * 100}%`, fontSize: `${(tit.tamanho || 0.12) * 100}cqh`, color: tit.cor, fontFamily: fonteCapaCss(tit.fonte), fontWeight: tit.negrito ? 800 : 500, textAlign: alinhaCss(tit.alinhamento) }}
        >
          {tit.texto}
        </span>
      )}
    </>
  );
}

export function CapaEditor({ nome, cena, aoMudar, previa }: { nome: string; cena: CenaCapa; aoMudar: (c: CenaCapa) => void; previa: React.ReactNode }) {
  const tit = cena.titulo;
  const [pincel, setPincel] = useState(false);
  const [cor, setCor] = useState("#ffffff");
  const [tam, setTam] = useState(5);
  const [tracando, setTracando] = useState<Ponto[]>([]);
  const refArea = useRef<HTMLDivElement>(null);
  const mudarTitulo = (patch: Partial<TituloCapa>) => aoMudar({ ...cena, titulo: { ...(tit ?? tituloPadrao(nome)), ...patch } });
  const tracos = cena.tracos ?? [];

  const pontoRef = (e: PointerEvent | React.PointerEvent): Ponto => {
    const r = refArea.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CAPA_REF.largura, y: ((e.clientY - r.top) / r.height) * CAPA_REF.altura, p: (e as PointerEvent).pressure || 0.5 };
  };
  const comecar = (e: React.PointerEvent) => {
    if (!pincel) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    let pts = [pontoRef(e)];
    setTracando(pts);
    const mover = (ev: PointerEvent) => { pts = [...pts, pontoRef(ev)]; setTracando(pts); };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      if (pts.length > 1) aoMudar({ ...cena, tracos: [...tracos, fazTraco(pts, cor, tam)] });
      setTracando([]);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };
  const extra = tracando.length > 1 ? <path d={caminhoDeTraco(fazTraco(tracando, cor, tam))} fill={cor} /> : null;

  return (
    <div className="campo capa-editor">
      <span className="campo-rotulo">{t.titulo}</span>
      <div ref={refArea} className={`capa-editor-previa${pincel ? " pincel" : ""}`} onPointerDown={comecar}>
        {previa}
        <RenderCapaCena cena={cena} aoMover={tit && !pincel ? (x, y) => mudarTitulo({ x, y }) : undefined} extra={extra} />
      </div>

      <div className="linha-ajuste capa-editor-linha">
        {!tit ? (
          <Button className="botao com-icone" onPress={() => aoMudar({ ...cena, titulo: tituloPadrao(nome) })}><Plus aria-hidden="true" size="1em" /> {t.adicionar}</Button>
        ) : null}
        <Button className={pincel ? "botao com-icone ativo" : "botao com-icone"} onPress={() => setPincel((v) => !v)} aria-pressed={pincel}><Pencil aria-hidden="true" size="1em" /> {t.pincel}</Button>
        {tracos.length > 0 && (
          <>
            <Button className="botao-icone" onPress={() => aoMudar({ ...cena, tracos: tracos.slice(0, -1) })} aria-label={t.desfazer}><Undo2 aria-hidden="true" size="1.1em" /></Button>
            <Button className="botao-icone" onPress={() => aoMudar({ ...cena, tracos: [] })} aria-label={t.limpar}><Eraser aria-hidden="true" size="1.1em" /></Button>
          </>
        )}
      </div>

      {pincel && (
        <div className="formulario capa-editor-controles">
          <div className="linha-ajuste capa-editor-linha caderno-cores" role="group" aria-label={t.corPincel}>
            {CORES_PINCEL.map((c) => <button key={c} type="button" className={cor.toLowerCase() === c ? "caderno-cor atual" : "caderno-cor"} style={{ background: c }} onClick={() => setCor(c)} aria-label={c} aria-pressed={cor.toLowerCase() === c} />)}
            <label className="caderno-cor-escolher" title={t.corPincel}><input type="color" value={/^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#ffffff"} onChange={(e) => setCor(e.target.value)} aria-label={t.corPincel} /><Plus aria-hidden="true" size="1em" /></label>
          </div>
          <label className="campo-rotulo deslizante-rotulo" htmlFor="capa-pincel-tam">{t.espessura} <span className="texto-suave">{tam}</span></label>
          <input id="capa-pincel-tam" type="range" className="deslizante" min={1} max={16} step={1} value={tam} onChange={(e) => setTam(Number(e.target.value))} />
        </div>
      )}

      {tit && (
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
        </div>
      )}
      <p className="campo-ajuda">{pincel ? t.ajudaPincel : t.ajuda}</p>
    </div>
  );
}
