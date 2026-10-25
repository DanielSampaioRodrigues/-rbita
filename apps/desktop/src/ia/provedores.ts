import type { TipoProvedor } from "../api";

export type IdModelo = "claude" | "gpt" | "gemini" | "grok" | "sabia" | "ollama" | "outro";

export interface ModeloProvedor {
  id: IdModelo;
  nome: string;
  tipo: TipoProvedor;
  url: string;
  /** Ollama roda no computador e não usa chave. */
  precisaChave: boolean;
  /** Onde a pessoa cria a chave (só o endereço, para ler; o Órbita não abre sites). */
  ondeChave?: string;
  /** Modelo escolhido sozinho depois da conferência, se existir na lista. */
  modeloSugerido?: string;
}

/** Provedores conhecidos. Todos menos o Claude usam o formato "compatível com GPT". */
export const MODELOS_PROVEDOR: ModeloProvedor[] = [
  { id: "claude", nome: "Claude", tipo: "claude", url: "https://api.anthropic.com", precisaChave: true, ondeChave: "platform.claude.com", modeloSugerido: "claude-opus-5-5" },
  { id: "gpt", nome: "GPT", tipo: "compativel", url: "https://api.openai.com/v1", precisaChave: true, ondeChave: "platform.openai.com" },
  { id: "gemini", nome: "Gemini", tipo: "compativel", url: "https://generativelanguage.googleapis.com/v1beta/openai", precisaChave: true, ondeChave: "aistudio.google.com" },
  { id: "grok", nome: "Grok", tipo: "compativel", url: "https://api.x.ai/v1", precisaChave: true, ondeChave: "console.x.ai" },
  { id: "sabia", nome: "Sabiá", tipo: "compativel", url: "https://chat.maritaca.ai/api", precisaChave: true, ondeChave: "plataforma.maritaca.ai" },
  { id: "ollama", nome: "Ollama", tipo: "compativel", url: "http://localhost:11434/v1", precisaChave: false },
  { id: "outro", nome: "Outro", tipo: "compativel", url: "", precisaChave: true },
];

/** Reconhece de qual modelo um provedor salvo veio (pelo endereço). */
export function modeloDe(tipo: TipoProvedor, url: string): ModeloProvedor {
  return MODELOS_PROVEDOR.find((m) => m.tipo === tipo && m.url === url) ?? MODELOS_PROVEDOR[MODELOS_PROVEDOR.length - 1];
}
