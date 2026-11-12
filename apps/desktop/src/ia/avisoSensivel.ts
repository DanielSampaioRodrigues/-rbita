// Aviso de dados de saúde ou terapia antes de ir para uma IA de fora do aparelho.
// Pedido de Dan (11/2026): "aparece uma vez e discreto; muito aviso assusta". O aviso
// aparece só na primeira vez com cada provedor; depois, o envio segue sem perguntar.
// Quem não quer que esses dados saiam do aparelho liga o bloqueio em Ajustes > IA
// ("Não enviar dados de saúde e terapia para fora do aparelho"): esse vale sempre.
// Fica guardado no banco criptografado (vai junto no backup), não no navegador.
import { api } from "../api";

const CHAVE = "ia.aviso-sensivel";
let vistos: Promise<string[]> | null = null;

const ler = () => {
  vistos ??= api.lerValor(CHAVE).then((v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []), () => []);
  return vistos;
};

/** Já avisou, alguma vez, que dados sensíveis iriam para este provedor? */
export async function jaAvisou(provedorId: string): Promise<boolean> {
  return (await ler()).includes(provedorId);
}

/** A pessoa viu o aviso e seguiu: não pergunta mais para este provedor. */
export async function marcarAvisado(provedorId: string): Promise<void> {
  const atuais = await ler();
  if (atuais.includes(provedorId)) return;
  const novos = [...atuais, provedorId];
  vistos = Promise.resolve(novos);
  await api.gravarValor(CHAVE, novos).catch(() => undefined);
}

/** Precisa parar para avisar (ou explicar o bloqueio) antes de enviar? */
export async function precisaAvisar(sensivel: boolean, provedor: { id: string; local: boolean }, bloqueia: boolean): Promise<boolean> {
  if (!sensivel || provedor.local) return false;
  if (bloqueia) return true;
  return !(await jaAvisou(provedor.id));
}
