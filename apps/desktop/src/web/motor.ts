// O motor do navegador: o mesmo banco do Windows, em WebAssembly
// (crates/motor-web; ver docs/decisoes/0011-motor-unico.md). Só entra no build da
// web; montado por `pnpm motor` em src/web/motor/.

export interface Motor {
  abrir_vazio(): number;
  abrir_de_bytes(bytes: Uint8Array): number;
  exportar(): Uint8Array;
  fechar(): void;
  /** JSON `{ r, mudou }`; em erro, lança o JSON do mesmo erro do Windows. */
  executar(comando: string, args: string): string;
  comandos_gerados(): string[];
  comandos_de_fora(): string[];
}

type Modulo = Motor & { default: () => Promise<unknown> };
const modulos = import.meta.glob<Modulo>("./motor/orbita_motor_web.js");

let carregando: Promise<Motor> | null = null;

export function carregarMotor(): Promise<Motor> {
  carregando ??= (async () => {
    const carregar = modulos["./motor/orbita_motor_web.js"];
    if (!carregar) throw new Error("O motor do navegador não foi montado (rode pnpm motor).");
    const m = await carregar();
    await m.default();
    return m;
  })();
  return carregando;
}
