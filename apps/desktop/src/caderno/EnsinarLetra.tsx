// Janela "Ensinar a minha letra": uma caixa com linhas-guia para escrever cada letra uma
// vez (caneta, dedo ou mouse). Grava a cada letra; dá para voltar, pular e refazer.
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { useRecado } from "../app/Recado";
import { Janela } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";
import { CARACTERES, gravarAlfabeto, lerAlfabeto, LINHA_BASE, LINHA_MEIO, type Alfabeto, type PontoGlifo } from "./alfabeto";

const t = textos.caderno.correcao.letra;

export function EnsinarLetra({ aberta, aoFechar, aoMudar }: { aberta: boolean; aoFechar: () => void; aoMudar?: (a: Alfabeto) => void }) {
  const recado = useRecado();
  const [alfa, setAlfa] = useState<Alfabeto>({});
  const [i, setI] = useState(0);
  const [tracos, setTracos] = useState<PontoGlifo[][]>([]);
  const atual = useRef<PontoGlifo[] | null>(null);
  const [, redesenhar] = useState(0);
  const caixa = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!aberta) return;
    void lerAlfabeto().then((a) => {
      setAlfa(a);
      const falta = CARACTERES.findIndex((c) => !a[c]);
      const n = falta < 0 ? 0 : falta;
      setI(n);
      setTracos(a[CARACTERES[n]]?.tracos ?? []);
    });
  }, [aberta]);

  const ch = CARACTERES[i];
  const feitas = CARACTERES.filter((c) => alfa[c]).length;

  const guardar = async (): Promise<Alfabeto> => {
    const novo = { ...alfa };
    if (tracos.length) novo[ch] = { tracos }; else delete novo[ch];
    setAlfa(novo);
    await gravarAlfabeto(novo);
    aoMudar?.(novo);
    return novo;
  };
  const ir = async (n: number) => {
    const a = await guardar();
    const k = Math.max(0, Math.min(CARACTERES.length - 1, n));
    setI(k);
    setTracos(a[CARACTERES[k]]?.tracos ?? []);
  };
  const pronto = async () => {
    const a = await guardar();
    recado(t.guardada(CARACTERES.filter((c) => a[c]).length, CARACTERES.length));
    aoFechar();
  };

  // Desenho: pontos relativos à caixa (0 a 1), com a pressão da caneta quando houver.
  const rel = (e: React.PointerEvent): PontoGlifo => {
    const r = caixa.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, p: e.pressure > 0 ? e.pressure : 0.5 };
  };
  const desce = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    atual.current = [rel(e)];
    redesenhar((x) => x + 1);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!atual.current) return;
    atual.current.push(rel(e));
    redesenhar((x) => x + 1);
  };
  const sobe = () => {
    const tr = atual.current;
    atual.current = null;
    if (tr && tr.length > 1) setTracos((ts) => [...ts, tr]);
    else redesenhar((x) => x + 1);
  };
  const linha = (pts: PontoGlifo[]) => pts.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
  const nome = t.nomes[ch as keyof typeof t.nomes] ?? ch;

  return (
    <Janela titulo={t.titulo} aberta={aberta} aoFechar={() => void pronto()}>
      <div className="ensinar-letra">
        <p className="texto-suave">{t.explicacao}</p>
        <p className="ensinar-letra-alvo" aria-live="polite">{t.escreva} <strong>{nome}</strong> <span className="texto-suave pequeno">({t.posicao(i + 1, CARACTERES.length)})</span></p>
        <svg ref={caixa} className="ensinar-letra-caixa" viewBox="0 0 100 100" role="img" aria-label={t.caixa(nome)}
          onPointerDown={desce} onPointerMove={move} onPointerUp={sobe} onPointerCancel={sobe}>
          <line x1="0" x2="100" y1="12" y2="12" className="guia fraca" />
          <line x1="0" x2="100" y1={LINHA_MEIO * 100} y2={LINHA_MEIO * 100} className="guia meio" />
          <line x1="0" x2="100" y1={LINHA_BASE * 100} y2={LINHA_BASE * 100} className="guia base" />
          <line x1="0" x2="100" y1="92" y2="92" className="guia fraca" />
          {tracos.map((tr, k) => <polyline key={k} points={linha(tr)} className="traco" />)}
          {atual.current && <polyline points={linha(atual.current)} className="traco" />}
        </svg>
        <div className="linha-ajuste ensinar-letra-botoes">
          <Button className="botao" onPress={() => setTracos([])} isDisabled={!tracos.length}>{t.apagar}</Button>
          <Button className="botao" onPress={() => void ir(i - 1)} isDisabled={i === 0}>{t.voltar}</Button>
          <Button className="botao principal" onPress={() => void ir(i + 1)} isDisabled={i === CARACTERES.length - 1}>{tracos.length ? t.proxima : t.pular}</Button>
        </div>
        <ul className="ensinar-letra-mapa" aria-label={t.mapa(feitas, CARACTERES.length)}>
          {CARACTERES.map((c, k) => (
            <li key={c}>
              <button type="button" className={`ensinar-letra-chip${alfa[c] ? " feita" : ""}${k === i ? " atual" : ""}`} aria-current={k === i ? "true" : undefined}
                aria-label={`${t.nomes[c as keyof typeof t.nomes] ?? c}${alfa[c] ? `, ${t.feita}` : ""}`} onClick={() => void ir(k)}>{c}</button>
            </li>
          ))}
        </ul>
        <p className="campo-ajuda">{t.ajuda}</p>
        <div className="janela-acoes">
          <Button className="botao principal" onPress={() => void pronto()}>{t.pronto}</Button>
        </div>
      </div>
    </Janela>
  );
}
