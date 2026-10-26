// Ponte com a parte nativa (Rust). Fora do app (navegador, testes de tela),
// usa uma simulação em memória para a interface poder ser vista e testada.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";

export type ModoAbrir = "hello" | "pin" | "senha" | "direto";

export interface Situacao {
  existe: boolean;
  modo: ModoAbrir | null;
  tentativasRestantes: number;
  aberto: boolean;
  /** Sem senha, onde antes se pedia a senha valem as 6 palavras. */
  temSenha: boolean;
}

/** Confirmar que é a pessoa antes de uma ação sensível (ver a chave, mudar como abre, criar senha). */
export type Confirmacao = { tipo: "senha" | "palavras" | "pin"; valor: string } | { tipo: "aparelho" };

export type ProvedorNuvem = "google" | "microsoft";

/** Conta Google ou Microsoft ligada para guardar a recuperação. */
export interface SituacaoNuvem {
  provedor: ProvedorNuvem;
  /** E-mail da conta. */
  conta: string;
  /** Último envio da chave e do backup. */
  ultimo: number | null;
  erro: string | null;
}

export interface EncontradoNaNuvem {
  conta: string;
  criadoEm: number;
  versaoApp: string;
}

export interface Ideia {
  id: string;
  texto: string;
  criadoEm: number;
  /** Texto mais longo, opcional. */
  nota: string;
  /** Ids das etiquetas. */
  etiquetas: string[];
  /** Ids das outras ideias ligadas a esta. */
  ligadas: string[];
}

/** Cores das etiquetas (sempre mostradas junto do nome). */
export const CORES_ETIQUETA = ["musgo", "mar", "ceu", "lavanda", "rosa", "terra", "areia", "cinza"] as const;
export type CorEtiqueta = (typeof CORES_ETIQUETA)[number];

export interface Etiqueta {
  id: string;
  nome: string;
  cor: CorEtiqueta;
}

export interface OndeParei {
  texto: string;
  proximoPasso: string;
  links: string[];
  atualizadoEm: number;
}

export type EstadoProjeto = "ativo" | "pausado" | "concluido";
export type EstadoTarefa = "a_fazer" | "fazendo" | "feita";

export interface Projeto {
  id: string;
  titulo: string;
  estado: EstadoProjeto;
  ondeParei: OndeParei | null;
  pausadoEm: number | null;
  /** Datas opcionais, "AAAA-MM-DD". */
  inicio: string | null;
  prazo: string | null;
  criadoEm: number;
  tarefasFeitas: number;
  tarefasTotal: number;
  alteradoEm: number;
  /** Ids das etiquetas. */
  etiquetas: string[];
}

export interface Repeticao {
  frequencia: "diaria" | "semanal" | "mensal";
  dias: number[];
  ate: number | null;
}

export interface Evento {
  /** Vazio ao criar. */
  id: string;
  titulo: string;
  inicio: number;
  fim: number | null;
  diaInteiro: boolean;
  repeticao: Repeticao | null;
  /** Bloco fixo da semana-modelo. */
  modelo: boolean;
  notas: string;
  excecoes: string[];
}

export interface Passo {
  /** Vazio ao criar. */
  id: string;
  titulo: string;
  icone: string;
  minutos: number | null;
  /** Id do anexo de imagem do passo (foto ou desenho). Só leitura. */
  imagem?: string | null;
}

export interface Rotina {
  id: string;
  titulo: string;
  passos: Passo[];
}

export type Peso = "leve" | "media" | "pesada";

export interface Tarefa {
  id: string;
  paiId: string;
  titulo: string;
  estado: EstadoTarefa;
  ordem: number;
  peso: Peso | null;
  /** "AAAA-MM-DD" */
  prazo: string | null;
  /** Ids das etiquetas. */
  etiquetas: string[];
}

/** Outro item ligado a este (ideia, projeto ou tarefa). */
export interface ItemResumo {
  id: string;
  tipo: "ideia" | "projeto" | "tarefa";
  titulo: string;
  estado: string | null;
}

export interface Anexo {
  id: string;
  tipo: "imagem" | "arquivo" | "link";
  nome: string;
  /** Só links: o endereço. */
  endereco: string;
  tamanho: number;
  criadoEm: number;
}

export interface Prazo {
  id: string;
  tipo: "projeto" | "tarefa";
  titulo: string;
  data: string;
  projetoId: string;
  projeto: string;
}

export interface RegistroEnergia {
  id: string;
  /** De 1 (muito baixa) a 5 (muito boa). */
  nivel: number;
  momento: number;
  nota: string;
}

export interface Basico {
  texto: string;
  feito: boolean;
}

export interface TarefaSugerida {
  id: string;
  titulo: string;
  peso: Peso | null;
  projetoId: string;
  projeto: string;
}

/** Um remédio cadastrado no módulo de Saúde. */
export interface Remedio {
  /** Vazio ao criar. */
  id: string;
  nome: string;
  /** Texto livre, por exemplo "1 comprimido" ou "10 gotas". */
  dose: string;
  /** Horários do dia ("HH:MM", 24h) de tomar. Vazio = sem horário fixo. */
  horarios: string[];
  /** Unidades em estoque; null = não controla estoque. */
  estoque: number | null;
  /** Unidades gastas por dose (para baixar o estoque). */
  porDose: number;
  /** Quando a receita vence ("AAAA-MM-DD"); null = sem receita. */
  receita: string | null;
  /** "ativo" ou "pausado". */
  estado: string;
  criadoEm: number;
}

/** Uma dose a tomar (ou já tomada) de um remédio num dia. */
export interface DoseDoDia {
  remedioId: string;
  nome: string;
  dose: string;
  horario: string;
  tomada: boolean;
}

/** Aviso calmo de estoque acabando ou receita vencendo. */
export interface AvisoSaude {
  remedioId: string;
  nome: string;
  /** "estoque" ou "receita". */
  tipo: string;
  /** Unidades restantes (estoque) ou dias até vencer (receita). */
  quanto: number;
}

/** Tipos de registro de saúde: difíceis e também positivos. */
export type TipoRegistroSaude = "sono" | "sintoma" | "sobrecarga" | "coisa_boa" | "potencialidade" | "regulacao";
/** Os tipos do lado positivo (para separar nos gráficos). */
export const TIPOS_SAUDE_POSITIVOS: TipoRegistroSaude[] = ["coisa_boa", "potencialidade", "regulacao"];

/** Registro curto de saúde, difícil (sono/sintoma/sobrecarga) ou positivo. */
export interface RegistroSaude {
  id: string;
  tipo: string;
  momento: number;
  /** De 1 a 5; null quando não se aplica. */
  intensidade: number | null;
  nota: string;
}

/** Tipo de plano: de crise ou de estratégia/potencialidade. */
export type TipoPlano = "crise" | "estrategia";

/** Um plano de crise ou estratégia, escrito num momento bom. A pessoa pode ter vários. */
export interface PlanoSaude {
  id: string;
  tipo: TipoPlano;
  titulo: string;
  sinais: string;
  ajuda: string;
  contatos: string;
  atualizadoEm: number;
}

/** Um profissional de saúde que a pessoa acompanha (psiquiatra, psicólogo...). */
export interface Profissional {
  id: string;
  nome: string;
  /** Especialidade (texto livre). */
  especialidade: string;
  /** Descrição livre, em Markdown. */
  sobre: string;
  /** Próxima consulta ("AAAA-MM-DD") ou vazio. */
  proximaConsulta: string;
  criadoEm: number;
}

/** Anotação de cuidado: "pauta" (o que levar) ou "pergunta" (para o profissional). */
export interface Nota {
  id: string;
  tipo: string;
  texto: string;
  feita: boolean;
  criadoEm: number;
}

/** Registro do que ficou de uma sessão (anotação em Markdown, com a data). */
export interface RegistroSessao {
  id: string;
  /** Data da sessão ("AAAA-MM-DD"). */
  data: string;
  nota: string;
  criadoEm: number;
}

/** Um gasto registrado (valor em centavos). */
export interface Gasto {
  id: string;
  centavos: number;
  /** Id do grupo (categoria) a que pertence; vazio = sem grupo. */
  grupoId: string;
  /** Texto de categoria antigo, de gastos anteriores aos grupos. */
  categoria: string;
  /** Gasto com interesse especial / hiperfoco. Visível, sem julgamento. */
  interesse: boolean;
  descricao: string;
  momento: number;
}

/** Grupo de gasto (categoria personalizável), com cor. */
export interface Grupo {
  id: string;
  nome: string;
  cor: string;
  criadoEm: number;
}

/** Conta recorrente (valor em centavos). */
export interface Conta {
  id: string;
  nome: string;
  centavos: number;
  /** Dia do mês em que vence (1 a 31). */
  diaVencimento: number;
  /** Dias de antecedência do aviso. */
  avisoDias: number;
  /** Grupo (categoria) a que pertence; vazio = sem grupo. Mesmo sistema dos gastos. */
  grupoId: string;
  criadoEm: number;
}

/** Item da lista de espera de compras. */
export interface Desejo {
  id: string;
  nome: string;
  centavos: number;
  /** A partir de quando dá para decidir (ms). */
  decidirEm: number;
  /** "esperando" ou "resolvido". */
  estado: string;
  criadoEm: number;
}

/** Meta de reserva (valores em centavos). */
export interface Meta {
  id: string;
  nome: string;
  alvoCentavos: number;
  guardadoCentavos: number;
  criadoEm: number;
}

/** Um livro na estante, com status e diário de leitura. */
export interface Livro {
  id: string;
  titulo: string;
  autor: string;
  /** "quero", "lendo", "lido" ou "pausado". */
  status: string;
  ondeParei: string;
  impressoes: string;
  /** "AAAA-MM-DD", opcionais. */
  inicio: string;
  fim: string;
  /** "epub", "pdf" ou vazio (só acompanhamento). */
  formato: string;
  /** Id do anexo com o arquivo do livro, quando houver. */
  arquivoId: string;
  /** Id da prateleira (grupo) a que pertence; vazio = sem prateleira. */
  grupoId: string;
  /** Cor da capa do livro (nome da paleta de etiquetas). */
  cor: string;
  criadoEm: number;
}

/** Um ponto de um traço da caneta, relativo à página (x e y de 0 a 1). */
export interface Ponto {
  x: number;
  y: number;
}

/** Tipo de anotação de leitura. */
export type TipoAnotacao = "marcador" | "nota" | "grifo" | "traco";

/** Anotação de leitura: marcador, nota, grifo (EPUB) ou traço da caneta (PDF). */
export interface Anotacao {
  id: string;
  livroId: string;
  tipo: TipoAnotacao;
  /** EPUB: ponto (marcador/nota) — um CFI. */
  epubCfi: string;
  /** EPUB: intervalo grifado — um CFI de intervalo. */
  epubCfiRange: string;
  /** PDF: página (1 em diante). */
  pdfPagina: number;
  /** Cor do grifo ou do traço (nome da paleta de etiquetas). */
  cor: string;
  /** Texto da nota (ou nota presa a um grifo). */
  texto: string;
  /** Trecho grifado, guardado para listar sem abrir o livro. */
  trecho: string;
  /** Traço da caneta: pontos relativos à página. */
  pontos: Ponto[];
  /** Espessura do traço, relativa à largura da página. */
  espessura: number;
  criadoEm: number;
}

/** "Minha organização": um quadro (estilo Trello) ou uma lista. */
export interface Quadro {
  id: string;
  nome: string;
  /** "quadro" (colunas com cartões) ou "lista" (itens com caixinha). */
  estilo: "quadro" | "lista";
  criadoEm: number;
}

/** Uma coluna de um quadro (na lista, uma só, sem título). */
export interface Coluna {
  id: string;
  quadroId: string;
  nome: string;
  ordem: number;
}

/** Um cartão/item de "Minha organização". */
export interface CartaoOrg {
  id: string;
  colunaId: string;
  texto: string;
  feito: boolean;
  /** Cor da etiqueta (vazio = sem cor). */
  cor: string;
  /** Prazo em "AAAA-MM-DD" (vazio = sem prazo). */
  prazo: string;
  ordem: number;
  criadoEm: number;
}

/** Capa do caderno: cor da paleta ou id de uma capa pronta. */
export interface Capa {
  tipo: "cor" | "galeria";
  valor: string;
}

/** Um caderno da estante (modo caderno com páginas, ou quadro infinito). */
export interface Caderno {
  id: string;
  nome: string;
  modo: "caderno" | "infinito";
  capa: Capa;
  /** Pasta a que pertence; vazio = fora de pasta. */
  pastaId: string;
  criadoEm: number;
}

/** Pasta da estante de cadernos. */
export interface PastaCaderno {
  id: string;
  nome: string;
  criadoEm: number;
}

/** Uma página de um caderno. `papel` é o objeto Papel do pacote (ou null). */
export interface PaginaCaderno {
  id: string;
  cadernoId: string;
  ordem: number;
  /** "a4", "a5", "carta" ou "infinito". */
  tamanho: string;
  papel: unknown;
  /** Título da página (para o índice); vazio = sem título. */
  titulo: string;
  /** Marcador. */
  marcado: boolean;
  criadoEm: number;
}

/** Prateleira (grupo) de livros. */
export interface GrupoLivro {
  id: string;
  nome: string;
  criadoEm: number;
}

/** Um interesse ou hiperfoco. Imagens e links usam os anexos do item. */
export interface Hobby {
  id: string;
  nome: string;
  notas: string;
  criadoEm: number;
}

/** Tipo de cartão do quadro livre de um hobby. */
export type TipoCartao = "texto" | "arquivo" | "imagem" | "link" | "audio";

/** Um cartão solto no quadro de um hobby, posicionado onde a pessoa quiser. */
export interface CartaoQuadro {
  id: string;
  hobbyId: string;
  tipo: TipoCartao;
  /** Texto livre (cartão de texto) ou legenda. */
  texto: string;
  /** Id do anexo ligado (arquivo, imagem, link ou áudio). */
  anexoId: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  criadoEm: number;
}

/** Matéria (disciplina) da vida acadêmica. */
export interface Materia {
  /** Vazio ao criar. */
  id: string;
  nome: string;
  professor: string;
  /** Nome de cor da paleta de etiquetas. */
  cor: string;
  criadoEm: number;
}

/** Prova, trabalho ou dever de casa de uma matéria. */
export interface Atividade {
  /** Vazio ao criar. */
  id: string;
  materiaId: string;
  /** "prova", "trabalho" ou "dever". */
  tipo: string;
  titulo: string;
  /** "AAAA-MM-DD". */
  data: string;
  /** Peso na média; null conta como 1. */
  peso: number | null;
  /** Nota recebida; null quando ainda não saiu. */
  nota: number | null;
  feita: boolean;
  criadoEm: number;
}

/** Uma aula fixa da grade semanal: uma matéria num dia e horário. */
export interface Aula {
  id: string;
  materiaId: string;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  /** "HH:MM". */
  inicio: string;
  fim: string;
  criadoEm: number;
}

export interface SituacaoBackup {
  pasta: string | null;
  ultimo: number | null;
  erro: string | null;
}

export interface InfoBackup {
  criadoEm: number;
  versaoApp: string;
  /** Sem senha, o backup abre com as 6 palavras e a pessoa escolhe como abrir depois. */
  temSenha: boolean;
}

export type CodigoErro =
  | "senha_errada"
  | "pin_errado"
  | "pin_bloqueado"
  | "palavras_erradas"
  | "chave_errada"
  | "senha_curta"
  | "sem_senha"
  | "pin_invalido"
  | "cofre_existe"
  | "cofre_ausente"
  | "bloqueado"
  | "aparelho_sem_chave"
  | "hello_cancelado"
  | "hello_indisponivel"
  | "backup_invalido"
  | "limite_projetos"
  | "texto_vazio"
  | "nao_encontrado"
  | "arquivo"
  | "ia"
  | "nuvem"
  | "ditado"
  | "interno";

export class ErroOrbita extends Error {
  constructor(
    public codigo: CodigoErro,
    mensagem: string,
    public tentativasRestantes?: number,
    public posicoes?: number[],
    public limite?: number,
    /** Só para erros da IA: chave, limite, rede, local_fechado, sem_provedor... */
    public motivo?: string,
  ) {
    super(mensagem);
  }
}

function comoErro(e: unknown): ErroOrbita {
  if (e instanceof ErroOrbita) return e;
  if (typeof e === "object" && e && "codigo" in e) {
    const x = e as { codigo: CodigoErro; mensagem: string; tentativasRestantes?: number; posicoes?: number[]; limite?: number; motivo?: string };
    return new ErroOrbita(x.codigo, x.mensagem, x.tentativasRestantes, x.posicoes, x.limite, x.motivo);
  }
  return new ErroOrbita("interno", String(e));
}

export type TipoProvedor = "claude" | "compativel";
export type FuncaoIa = "quebrar" | "conversa" | "revisao" | "personalizacao";

