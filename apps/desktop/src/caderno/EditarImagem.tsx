// Janela para recortar uma imagem da página ou tirar o fundo dela. Mostra a prévia e
// só muda a página quando a pessoa aperta "Aplicar" (dá para desfazer depois).
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { Janela } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";
import { carregarImagem, recortar, recorteValido, tirarFundo, type Recorte } from "./imagemEdicao";

const t = textos.caderno.imagem;

export type ModoEdicao = "recortar" | "fundo";

export function EditarImagem({ url, modo, aoAplicar, aoFechar }: {
  url: string; modo: ModoEdicao;
  aoAplicar: (blob: Blob, recorte?: Recorte) => Promise<void> | void;
  aoFechar: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { carregarImagem(url).then(setImg, (e: Error) => setErro(e.message)); }, [url]);

  // Recorte: um retângulo em frações da imagem, com alças nos cantos.
  const [rec, setRec] = useState<Recorte>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const caixa = useRef<HTMLDivElement>(null);
  const gesto = useRef<{ modo: "mover" | 0 | 1 | 2 | 3; px: number; py: number; r: Recorte } | null>(null);
  const fr = (e: React.PointerEvent) => {
    const b = caixa.current!.getBoundingClientRect();
    return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height] as const;
  };
  const desce = (m: "mover" | 0 | 1 | 2 | 3) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const [px, py] = fr(e);
    gesto.current = { modo: m, px, py, r: rec };
  };
  const move = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g) return;
    const [px, py] = fr(e);
    const dx = px - g.px, dy = py - g.py, r = g.r;
    if (g.modo === "mover") { setRec(recorteValido({ ...r, x: Math.min(r.x + dx, 1 - r.w), y: Math.min(r.y + dy, 1 - r.h) })); return; }
    // Cantos: 0 cima-esquerda, 1 cima-direita, 2 baixo-direita, 3 baixo-esquerda.
    let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
    if (g.modo === 0 || g.modo === 3) x0 = Math.min(x1 - 0.03, x0 + dx); else x1 = Math.max(x0 + 0.03, x1 + dx);
    if (g.modo === 0 || g.modo === 1) y0 = Math.min(y1 - 0.03, y0 + dy); else y1 = Math.max(y0 + 0.03, y1 + dy);
    setRec(recorteValido({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }));
  };
  const sobe = () => { gesto.current = null; };

  // Tirar o fundo: prévia ao vivo, com a força ajustável.
  const [forca, setForca] = useState(18);
  const [previa, setPrevia] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (modo !== "fundo" || !img) return;
    let vivo = true;
    const id = setTimeout(() => {
      void tirarFundo(img, forca, 1200).then((b) => {
        if (!vivo) return;
        setPrevia((p) => { if (p) URL.revokeObjectURL(p.url); return { blob: b, url: URL.createObjectURL(b) }; });
      }, (e: Error) => setErro(e.message));
    }, 180);
    return () => { vivo = false; clearTimeout(id); };
  }, [modo, img, forca]);
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa.url); }, [previa]);

  const aplicar = async () => {
    if (!img) return;
    setOcupado(true);
    try {
      if (modo === "recortar") await aoAplicar(await recortar(img, rec), recorteValido(rec));
      else await aoAplicar(await tirarFundo(img, forca));
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  const proporcao = img ? `${img.naturalWidth} / ${img.naturalHeight}` : "4 / 3";
  // A caixa tem a proporção da imagem e cabe na tela (assim o recorte bate com a imagem).
  const palco: React.CSSProperties = { aspectRatio: proporcao, width: `min(100%, calc(55vh * ${img ? img.naturalWidth / img.naturalHeight : 4 / 3}))` };
  return (
    <Janela titulo={modo === "recortar" ? t.recortarTitulo : t.fundoTitulo} aberta aoFechar={aoFechar}>
      <div className="editar-imagem">
        <p className="texto-suave pequeno">{modo === "recortar" ? t.recortarAjuda : t.fundoAjuda}</p>
        {erro && <p role="alert" className="texto-erro">{erro}</p>}
        {modo === "recortar" ? (
          <div ref={caixa} className="editar-imagem-palco" style={palco} onPointerMove={move} onPointerUp={sobe} onPointerCancel={sobe}>
            <img src={url} alt="" draggable={false} />
            <div className="editar-imagem-recorte" style={{ left: `${rec.x * 100}%`, top: `${rec.y * 100}%`, width: `${rec.w * 100}%`, height: `${rec.h * 100}%` }}
              onPointerDown={desce("mover")} role="presentation">
              {([0, 1, 2, 3] as const).map((k) => <span key={k} className={`editar-imagem-alca c${k}`} onPointerDown={desce(k)} />)}
            </div>
          </div>
        ) : (
          <>
            <div className="editar-imagem-palco xadrez" style={palco}>
              {previa ? <img src={previa.url} alt={t.previa} draggable={false} /> : <p className="texto-suave">{t.preparando}</p>}
            </div>
            <label className="campo">
              <span className="campo-rotulo">{t.forca(forca)}</span>
              <input type="range" min={2} max={60} value={forca} onChange={(e) => setForca(Number(e.target.value))} />
            </label>
            <p className="campo-ajuda">{t.fundoLimite}</p>
          </>
        )}
        <div className="janela-acoes">
          <Button className="botao" onPress={aoFechar}>{t.cancelar}</Button>
          <Button className="botao principal" onPress={() => void aplicar()} isDisabled={!img || ocupado || (modo === "fundo" && !previa)}>{t.aplicar}</Button>
        </div>
      </div>
    </Janela>
  );
}
