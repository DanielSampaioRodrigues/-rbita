# O que falta implementar

12/11/2026 · versão 0.51.1. **Conferido no código** (não só nas anotações): cada item abaixo foi procurado nos arquivos do app. A lista anterior (25/10, versão 0.29.2) tinha ficado desatualizada e levou a erro: dizia que faltavam coisas que já existiam. Ao terminar um item, riscar aqui no mesmo commit.

O histórico do que já foi feito está na especificação (`docs/especificacao.md`) e nas notas de cada versão (`apps/desktop/notas-da-versao.md`).

## 1. Caderno e documento

- [x] ~~**Quadro infinito**~~ (12/11/2026): tela grande com as mesmas ferramentas, abre no meio, cresce para a direita e para baixo, zoom de 15% a 400%.
- [x] ~~Quadro infinito, segunda parte~~ (12/11/2026): enviar como PDF ou imagem, crescer para todos os lados, IA e biblioteca no meio da vista. Falta só a IA "com liberdade total" dentro do quadro.
- [x] ~~**Importar PDF para anotar no caderno**~~ (12/11/2026): PDF e imagens viram páginas com o arquivo de fundo.
- [x] ~~**Arrastar para reordenar as páginas**~~ (12/11/2026) na visão das páginas e no painel lateral (mouse, caneta, dedo e teclado).
- [x] ~~**Sumário automático**~~ (12/11/2026) no documento de texto.
- [x] ~~**Ensinar a minha letra** ao corretor da escrita à mão~~ (12/11/2026): escrever o alfabeto uma vez; a palavra corrigida sai na letra da pessoa. Também "Minhas palavras": lista de palavras certas que vai à IA e nunca é marcada.
- [x] ~~**PDF digitalizado nas Fontes** lido pela IA página por página~~ (12/11/2026).
- [x] ~~**IA preencher os campos da referência** a partir de um texto colado~~ (12/11/2026).
- [ ] Seletor do Google Drive dentro do Órbita (Google Picker); hoje abre pelo seletor de arquivos do sistema.

## 2. Estudos

- [x] ~~**Classroom ligado à Vida acadêmica**~~ (12/11/2026): "Pôr nos Estudos" leva a tarefa para a matéria da turma.
- [x] ~~**Prova e entrega viram compromisso na Agenda**~~ (12/11/2026).
- [x] ~~**"Comece na terça se entrega na sexta"**~~ (12/11/2026): "Começar quantos dias antes".
- [x] ~~**"Estudar agora"** abre o Foco com a matéria~~ (12/11/2026).
- [x] ~~**Matéria como assunto**: cadernos e leituras ligados à matéria~~ (12/11/2026).
- [ ] Matéria como assunto, segunda parte: grifos e páginas soltas marcados com a matéria.

## 3. Leitura

Já existem: estante em prateleiras, leitor de EPUB e PDF com fontes e cores, sumário, marcadores, notas, grifo no EPUB, caneta no PDF.
- [x] ~~**Régua de leitura**, **leitura em voz alta** e **busca no livro**~~ (12/11/2026).
- [x] ~~**Grifo de texto no PDF**~~ (12/11/2026), nos PDFs com texto.
- [x] ~~**Fichamento** (citação, resumo, comentário, paráfrase) em ABNT, com exportação~~ (12/11/2026).

## 4. Outros módulos

- [x] ~~**Dinheiro**: importar o extrato do banco (OFX ou CSV); avisar conta a vencer~~ (12/11/2026).
- [x] ~~**Minha organização**: ligar cartão com prazo à Agenda; enviar um quadro (como texto)~~ (12/11/2026).
- [ ] **Quadro compartilhado para editar a duas pessoas** (depende da sincronização com conta, Onda 3).
- [x] ~~**Modo baixa energia**: mostrar o remédio a partir da medicação cadastrada na Saúde~~ (12/11/2026).
- [ ] **Contas para a recuperação**: Dropbox e Nextcloud/WebDAV. Avaliado em 12/11/2026 (`docs/decisoes/0014-dropbox-webdav.md`): recomendo Dropbox (vale também no iPad) e WebDAV só no Windows, como opção avançada. **Esperando Dan decidir.**

## 5. Depende de Dan (não é código)

- [ ] **Parte 5 de `docs/configurar-contas.md`**: ligar a Google Classroom API e acrescentar as 3 permissões. Sem isso, "Ligar a conta Google" em Contas conectadas não funciona.
- [ ] **Conta Microsoft (OneDrive)**: o código e o workflow estão prontos (`ORBITA_MICROSOFT_CLIENT_ID`); falta registrar o app na Microsoft (Parte 3).
- [ ] **Testes no Windows e no iPad** da 0.51.x: IA mexendo no caderno com chave de verdade e o desfazer; Fontes com PDF grande; DOI/ISBN no Windows; Zotero do computador; Classroom; Espaço segurado para a mão; caneta do Windows virada para apagar; menu flutuante.
- [ ] **Testes da 0.55.0 (publicada em 24/11/2026)**, no iPad e no Windows:
  - Caderno aberto: a folha ocupa a tela? A barra de cima, a pílula de opções e o contador atrapalham a escrita em algum canto?
  - Caneta de verdade (Apple Pencil): rabiscar apaga? Apaga sem querer com letra cursiva ou hachura? (Só foi testado com mouse simulado.)
  - Botão único de escrita: trocar entre caneta, lápis, pincel e marca-texto pela pílula.
  - Abas: abrir três cadernos, trocar, fechar. Apresentar: no iPad (sem tela cheia no navegador) e no Windows (tela cheia).
  - Caderno antigo com "cor da barra" escolhida: a faixa de cima acompanha a cor e os ícones se leem?
  - Computador com a tela deitada: a página inteira deixa muita mesa vazia dos lados; decidir se o começo ali também deve ser "largura toda".
