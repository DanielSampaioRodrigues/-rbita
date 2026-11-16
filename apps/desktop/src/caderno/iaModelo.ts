// Qual IA (e qual modelo) o caderno usa: a escolha própria do caderno ou, sem ela, a
// da conversa. Igual ao que o Rust faz em `provedor_da_funcao` ("caderno").
import type { EstadoIa, ProvedorVisivel } from "../api";

export interface IaDoCaderno { provedor: ProvedorVisivel; modelo: string; propria: boolean }

export function iaDoCaderno(e: EstadoIa | null): IaDoCaderno | null {
  if (!e) return null;
  const propria = !!e.funcoes.caderno;
  const funcao = propria ? "caderno" : "conversa";
  const provedor = e.provedores.find((p) => p.id === e.funcoes[funcao]);
  if (!provedor) return null;
  return { provedor, modelo: e.modelos[funcao] || provedor.modelo, propria };
}

/** Nome curto do modelo para o botão ("claude-sonnet-5-5" → "sonnet 5.5"). */
export function nomeCurtoModelo(m: string): string {
  const s = m.replace(/^(models\/|claude-|gpt-|gemini-|grok-)/i, "").replace(/-(\d+)-(\d+)(?=$|-)/, " $1.$2").replace(/-/g, " ");
  return s.length > 22 ? `${s.slice(0, 21)}…` : s;
}
