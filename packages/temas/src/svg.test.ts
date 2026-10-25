// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { congelarSvg, limparSvg, pintarSvg, SvgInvalido } from "./svg";

describe("limpeza de SVG", () => {
  it("tira scripts, eventos, objetos externos e links para fora", () => {
    const sujo = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
      <script>alert(2)</script>
      <foreignObject><iframe src="https://mal.example"></iframe></foreignObject>
      <a href="javascript:alert(3)"><circle r="5"/></a>
      <use href="https://mal.example/x.svg#a"/>
      <use href="#local"/>
      <rect id="local" width="10" height="10" fill="currentColor" onclick="alert(4)" style="fill:url(https://mal.example/p)"/>
      <style>@import url(https://mal.example/x.css); rect{fill:url(https://mal.example/y)}</style>
    </svg>`;
    const limpo = limparSvg(sujo);
    expect(limpo).not.toMatch(/script|onload|onclick|foreignObject|iframe|javascript:|mal\.example|@import/i);
    expect(limpo).toContain('href="#local"');
    expect(limpo).toContain("<rect");
  });

  it("recusa o que não é SVG e arquivo grande demais", () => {
    expect(() => limparSvg("<p>oi</p>")).toThrow(SvgInvalido);
    expect(() => limparSvg("<svg>" + "a".repeat(1024 * 1024) + "</svg>")).toThrow(SvgInvalido);
  });

  it("congela animações e pinta com a cor do tema", () => {
    const animado = `<svg><circle r="5" fill="currentColor"><animate attributeName="r" from="1" to="9" dur="1s"/></circle><set attributeName="x" to="1"/></svg>`;
    const parado = congelarSvg(animado);
    expect(parado).not.toMatch(/<animate|<set/);
    expect(parado).toContain("animation:none");
    expect(pintarSvg(parado, "#123456")).toContain('fill="#123456"');
  });
});
