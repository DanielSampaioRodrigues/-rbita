// O motor do navegador: o mesmo banco do Windows, em WebAssembly
// (crates/motor-web; ver docs/decisoes/0011-motor-unico.md). Só entra no build da
// web; montado por `pnpm motor` em src/web/motor/.

import type { MotorIa } from "./iaWeb";

export interface Motor extends MotorIa {
  abrir_vazio(): number;
  abrir_de_bytes(bytes: Uint8Array): number;
  exportar(): Uint8Array;
  fechar(): void;
  /** JSON `{ r, mudou }`; em erro, lança o JSON do mesmo erro do Windows. */
  executar(comando: string, args: string): string;
  comandos_gerados(): string[];
  comandos_de_fora(): string[];
  /** Ordens de IA que vão à internet: rodam por `ia_avancar` (ver iaWeb.ts). */
  ia_comandos(): string[];
  // Backup portátil (o mesmo arquivo do Windows; src-tauri/src/portatil.rs). Erros: JSON do erro do Windows.
  /** JSON do envelope da senha que viaja no backup (Argon2id). */
  portatil_envelope_senha(dek: Uint8Array, senha: string, id: string): string;
  /** JSON do envelope das 6 palavras que viaja no backup. */
  portatil_envelope_palavras(dek: Uint8Array, palavras: string, id: string): string;
  /** A chave dos dados, aberta pelos envelopes portáteis (`{id, senha?, recuperacao}`). */
  portatil_abrir(envelopes: string, senha?: string | null, palavras?: string | null): Uint8Array;
  /** O arquivo .orbita-backup inteiro, com o banco aberto agora. */
  backup_montar(dek: Uint8Array, envelopes: string, versaoApp: string): Uint8Array;
  /** JSON `{criadoEm, versaoApp, temSenha, versao, origem}`. */
  backup_info(bytes: Uint8Array): string;
  backup_abrir(bytes: Uint8Array, senha?: string | null, palavras?: string | null): BackupAberto;
  palavras_no_banco(): string | undefined;
  guardar_palavras_no_banco(palavras: string): boolean;
}

export interface BackupAberto {
  readonly dek: Uint8Array;
  readonly banco: Uint8Array;
  /** JSON dos envelopes portáteis do backup (`{id, senha?, recuperacao}`). */
  readonly envelopes: string;
  /** As 6 palavras guardadas dentro do banco, se houver. */
  readonly palavras: string | undefined;
  free(): void;
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