export interface Provedor {
  /** Vazio ao criar. */
  id: string;
  tipo: TipoProvedor;
  nome: string;
  url: string;
  modelo: string;
}

export interface ProvedorVisivel extends Provedor {
  /** Só os quatro últimos caracteres da chave. */
  finalChave: string | null;
  /** Roda no próprio computador (Ollama). */
  local: boolean;
}

export interface EstadoIa {
  provedores: ProvedorVisivel[];
  funcoes: Partial<Record<FuncaoIa, string>>;
  /** Modelo próprio da função (sem ele, vale o modelo padrão do provedor). */
  modelos: Partial<Record<FuncaoIa, string>>;
  bloquearSensivel: boolean;
}

export type TipoItemProposto = "ideia" | "tarefa" | "compromisso";

export interface ItemProposto {
  tipo: TipoItemProposto;
  texto: string;
  /** Só tarefa; null se a IA citou um projeto que não existe. */
  projetoId: string | null;
  /** Só compromisso: "AAAA-MM-DD", "HH:MM" (sem hora = dia inteiro) e duração. */
  data: string | null;
  hora: string | null;
  duracaoMin: number | null;
}

export interface Organizacao {
  itens: ItemProposto[];
  provedor: string;
  local: boolean;
}

export type ModeloVoz = "base" | "small";

/** Jeitos de reescrever um texto com IA. */
export const MODOS_REESCRITA = ["revisar", "claro", "curto", "detalhado", "topicos", "leve", "formal", "livre"] as const;
export type ModoReescrita = (typeof MODOS_REESCRITA)[number];

export interface EstadoDitado {
  instalado: ModeloVoz | null;
  baixando: boolean;
  gravando: boolean;
}

export interface Sugestao {
  passos: string[];
  provedor: string;
  local: boolean;
}

interface Api {
  situacao(): Promise<Situacao>;
  /** `senha` é opcional: sem ela, as 6 palavras fazem o papel de senha. */
  criarCofre(senha: string | null, modo: ModoAbrir, pin?: string): Promise<string[]>;
  /** Abre com as 6 palavras e libera o PIN de novo. */
  abrirComPalavras(texto: string): Promise<void>;
  abrirComSenha(senha: string): Promise<void>;
  abrirComPin(pin: string): Promise<void>;
  abrirDireto(): Promise<void>;
  helloDisponivel(): Promise<boolean>;
  abrirComHello(): Promise<void>;
  conferirPalavras(texto: string): Promise<void>;
  recuperar(texto: string, novaSenha: string): Promise<void>;
  lerArquivoRecuperacao(caminho: string): Promise<string>;
  gravarArquivoRecuperacao(caminho: string): Promise<void>;
  verPalavras(confirmacao: Confirmacao): Promise<string[]>;
  /** Cria a senha (se não houver) ou troca a atual. */
  definirSenha(confirmacao: Confirmacao, nova: string): Promise<void>;
  mudarModo(confirmacao: Confirmacao, modo: ModoAbrir, pin?: string): Promise<void>;
  bloquear(): Promise<void>;
  listarIdeias(): Promise<Ideia[]>;
  criarIdeia(texto: string): Promise<Ideia>;
  editarIdeia(id: string, texto: string): Promise<void>;
  salvarNotaIdeia(id: string, nota: string): Promise<void>;
  listarEtiquetas(): Promise<Etiqueta[]>;
  /** Se já existe uma com o mesmo nome, devolve a existente. */
  criarEtiqueta(nome: string, cor: CorEtiqueta): Promise<Etiqueta>;
  editarEtiqueta(id: string, nome: string, cor: CorEtiqueta): Promise<void>;
  excluirEtiqueta(id: string): Promise<void>;
  /** Deixa o item exatamente com estas etiquetas. */
  definirEtiquetasItem(id: string, etiquetas: string[]): Promise<void>;
  ligarItens(a: string, b: string, ligar: boolean): Promise<void>;
  /** Ideias, projetos e tarefas ligados a este, nos dois sentidos. */
  itensLigados(id: string): Promise<ItemResumo[]>;
  listarAnexos(item: string): Promise<Anexo[]>;
  /** Guarda uma cópia do arquivo dentro do cofre (até 20 MB). */
  anexarArquivo(item: string, caminho: string): Promise<Anexo>;
  anexarLink(item: string, nome: string, endereco: string): Promise<Anexo>;
  /** Anexa conteúdo da memória (por exemplo, um áudio gravado), em base64. */
  anexarBytes(item: string, nome: string, base64: string): Promise<Anexo>;
  /** A imagem como endereço de dados, para mostrar na tela. */
  imagemAnexo(id: string): Promise<string>;
  /** Link no navegador; arquivo no programa padrão do computador. */
  abrirAnexo(id: string): Promise<void>;
  salvarAnexo(id: string, caminho: string): Promise<void>;
  excluirAnexo(id: string): Promise<void>;
  ideiaParaProjeto(id: string, ativo: boolean): Promise<Projeto>;
  excluirItem(id: string): Promise<void>;
  listarProjetos(): Promise<Projeto[]>;
  obterProjeto(id: string): Promise<Projeto>;
  criarProjeto(titulo: string, ativo: boolean): Promise<Projeto>;
  renomear(id: string, titulo: string): Promise<void>;
  mudarEstadoProjeto(id: string, novo: EstadoProjeto, ondeParei?: Omit<OndeParei, "atualizadoEm">): Promise<Projeto>;
  salvarOndeParei(id: string, ondeParei: Omit<OndeParei, "atualizadoEm">): Promise<void>;
  limiteProjetos(): Promise<number>;
  definirLimiteProjetos(limite: number): Promise<void>;
  listarTarefas(projetoId: string): Promise<Tarefa[]>;
  criarTarefa(paiId: string, titulo: string): Promise<Tarefa>;
  mudarEstadoTarefa(id: string, novo: EstadoTarefa): Promise<void>;
  moverTarefa(id: string, antesDe: string | null): Promise<void>;
  listarEventos(de: number, ate: number): Promise<Evento[]>;
  salvarEvento(evento: Evento): Promise<Evento>;
  pularDataEvento(id: string, data: string): Promise<void>;
  excluirEvento(id: string): Promise<void>;
  listarRotinas(): Promise<Rotina[]>;
  criarRotina(titulo: string): Promise<Rotina>;
  salvarPasso(rotinaId: string, passo: Passo): Promise<Passo>;
  registrarEnergia(nivel: number, nota: string): Promise<RegistroEnergia>;
  listarEnergia(de: number, ate: number): Promise<RegistroEnergia[]>;
  basicosDoDia(data: string): Promise<Basico[]>;
  definirBasicos(lista: string[]): Promise<void>;
  marcarBasico(data: string, texto: string, feito: boolean): Promise<void>;
  tarefasSugeridas(): Promise<TarefaSugerida[]>;
  listarRemedios(): Promise<Remedio[]>;
  salvarRemedio(remedio: Remedio): Promise<Remedio>;
  excluirRemedio(id: string): Promise<void>;
  pausarRemedio(id: string, pausado: boolean): Promise<void>;
  dosesDoDia(data: string): Promise<DoseDoDia[]>;
  marcarDose(remedioId: string, horario: string, data: string, tomada: boolean): Promise<void>;
  /** `hoje`: "AAAA-MM-DD". Avisos de estoque acabando e receita vencendo. */
  alertasSaude(hoje: string): Promise<AvisoSaude[]>;
  /** `tipo`: "sono", "sintoma" ou "sobrecarga". `intensidade`: 1 a 5 ou null. */
  registrarSaude(tipo: string, intensidade: number | null, nota: string): Promise<RegistroSaude>;
  listarRegistrosSaude(de: number, ate: number): Promise<RegistroSaude[]>;
  excluirRegistroSaude(id: string): Promise<void>;
  listarPlanos(): Promise<PlanoSaude[]>;
  salvarPlano(plano: PlanoSaude): Promise<PlanoSaude>;
  excluirPlano(id: string): Promise<void>;
  listarProfissionais(): Promise<Profissional[]>;
  salvarProfissional(profissional: Profissional): Promise<Profissional>;
  excluirProfissional(id: string): Promise<void>;
  /** `tipo`: "pauta" (o que levar) ou "pergunta" (para o profissional). */
  listarNotasCuidado(profissionalId: string, tipo: string): Promise<Nota[]>;
  criarNotaCuidado(profissionalId: string, tipo: string, texto: string): Promise<Nota>;
  marcarNotaCuidado(id: string, feita: boolean): Promise<void>;
  excluirNotaCuidado(id: string): Promise<void>;
  registrarSessao(profissionalId: string, data: string, nota: string): Promise<RegistroSessao>;
  listarSessoes(profissionalId: string): Promise<RegistroSessao[]>;
  excluirSessao(id: string): Promise<void>;
  listarMaterias(): Promise<Materia[]>;
  salvarMateria(materia: Materia): Promise<Materia>;
  excluirMateria(id: string): Promise<void>;
  listarAtividades(): Promise<Atividade[]>;
  salvarAtividade(atividade: Atividade): Promise<Atividade>;
  marcarAtividade(id: string, feita: boolean): Promise<void>;
  excluirAtividade(id: string): Promise<void>;
  mediaAprovacao(): Promise<number>;
  definirMediaAprovacao(media: number): Promise<void>;
  listarAulas(): Promise<Aula[]>;
  salvarAula(aula: Aula): Promise<Aula>;
  excluirAula(id: string): Promise<void>;
  registrarGasto(centavos: number, grupoId: string, descricao: string, interesse: boolean): Promise<Gasto>;
  listarGastos(de: number, ate: number): Promise<Gasto[]>;
  excluirGasto(id: string): Promise<void>;
  listarGruposGasto(): Promise<Grupo[]>;
  salvarGrupoGasto(grupo: Grupo): Promise<Grupo>;
  excluirGrupoGasto(id: string): Promise<void>;
  listarContas(): Promise<Conta[]>;
  salvarConta(conta: Conta): Promise<Conta>;
  excluirConta(id: string): Promise<void>;
  listarDesejos(): Promise<Desejo[]>;
  criarDesejo(nome: string, centavos: number, esperaHoras: number): Promise<Desejo>;
  resolverDesejo(id: string): Promise<void>;
  excluirDesejo(id: string): Promise<void>;
  listarMetas(): Promise<Meta[]>;
  salvarMeta(meta: Meta): Promise<Meta>;
  excluirMeta(id: string): Promise<void>;
  listarHobbies(): Promise<Hobby[]>;
  salvarHobby(hobby: Hobby): Promise<Hobby>;
  excluirHobby(id: string): Promise<void>;
  listarCartoes(hobbyId: string): Promise<CartaoQuadro[]>;
  salvarCartao(cartao: CartaoQuadro): Promise<CartaoQuadro>;
  moverCartao(id: string, x: number, y: number): Promise<void>;
  excluirCartao(id: string): Promise<void>;
  listarQuadros(): Promise<Quadro[]>;
  salvarQuadro(quadro: Quadro): Promise<Quadro>;
  excluirQuadro(id: string): Promise<void>;
  listarColunas(quadroId: string): Promise<Coluna[]>;
  salvarColuna(coluna: Coluna): Promise<Coluna>;
  excluirColuna(id: string): Promise<void>;
  listarCartoesOrg(quadroId: string): Promise<CartaoOrg[]>;
  salvarCartaoOrg(cartao: CartaoOrg): Promise<CartaoOrg>;
  marcarCartaoOrg(id: string, feito: boolean): Promise<void>;
  moverCartaoOrg(id: string, colunaId: string, ordem: number): Promise<void>;
  reordenarCartoesOrg(ids: string[]): Promise<void>;
  excluirCartaoOrg(id: string): Promise<void>;
  listarPastasCaderno(): Promise<PastaCaderno[]>;
  salvarPastaCaderno(pasta: PastaCaderno): Promise<PastaCaderno>;
  excluirPastaCaderno(id: string): Promise<void>;
  listarCadernos(): Promise<Caderno[]>;
  salvarCaderno(cad: Caderno): Promise<Caderno>;
  excluirCaderno(id: string): Promise<void>;
  listarPaginasCaderno(cadernoId: string): Promise<PaginaCaderno[]>;
  salvarPaginaCaderno(pagina: PaginaCaderno): Promise<PaginaCaderno>;
  excluirPaginaCaderno(id: string): Promise<void>;
  carregarCenaCaderno(paginaId: string): Promise<string>;
  salvarCenaCaderno(paginaId: string, cena: string): Promise<void>;
  listarLivros(): Promise<Livro[]>;
  salvarLivro(livro: Livro): Promise<Livro>;
  mudarStatusLivro(id: string, status: string): Promise<void>;
  excluirLivro(id: string): Promise<void>;
  /** Conteúdo de um anexo em base64 (para abrir um livro no leitor). */
  bytesAnexo(id: string): Promise<string>;
  /** Conteúdo de um arquivo do disco em base64 (para ler os metadados ao escolher). */
  bytesArquivo(caminho: string): Promise<string>;
  listarGruposLivro(): Promise<GrupoLivro[]>;
  salvarGrupoLivro(grupo: GrupoLivro): Promise<GrupoLivro>;
  excluirGrupoLivro(id: string): Promise<void>;
  listarAnotacoes(livroId: string): Promise<Anotacao[]>;
  salvarAnotacao(anotacao: Anotacao): Promise<Anotacao>;
  excluirAnotacao(id: string): Promise<void>;
  definirPesoTarefa(id: string, peso: Peso | null): Promise<void>;
  definirDatasProjeto(id: string, inicio: string | null, prazo: string | null): Promise<void>;
  definirPrazoTarefa(id: string, prazo: string | null): Promise<void>;
  listarPrazos(de: string, ate: string): Promise<Prazo[]>;
  fazerBackup(caminho: string): Promise<void>;
  /** Grava um texto (exportação em formato aberto) no caminho escolhido. */
  exportarTexto(caminho: string, conteudo: string): Promise<void>;
  infoBackup(caminho: string): Promise<InfoBackup>;
  /** `escolha`: como abrir no dia a dia depois (obrigatória se o backup não tem senha). */
  restaurarBackup(caminho: string, segredo: { senha?: string; palavras?: string }, escolha?: { modo: ModoAbrir; pin?: string }): Promise<ModoAbrir>;
  situacaoBackup(): Promise<SituacaoBackup>;
  definirBackupAutomatico(pasta: string | null): Promise<SituacaoBackup>;
  estadoIa(): Promise<EstadoIa>;
  /** `chave`: null mantém a atual; texto vazio apaga. */
  salvarProvedorIa(provedor: Provedor, chave: string | null): Promise<EstadoIa>;
  removerProvedorIa(id: string): Promise<EstadoIa>;
  definirFuncaoIa(funcao: FuncaoIa, provedorId: string | null, modelo?: string | null): Promise<EstadoIa>;
  bloquearSensivelIa(bloquear: boolean): Promise<EstadoIa>;
  /** Confere a chave e devolve os modelos disponíveis. Não gasta créditos. */
  testarProvedorIa(provedor: Provedor, chave: string | null): Promise<string[]>;
  memoriaDoComputador(): Promise<number | null>;
  /** Sugestões de passos para um projeto ou uma etapa. Não grava nada. */
  sugerirPassosIa(alvo: string): Promise<Sugestao>;
  /** Separa um texto em ideias, tarefas e compromissos. Não grava nada. */
  organizarTextoIa(texto: string, sensivel: boolean): Promise<Organizacao>;
  /** Conversa: refaz a lista separada com a mudança pedida. Não grava nada. */
  /** `itens`: a lista atual em JSON, no formato que a IA usa (com o nome do projeto). */
  ajustarOrganizacaoIa(texto: string, itens: string, mudanca: string, sensivel: boolean): Promise<Organizacao>;
  /** Revisa ortografia e pontuação. Não grava nada. */
  revisarTextoIa(texto: string, sensivel: boolean, modo?: ModoReescrita, instrucao?: string): Promise<string>;
  ditadoEstado(): Promise<EstadoDitado>;
  ditadoBaixar(modelo: ModeloVoz): Promise<EstadoDitado>;
  ditadoCancelarDownload(): Promise<void>;
  ditadoRemover(): Promise<EstadoDitado>;
  ditadoComecar(): Promise<void>;
  /** Para de gravar e devolve o texto transcrito no computador. */
  ditadoParar(): Promise<string>;
  ditadoDescartar(): Promise<void>;
  /** Andamento do download do modelo de voz. Devolve a função para parar de ouvir. */
  ouvirProgressoDitado(aoMudar: (baixado: number, total: number) => void): Promise<() => void>;
  /** A IA escreve um tema (texto com JSON). `anterior`: tema atual, para ajustar. */
  gerarTemaIa(provedorId: string, pedido: string, anterior: string | null, comDesenho: boolean): Promise<string>;
  /** Experimental: a IA desenha um lote de ícones. Devolve o texto da IA (JSON com o miolo dos SVGs). */
  desenharIconesIa(provedorId: string, estilo: string, icones: [string, string][], referencia: string | null): Promise<string>;
  /** Modelos de imagem que a conta tem nesse provedor (pode ser nenhum). */
  modelosImagemIa(provedorId: string): Promise<string[]>;
  /** Imagem de fundo gerada pela IA, como endereço de dados. */
  /** `alta`: resolução maior, mais demorada e mais cara. `vivas`: cores fortes em vez das suaves (padrão). */
  gerarImagemIa(provedorId: string, modelo: string, pedido: string, alta: boolean, vivas: boolean): Promise<string>;
  /** Quais contas esta versão sabe usar (depende do cadastro no Google e na Microsoft). */
  nuvemDisponivel(): Promise<Record<ProvedorNuvem, boolean>>;
  nuvemSituacao(): Promise<SituacaoNuvem | null>;
  /** Abre o navegador para entrar na conta e já envia a chave e o backup. */
  nuvemConectar(provedor: ProvedorNuvem): Promise<SituacaoNuvem>;
  /** `soSePreciso`: só envia se o último envio tiver mais de 20 horas. */
  nuvemEnviar(soSePreciso: boolean): Promise<SituacaoNuvem | null>;
  nuvemDesconectar(apagar: boolean): Promise<void>;
  /** Computador novo: entra na conta e busca os dados (ainda não restaura). */
  nuvemBuscarParaRecuperar(provedor: ProvedorNuvem): Promise<EncontradoNaNuvem>;
  nuvemConcluirRecuperacao(modo: ModoAbrir, pin?: string): Promise<ModoAbrir>;
  /** Fechar a janela deixa o Órbita na bandeja do sistema. */
  bandejaLigada(): Promise<boolean>;
  definirBandeja(ligar: boolean): Promise<void>;
}

