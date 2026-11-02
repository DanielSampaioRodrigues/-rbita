// O lugar onde os aparelhos trocam arquivos de sincronização (ver
// docs/decisoes/0012-sincronizacao.md). No uso real, a pasta escondida do app no
// Google Drive da pessoa (drive.appdata); nos testes, uma pasta de mentira.
//
// Arquivos usados pelo maestro:
//   chave.orbita-sync            envelope da chave de sincronização (texto, base64)
//   aparelho-<id>.orbita-sync    retrato trancado de cada aparelho (texto, base64)
//   anexo-<sha256>.orbita-sync   conteúdo trancado de um anexo (texto, base64)
// Todo conteúdo já chega trancado pelo motor: o armazenamento nunca vê dado aberto.

export interface ArquivoRemoto {
  nome: string;
  /** Muda sempre que o conteúdo muda (no Drive: `modifiedTime` ou `version`). */
  versao: string;
  /** Milissegundos desde 1970, para mostrar "atualizado há…". */
  alteradoEm: number;
}

export class SemInternet extends Error {
  constructor() {
    super("Sem internet agora.");
  }
}

export class AcessoNegado extends Error {
  constructor(mensagem = "A conta não deu acesso à pasta do Órbita.") {
    super(mensagem);
  }
}

export interface Armazenamento {
  /** Lista os arquivos cujo nome começa com `prefixo` (ou todos). */
  listar(prefixo?: string): Promise<ArquivoRemoto[]>;
  /** Conteúdo do arquivo, ou null se não existe. */
  baixar(nome: string): Promise<string | null>;
  /** Cria ou substitui o arquivo. */
  enviar(nome: string, conteudo: string): Promise<ArquivoRemoto>;
  /** Apaga (para "sair da sincronização" e testes). Não falha se não existe. */
  apagar(nome: string): Promise<void>;
}
