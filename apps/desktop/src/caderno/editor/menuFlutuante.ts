// Menu flutuante ao selecionar texto (como a mini barra do Word): aparece perto do
// trecho escolhido, sem animação, depois que a pessoa solta o mouse ou a caneta.
// Some quando a seleção acaba, com Esc, ou quando o foco vai para fora do editor
// (um submenu aberto a partir dele, como as cores, não conta como "fora").
// No iPad e no celular fica embaixo do trecho, porque em cima vem o menu do sistema.
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

const CHAVE = "editor-menu-flutuante";
export function menuFlutuanteLigado(): boolean {
  try { return localStorage.getItem(CHAVE) !== "0"; } catch { return true; }
}
export function ligarMenuFlutuante(v: boolean) {
  try { localStorage.setItem(CHAVE, v ? "1" : "0"); } catch { /* fica só nesta sessão */ }
  window.dispatchEvent(new Event(CHAVE));
}
export function useMenuFlutuanteLigado(): boolean {
  const [v, setV] = useState(menuFlutuanteLigado);
  useEffect(() => {
    const ouvir = () => setV(menuFlutuanteLigado());
    window.addEventListener(CHAVE, ouvir);
    return () => window.removeEventListener(CHAVE, ouvir);
  }, []);
  return v;
}

export interface PosicaoMenu { x: number; topo: number; base: number; embaixo: boolean }

/** Onde pôr o menu (centro em x, e as bordas de cima e de baixo do trecho), ou null. */
export function posicaoDaSelecao(a: { left: number; top: number; bottom: number }, b: { right: number; left: number; top: number; bottom: number }, toque: boolean): PosicaoMenu {
  const mesmaLinha = Math.abs(a.top - b.top) < 4;
  const x = mesmaLinha ? (a.left + b.right) / 2 : b.left;
  return { x, topo: Math.min(a.top, b.top), base: Math.max(a.bottom, b.bottom), embaixo: toque };
}

/** Pondo dentro da tela: devolve left e top do menu (com a largura e altura dele). */
export function encaixarNaTela(p: PosicaoMenu, largura: number, altura: number, tela: { largura: number; altura: number }): { left: number; top: number } {
  const margem = 8;
  const left = Math.min(Math.max(margem, p.x - largura / 2), Math.max(margem, tela.largura - largura - margem));
  // No toque, mais longe: as alças de seleção do iPad ficam logo abaixo do trecho.
  let top = p.embaixo ? p.base + 28 : p.topo - altura - 8;
  if (!p.embaixo && top < margem) top = p.base + 12; // sem espaço em cima: vai para baixo
  if (top + altura > tela.altura - margem) top = Math.max(margem, p.topo - altura - 8);
  return { left, top };
}

const temSubmenuAberto = () => !!(document.activeElement as HTMLElement | null)?.closest?.("[data-trigger], [role='dialog'], .menu-flutuante");

export function useMenuFlutuante(editor: Editor, ligado: boolean, menu: RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<PosicaoMenu | null>(null);
  const [lugar, setLugar] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!ligado) { setPos(null); return; }
    let tempo: ReturnType<typeof setTimeout> | undefined;
    let apertado = false;
    // Esc esconde até a seleção mudar (voltar o foco ao texto não traz o menu de volta).
    let escondidoEm: { from: number; to: number } | null = null;
    const atualizar = () => {
      if (editor.isDestroyed) return;
      const sel = editor.state.selection;
      if (escondidoEm && (escondidoEm.from !== sel.from || escondidoEm.to !== sel.to)) escondidoEm = null;
      const escondidoPorEsc = !!escondidoEm;
      const noMenu = !!menu.current?.contains(document.activeElement) || temSubmenuAberto();
      if (sel.empty || !editor.isEditable || sel instanceof NodeSelection || escondidoPorEsc || apertado) { if (!noMenu || sel.empty) setPos(null); return; }
      if (!editor.view.hasFocus() && !noMenu) { setPos(null); return; }
      try {
        const a = editor.view.coordsAtPos(sel.from), b = editor.view.coordsAtPos(sel.to);
        setPos(posicaoDaSelecao(a, b, matchMedia("(pointer: coarse)").matches));
      } catch { setPos(null); }
    };
    const agendar = (ms = 120) => { clearTimeout(tempo); tempo = setTimeout(atualizar, ms); };
    const aoSelecionar = () => agendar();
    const aoSair = () => agendar(160);
    const dom = editor.view.dom;
    // Enquanto arrasta para escolher o trecho, o menu espera soltar.
    const desce = () => { apertado = true; setPos(null); };
    const sobe = () => { if (apertado) { apertado = false; agendar(60); } };
    // Esc esconde (no texto ou com o foco no próprio menu, que devolve o foco ao texto).
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || escondidoEm) return;
      const noMenu = !!menu.current?.contains(document.activeElement);
      if (!editor.view.hasFocus() && !noMenu) return;
      escondidoEm = { from: editor.state.selection.from, to: editor.state.selection.to };
      setPos(null);
      if (noMenu) editor.commands.focus();
    };
    const rolar = () => agendar(30);
    // Tocou fora do texto e do menu (e não num submenu dele): o menu some.
    const fora = (e: PointerEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (!alvo || dom.contains(alvo) || menu.current?.contains(alvo) || alvo.closest?.("[data-trigger], [role='dialog']")) return;
      setPos(null);
    };
    editor.on("selectionUpdate", aoSelecionar);
    editor.on("focus", aoSelecionar);
    editor.on("blur", aoSair);
    dom.addEventListener("pointerdown", desce);
    window.addEventListener("pointerup", sobe);
    window.addEventListener("keydown", tecla, true);
    window.addEventListener("scroll", rolar, true);
    window.addEventListener("resize", rolar);
    window.addEventListener("pointerdown", fora, true);
    return () => {
      window.removeEventListener("pointerdown", fora, true);
      clearTimeout(tempo);
      editor.off("selectionUpdate", aoSelecionar);
      editor.off("focus", aoSelecionar);
      editor.off("blur", aoSair);
      dom.removeEventListener("pointerdown", desce);
      window.removeEventListener("pointerup", sobe);
      window.removeEventListener("keydown", tecla, true);
      window.removeEventListener("scroll", rolar, true);
      window.removeEventListener("resize", rolar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, ligado]);
  // Mede o menu e encaixa na tela (sem piscar: antes da tela desenhar).
  useLayoutEffect(() => {
    if (!pos || !menu.current) { setLugar(null); return; }
    const r = menu.current.getBoundingClientRect();
    setLugar(encaixarNaTela(pos, r.width, r.height, { largura: window.innerWidth, altura: window.innerHeight }));
  }, [pos, menu]);
  return { visivel: !!pos, lugar, fechar: () => setPos(null) };
}