const chamar = async <T>(comando: string, args?: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(comando, args);
  } catch (e) {
    throw comoErro(e);
  }
};

const nativa: Api = {
  situacao: () => chamar("situacao"),
  criarCofre: (senha, modo, pin) => chamar("criar_cofre", { senha, modo, pin: pin ?? null }),
  abrirComPalavras: (texto) => chamar("abrir_com_palavras", { texto }),
  abrirComSenha: (senha) => chamar("abrir_com_senha", { senha }),
  abrirComPin: (pin) => chamar("abrir_com_pin", { pin }),
  abrirDireto: () => chamar("abrir_direto"),
  helloDisponivel: () => chamar("hello_disponivel"),
  abrirComHello: () => chamar("abrir_com_hello"),
  conferirPalavras: (texto) => chamar("conferir_palavras", { texto }),
  recuperar: (texto, novaSenha) => chamar("recuperar", { texto, novaSenha }),
  lerArquivoRecuperacao: (caminho) => chamar("ler_arquivo_recuperacao", { caminho }),
  gravarArquivoRecuperacao: (caminho) => chamar("gravar_arquivo_recuperacao", { caminho }),
  verPalavras: (confirmacao) => chamar("ver_palavras", { confirmacao }),
  definirSenha: (confirmacao, nova) => chamar("definir_senha", { confirmacao, nova }),
  mudarModo: (confirmacao, modo, pin) => chamar("mudar_modo", { confirmacao, modo, pin: pin ?? null }),
  bloquear: () => chamar("bloquear"),
  listarIdeias: () => chamar("listar_ideias"),
  criarIdeia: (texto) => chamar("criar_ideia", { texto }),
  editarIdeia: (id, texto) => chamar("editar_ideia", { id, texto }),
  salvarNotaIdeia: (id, nota) => chamar("salvar_nota_ideia", { id, nota }),
  listarEtiquetas: () => chamar("listar_etiquetas"),
  criarEtiqueta: (nome, cor) => chamar("criar_etiqueta", { nome, cor }),
  editarEtiqueta: (id, nome, cor) => chamar("editar_etiqueta", { id, nome, cor }),
  excluirEtiqueta: (id) => chamar("excluir_etiqueta", { id }),
  definirEtiquetasItem: (id, etiquetas) => chamar("definir_etiquetas_item", { id, etiquetas }),
  ligarItens: (a, b, ligar) => chamar("ligar_itens", { a, b, ligar }),
  itensLigados: (id) => chamar("itens_ligados", { id }),
  listarAnexos: (item) => chamar("listar_anexos", { item }),
  anexarArquivo: (item, caminho) => chamar("anexar_arquivo", { item, caminho }),
  anexarLink: (item, nome, endereco) => chamar("anexar_link", { item, nome, endereco }),
  anexarBytes: (item, nome, base64) => chamar("anexar_bytes", { item, nome, base64 }),
  imagemAnexo: (id) => chamar("imagem_anexo", { id }),
  abrirAnexo: (id) => chamar("abrir_anexo", { id }),
  salvarAnexo: (id, caminho) => chamar("salvar_anexo", { id, caminho }),
  excluirAnexo: (id) => chamar("excluir_anexo", { id }),
  ideiaParaProjeto: (id, ativo) => chamar("ideia_para_projeto", { id, ativo }),
  excluirItem: (id) => chamar("excluir_item", { id }),
  listarProjetos: () => chamar("listar_projetos"),
  obterProjeto: (id) => chamar("obter_projeto", { id }),
  criarProjeto: (titulo, ativo) => chamar("criar_projeto", { titulo, ativo }),
  renomear: (id, titulo) => chamar("renomear", { id, titulo }),
  mudarEstadoProjeto: (id, novo, ondeParei) =>
    chamar("mudar_estado_projeto", { id, novo, ondeParei: ondeParei ? { ...ondeParei, atualizadoEm: 0 } : null }),
  salvarOndeParei: (id, ondeParei) => chamar("salvar_onde_parei", { id, ondeParei: { ...ondeParei, atualizadoEm: 0 } }),
  limiteProjetos: () => chamar("limite_projetos"),
  definirLimiteProjetos: (limite) => chamar("definir_limite_projetos", { limite }),
  listarTarefas: (projetoId) => chamar("listar_tarefas", { projetoId }),
  criarTarefa: (paiId, titulo) => chamar("criar_tarefa", { paiId, titulo }),
  mudarEstadoTarefa: (id, novo) => chamar("mudar_estado_tarefa", { id, novo }),
  moverTarefa: (id, antesDe) => chamar("mover_tarefa", { id, antesDe }),
  listarEventos: (de, ate) => chamar("listar_eventos", { de, ate }),
  salvarEvento: (evento) => chamar("salvar_evento", { evento }),
  pularDataEvento: (id, data) => chamar("pular_data_evento", { id, data }),
  excluirEvento: (id) => chamar("excluir_evento", { id }),
  listarRotinas: () => chamar("listar_rotinas"),
  criarRotina: (titulo) => chamar("criar_rotina", { titulo }),
  salvarPasso: (rotinaId, passo) => chamar("salvar_passo", { rotinaId, passo }),
  registrarEnergia: (nivel, nota) => chamar("registrar_energia", { nivel, nota }),
  listarEnergia: (de, ate) => chamar("listar_energia", { de, ate }),
  basicosDoDia: (data) => chamar("basicos_do_dia", { data }),
  listarRemedios: () => chamar("listar_remedios"),
  salvarRemedio: (remedio) => chamar("salvar_remedio", { remedio }),
  excluirRemedio: (id) => chamar("excluir_remedio", { id }),
  pausarRemedio: (id, pausado) => chamar("pausar_remedio", { id, pausado }),
  dosesDoDia: (data) => chamar("doses_do_dia", { data }),
  marcarDose: (remedioId, horario, data, tomada) => chamar("marcar_dose", { remedioId, horario, data, tomada }),
  alertasSaude: (hoje) => chamar("alertas_saude", { hoje }),
  registrarSaude: (tipo, intensidade, nota) => chamar("registrar_saude", { tipo, intensidade, nota }),
  listarRegistrosSaude: (de, ate) => chamar("listar_registros_saude", { de, ate }),
  excluirRegistroSaude: (id) => chamar("excluir_registro_saude", { id }),
  listarPlanos: () => chamar("listar_planos"),
  salvarPlano: (plano) => chamar("salvar_plano", { plano }),
  excluirPlano: (id) => chamar("excluir_plano", { id }),
  listarProfissionais: () => chamar("listar_profissionais"),
  salvarProfissional: (profissional) => chamar("salvar_profissional", { profissional }),
  excluirProfissional: (id) => chamar("excluir_profissional", { id }),
  listarNotasCuidado: (profissionalId, tipo) => chamar("listar_notas_cuidado", { profissionalId, tipo }),
  criarNotaCuidado: (profissionalId, tipo, texto) => chamar("criar_nota_cuidado", { profissionalId, tipo, texto }),
  marcarNotaCuidado: (id, feita) => chamar("marcar_nota_cuidado", { id, feita }),
  excluirNotaCuidado: (id) => chamar("excluir_nota_cuidado", { id }),
  registrarSessao: (profissionalId, data, nota) => chamar("registrar_sessao", { profissionalId, data, nota }),
  listarSessoes: (profissionalId) => chamar("listar_sessoes", { profissionalId }),
  excluirSessao: (id) => chamar("excluir_sessao", { id }),
  listarMaterias: () => chamar("listar_materias"),
  salvarMateria: (materia) => chamar("salvar_materia", { materia }),
  excluirMateria: (id) => chamar("excluir_materia", { id }),
  listarAtividades: () => chamar("listar_atividades"),
  salvarAtividade: (atividade) => chamar("salvar_atividade", { atividade }),
  marcarAtividade: (id, feita) => chamar("marcar_atividade", { id, feita }),
  excluirAtividade: (id) => chamar("excluir_atividade", { id }),
  mediaAprovacao: () => chamar("media_aprovacao"),
  definirMediaAprovacao: (media) => chamar("definir_media_aprovacao", { media }),
  listarAulas: () => chamar("listar_aulas"),
  salvarAula: (aula) => chamar("salvar_aula", { aula }),
  excluirAula: (id) => chamar("excluir_aula", { id }),
  registrarGasto: (centavos, grupoId, descricao, interesse) => chamar("registrar_gasto", { centavos, grupoId, descricao, interesse }),
  listarGastos: (de, ate) => chamar("listar_gastos", { de, ate }),
  excluirGasto: (id) => chamar("excluir_gasto", { id }),
  listarGruposGasto: () => chamar("listar_grupos_gasto"),
  salvarGrupoGasto: (grupo) => chamar("salvar_grupo_gasto", { grupo }),
  excluirGrupoGasto: (id) => chamar("excluir_grupo_gasto", { id }),
  listarContas: () => chamar("listar_contas"),
  salvarConta: (conta) => chamar("salvar_conta", { conta }),
  excluirConta: (id) => chamar("excluir_conta", { id }),
  listarDesejos: () => chamar("listar_desejos"),
  criarDesejo: (nome, centavos, esperaHoras) => chamar("criar_desejo", { nome, centavos, esperaHoras }),
  resolverDesejo: (id) => chamar("resolver_desejo", { id }),
  excluirDesejo: (id) => chamar("excluir_desejo", { id }),
  listarMetas: () => chamar("listar_metas"),
  salvarMeta: (meta) => chamar("salvar_meta", { meta }),
  excluirMeta: (id) => chamar("excluir_meta", { id }),
  listarHobbies: () => chamar("listar_hobbies"),
  salvarHobby: (hobby) => chamar("salvar_hobby", { hobby }),
  excluirHobby: (id) => chamar("excluir_hobby", { id }),
  listarCartoes: (hobbyId) => chamar("listar_cartoes", { hobbyId }),
  salvarCartao: (cartao) => chamar("salvar_cartao", { cartao }),
  moverCartao: (id, x, y) => chamar("mover_cartao", { id, x, y }),
  excluirCartao: (id) => chamar("excluir_cartao", { id }),
  listarQuadros: () => chamar("listar_quadros"),
  salvarQuadro: (quadro) => chamar("salvar_quadro", { quadro }),
  excluirQuadro: (id) => chamar("excluir_quadro", { id }),
  listarColunas: (quadroId) => chamar("listar_colunas", { quadroId }),
  salvarColuna: (coluna) => chamar("salvar_coluna", { coluna }),
  excluirColuna: (id) => chamar("excluir_coluna", { id }),
  listarCartoesOrg: (quadroId) => chamar("listar_cartoes_org", { quadroId }),
  salvarCartaoOrg: (cartao) => chamar("salvar_cartao_org", { cartao }),
  marcarCartaoOrg: (id, feito) => chamar("marcar_cartao_org", { id, feito }),
  moverCartaoOrg: (id, colunaId, ordem) => chamar("mover_cartao_org", { id, colunaId, ordem }),
  reordenarCartoesOrg: (ids) => chamar("reordenar_cartoes_org", { ids }),
  excluirCartaoOrg: (id) => chamar("excluir_cartao_org", { id }),
  listarPastasCaderno: () => chamar("listar_pastas_caderno"),
  salvarPastaCaderno: (pasta) => chamar("salvar_pasta_caderno", { pasta }),
  excluirPastaCaderno: (id) => chamar("excluir_pasta_caderno", { id }),
  listarCadernos: () => chamar("listar_cadernos"),
  salvarCaderno: (cad) => chamar("salvar_caderno", { cad }),
  excluirCaderno: (id) => chamar("excluir_caderno", { id }),
  listarPaginasCaderno: (cadernoId) => chamar("listar_paginas_caderno", { cadernoId }),
  salvarPaginaCaderno: (pagina) => chamar("salvar_pagina_caderno", { pagina }),
  excluirPaginaCaderno: (id) => chamar("excluir_pagina_caderno", { id }),
  carregarCenaCaderno: (paginaId) => chamar("carregar_cena_caderno", { paginaId }),
  salvarCenaCaderno: (paginaId, cena) => chamar("salvar_cena_caderno", { paginaId, cena }),
  listarLivros: () => chamar("listar_livros"),
  salvarLivro: (livro) => chamar("salvar_livro", { livro }),
  mudarStatusLivro: (id, status) => chamar("mudar_status_livro", { id, status }),
  excluirLivro: (id) => chamar("excluir_livro", { id }),
  bytesAnexo: (id) => chamar("bytes_anexo", { id }),
  bytesArquivo: (caminho) => chamar("bytes_arquivo", { caminho }),
  listarGruposLivro: () => chamar("listar_grupos_livro"),
  salvarGrupoLivro: (grupo) => chamar("salvar_grupo_livro", { grupo }),
  excluirGrupoLivro: (id) => chamar("excluir_grupo_livro", { id }),
  listarAnotacoes: (livroId) => chamar("listar_anotacoes", { livroId }),
  salvarAnotacao: (anotacao) => chamar("salvar_anotacao", { anotacao }),
  excluirAnotacao: (id) => chamar("excluir_anotacao", { id }),
  definirBasicos: (lista) => chamar("definir_basicos", { lista }),
  marcarBasico: (data, texto, feito) => chamar("marcar_basico", { data, texto, feito }),
  tarefasSugeridas: () => chamar("tarefas_sugeridas"),
  definirPesoTarefa: (id, peso) => chamar("definir_peso_tarefa", { id, peso }),
  definirDatasProjeto: (id, inicio, prazo) => chamar("definir_datas_projeto", { id, inicio, prazo }),
  definirPrazoTarefa: (id, prazo) => chamar("definir_prazo_tarefa", { id, prazo }),
  listarPrazos: (de, ate) => chamar("listar_prazos", { de, ate }),
  fazerBackup: (caminho) => chamar("fazer_backup", { caminho }),
  exportarTexto: (caminho, conteudo) => chamar("exportar_texto", { caminho, conteudo }),
  infoBackup: (caminho) => chamar("info_backup", { caminho }),
  restaurarBackup: (caminho, { senha, palavras }, escolha) =>
    chamar("restaurar_backup", { caminho, senha: senha ?? null, palavras: palavras ?? null, modo: escolha?.modo ?? null, pin: escolha?.pin ?? null }),
  situacaoBackup: () => chamar("situacao_backup"),
  definirBackupAutomatico: (pasta) => chamar("definir_backup_automatico", { pasta }),
  estadoIa: () => chamar("estado_ia"),
  salvarProvedorIa: (provedor, chave) => chamar("salvar_provedor_ia", { provedor, chave }),
  removerProvedorIa: (id) => chamar("remover_provedor_ia", { id }),
  definirFuncaoIa: (funcao, provedorId, modelo) => chamar("definir_funcao_ia", { funcao, provedorId, modelo: modelo ?? null }),
  bloquearSensivelIa: (bloquear) => chamar("bloquear_sensivel_ia", { bloquear }),
  testarProvedorIa: (provedor, chave) => chamar("testar_provedor_ia", { provedor, chave }),
  memoriaDoComputador: () => chamar("memoria_do_computador"),
  sugerirPassosIa: (alvo) => chamar("sugerir_passos_ia", { alvo }),
  organizarTextoIa: (texto, sensivel) => chamar("organizar_texto_ia", { texto, sensivel }),
  ajustarOrganizacaoIa: (texto, itens, mudanca, sensivel) => chamar("ajustar_organizacao_ia", { texto, itens, mudanca, sensivel }),
  revisarTextoIa: (texto, sensivel, modo, instrucao) => chamar("revisar_texto_ia", { texto, sensivel, modo: modo ?? null, instrucao: instrucao ?? null }),
  ditadoEstado: () => chamar("ditado_estado"),
  ditadoBaixar: (modelo) => chamar("ditado_baixar", { modelo }),
  ditadoCancelarDownload: () => chamar("ditado_cancelar_download"),
  ditadoRemover: () => chamar("ditado_remover"),
  ditadoComecar: () => chamar("ditado_comecar"),
  ditadoParar: () => chamar("ditado_parar"),
  ditadoDescartar: () => chamar("ditado_descartar"),
  gerarTemaIa: (provedorId, pedido, anterior, comDesenho) => chamar("gerar_tema_ia", { provedorId, pedido, anterior, comDesenho }),
  modelosImagemIa: (provedorId) => chamar("modelos_imagem_ia", { provedorId }),
  desenharIconesIa: (provedorId, estilo, icones, referencia) => chamar("desenhar_icones_ia", { provedorId, estilo, icones, referencia }),
  gerarImagemIa: (provedorId, modelo, pedido, alta, vivas) => chamar("gerar_imagem_ia", { provedorId, modelo, pedido, alta, vivas }),
  nuvemDisponivel: () => chamar("nuvem_disponivel"),
  nuvemSituacao: () => chamar("nuvem_situacao"),
  nuvemConectar: (provedor) => chamar("nuvem_conectar", { provedor }),
  nuvemEnviar: (soSePreciso) => chamar("nuvem_enviar", { soSePreciso }),
  nuvemDesconectar: (apagar) => chamar("nuvem_desconectar", { apagar }),
  nuvemBuscarParaRecuperar: (provedor) => chamar("nuvem_buscar_para_recuperar", { provedor }),
  nuvemConcluirRecuperacao: (modo, pin) => chamar("nuvem_concluir_recuperacao", { modo, pin: pin ?? null }),
  bandejaLigada: () => chamar("bandeja_ligada"),
  definirBandeja: (ligar) => chamar("definir_bandeja", { ligar }),
  ouvirProgressoDitado: (aoMudar) => listen<{ baixado: number; total: number }>("ditado-progresso", (e) => aoMudar(e.payload.baixado, e.payload.total)),
};

