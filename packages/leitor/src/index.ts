export { Leitor, lerMetadados } from "./leitor";
export { CORES_FUNDO, coresDeLeitura, estiloDoCorpo, temaEpub, zoomPdf } from "./estilo";
export { CONFIG_PADRAO, CORES_ANOTACAO } from "./tipos";
export type { ConfigLeitura, CorFundo, Alinhamento, Modo, Formato, Localizacao, ItemSumario, ModoCaneta, Traco, SelecaoTexto } from "./tipos";
export { abrirPdf, desenharPaginaPdf, extrairTextoEpub, extrairTextoPdf } from "./extrair";