- [ ] **Caderno, o que ficou de fora da 0.55.0:** capas (a Galeria já tem capas prontas; a capa de cor lisa não mudou); o painel lateral continua na cor do tema (claro), ao lado da mesa escura; "circular para laçar" (o outro gesto de caneta do Goodnotes).
- [ ] **Testes da 0.54.0 (publicada em 18/11/2026)**, no iPad e no Windows:
  - O céu: está fluido? Arrastar gira, dois dedos passeiam, pinça aproxima? Os nomes se leem bem?
  - Aparelho lento: apareceu a pergunta "Posso reduzir as animações e os efeitos?" e "Reduzir" ajudou?
  - Tocar num caderno, projeto ou livro no céu e abrir pela barra do cartão.
  - Baixo estímulo ligado: o Início volta para a lista. "Ver o céu" e "Lista" trocam.
  - Primeira vez (num navegador limpo ou aparelho novo): duas telas, "Escolher tudo", abre sem PIN.
  - Saúde com as abas Energia e Profissionais (os dados antigos de Energia e Cuidado estão lá).
  - Ctrl + K: achar um caderno pelo nome; escrever algo e guardar como ideia.
- [ ] **Órbita em 3D, o que falta:** linhas ligando coisas relacionadas; criar caderno ou projeto direto do céu; páginas em órbita dos cadernos; resto da "cara de programa" nas telas por dentro (painéis, um só tipo de aba, botão "Novo").
- [ ] **Início em lista:** o quadro "O que mudou na versão" mostra a lista da primeira versão, não as notas de verdade.
- [ ] **Testes da 0.53.0 (publicada em 17/11/2026)**, no iPad e no Windows:
  - Página de texto que passa da folha: "Continuar numa página nova" leva o resto (inclusive o texto antigo da IA que ficou cortado).
  - Colar no caderno: foto e texto do iPhone, imagem sem fundo (continua sem fundo), PDF, texto do Word ou do navegador (com títulos e listas). No iPad, o botão Colar mostra o balão do sistema.
  - Copiar uma seleção do caderno e colar no Notes ou no Keynote: vem a imagem sem fundo.
  - Segurar o dedo na folha (com a seta ou com "só a caneta desenha") abre Colar.
  - Seta e laço: nenhuma janela abre ao escolher; a barrinha aparece inteira.
  - Imagem: Cortar, Tirar o fundo (foto de folha branca e de quadro branco), Girar, Espelhar, Trocar; Ctrl+Z volta.
  - Painel da IA: conversa, fontes marcadas, trocar o modelo (e conferir em Ajustes > IA > Caderno).
- [ ] **Testes da 0.52.0 (publicada em 12/11/2026)**, que aqui só deu para simular:
  - **Com a chave de IA de verdade**: "Preencher com a IA" na referência; "Ler as páginas com a IA" num PDF digitalizado nas Fontes; corretor com "Minhas palavras".
  - **Extrato do seu banco** (OFX ou CSV): conferir se as colunas e os sinais vêm certos.
  - **No iPad**: escolher texto no PDF com o dedo para grifar; quadro infinito com pinça, dois dedos e a caneta; "Ensinar a minha letra" com o Apple Pencil e a troca da palavra no corretor.
  - **No Word**: abrir o fichamento exportado (citação longa com recuo de 4 cm).
  - **Estudos**: trabalho na Agenda e "Comece em"; "Virar projeto"; matéria com caderno e livro ligados.
- [ ] **Teste com leitor de tela** (NVDA) com quem usa no dia a dia.
- [ ] **Portão da Onda 1**: usar no dia a dia por algumas semanas e aprovar (`docs/revisao-onda-1.md`).

## 6. Lançamento (Onda 4)

- [ ] Assinatura digital do instalador do Windows (tira o aviso "O Windows protegeu o computador").
- [ ] Análise do Google para os escopos do Classroom (sem ela, até 100 pessoas) e logo na tela do Google.
- [ ] Versões Mac, Android e iOS do mesmo código (Onda 3); hoje o iPad usa a versão de navegador.
- [ ] Página do projeto, distribuição gratuita e doação; galeria de temas da comunidade; decidir sobre código aberto.

## 7. Decisões em aberto

- [ ] Nome Órbita no INPI (e o domínio orbita.arcano3.com.br).
- [ ] Conta de desenvolvedor da Apple: individual ou de empresa.
- [ ] Motor de temas compartilhado com o Escuta ou separado; como o Escuta recebe o motor de leitura.
- [ ] As páginas públicas do `orbita-versoes` saem da branch `claude/orbita-setup-planning-cfbqzz`. Trocar exige mudar também a origem do GitHub Pages (não trocar sem combinar: ela serve as páginas exigidas pelo Google).

## Onde está o código

- A `main` do `-rbita` foi avançada em 12/11/2026 até a branch de trabalho (`claude/awesome-allen-kkfoij`), duas vezes no mesmo dia (depois, com Estudos, Dinheiro, Organização, Leitura, quadro infinito, referência pela IA, "minha letra" e PDF digitalizado nas Fontes, ainda não publicados: a versão no ar continua 0.51.1; ao publicar, recompilar o motor do navegador com `pnpm motor`, porque o Rust mudou); antes, tinha parado em 25/10. **Ao terminar uma rodada, levar o trabalho para a `main`** (com `[skip ci]` na mensagem quando a versão já estiver publicada, para não montar o instalador do Windows à toa).