/** Parte da simulação que cuida de ideias, projetos e tarefas (mesmas regras da parte nativa). */
function simularItens() {
  type Item = { id: string; tipo: "ideia" | "projeto" | "tarefa"; texto: string; estado: string; paiId: string | null; ordem: number; criadoEm: number; alteradoEm: number; ondeParei: OndeParei | null; pausadoEm: number | null; peso?: Peso | null; inicio?: string | null; prazo?: string | null; nota?: string; etiquetas?: string[] };
  let etiquetas: Etiqueta[] = [];
  let ligacoes: [string, string][] = [];
  const itens: Item[] = [];
  let limite = 3;
  const agora = () => Date.now();
  const novo = (x: Partial<Item> & Pick<Item, "tipo" | "texto" | "estado">): Item => {
    const item: Item = { id: crypto.randomUUID(), paiId: null, ordem: 0, criadoEm: agora(), alteradoEm: agora(), ondeParei: null, pausadoEm: null, ...x };
    itens.push(item);
    return item;
  };
  const vazio = (t: string) => {
    if (!t.trim()) throw new ErroOrbita("texto_vazio", "Escreva alguma coisa antes de salvar.");
    return t.trim();
  };
  const tarefasDe = (pid: string) => {
    const etapas = itens.filter((i) => i.tipo === "tarefa" && i.paiId === pid);
    return [...etapas, ...itens.filter((i) => i.tipo === "tarefa" && etapas.some((e) => e.id === i.paiId))];
  };
  const comoProjeto = (p: Item): Projeto => {
    const t = tarefasDe(p.id);
    return { id: p.id, titulo: p.texto, estado: p.estado as EstadoProjeto, ondeParei: p.ondeParei, pausadoEm: p.pausadoEm,
      inicio: p.inicio ?? null, prazo: p.prazo ?? null, criadoEm: p.criadoEm,
      tarefasFeitas: t.filter((x) => x.estado === "feita").length, tarefasTotal: t.length, alteradoEm: p.alteradoEm, etiquetas: vivas(p) };
  };
  const vivas = (i: Item) => (i.etiquetas ?? []).filter((e) => etiquetas.some((x) => x.id === e));
  const achar = (id: string) => {
    const i = itens.find((x) => x.id === id);
    if (!i) throw new ErroOrbita("nao_encontrado", "Não encontrei esse item.");
    return i;
  };
  const conferirLimite = () => {
    if (itens.filter((i) => i.tipo === "projeto" && i.estado === "ativo").length >= limite)
      throw new ErroOrbita("limite_projetos", `Já existem ${limite} projetos ativos, o limite que você definiu.`, undefined, undefined, limite);
  };
  const criarProjeto = async (titulo: string, ativo: boolean) => {
    if (ativo) conferirLimite();
    return comoProjeto(novo({ tipo: "projeto", texto: vazio(titulo), estado: ativo ? "ativo" : "pausado", pausadoEm: ativo ? null : agora() }));
  };
  const projetoDa = (paiId: string) => {
    const pai = achar(paiId);
    return pai.tipo === "projeto" ? pai : achar(pai.paiId!);
  };
  // Exemplo para as telas não começarem vazias.
  if (new URLSearchParams(globalThis.location?.search ?? "").get("exemplo")) {
    etiquetas = [
      { id: "e1", nome: "Arte", cor: "rosa" },
      { id: "e2", nome: "Escrita", cor: "mar" },
      { id: "e3", nome: "Trabalho", cor: "musgo" },
    ];
    const pod = novo({ tipo: "ideia", texto: "Podcast sobre neurodivergência e trabalho", estado: "guardada" });
    pod.etiquetas = ["e2", "e3"];
    pod.nota = "Convidar pessoas autistas que trabalham com tecnologia, arte e educação.\nEpisódios curtos, com transcrição.";
    const enc = novo({ tipo: "ideia", texto: "Aprender encadernação japonesa", estado: "guardada" });
    enc.etiquetas = ["e1"];
    const farol = novo({ tipo: "ideia", texto: "Livro de contos sobre faróis", estado: "guardada" });
    farol.etiquetas = ["e1", "e2"];
    novo({ tipo: "ideia", texto: "Organizar a caixa de cabos", estado: "guardada" });
    ligacoes = [[pod.id, farol.id]];
    const dia = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv-SE"); };
    const tcc = novo({ tipo: "projeto", texto: "TCC: atenção e interesses especiais", estado: "ativo", inicio: dia(-40), prazo: dia(50),
      ondeParei: { texto: "Fichando o artigo da Grandin", proximoPasso: "Abrir o PDF na página 12 e terminar o fichamento", links: ["https://scholar.google.com"], atualizadoEm: agora() - 3_600_000 } });
    const e1 = novo({ tipo: "tarefa", texto: "Revisão de literatura", estado: "fazendo", paiId: tcc.id, ordem: 1 });
    novo({ tipo: "tarefa", texto: "Fichar 5 artigos", estado: "feita", paiId: e1.id, ordem: 1 });
    novo({ tipo: "tarefa", texto: "Organizar as citações", estado: "a_fazer", paiId: e1.id, ordem: 2, peso: "leve" });
    novo({ tipo: "tarefa", texto: "Escrever a introdução", estado: "a_fazer", paiId: tcc.id, ordem: 2, prazo: dia(3) });
    novo({ tipo: "tarefa", texto: "Marcar reunião com a orientadora", estado: "feita", paiId: tcc.id, ordem: 3 });
    novo({ tipo: "projeto", texto: "Reformar a estante", estado: "ativo", inicio: dia(-5), prazo: dia(20) });
    ligacoes.push([tcc.id, pod.id]);
    tcc.etiquetas = ["e3"];
    novo({ tipo: "projeto", texto: "Curso de ilustração", estado: "pausado", pausadoEm: agora() - 86_400_000 * 9,
      ondeParei: { texto: "Terminei o módulo 3", proximoPasso: "Assistir a aula sobre luz e sombra", links: [], atualizadoEm: agora() - 86_400_000 * 9 } });
  }
  return {
    listarIdeias: async () =>
      itens.filter((i) => i.tipo === "ideia" && i.estado === "guardada").sort((a, b) => b.criadoEm - a.criadoEm)
        .map((i) => ({
          id: i.id, texto: i.texto, criadoEm: i.criadoEm, nota: i.nota ?? "",
          etiquetas: vivas(i),
          ligadas: ligacoes.flatMap(([a, b]) => (a === i.id ? [b] : b === i.id ? [a] : []))
            .filter((o) => itens.some((x) => x.id === o && x.tipo === "ideia" && x.estado === "guardada")),
        })),
    criarIdeia: async (texto: string) => {
      const i = novo({ tipo: "ideia", texto: vazio(texto), estado: "guardada" });
      return { id: i.id, texto: i.texto, criadoEm: i.criadoEm, nota: "", etiquetas: [], ligadas: [] };
    },
    editarIdeia: async (id: string, texto: string) => void (achar(id).texto = vazio(texto)),
    salvarNotaIdeia: async (id: string, nota: string) => void (achar(id).nota = nota.trim()),
    listarEtiquetas: async () => [...etiquetas].sort((a, b) => a.nome.localeCompare(b.nome)),
    criarEtiqueta: async (nome: string, cor: CorEtiqueta) => {
      const n = vazio(nome);
      const ja = etiquetas.find((e) => e.nome.toLowerCase() === n.toLowerCase());
      if (ja) return ja;
      const e = { id: `e${Date.now()}`, nome: n, cor };
      etiquetas.push(e);
      return e;
    },
    editarEtiqueta: async (id: string, nome: string, cor: CorEtiqueta) => void Object.assign(etiquetas.find((e) => e.id === id)!, { nome: vazio(nome), cor }),
    excluirEtiqueta: async (id: string) => void (etiquetas = etiquetas.filter((e) => e.id !== id)),
    definirEtiquetasItem: async (id: string, lista: string[]) => void (achar(id).etiquetas = [...lista]),
    ligarItens: async (a: string, b: string, ligar: boolean) => {
      ligacoes = ligacoes.filter(([x, y]) => !((x === a && y === b) || (x === b && y === a)));
      if (ligar && a !== b) ligacoes.push([a, b]);
    },
    itensLigados: async (id: string) =>
      ligacoes.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []))
        .map((o) => itens.find((x) => x.id === o))
        .filter((x): x is Item => !!x && (x.tipo !== "ideia" || x.estado === "guardada"))
        .map((x) => ({ id: x.id, tipo: x.tipo, titulo: x.texto, estado: x.estado })),
    ideiaParaProjeto: async (id: string, ativo: boolean) => {
      const ideia = achar(id);
      const p = await criarProjeto(ideia.texto, ativo);
      ideia.estado = "virou_projeto";
      return p;
    },
    excluirItem: async (id: string) => {
      const fora = new Set([id]);
      let mudou = true;
      while (mudou) {
        mudou = false;
        for (const i of itens) if (i.paiId && fora.has(i.paiId) && !fora.has(i.id)) (fora.add(i.id), (mudou = true));
      }
      for (let k = itens.length - 1; k >= 0; k--) if (fora.has(itens[k].id)) itens.splice(k, 1);
    },
    listarProjetos: async () => itens.filter((i) => i.tipo === "projeto").sort((a, b) => b.alteradoEm - a.alteradoEm).map(comoProjeto),
    obterProjeto: async (id: string) => comoProjeto(achar(id)),
    criarProjeto,
    renomear: async (id: string, titulo: string) => void (achar(id).texto = vazio(titulo)),
    mudarEstadoProjeto: async (id: string, estado: EstadoProjeto, ondeParei?: Omit<OndeParei, "atualizadoEm">) => {
      const p = achar(id);
      if (estado === "ativo" && p.estado !== "ativo") conferirLimite();
      if (ondeParei) p.ondeParei = { ...ondeParei, atualizadoEm: agora() };
      Object.assign(p, { estado, pausadoEm: estado === "pausado" ? agora() : null, alteradoEm: agora() });
      return comoProjeto(p);
    },
    salvarOndeParei: async (id: string, o: Omit<OndeParei, "atualizadoEm">) =>
      void (achar(id).ondeParei = { ...o, links: o.links.filter((l) => l.trim()), atualizadoEm: agora() }),
    limiteProjetos: async () => limite,
    definirLimiteProjetos: async (n: number) => void (limite = n),
    listarTarefas: async (pid: string) =>
      tarefasDe(pid).sort((a, b) => a.ordem - b.ordem)
        .map((t) => ({ id: t.id, paiId: t.paiId!, titulo: t.texto, estado: t.estado as EstadoTarefa, ordem: t.ordem, peso: t.peso ?? null, prazo: t.prazo ?? null, etiquetas: vivas(t) })),
    criarTarefa: async (paiId: string, titulo: string) => {
      const ordem = Math.max(0, ...itens.filter((i) => i.paiId === paiId).map((i) => i.ordem)) + 1;
      const t = novo({ tipo: "tarefa", texto: vazio(titulo), estado: "a_fazer", paiId, ordem });
      projetoDa(paiId).alteradoEm = agora();
      return { id: t.id, paiId, titulo: t.texto, estado: "a_fazer" as EstadoTarefa, ordem, peso: null, prazo: null, etiquetas: [] };
    },
    mudarEstadoTarefa: async (id: string, estado: EstadoTarefa) => {
      const t = achar(id);
      t.estado = estado;
      projetoDa(t.paiId!).alteradoEm = agora();
    },
    definirPesoTarefa: async (id: string, peso: Peso | null) => void (achar(id).peso = peso),
    definirDatasProjeto: async (id: string, inicio: string | null, prazo: string | null) => void Object.assign(achar(id), { inicio, prazo }),
    definirPrazoTarefa: async (id: string, prazo: string | null) => void (achar(id).prazo = prazo),
    listarPrazos: async (de: string, ate: string) => {
      const lista: Prazo[] = [];
      for (const i of itens) {
        if (!i.prazo || i.prazo < de || i.prazo > ate) continue;
        if (i.tipo === "projeto" && i.estado !== "concluido") lista.push({ id: i.id, tipo: "projeto", titulo: i.texto, data: i.prazo, projetoId: i.id, projeto: i.texto });
        if (i.tipo === "tarefa" && i.estado !== "feita") {
          const p = projetoDa(i.paiId!);
          if (p.estado !== "concluido") lista.push({ id: i.id, tipo: "tarefa", titulo: i.texto, data: i.prazo, projetoId: p.id, projeto: p.texto });
        }
      }
      return lista.sort((a, b) => a.data.localeCompare(b.data));
    },
    tarefasSugeridas: async () => {
      const ordem = (p: Peso | null | undefined) => (p === "leve" ? 0 : p === "media" ? 2 : p === "pesada" ? 3 : 1);
      return itens
        .filter((t) => t.tipo === "tarefa" && t.estado !== "feita" && !itens.some((f) => f.paiId === t.id))
        .map((t) => ({ t, p: projetoDa(t.paiId!) }))
        .filter(({ p }) => p.estado === "ativo")
        .sort((a, b) => ordem(a.t.peso) - ordem(b.t.peso))
        .map(({ t, p }) => ({ id: t.id, titulo: t.texto, peso: t.peso ?? null, projetoId: p.id, projeto: p.texto }));
    },
    moverTarefa: async (id: string, antesDe: string | null) => {
      const t = achar(id);
      const irmas = itens.filter((i) => i.paiId === t.paiId && i.id !== id).sort((a, b) => a.ordem - b.ordem);
      const pos = antesDe ? irmas.findIndex((i) => i.id === antesDe) : -1;
      irmas.splice(pos < 0 ? irmas.length : pos, 0, t);
      irmas.forEach((i, k) => (i.ordem = k + 1));
    },
  };
}

