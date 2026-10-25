import { textos } from "../textos/pt-BR";

export const MINIMO_SENHA = 12;

/** Mensagem sobre a senha nova; `ok` diz se já dá para seguir. */
export function avaliarSenha(senha: string, confirmacao: string): { ok: boolean; dica: string | null; erro: string | null } {
  const tamanho = [...senha.trim()].length;
  const faltam = MINIMO_SENHA - tamanho;
  const dica = senha.length === 0 ? null : faltam > 0 ? textos.senha.faltam(faltam) : textos.senha.tamanhoBom;
  const erro = confirmacao.length > 0 && confirmacao !== senha ? textos.senha.naoConferem : null;
  return { ok: faltam <= 0 && confirmacao === senha, dica, erro };
}

export function avaliarPin(pin: string, confirmacao: string): { ok: boolean; erro: string | null } {
  if (pin.length > 0 && !/^\d*$/.test(pin)) return { ok: false, erro: textos.pin.soNumeros };
  const erro = confirmacao.length > 0 && confirmacao !== pin ? textos.pin.naoConferem : null;
  return { ok: /^\d{4,8}$/.test(pin) && pin === confirmacao, erro };
}