function simularAgenda() {
  const eventos: Evento[] = [];
  const hoje = new Date();
  const em = (dias: number, h: number, m = 0) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias, h, m).getTime();
  if (new URLSearchParams(globalThis.location?.search ?? "").get("exemplo")) {
    const base = { id: "", diaInteiro: false, repeticao: null, modelo: false, notas: "", excecoes: [] };
    eventos.push(
      { ...base, id: "a1", titulo: "Consulta com a psiquiatra", inicio: em(0, 15), fim: em(0, 16) },
      { ...base, id: "a2", titulo: "Terapia", inicio: em(-3, 10), fim: em(-3, 11), repeticao: { frequencia: "semanal", dias: [new Date(em(-3, 0)).getDay()], ate: null } },
      { ...base, id: "a3", titulo: "Aula de Psicopatologia", inicio: em(-14, 19), fim: em(-14, 21), modelo: true, repeticao: { frequencia: "semanal", dias: [1, 3], ate: null } },
      { ...base, id: "a4", titulo: "Trabalho de edição", inicio: em(-14, 9), fim: em(-14, 12), modelo: true, repeticao: { frequencia: "semanal", dias: [1, 2, 3, 4, 5], ate: null } },
      { ...base, id: "a5", titulo: "Entrega do artigo", inicio: em(2, 0), fim: null, diaInteiro: true },
    );
  }
  return {
    listarEventos: async () => eventos.map((e) => ({ ...e })),
    salvarEvento: async (e: Evento) => {
      if (!e.titulo.trim()) throw new ErroOrbita("texto_vazio", "Escreva alguma coisa antes de salvar.");
      const salvo = { ...e, id: e.id || crypto.randomUUID(), titulo: e.titulo.trim() };
      const i = eventos.findIndex((x) => x.id === salvo.id);
      if (i >= 0) eventos[i] = salvo;
      else eventos.push(salvo);
      return salvo;
    },
    pularDataEvento: async (id: string, data: string) => {
      const e = eventos.find((x) => x.id === id);
      if (e && !e.excecoes.includes(data)) e.excecoes.push(data);
    },
    excluirEvento: async (id: string) => {
      const i = eventos.findIndex((x) => x.id === id);
      if (i >= 0) eventos.splice(i, 1);
    },
  };
}

function simularRotinas(itens: ReturnType<typeof simularItens>, anexos: ReturnType<typeof simularAnexos>) {
  const rotinas: Rotina[] = [];
  if (new URLSearchParams(globalThis.location?.search ?? "").get("exemplo")) {
    rotinas.push({
      id: "r1",
      titulo: "Manhã",
      passos: [
        { id: "p1", titulo: "Beber um copo de água", icone: "copo", minutos: null },
        { id: "p2", titulo: "Tomar o remédio", icone: "remedio", minutos: null },
        { id: "p3", titulo: "Banho", icone: "banho", minutos: 15 },
        { id: "p4", titulo: "Café da manhã", icone: "cafe", minutos: 20 },
        { id: "p5", titulo: "Olhar a agenda do dia", icone: "agenda", minutos: 5 },
      ],
    });
  }
  return {
    listarRotinas: async () => structuredClone(rotinas).map((r) => ({ ...r, passos: r.passos.map((p) => ({ ...p, imagem: anexos.imagemDe(p.id) })) })),
    criarRotina: async (titulo: string) => {
      if (!titulo.trim()) throw new ErroOrbita("texto_vazio", "Escreva alguma coisa antes de salvar.");
      const r = { id: crypto.randomUUID(), titulo: titulo.trim(), passos: [] };
      rotinas.push(r);
      return structuredClone(r);
    },
    salvarPasso: async (rotinaId: string, passo: Passo) => {
      const r = rotinas.find((x) => x.id === rotinaId)!;
      const salvo = { ...passo, id: passo.id || crypto.randomUUID(), titulo: passo.titulo.trim() };
      const i = r.passos.findIndex((p) => p.id === salvo.id);
      if (i >= 0) r.passos[i] = salvo;
      else r.passos.push(salvo);
      return salvo;
    },
    // Renomear, excluir e mover valem também para rotinas e passos (como na parte nativa).
    renomear: async (id: string, titulo: string) => {
      const r = rotinas.find((x) => x.id === id);
      if (r) r.titulo = titulo.trim();
      else await itens.renomear(id, titulo);
    },
    excluirItem: async (id: string) => {
      const i = rotinas.findIndex((x) => x.id === id);
      if (i >= 0) return void rotinas.splice(i, 1);
      for (const r of rotinas) {
        const j = r.passos.findIndex((p) => p.id === id);
        if (j >= 0) return void r.passos.splice(j, 1);
      }
      await itens.excluirItem(id);
    },
    moverTarefa: async (id: string, antesDe: string | null) => {
      const r = rotinas.find((x) => x.passos.some((p) => p.id === id));
      if (!r) return itens.moverTarefa(id, antesDe);
      const passo = r.passos.find((p) => p.id === id)!;
      const resto = r.passos.filter((p) => p.id !== id);
      const pos = antesDe ? resto.findIndex((p) => p.id === antesDe) : -1;
      resto.splice(pos < 0 ? resto.length : pos, 0, passo);
      r.passos = resto;
    },
  };
}

/** Anexos de mentira: guardados só na memória da página. */
function simularAnexos(): Pick<Api, "listarAnexos" | "anexarArquivo" | "anexarLink" | "anexarBytes" | "imagemAnexo" | "abrirAnexo" | "salvarAnexo" | "excluirAnexo"> & { imagemDe: (item: string) => string | null } {
  const anexos: (Anexo & { item: string })[] = [];
  const desenho = (cor: string) =>
    `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="${cor}"/><circle cx="360" cy="90" r="40" fill="#f3efe6" opacity="0.8"/><path d="M0 260 L120 150 L230 250 L320 180 L480 280 L480 320 L0 320 Z" fill="#2f4a3a"/></svg>`)}`;
  const imagens = new Map<string, string>();
  const tipoDe = (nome: string): Anexo["tipo"] => (/\.(png|jpe?g|gif|webp|svg)$/i.test(nome) ? "imagem" : "arquivo");
  return {
    imagemDe: (item) => anexos.filter((a) => a.item === item && a.tipo === "imagem").pop()?.id ?? null,
    listarAnexos: async (item) => anexos.filter((a) => a.item === item).map(({ item: _, ...a }) => a),
    anexarArquivo: async (item, caminho) => {
      const nome = caminho.split(/[\\/]/).pop() || "arquivo";
      const a = { id: crypto.randomUUID(), tipo: tipoDe(nome), nome, endereco: "", tamanho: 184_320, criadoEm: Date.now(), item };
      if (a.tipo === "imagem") imagens.set(a.id, desenho(["#7a9c8a", "#8a7fa8", "#b08a6a"][anexos.length % 3]));
      anexos.push(a);
      return a;
    },
    anexarLink: async (item, nome, endereco) => {
      let e = endereco.trim();
      if (!e) throw new ErroOrbita("texto_vazio", "Escreva o endereço do link.");
      if (!/^[a-z][a-z0-9+.-]*:/i.test(e)) e = `https://${e}`;
      if (!/^https?:\/\//i.test(e)) throw new ErroOrbita("arquivo", "Só dá para anexar links da internet (http ou https).");
      const a = { id: crypto.randomUUID(), tipo: "link" as const, nome: nome.trim() || e, endereco: e, tamanho: 0, criadoEm: Date.now(), item };
      anexos.push(a);
      return a;
    },
    anexarBytes: async (item, nome) => {
      const a = { id: crypto.randomUUID(), tipo: tipoDe(nome), nome, endereco: "", tamanho: 24_000, criadoEm: Date.now(), item };
      anexos.push(a);
      return a;
    },
    imagemAnexo: async (id) => imagens.get(id) ?? Promise.reject(new ErroOrbita("nao_encontrado", "Não encontrei esse item.")),
    abrirAnexo: async (id) => {
      const a = anexos.find((x) => x.id === id);
      if (a?.tipo === "link") globalThis.open?.(a.endereco, "_blank", "noopener");
    },
    salvarAnexo: async () => {},
    excluirAnexo: async (id) => {
      const i = anexos.findIndex((x) => x.id === id);
      if (i >= 0) anexos.splice(i, 1);
      imagens.delete(id);
    },
  };
}

function simularEnergia() {
  const registros: RegistroEnergia[] = [];
  let basicos = ["Tomar o remédio", "Comer alguma coisa", "Beber água"];
  const feitos = new Set<string>();
  if (new URLSearchParams(globalThis.location?.search ?? "").get("exemplo")) {
    const dia = 86_400_000;
    [3, 2, 4, 3, 1, 2, 3, 4, 4, 2, 3, 3, 2].forEach((nivel, i) =>
      registros.push({ id: `en${i}`, nivel, momento: Date.now() - (13 - i) * dia - 3_600_000, nota: "" }),
    );
  }
  return {
    registrarEnergia: async (nivel: number, nota: string) => {
      const r = { id: crypto.randomUUID(), nivel, momento: Date.now(), nota };
      registros.push(r);
      return r;
    },
    listarEnergia: async (de: number, ate: number) => registros.filter((r) => r.momento >= de && r.momento < ate),
    basicosDoDia: async (data: string) => basicos.map((texto) => ({ texto, feito: feitos.has(`${data}|${texto}`) })),
    definirBasicos: async (lista: string[]) => void (basicos = lista.map((b) => b.trim()).filter(Boolean)),
    marcarBasico: async (data: string, texto: string, feito: boolean) =>
      void (feito ? feitos.add(`${data}|${texto}`) : feitos.delete(`${data}|${texto}`)),
  };
}

function simularSaude() {
  const remedios: Remedio[] = [];
  // Doses tomadas: chave "remedioId|horario|data".
  const tomadas = new Set<string>();
  const registros: RegistroSaude[] = [];
  const planos: PlanoSaude[] = [];
  const normalizar = (hs: string[]) =>
    [...new Set(hs.map((h) => h.trim()).filter(Boolean))].filter((h) => /^\d{2}:\d{2}$/.test(h)).sort();
  if (new URLSearchParams(globalThis.location?.search ?? "").get("exemplo")) {
    remedios.push(
      { id: "rem1", nome: "Metilfenidato", dose: "1 comprimido", horarios: ["08:00", "14:00"], estoque: 4, porDose: 1, receita: "2026-10-30", estado: "ativo", criadoEm: Date.now() },
      { id: "rem2", nome: "Sertralina", dose: "1 comprimido", horarios: ["08:00"], estoque: 28, porDose: 1, receita: null, estado: "ativo", criadoEm: Date.now() },
    );
  }
  const diasAte = (hoje: string, data: string) => Math.round((Date.parse(data) - Date.parse(hoje)) / 86_400_000);
  return {
    listarRemedios: async () =>
      remedios
        .map((r) => ({ ...r }))
        .sort((a, b) => (a.estado === b.estado ? a.nome.localeCompare(b.nome) : a.estado === "ativo" ? -1 : 1)),
    salvarRemedio: async (r: Remedio) => {
      const nome = r.nome.trim();
      if (!nome) throw new ErroOrbita("texto_vazio", "O remédio precisa de um nome.");
      const limpo: Remedio = { ...r, nome, dose: r.dose.trim(), horarios: normalizar(r.horarios), porDose: Math.max(1, r.porDose), estado: r.estado === "pausado" ? "pausado" : "ativo" };
      if (r.id) {
        const i = remedios.findIndex((x) => x.id === r.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Remédio não encontrado.");
        remedios[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      remedios.push(novo);
      return { ...novo };
    },
    excluirRemedio: async (id: string) => {
      const i = remedios.findIndex((r) => r.id === id);
      if (i >= 0) remedios.splice(i, 1);
    },
    pausarRemedio: async (id: string, pausado: boolean) => {
      const r = remedios.find((x) => x.id === id);
      if (r) r.estado = pausado ? "pausado" : "ativo";
    },
    dosesDoDia: async (data: string) =>
      remedios
        .filter((r) => r.estado === "ativo")
        .flatMap((r) => r.horarios.map((horario) => ({ remedioId: r.id, nome: r.nome, dose: r.dose, horario, tomada: tomadas.has(`${r.id}|${horario}|${data}`) })))
        .sort((a, b) => a.horario.localeCompare(b.horario) || a.nome.localeCompare(b.nome)),
    marcarDose: async (remedioId: string, horario: string, data: string, tomada: boolean) => {
      const chave = `${remedioId}|${horario}|${data}`;
      const r = remedios.find((x) => x.id === remedioId);
      if (tomada && !tomadas.has(chave)) {
        tomadas.add(chave);
        if (r && r.estoque !== null) r.estoque = Math.max(0, r.estoque - Math.max(1, r.porDose));
      } else if (!tomada && tomadas.has(chave)) {
        tomadas.delete(chave);
        if (r && r.estoque !== null) r.estoque = r.estoque + Math.max(1, r.porDose);
      }
    },
    alertasSaude: async (hoje: string) => {
      const avisos: AvisoSaude[] = [];
      for (const r of remedios.filter((x) => x.estado === "ativo")) {
        if (r.estoque !== null && r.estoque <= 5) avisos.push({ remedioId: r.id, nome: r.nome, tipo: "estoque", quanto: r.estoque });
        if (r.receita) {
          const dias = diasAte(hoje, r.receita);
          if (Number.isFinite(dias) && dias <= 7) avisos.push({ remedioId: r.id, nome: r.nome, tipo: "receita", quanto: dias });
        }
      }
      return avisos;
    },
    registrarSaude: async (tipo: string, intensidade: number | null, nota: string) => {
      if (!["sono", "sintoma", "sobrecarga", "coisa_boa", "potencialidade", "regulacao"].includes(tipo)) throw new ErroOrbita("interno", "Tipo de registro desconhecido.");
      if (intensidade !== null && (intensidade < 1 || intensidade > 5)) throw new ErroOrbita("interno", "A intensidade vai de 1 a 5.");
      const r: RegistroSaude = { id: crypto.randomUUID(), tipo, momento: Date.now(), intensidade, nota: nota.trim() };
      registros.push(r);
      return { ...r };
    },
    listarRegistrosSaude: async (de: number, ate: number) =>
      registros.filter((r) => r.momento >= de && r.momento < ate).sort((a, b) => b.momento - a.momento).map((r) => ({ ...r })),
    excluirRegistroSaude: async (id: string) => {
      const i = registros.findIndex((r) => r.id === id);
      if (i >= 0) registros.splice(i, 1);
    },
    listarPlanos: async () =>
      planos.map((p) => ({ ...p })).sort((a, b) => (a.tipo === b.tipo ? a.titulo.localeCompare(b.titulo) : a.tipo === "crise" ? -1 : 1)),
    salvarPlano: async (p: PlanoSaude) => {
      if (!["crise", "estrategia"].includes(p.tipo)) throw new ErroOrbita("interno", "Tipo de plano desconhecido.");
      const titulo = p.titulo.trim() || (p.tipo === "crise" ? "Plano de crise" : "Estratégia");
      const limpo: PlanoSaude = { ...p, titulo, sinais: p.sinais.trim(), ajuda: p.ajuda.trim(), contatos: p.contatos.trim(), atualizadoEm: Date.now() };
      if (p.id) {
        const i = planos.findIndex((x) => x.id === p.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Plano não encontrado.");
        planos[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID() };
      planos.push(novo);
      return { ...novo };
    },
    excluirPlano: async (id: string) => {
      const i = planos.findIndex((p) => p.id === id);
      if (i >= 0) planos.splice(i, 1);
    },
  };
}

function simularCuidado() {
  const profissionais: Profissional[] = [];
  const notas: (Nota & { prof: string })[] = [];
  const sessoes: (RegistroSessao & { prof: string })[] = [];
  return {
    listarProfissionais: async () => profissionais.map((p) => ({ ...p })).sort((a, b) => a.criadoEm - b.criadoEm),
    salvarProfissional: async (p: Profissional) => {
      const nome = p.nome.trim();
      if (!nome) throw new ErroOrbita("texto_vazio", "O profissional precisa de um nome.");
      const limpo: Profissional = { ...p, nome, especialidade: p.especialidade.trim(), sobre: p.sobre.trim(), proximaConsulta: p.proximaConsulta.trim() };
      if (p.id) {
        const i = profissionais.findIndex((x) => x.id === p.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Profissional não encontrado.");
        profissionais[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      profissionais.push(novo);
      return { ...novo };
    },
    excluirProfissional: async (id: string) => {
      for (let i = notas.length - 1; i >= 0; i--) if (notas[i].prof === id) notas.splice(i, 1);
      for (let i = sessoes.length - 1; i >= 0; i--) if (sessoes[i].prof === id) sessoes.splice(i, 1);
      const pi = profissionais.findIndex((p) => p.id === id);
      if (pi >= 0) profissionais.splice(pi, 1);
    },
    listarNotasCuidado: async (profissionalId: string, tipo: string) =>
      notas
        .filter((n) => n.prof === profissionalId && n.tipo === tipo)
        .sort((a, b) => (a.feita === b.feita ? b.criadoEm - a.criadoEm : a.feita ? 1 : -1))
        .map(({ prof: _, ...n }) => n),
    criarNotaCuidado: async (profissionalId: string, tipo: string, texto: string) => {
      if (!profissionalId.trim()) throw new ErroOrbita("interno", "A anotação precisa de um profissional.");
      if (!["pauta", "pergunta"].includes(tipo)) throw new ErroOrbita("interno", "Tipo de anotação desconhecido.");
      const t = texto.trim();
      if (!t) throw new ErroOrbita("texto_vazio", "A anotação não pode ficar vazia.");
      const nota = { id: crypto.randomUUID(), tipo, texto: t, feita: false, criadoEm: Date.now(), prof: profissionalId };
      notas.push(nota);
      const { prof: _, ...r } = nota;
      return r;
    },
    marcarNotaCuidado: async (id: string, feita: boolean) => {
      const n = notas.find((x) => x.id === id);
      if (n) n.feita = feita;
    },
    excluirNotaCuidado: async (id: string) => {
      const i = notas.findIndex((n) => n.id === id);
      if (i >= 0) notas.splice(i, 1);
    },
    registrarSessao: async (profissionalId: string, data: string, nota: string) => {
      if (!profissionalId.trim()) throw new ErroOrbita("interno", "A sessão precisa de um profissional.");
      const t = nota.trim();
      if (!t) throw new ErroOrbita("texto_vazio", "Escreva o que ficou da sessão.");
      const r = { id: crypto.randomUUID(), data: data.trim(), nota: t, criadoEm: Date.now(), prof: profissionalId };
      sessoes.push(r);
      const { prof: _, ...s } = r;
      return s;
    },
    listarSessoes: async (profissionalId: string) =>
      sessoes.filter((s) => s.prof === profissionalId).sort((a, b) => b.criadoEm - a.criadoEm).map(({ prof: _, ...s }) => s),
    excluirSessao: async (id: string) => {
      const i = sessoes.findIndex((s) => s.id === id);
      if (i >= 0) sessoes.splice(i, 1);
    },
  };
}

function simularAcademico() {
  const materias: Materia[] = [];
  const atividades: Atividade[] = [];
  const aulas: Aula[] = [];
  let media = 6;
  const horaOk = (h: string) => /^\d{2}:\d{2}$/.test(h) && Number(h.slice(0, 2)) < 24 && Number(h.slice(3)) < 60;
  return {
    listarMaterias: async () => materias.map((m) => ({ ...m })).sort((a, b) => a.nome.localeCompare(b.nome)),
    salvarMateria: async (m: Materia) => {
      const nome = m.nome.trim();
      if (!nome) throw new ErroOrbita("texto_vazio", "A matéria precisa de um nome.");
      const limpo: Materia = { ...m, nome, professor: m.professor.trim(), cor: m.cor.trim() || "mar" };
      if (m.id) {
        const i = materias.findIndex((x) => x.id === m.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Matéria não encontrada.");
        materias[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      materias.push(novo);
      return { ...novo };
    },
    excluirMateria: async (id: string) => {
      const i = materias.findIndex((m) => m.id === id);
      if (i >= 0) materias.splice(i, 1);
      for (let j = atividades.length - 1; j >= 0; j--) if (atividades[j].materiaId === id) atividades.splice(j, 1);
      for (let j = aulas.length - 1; j >= 0; j--) if (aulas[j].materiaId === id) aulas.splice(j, 1);
    },
    listarAtividades: async () => atividades.map((a) => ({ ...a })),
    salvarAtividade: async (a: Atividade) => {
      const titulo = a.titulo.trim();
      if (!titulo) throw new ErroOrbita("texto_vazio", "A atividade precisa de um título.");
      if (!["prova", "trabalho", "dever"].includes(a.tipo)) throw new ErroOrbita("interno", "Tipo de atividade desconhecido.");
      if (!a.materiaId.trim()) throw new ErroOrbita("interno", "Escolha a matéria.");
      if (a.nota !== null && (a.nota < 0 || a.nota > 100)) throw new ErroOrbita("interno", "A nota precisa estar entre 0 e 100.");
      if (a.peso !== null && a.peso < 0) throw new ErroOrbita("interno", "O peso não pode ser negativo.");
      const limpo: Atividade = { ...a, titulo };
      if (a.id) {
        const i = atividades.findIndex((x) => x.id === a.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Atividade não encontrada.");
        atividades[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      atividades.push(novo);
      return { ...novo };
    },
    marcarAtividade: async (id: string, feita: boolean) => {
      const a = atividades.find((x) => x.id === id);
      if (a) a.feita = feita;
    },
    excluirAtividade: async (id: string) => {
      const i = atividades.findIndex((a) => a.id === id);
      if (i >= 0) atividades.splice(i, 1);
    },
    mediaAprovacao: async () => media,
    definirMediaAprovacao: async (m: number) => void (media = Math.min(100, Math.max(0, m))),
    listarAulas: async () => aulas.map((a) => ({ ...a })),
    salvarAula: async (a: Aula) => {
      if (!a.materiaId.trim()) throw new ErroOrbita("interno", "Escolha a matéria.");
      if (a.diaSemana < 0 || a.diaSemana > 6) throw new ErroOrbita("interno", "Dia da semana inválido.");
      if (!horaOk(a.inicio.trim())) throw new ErroOrbita("interno", "Horário de início inválido (use HH:MM).");
      if (a.fim.trim() && !horaOk(a.fim.trim())) throw new ErroOrbita("interno", "Horário de fim inválido (use HH:MM).");
      const limpo: Aula = { ...a, inicio: a.inicio.trim(), fim: a.fim.trim() };
      if (a.id) {
        const i = aulas.findIndex((x) => x.id === a.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Aula não encontrada.");
        aulas[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      aulas.push(novo);
      return { ...novo };
    },
    excluirAula: async (id: string) => {
      const i = aulas.findIndex((a) => a.id === id);
      if (i >= 0) aulas.splice(i, 1);
    },
  };
}

function simularDinheiro() {
  const gastos: Gasto[] = [];
  const grupos: Grupo[] = [];
  const contas: Conta[] = [];
  const desejos: Desejo[] = [];
  const metas: Meta[] = [];
  return {
    registrarGasto: async (centavos: number, grupoId: string, descricao: string, interesse: boolean) => {
      if (centavos < 0) throw new ErroOrbita("interno", "O valor não pode ser negativo.");
      const g: Gasto = { id: crypto.randomUUID(), centavos, grupoId: grupoId.trim(), categoria: "", interesse, descricao: descricao.trim(), momento: Date.now() };
      gastos.push(g);
      return { ...g };
    },
    listarGruposGasto: async () => grupos.map((x) => ({ ...x })).sort((a, b) => a.nome.localeCompare(b.nome)),
    salvarGrupoGasto: async (grupo: Grupo) => {
      const nome = grupo.nome.trim();
      if (!nome) throw new ErroOrbita("texto_vazio", "O grupo precisa de um nome.");
      const limpo: Grupo = { ...grupo, nome, cor: grupo.cor.trim() || "mar" };
      if (grupo.id) {
        const i = grupos.findIndex((x) => x.id === grupo.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Grupo não encontrado.");
        grupos[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      grupos.push(novo);
      return { ...novo };
    },
    excluirGrupoGasto: async (id: string) => {
      const i = grupos.findIndex((g) => g.id === id);
      if (i >= 0) grupos.splice(i, 1);
    },
    listarGastos: async (de: number, ate: number) =>
      gastos.filter((g) => g.momento >= de && g.momento < ate).sort((a, b) => b.momento - a.momento).map((g) => ({ ...g })),
    excluirGasto: async (id: string) => {
      const i = gastos.findIndex((g) => g.id === id);
      if (i >= 0) gastos.splice(i, 1);
    },
    listarContas: async () => contas.map((c) => ({ ...c })).sort((a, b) => a.nome.localeCompare(b.nome)),
    salvarConta: async (c: Conta) => {
      const nome = c.nome.trim();
      if (!nome) throw new ErroOrbita("texto_vazio", "A conta precisa de um nome.");
      if (c.diaVencimento < 1 || c.diaVencimento > 31) throw new ErroOrbita("interno", "O dia de vencimento vai de 1 a 31.");
      const limpo: Conta = { ...c, nome };
      if (c.id) {
        const i = contas.findIndex((x) => x.id === c.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Conta não encontrada.");
        contas[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      contas.push(novo);
      return { ...novo };
    },
    excluirConta: async (id: string) => {
      const i = contas.findIndex((c) => c.id === id);
      if (i >= 0) contas.splice(i, 1);
    },
    listarDesejos: async () =>
      desejos
        .map((d) => ({ ...d }))
        .sort((a, b) => (a.estado === b.estado ? b.criadoEm - a.criadoEm : a.estado === "esperando" ? -1 : 1)),
    criarDesejo: async (nome: string, centavos: number, esperaHoras: number) => {
      const n = nome.trim();
      if (!n) throw new ErroOrbita("texto_vazio", "Escreva o que você quer comprar.");
      const agora = Date.now();
      const d: Desejo = { id: crypto.randomUUID(), nome: n, centavos, decidirEm: agora + Math.max(0, esperaHoras) * 3_600_000, estado: "esperando", criadoEm: agora };
      desejos.push(d);
      return { ...d };
    },
    resolverDesejo: async (id: string) => {
      const d = desejos.find((x) => x.id === id);
      if (d) d.estado = "resolvido";
    },
    excluirDesejo: async (id: string) => {
      const i = desejos.findIndex((d) => d.id === id);
      if (i >= 0) desejos.splice(i, 1);
    },
    listarMetas: async () => metas.map((m) => ({ ...m })).sort((a, b) => b.criadoEm - a.criadoEm),
    salvarMeta: async (m: Meta) => {
      const nome = m.nome.trim();
      if (!nome) throw new ErroOrbita("texto_vazio", "A meta precisa de um nome.");
      const limpo: Meta = { ...m, nome };
      if (m.id) {
        const i = metas.findIndex((x) => x.id === m.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Meta não encontrada.");
        metas[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      metas.push(novo);
      return { ...novo };
    },
    excluirMeta: async (id: string) => {
      const i = metas.findIndex((m) => m.id === id);
      if (i >= 0) metas.splice(i, 1);
    },
  };
}

function simularHobbies() {
  const hobbies: Hobby[] = [];
  const cartoes: CartaoQuadro[] = [];
  const TIPOS = ["texto", "arquivo", "imagem", "link", "audio"];
  return {
    listarCartoes: async (hobbyId: string) =>
      cartoes.filter((c) => c.hobbyId === hobbyId).map((c) => ({ ...c })).sort((a, b) => a.criadoEm - b.criadoEm),
    salvarCartao: async (c: CartaoQuadro) => {
      if (!c.hobbyId.trim()) throw new ErroOrbita("interno", "O cartão precisa de um quadro.");
      if (!TIPOS.includes(c.tipo)) throw new ErroOrbita("interno", "Tipo de cartão desconhecido.");
      const limpo: CartaoQuadro = { ...c, texto: c.texto.trimEnd() };
      if (c.id) {
        const i = cartoes.findIndex((x) => x.id === c.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Cartão não encontrado.");
        cartoes[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      cartoes.push(novo);
      return { ...novo };
    },
    moverCartao: async (id: string, x: number, y: number) => {
      const c = cartoes.find((x2) => x2.id === id);
      if (!c) throw new ErroOrbita("nao_encontrado", "Cartão não encontrado.");
      c.x = x;
      c.y = y;
    },
    excluirCartao: async (id: string) => {
      const i = cartoes.findIndex((c) => c.id === id);
      if (i >= 0) cartoes.splice(i, 1);
    },
    listarHobbies: async () => hobbies.map((h) => ({ ...h })).sort((a, b) => b.criadoEm - a.criadoEm),
    salvarHobby: async (h: Hobby) => {
      const nome = h.nome.trim();
      if (!nome) throw new ErroOrbita("texto_vazio", "O interesse precisa de um nome.");
      const limpo: Hobby = { ...h, nome, notas: h.notas.trim() };
      if (h.id) {
        const i = hobbies.findIndex((x) => x.id === h.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Interesse não encontrado.");
        hobbies[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      hobbies.push(novo);
      return { ...novo };
    },
    excluirHobby: async (id: string) => {
      const i = hobbies.findIndex((h) => h.id === id);
      if (i >= 0) hobbies.splice(i, 1);
    },
  };
}

function simularOrganizacao() {
  const quadros: Quadro[] = [];
  const colunas: Coluna[] = [];
  const cartoes: CartaoOrg[] = [];
  const novaColuna = (quadroId: string, nome: string, ordem: number): Coluna => {
    const c = { id: crypto.randomUUID(), quadroId, nome, ordem };
    colunas.push(c);
    return c;
  };
  return {
    listarQuadros: async () => quadros.map((q) => ({ ...q })).sort((a, b) => a.criadoEm - b.criadoEm),
    salvarQuadro: async (q: Quadro) => {
      const nome = q.nome.trim();
      if (!nome) throw new ErroOrbita("texto_vazio", "O quadro precisa de um nome.");
      const estilo = q.estilo === "quadro" ? "quadro" : "lista";
      if (q.id) {
        const i = quadros.findIndex((x) => x.id === q.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Quadro não encontrado.");
        quadros[i] = { ...quadros[i], nome };
        return { ...quadros[i] };
      }
      const novo: Quadro = { id: crypto.randomUUID(), nome, estilo, criadoEm: Date.now() };
      quadros.push(novo);
      if (estilo === "lista") novaColuna(novo.id, "", 1);
      else ["A fazer", "Fazendo", "Feito"].forEach((n, i) => novaColuna(novo.id, n, i + 1));
      return { ...novo };
    },
    excluirQuadro: async (id: string) => {
      const cols = colunas.filter((c) => c.quadroId === id).map((c) => c.id);
      for (let i = cartoes.length - 1; i >= 0; i--) if (cols.includes(cartoes[i].colunaId)) cartoes.splice(i, 1);
      for (let i = colunas.length - 1; i >= 0; i--) if (colunas[i].quadroId === id) colunas.splice(i, 1);
      const qi = quadros.findIndex((q) => q.id === id);
      if (qi >= 0) quadros.splice(qi, 1);
    },
    listarColunas: async (quadroId: string) => colunas.filter((c) => c.quadroId === quadroId).map((c) => ({ ...c })).sort((a, b) => a.ordem - b.ordem),
    salvarColuna: async (col: Coluna) => {
      if (!col.quadroId.trim()) throw new ErroOrbita("interno", "A coluna precisa de um quadro.");
      if (col.id) {
        const i = colunas.findIndex((x) => x.id === col.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Coluna não encontrada.");
        colunas[i] = { ...col, nome: col.nome.trim() };
        return { ...colunas[i] };
      }
      const ordem = col.ordem || Math.max(0, ...colunas.filter((c) => c.quadroId === col.quadroId).map((c) => c.ordem)) + 1;
      return { ...novaColuna(col.quadroId, col.nome.trim(), ordem) };
    },
    excluirColuna: async (id: string) => {
      for (let i = cartoes.length - 1; i >= 0; i--) if (cartoes[i].colunaId === id) cartoes.splice(i, 1);
      const i = colunas.findIndex((c) => c.id === id);
      if (i >= 0) colunas.splice(i, 1);
    },
    listarCartoesOrg: async (quadroId: string) => {
      const cols = new Set(colunas.filter((c) => c.quadroId === quadroId).map((c) => c.id));
      return cartoes.filter((c) => cols.has(c.colunaId)).map((c) => ({ ...c })).sort((a, b) => a.ordem - b.ordem);
    },
    salvarCartaoOrg: async (c: CartaoOrg) => {
      if (!c.colunaId.trim()) throw new ErroOrbita("interno", "O cartão precisa de uma coluna.");
      const texto = c.texto.trim();
      if (!texto) throw new ErroOrbita("texto_vazio", "O cartão precisa de um texto.");
      if (c.id) {
        const i = cartoes.findIndex((x) => x.id === c.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Cartão não encontrado.");
        cartoes[i] = { ...c, texto };
        return { ...cartoes[i] };
      }
      const ordem = c.ordem || Math.max(0, ...cartoes.filter((x) => x.colunaId === c.colunaId).map((x) => x.ordem)) + 1;
      const novo: CartaoOrg = { ...c, id: crypto.randomUUID(), texto, ordem, criadoEm: Date.now() };
      cartoes.push(novo);
      return { ...novo };
    },
    marcarCartaoOrg: async (id: string, feito: boolean) => {
      const c = cartoes.find((x) => x.id === id);
      if (!c) throw new ErroOrbita("nao_encontrado", "Cartão não encontrado.");
      c.feito = feito;
    },
    moverCartaoOrg: async (id: string, colunaId: string, ordem: number) => {
      const c = cartoes.find((x) => x.id === id);
      if (!c) throw new ErroOrbita("nao_encontrado", "Cartão não encontrado.");
      c.colunaId = colunaId;
      c.ordem = ordem;
    },
    reordenarCartoesOrg: async (ids: string[]) => {
      ids.forEach((id, i) => {
        const c = cartoes.find((x) => x.id === id);
        if (c) c.ordem = i + 1;
      });
    },
    excluirCartaoOrg: async (id: string) => {
      const i = cartoes.findIndex((c) => c.id === id);
      if (i >= 0) cartoes.splice(i, 1);
    },
  };
}

function simularCaderno() {
  const pastas: PastaCaderno[] = [];
  const cadernos: Caderno[] = [];
  const paginas: PaginaCaderno[] = [];
  const cenas = new Map<string, string>();
  return {
    listarPastasCaderno: async () => pastas.map((p) => ({ ...p })).sort((a, b) => a.nome.localeCompare(b.nome)),
    salvarPastaCaderno: async (p: PastaCaderno) => {
      if (!p.nome.trim()) throw new ErroOrbita("texto_vazio", "A pasta precisa de um nome.");
      if (p.id) {
        const i = pastas.findIndex((x) => x.id === p.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Pasta não encontrada.");
        pastas[i] = { ...p, nome: p.nome.trim() };
        return { ...pastas[i] };
      }
      const nova: PastaCaderno = { id: crypto.randomUUID(), nome: p.nome.trim(), criadoEm: Date.now() };
      pastas.push(nova);
      return { ...nova };
    },
    excluirPastaCaderno: async (id: string) => {
      cadernos.forEach((c) => { if (c.pastaId === id) c.pastaId = ""; });
      const i = pastas.findIndex((p) => p.id === id);
      if (i >= 0) pastas.splice(i, 1);
    },
    listarCadernos: async () => cadernos.map((c) => ({ ...c })).sort((a, b) => b.criadoEm - a.criadoEm),
    salvarCaderno: async (c: Caderno) => {
      if (!c.nome.trim()) throw new ErroOrbita("texto_vazio", "O caderno precisa de um nome.");
      if (c.id) {
        const i = cadernos.findIndex((x) => x.id === c.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Caderno não encontrado.");
        cadernos[i] = { ...cadernos[i], nome: c.nome.trim(), capa: c.capa, pastaId: c.pastaId };
        return { ...cadernos[i] };
      }
      const modo = c.modo === "infinito" ? "infinito" : "caderno";
      const novo: Caderno = { ...c, id: crypto.randomUUID(), nome: c.nome.trim(), modo, criadoEm: Date.now() };
      cadernos.push(novo);
      paginas.push({ id: crypto.randomUUID(), cadernoId: novo.id, ordem: 1, tamanho: modo === "infinito" ? "infinito" : "a4", papel: null, titulo: "", marcado: false, criadoEm: Date.now() });
      return { ...novo };
    },
    excluirCaderno: async (id: string) => {
      for (let i = paginas.length - 1; i >= 0; i--) if (paginas[i].cadernoId === id) paginas.splice(i, 1);
      const i = cadernos.findIndex((c) => c.id === id);
      if (i >= 0) cadernos.splice(i, 1);
    },
    listarPaginasCaderno: async (cadernoId: string) => paginas.filter((p) => p.cadernoId === cadernoId).map((p) => ({ ...p })).sort((a, b) => a.ordem - b.ordem),
    salvarPaginaCaderno: async (p: PaginaCaderno) => {
      if (!p.cadernoId.trim()) throw new ErroOrbita("interno", "A página precisa de um caderno.");
      if (p.id) {
        const i = paginas.findIndex((x) => x.id === p.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Página não encontrada.");
        paginas[i] = { ...p };
        return { ...paginas[i] };
      }
      const ordem = p.ordem || Math.max(0, ...paginas.filter((x) => x.cadernoId === p.cadernoId).map((x) => x.ordem)) + 1;
      const nova: PaginaCaderno = { ...p, id: crypto.randomUUID(), tamanho: p.tamanho || "a4", titulo: p.titulo ?? "", marcado: p.marcado ?? false, ordem, criadoEm: Date.now() };
      paginas.push(nova);
      return { ...nova };
    },
    excluirPaginaCaderno: async (id: string) => {
      const i = paginas.findIndex((p) => p.id === id);
      if (i >= 0) paginas.splice(i, 1);
      cenas.delete(id);
    },
    carregarCenaCaderno: async (paginaId: string) => cenas.get(paginaId) ?? "",
    salvarCenaCaderno: async (paginaId: string, cena: string) => { cenas.set(paginaId, cena); },
  };
}

function simularLeitura() {
  const livros: Livro[] = [];
  const gruposLivro: GrupoLivro[] = [];
  const anotacoes: Anotacao[] = [];
  const SUBTIPOS = ["marcador", "nota", "grifo", "traco"];
  const ordem: Record<string, number> = { lendo: 0, quero: 1, pausado: 2, lido: 3 };
  const STATUS = ["quero", "lendo", "lido", "pausado"];
  return {
    listarLivros: async () =>
      livros
        .map((l) => ({ ...l }))
        .sort((a, b) => (ordem[a.status] - ordem[b.status]) || a.titulo.localeCompare(b.titulo)),
    salvarLivro: async (l: Livro) => {
      const titulo = l.titulo.trim();
      if (!titulo) throw new ErroOrbita("texto_vazio", "O livro precisa de um título.");
      const limpo: Livro = { ...l, titulo, autor: l.autor.trim(), status: STATUS.includes(l.status) ? l.status : "quero" };
      if (l.id) {
        const i = livros.findIndex((x) => x.id === l.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Livro não encontrado.");
        livros[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      livros.push(novo);
      return { ...novo };
    },
    mudarStatusLivro: async (id: string, status: string) => {
      if (!STATUS.includes(status)) throw new ErroOrbita("interno", "Status de leitura desconhecido.");
      const l = livros.find((x) => x.id === id);
      if (!l) throw new ErroOrbita("nao_encontrado", "Livro não encontrado.");
      l.status = status;
    },
    excluirLivro: async (id: string) => {
      const i = livros.findIndex((l) => l.id === id);
      if (i >= 0) livros.splice(i, 1);
    },
    // No navegador não há arquivo guardado; o leitor mostra um aviso.
    bytesAnexo: async () => "",
    bytesArquivo: async () => "",
    listarGruposLivro: async () => gruposLivro.map((g) => ({ ...g })).sort((a, b) => a.nome.localeCompare(b.nome)),
    salvarGrupoLivro: async (grupo: GrupoLivro) => {
      const nome = grupo.nome.trim();
      if (!nome) throw new ErroOrbita("texto_vazio", "A prateleira precisa de um nome.");
      if (grupo.id) {
        const i = gruposLivro.findIndex((x) => x.id === grupo.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Prateleira não encontrada.");
        gruposLivro[i] = { ...grupo, nome };
        return { ...gruposLivro[i] };
      }
      const novo = { ...grupo, nome, id: crypto.randomUUID(), criadoEm: Date.now() };
      gruposLivro.push(novo);
      return { ...novo };
    },
    excluirGrupoLivro: async (id: string) => {
      const i = gruposLivro.findIndex((g) => g.id === id);
      if (i >= 0) gruposLivro.splice(i, 1);
    },
    listarAnotacoes: async (livroId: string) =>
      anotacoes.filter((a) => a.livroId === livroId).map((a) => ({ ...a })).sort((a, b) => a.criadoEm - b.criadoEm),
    salvarAnotacao: async (a: Anotacao) => {
      if (!a.livroId.trim()) throw new ErroOrbita("interno", "A anotação precisa de um livro.");
      if (!SUBTIPOS.includes(a.tipo)) throw new ErroOrbita("interno", "Tipo de anotação desconhecido.");
      const limpo: Anotacao = { ...a, texto: a.texto.trim(), trecho: a.trecho.trim() };
      if (a.id) {
        const i = anotacoes.findIndex((x) => x.id === a.id);
        if (i < 0) throw new ErroOrbita("nao_encontrado", "Anotação não encontrada.");
        anotacoes[i] = { ...limpo };
        return { ...limpo };
      }
      const novo = { ...limpo, id: crypto.randomUUID(), criadoEm: Date.now() };
      anotacoes.push(novo);
      return { ...novo };
    },
    excluirAnotacao: async (id: string) => {
      const i = anotacoes.findIndex((a) => a.id === id);
      if (i >= 0) anotacoes.splice(i, 1);
    },
  };
}

/** Simulação para ver as telas no navegador. Nada aqui é seguro nem guardado. */
function criarSimulacao(): Api {
  const PALAVRAS = ["jardim", "girafa", "pipoca", "abacate", "orvalho", "tijolo"];
  const s = { existe: false, modo: null as ModoAbrir | null, senha: "", pin: "", erradas: 0, aberto: false };
  const backup: SituacaoBackup = { pasta: null, ultimo: null, erro: null };
  const comItens = simularItens();
  const comAnexos = simularAnexos();
  const params0 = new URLSearchParams(globalThis.location?.search ?? "");
  let bandeja = false;
  const comIa = simularIa(params0.get("ia") !== null, params0.get("ia") === "erro");
  const espera = () => new Promise((r) => setTimeout(r, 250));
  const falha = (codigo: CodigoErro, msg: string, extra?: number) => Promise.reject(new ErroOrbita(codigo, msg, extra));
  const conferir = async (texto: string) => {
    await espera();
    if (texto.trim().toLowerCase().split(/\s+/).join(" ") !== PALAVRAS.join(" "))
      throw new ErroOrbita("chave_errada", "A chave de recuperação não abre estes dados.");
  };
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  // `?senha=nao`: cofre criado sem senha (só as 6 palavras).
  if (params.get("cofre")) Object.assign(s, { existe: true, modo: params.get("cofre"), senha: params.get("senha") === "nao" ? "" : "gato azul na janela", pin: "2468" });
  const confirmar = async (conf: Confirmacao) => {
    await espera();
    if (conf.tipo === "senha" && (!s.senha || conf.valor !== s.senha)) throw new ErroOrbita(s.senha ? "senha_errada" : "sem_senha", s.senha ? "A senha não confere." : "Estes dados não têm senha.");
    if (conf.tipo === "pin" && conf.valor !== s.pin) throw new ErroOrbita("pin_errado", "O PIN não confere.");
    if (conf.tipo === "palavras") await conferir(conf.valor);
  };
  if (params.get("aberto")) s.aberto = true;
  return {
    situacao: async () => ({ existe: s.existe, modo: s.modo, tentativasRestantes: 5 - s.erradas, aberto: s.aberto, temSenha: !!s.senha }),
    criarCofre: async (senha, modo, pin) => {
      await espera();
      Object.assign(s, { existe: true, modo, senha: senha ?? "", pin: pin ?? "", aberto: true });
      return PALAVRAS;
    },
    abrirComPalavras: async (texto) => {
      await conferir(texto);
      Object.assign(s, { erradas: 0, aberto: true });
    },
    abrirComSenha: async (senha) => {
      await espera();
      if (senha !== s.senha) return falha("senha_errada", "A senha não confere.");
      s.erradas = 0;
      s.aberto = true;
    },
    abrirComPin: async (pin) => {
      await espera();
      if (s.erradas >= 5) return falha("pin_bloqueado", "Muitas tentativas com o PIN. Use a senha para abrir.");
      if (pin !== s.pin) {
        s.erradas++;
        return s.erradas >= 5
          ? falha("pin_bloqueado", "Muitas tentativas com o PIN. Use a senha para abrir.")
          : falha("pin_errado", "O PIN não confere.", 5 - s.erradas);
      }
      s.erradas = 0;
      s.aberto = true;
    },
    abrirDireto: async () => {
      s.aberto = true;
    },
    helloDisponivel: async () => params.get("hello") === "1",
    abrirComHello: async () => {
      await espera();
      s.aberto = true;
    },
    conferirPalavras: conferir,
    recuperar: async (texto, novaSenha) => {
      await conferir(texto);
      Object.assign(s, { senha: novaSenha, erradas: 0, aberto: true });
    },
    lerArquivoRecuperacao: async () => PALAVRAS.join(" "),
    gravarArquivoRecuperacao: async () => {},
    verPalavras: async (conf) => {
      await confirmar(conf);
      return PALAVRAS;
    },
    definirSenha: async (conf, nova) => {
      await confirmar(conf);
      s.senha = nova;
    },
    mudarModo: async (conf, modo, pin) => {
      await confirmar(conf);
      Object.assign(s, { modo, pin: pin ?? "" });
    },
    bloquear: async () => {
      s.aberto = false;
    },
    ...comItens,
    ...simularAgenda(),
    ...simularRotinas(comItens, comAnexos),
    ...simularEnergia(),
    ...simularSaude(),
    ...simularCuidado(),
    ...simularAcademico(),
    ...simularDinheiro(),
    ...simularHobbies(),
    ...simularOrganizacao(),
    ...simularCaderno(),
    ...simularLeitura(),
    ...comAnexos,
    fazerBackup: async () => {
      await espera();
    },
    exportarTexto: async () => {
      await espera();
    },
    // `?backup=semsenha`: o backup de exemplo não tem senha (abre com as palavras).
    infoBackup: async () => ({ criadoEm: Date.now() - 86_400_000, versaoApp: "0.5.0", temSenha: params.get("backup") !== "semsenha" }),
    restaurarBackup: async (_c, { senha, palavras }, escolha) => {
      const backupComSenha = params.get("backup") !== "semsenha";
      if (palavras) await conferir(palavras);
      else if (!backupComSenha || senha !== "gato azul na janela") return falha("senha_errada", "A senha não confere.");
      if (!backupComSenha && (!escolha || escolha.modo === "senha")) return falha("sem_senha", "Estes dados não têm senha. Use as 6 palavras da chave de recuperação.");
      const modo = escolha?.modo ?? "senha";
      Object.assign(s, { existe: true, modo, senha: backupComSenha ? "gato azul na janela" : "", pin: escolha?.pin ?? "", aberto: true });
      return modo;
    },
    situacaoBackup: async () => ({ ...backup }),
    definirBackupAutomatico: async (pasta) => {
      await espera();
      Object.assign(backup, { pasta, ultimo: pasta ? Date.now() : backup.ultimo, erro: null });
      return { ...backup };
    },
    ...comIa,
    ...simularDitado(params0.get("ditado")),
    ...simularNuvem(params0.get("nuvem"), async (modo, pin) => Object.assign(s, { existe: true, modo, pin: pin ?? "", senha: "", aberto: true })),
    bandejaLigada: async () => bandeja,
    definirBandeja: async (ligar) => void (bandeja = ligar),
    // A IA de mentira não conhece os projetos: liga a tarefa ao primeiro ativo.
    organizarTextoIa: async (texto, sensivel) => {
      const o = await comIa.organizarTextoIa(texto, sensivel);
      const ativo = (await comItens.listarProjetos()).find((p) => p.estado === "ativo");
      return { ...o, itens: o.itens.map((i) => (i.projetoId === "__primeiro_ativo__" ? { ...i, projetoId: ativo?.id ?? null } : i)) };
    },
    ajustarOrganizacaoIa: async (texto, lista, mudanca, sensivel) => {
      const o = await comIa.ajustarOrganizacaoIa(texto, lista, mudanca, sensivel);
      const ativo = (await comItens.listarProjetos()).find((p) => p.estado === "ativo");
      return { ...o, itens: o.itens.map((i) => (i.projetoId === "__primeiro_ativo__" ? { ...i, projetoId: ativo?.id ?? null } : i)) };
    },
  };
}

/**
 * Conta de mentira. `?nuvem=1`: Google e Microsoft disponíveis; `?nuvem=ligada`: já ligada ao Google;
 * `?nuvem=vazia`: a conta não tem nada guardado. Sem o parâmetro, a opção não aparece (como numa
 * versão sem o cadastro no Google e na Microsoft).
 */
function simularNuvem(
  modo: string | null,
  aoRecuperar: (m: ModoAbrir, pin?: string) => Promise<unknown>,
): Pick<Api, "nuvemDisponivel" | "nuvemSituacao" | "nuvemConectar" | "nuvemEnviar" | "nuvemDesconectar" | "nuvemBuscarParaRecuperar" | "nuvemConcluirRecuperacao"> {
  const espera = (ms = 900) => new Promise((r) => setTimeout(r, ms));
  let situacao: SituacaoNuvem | null =
    modo === "ligada" ? { provedor: "google", conta: "dan@gmail.com", ultimo: Date.now() - 3_600_000, erro: null } : null;
  return {
    nuvemDisponivel: async () => ({ google: !!modo, microsoft: !!modo }),
    nuvemSituacao: async () => situacao && { ...situacao },
    nuvemConectar: async (provedor) => {
      await espera(1600);
      situacao = { provedor, conta: provedor === "google" ? "dan@gmail.com" : "dan@outlook.com", ultimo: Date.now(), erro: null };
      return { ...situacao };
    },
    nuvemEnviar: async () => {
      if (!situacao) return null;
      await espera();
      situacao = { ...situacao, ultimo: Date.now(), erro: null };
      return { ...situacao };
    },
    nuvemDesconectar: async () => void (await espera(), (situacao = null)),
    nuvemBuscarParaRecuperar: async (provedor) => {
      await espera(1600);
      const conta = provedor === "google" ? "dan@gmail.com" : "dan@outlook.com";
      if (modo === "vazia") throw new ErroOrbita("nuvem", `Não encontrei um Órbita guardado na conta ${conta}. Confira se é a mesma conta que você ligou no outro computador.`);
      return { conta, criadoEm: Date.now() - 86_400_000, versaoApp: "0.22.0" };
    },
    nuvemConcluirRecuperacao: async (m, pin) => {
      await espera();
      await aoRecuperar(m, pin);
      situacao = { provedor: "google", conta: "dan@gmail.com", ultimo: Date.now(), erro: null };
      return m;
    },
  };
}

/** Ditado de mentira. `?ditado=1` já vem instalado; `?ditado=silencio` não ouve nada. */
function simularDitado(modo: string | null): Pick<Api, "ditadoEstado" | "ditadoBaixar" | "ditadoCancelarDownload" | "ditadoRemover" | "ditadoComecar" | "ditadoParar" | "ditadoDescartar" | "ouvirProgressoDitado"> {
  const estado: EstadoDitado = { instalado: modo ? "small" : null, baixando: false, gravando: false };
  const ouvintes = new Set<(b: number, t: number) => void>();
  let cancelar = false;
  return {
    ditadoEstado: async () => ({ ...estado }),
    ditadoBaixar: async (modelo) => {
      const total = modelo === "base" ? 142e6 : 466e6;
      estado.baixando = true;
      cancelar = false;
      for (let i = 1; i <= 20; i++) {
        await new Promise((r) => setTimeout(r, 120));
        if (cancelar) {
          estado.baixando = false;
          throw new ErroOrbita("ditado", "Download cancelado.");
        }
        ouvintes.forEach((f) => f((total * i) / 20, total));
      }
      Object.assign(estado, { baixando: false, instalado: modelo });
      return { ...estado };
    },
    ditadoCancelarDownload: async () => void (cancelar = true),
    ditadoRemover: async () => ((estado.instalado = null), { ...estado }),
    ditadoComecar: async () => void (estado.gravando = true),
    ditadoParar: async () => {
      estado.gravando = false;
      await new Promise((r) => setTimeout(r, 900));
      if (modo === "silencio") throw new ErroOrbita("ditado", "Não ouvi nada. Confira se o microfone está ligado e se o Windows deixa programas usarem o microfone (Configurações > Privacidade > Microfone).");
      return "lembrar de levar o laudo na consulta de quinta e comprar pão";
    },
    ditadoDescartar: async () => void (estado.gravando = false),
    ouvirProgressoDitado: async (f) => (ouvintes.add(f), () => void ouvintes.delete(f)),
  };
}

/** IA de mentira para ver as telas no navegador. `?ia=1` já vem com Claude; `?ia=erro` falha ao sugerir. */
function simularIa(comClaude: boolean, comErro: boolean): Pick<Api, "estadoIa" | "salvarProvedorIa" | "removerProvedorIa" | "definirFuncaoIa" | "bloquearSensivelIa" | "testarProvedorIa" | "memoriaDoComputador" | "sugerirPassosIa" | "organizarTextoIa" | "ajustarOrganizacaoIa" | "desenharIconesIa" | "revisarTextoIa" | "gerarTemaIa" | "modelosImagemIa" | "gerarImagemIa"> {
  const espera = (ms = 400) => new Promise((r) => setTimeout(r, ms));
  const estado: EstadoIa = { provedores: [], funcoes: {}, modelos: {}, bloquearSensivel: false };
  if (comClaude) {
    estado.provedores.push({ id: "p1", tipo: "claude", nome: "Claude", url: "https://api.anthropic.com", modelo: "claude-opus-5-5", finalChave: "x9Qa", local: false });
    estado.funcoes = { quebrar: "p1", conversa: "p1", revisao: "p1", personalizacao: "p1" };
    estado.provedores.push({ id: "p2", tipo: "compativel", nome: "GPT", url: "https://api.openai.com/v1", modelo: "gpt-x", finalChave: "k2Lm", local: false });
  }
  const copia = () => structuredClone(estado);
  return {
    estadoIa: async () => copia(),
    salvarProvedorIa: async (p, chave) => {
      await espera();
      const local = /^http:\/\/(localhost|127\.0\.0\.1)/.test(p.url);
      if (!p.id) {
        const novo = { ...p, id: `p${Date.now()}`, finalChave: chave ? chave.slice(-4) : null, local };
        if (estado.provedores.length === 0) estado.funcoes = { quebrar: novo.id, conversa: novo.id, revisao: novo.id, personalizacao: novo.id };
        estado.provedores.push(novo);
      } else {
        const i = estado.provedores.findIndex((x) => x.id === p.id);
        const finalChave = chave === null ? estado.provedores[i].finalChave : chave ? chave.slice(-4) : null;
        estado.provedores[i] = { ...p, finalChave, local };
      }
      return copia();
    },
    removerProvedorIa: async (id) => {
      estado.provedores = estado.provedores.filter((p) => p.id !== id);
      for (const f of Object.keys(estado.funcoes) as FuncaoIa[]) if (estado.funcoes[f] === id) (delete estado.funcoes[f], delete estado.modelos[f]);
      return copia();
    },
    definirFuncaoIa: async (funcao, id, modelo) => {
      if (id) estado.funcoes[funcao] = id;
      else delete estado.funcoes[funcao];
      if (id && modelo?.trim()) estado.modelos[funcao] = modelo.trim();
      else delete estado.modelos[funcao];
      return copia();
    },
    bloquearSensivelIa: async (bloquear) => ((estado.bloquearSensivel = bloquear), copia()),
    testarProvedorIa: async (p, chave) => {
      await espera(700);
      if (p.tipo === "claude" && chave === "errada") throw new ErroOrbita("ia", "O provedor não aceitou a chave. Confira se ela foi colada inteira.", undefined, undefined, undefined, "chave");
      if (p.tipo === "claude") return ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
      if (p.url.includes("localhost")) return ["gemma3:4b", "qwen3:8b"];
      return ["gpt-4o", "gpt-4o-mini", "gpt-5.5", "gpt-5.5-mini", "gpt-5.6", "gpt-5.6-mini", "gpt-5.6-luna", "gpt-5.6-2026-08-01", "whisper-1", "text-embedding-3-large", "gpt-image-2"];
    },
    memoriaDoComputador: async () => 16,
    gerarTemaIa: async (_p, pedido, anterior, comDesenho) => {
      await espera(1200);
      const escuro = /escur|noite/i.test(pedido);
      const verde = { claro: "#3f6b4a", escuro: "#9cc7a3" };
      const tema = {
        nome: anterior ? "Floresta à noite (ajustado)" : "Floresta à noite",
        cantos: 1.4,
        sombra: true,
        icones: { traco: /fin|delicad/i.test(pedido) ? 1.5 : /gross|forte/i.test(pedido) ? 2.5 : 2, pontas: /ret|geom/i.test(pedido) ? "retas" : "redondas" },
        claro: { fundo: escuro ? "#e7ece6" : "#eef2ec", superficie: "#f8faf6", superficieAlternativa: "#e3eadf", texto: "#1d2a21", textoSuave: "#4b5a4f",
          borda: "#d2dccf", bordaControle: "#6f7f72", destaque: verde.claro, textoSobreDestaque: "#ffffff", foco: "#2c5d8f", atencao: "#8a4b22" },
        escuro: { fundo: "#141b17", superficie: "#1c2520", superficieAlternativa: "#25302a", texto: "#e8efe9", textoSuave: "#b3c0b6",
          borda: "#2f3b34", bordaControle: "#7f8f83", destaque: verde.escuro, textoSobreDestaque: "#10261a", foco: "#8fb4e3", atencao: "#e0a37a" },
        ...(comDesenho ? { fundoSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M20 60 L28 40 L36 60 Z M52 64 L60 44 L68 64 Z" fill="#6f8f76" opacity="0.18"/><circle cx="64" cy="16" r="3" fill="#6f8f76" opacity="0.2"/></svg>' } : {}),
      };
      return `Aqui está o tema:
${JSON.stringify(tema)}`;
    },
    modelosImagemIa: async (id) => (estado.provedores.find((p) => p.id === id)?.tipo === "claude" ? [] : ["chatgpt-image-latest", "dall-e-3", "gpt-image-1", "gpt-image-2", "gpt-image-2-mini"]),
    gerarImagemIa: async () => {
      await espera(1500);
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2b3a"/><stop offset="1" stop-color="#2f4a3a"/></linearGradient></defs><rect width="1536" height="1024" fill="url(#g)"/><path d="M0 800 L200 520 L400 800 Z M300 820 L560 460 L820 820 Z M700 830 L980 500 L1260 830 Z M1100 820 L1320 560 L1536 820 Z" fill="#183025"/><circle cx="1200" cy="200" r="60" fill="#d8e2c8" opacity="0.8"/></svg>';
      return `data:image/svg+xml;base64,${btoa(svg)}`;
    },
    revisarTextoIa: async (texto, _s, modo) => {
      await espera(900);
      const t = texto.trim();
      if (modo === "topicos") return t.split(/,| e /).map((x) => `- ${x.trim().charAt(0).toUpperCase()}${x.trim().slice(1)}`).join("\n");
      if (modo === "curto") return t.split(" ").slice(0, 6).join(" ") + ".";
      return t.charAt(0).toUpperCase() + t.slice(1).replace(/\s+,/g, ",").replace(/ e tive/, ", e tive") + (/[.!?]$/.test(t) ? "" : ".");
    },
    organizarTextoIa: async (_texto, sensivel) => {
      await espera(1200);
      if (comErro) throw new ErroOrbita("ia", "O provedor não aceitou a chave. Confira se ela foi colada inteira.", undefined, undefined, undefined, "chave");
      if (sensivel && estado.bloquearSensivel)
        throw new ErroOrbita("ia", "Você bloqueou o envio de dados de saúde e terapia para provedores de fora do computador.", undefined, undefined, undefined, "sensivel_bloqueado");
      const quinta = new Date();
      quinta.setDate(quinta.getDate() + ((4 - quinta.getDay() + 7) % 7 || 7));
      const data = quinta.toLocaleDateString("sv-SE");
      return {
        itens: [
          { tipo: "compromisso", texto: "Consulta com a psiquiatra", projetoId: null, data, hora: "15:00", duracaoMin: null },
          { tipo: "ideia", texto: "Pagar a conta de luz", projetoId: null, data: null, hora: null, duracaoMin: null },
          { tipo: "tarefa", texto: "Ler o artigo da Grandin", projetoId: "__primeiro_ativo__", data: null, hora: null, duracaoMin: null },
          { tipo: "ideia", texto: "Livro sobre faróis e pessoas que moram neles", projetoId: null, data: null, hora: null, duracaoMin: null },
        ],
        provedor: "Claude",
        local: false,
      };
    },
    // Desenhos de mentira: um quadrado torto com um X, igual para todos (só para ver a tela).
    desenharIconesIa: async (_p, _estilo, icones) => {
      await espera(700);
      const desenho = '<path d="M4 5l15-1 1 15-16 1z"/><path d="M8 8l8 8M16 8l-8 8"/>';
      return JSON.stringify({ icones: Object.fromEntries(icones.map(([n]) => [n, desenho])) });
    },
    // Entende só dois pedidos: uma hora nova ("às 16h") e tirar o último item.
    ajustarOrganizacaoIa: async (_texto, lista, mudanca) => {
      await espera(1000);
      if (comErro) throw new ErroOrbita("ia", "O provedor não aceitou a chave. Confira se ela foi colada inteira.", undefined, undefined, undefined, "chave");
      type Bruto = { tipo: TipoItemProposto; texto: string; projeto?: string; data?: string; hora?: string; duracaoMin?: number };
      let itens: ItemProposto[] = (JSON.parse(lista).itens as Bruto[]).map((b) => ({
        tipo: b.tipo, texto: b.texto, projetoId: b.tipo === "tarefa" ? "__primeiro_ativo__" : null,
        data: b.data ?? null, hora: b.hora ?? null, duracaoMin: b.duracaoMin ?? null,
      }));
      const hora = mudanca.match(/(\d{1,2})\s*h/);
      if (hora) itens = itens.map((i) => (i.tipo === "compromisso" ? { ...i, hora: `${hora[1].padStart(2, "0")}:00` } : i));
      if (/tir|remov|apag/i.test(mudanca)) itens = itens.slice(0, -1);
      return { itens, provedor: "Claude", local: false };
    },
    sugerirPassosIa: async () => {
      await espera(1200);
      if (comErro) throw new ErroOrbita("ia", "O provedor recusou por limite de uso ou falta de créditos. Confira a sua conta ou tente mais tarde.", undefined, undefined, undefined, "limite");
      return {
        passos: ["Abrir o arquivo do artigo", "Ler só o resumo e a conclusão", "Anotar três ideias principais", "Escrever uma frase sobre cada ideia"],
        provedor: "Claude",
        local: false,
      };
    },
  };
}

export const noApp = isTauri();
export const api: Api = noApp ? nativa : criarSimulacao();

/** Pergunta onde salvar o arquivo de recuperação e grava. Devolve false se a pessoa cancelar. */
export async function salvarArquivoRecuperacao(): Promise<boolean> {
  if (!noApp) return true;
  const caminho = await save({
    defaultPath: "orbita-chave-de-recuperacao.txt",
    filters: [{ name: "Texto", extensions: ["txt"] }],
  });
  if (!caminho) return false;
  await api.gravarArquivoRecuperacao(caminho);
  return true;
}

/** Pede para escolher o arquivo de recuperação e devolve as palavras lidas. */
export async function escolherArquivoRecuperacao(): Promise<string | null> {
  if (!noApp) return api.lerArquivoRecuperacao("");
  const caminho = await open({ multiple: false, directory: false, filters: [{ name: "Texto", extensions: ["txt"] }] });
  if (!caminho || Array.isArray(caminho)) return null;
  return api.lerArquivoRecuperacao(caminho);
}

const hoje = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD

/** Pergunta onde salvar um backup. Devolve null se a pessoa cancelar. */
export async function escolherOndeSalvarBackup(): Promise<string | null> {
  if (!noApp) return "simulacao.orbita-backup";
  return save({
    defaultPath: `orbita-backup-${hoje()}.orbita-backup`,
    filters: [{ name: "Backup do Órbita", extensions: ["orbita-backup"] }],
  });
}

/** Diálogo de "salvar como" para uma exportação (nome sugerido + extensão). */
export async function escolherOndeExportar(nomeBase: string, nomeFiltro: string, extensao: string): Promise<string | null> {
  if (!noApp) return `simulacao-${nomeBase}.${extensao}`;
  return save({
    defaultPath: `${nomeBase}.${extensao}`,
    filters: [{ name: nomeFiltro, extensions: [extensao] }],
  });
}

export async function escolherBackup(): Promise<string | null> {
  if (!noApp) return "simulacao.orbita-backup";
  const caminho = await open({ multiple: false, directory: false, filters: [{ name: "Backup do Órbita", extensions: ["orbita-backup"] }] });
  return typeof caminho === "string" ? caminho : null;
}

export async function escolherPasta(): Promise<string | null> {
  if (!noApp) return "C:\\Users\\Dan\\Google Drive\\Órbita";
  const caminho = await open({ multiple: false, directory: true });
  return typeof caminho === "string" ? caminho : null;
}

/** Escolhe um arquivo para anexar. Devolve null se a pessoa cancelar. */
export async function escolherArquivoParaAnexar(soImagens = false): Promise<string | null> {
  if (!noApp) return soImagens ? "C:\\Users\\Dan\\Imagens\\copo-de-agua.png" : "C:\\Users\\Dan\\Imagens\\esboço-da-capa.png";
  const filters = soImagens ? [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }] : undefined;
  const caminho = await open({ multiple: false, directory: false, filters });
  return typeof caminho === "string" ? caminho : null;
}

/** Escolhe um arquivo EPUB ou PDF para a estante. */
export async function escolherLivro(): Promise<string | null> {
  if (!noApp) return "C:\\Users\\Dan\\Livros\\dom-casmurro.epub";
  const caminho = await open({ multiple: false, directory: false, filters: [{ name: "Livros", extensions: ["epub", "pdf"] }] });
  return typeof caminho === "string" ? caminho : null;
}

/** Pergunta onde salvar a cópia de um anexo. */
export async function escolherOndeSalvarAnexo(nome: string): Promise<string | null> {
  if (!noApp) return nome;
  return save({ defaultPath: nome });
}

/** Exporta um tema para arquivo. No navegador (prévia), baixa o arquivo. */
export async function exportarTema(nome: string, conteudo: string): Promise<boolean> {
  const arquivo = `${nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}.orbita-tema`;
  if (!noApp) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
    a.download = arquivo;
    a.click();
    return true;
  }
  const caminho = await save({ defaultPath: arquivo, filters: [{ name: "Tema do Órbita", extensions: ["orbita-tema"] }] });
  if (!caminho) return false;
  await chamar("gravar_arquivo_tema", { caminho, conteudo });
  return true;
}
