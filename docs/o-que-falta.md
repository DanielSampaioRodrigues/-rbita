# O que falta implementar

12/11/2026 · versão 0.51.1. **Conferido no código** (não só nas anotações): cada item abaixo foi procurado nos arquivos do app. A lista anterior (25/10, versão 0.29.2) tinha ficado desatualizada e levou a erro: dizia que faltavam coisas que já existiam. Ao terminar um item, riscar aqui no mesmo commit.

O histórico do que já foi feito está na especificação (`docs/especificacao.md`) e nas notas de cada versão (`apps/desktop/notas-da-versao.md`).

## 1. Caderno e documento

- [ ] **Quadro infinito**: o modo aparece ao criar um caderno, mas abre só o aviso "chega na próxima etapa" (`Caderno.tsx`, texto `infinitoEmBreve`). Rolagem e zoom livres, com as mesmas ferramentas.
- [x] ~~**Importar PDF para anotar no caderno**~~ (12/11/2026): PDF e imagens viram páginas com o arquivo de fundo.
- [x] ~~**Arrastar para reordenar as páginas**~~ (12/11/2026) na visão das páginas e no painel lateral (mouse, caneta, dedo e teclado).
- [x] ~~**Sumário automático**~~ (12/11/2026) no documento de texto.
- [ ] **Ensinar a minha letra** ao corretor da escrita à mão.
- [ ] **PDF digitalizado nas Fontes** lido pela IA página por página (hoje fica marcado como "sem texto").
- [ ] **IA preencher os campos da referência** a partir de um texto colado.
- [ ] Seletor do Google Drive dentro do Órbita (Google Picker); hoje abre pelo seletor de arquivos do sistema.

## 2. Estudos

- [x] ~~**Classroom ligado à Vida acadêmica**~~ (12/11/2026): "Pôr nos Estudos" leva a tarefa para a matéria da turma.
- [x] ~~**Prova e entrega viram compromisso na Agenda**~~ (12/11/2026).
- [x] ~~**"Comece na terça se entrega na sexta"**~~ (12/11/2026): "Começar quantos dias antes".
- [x] ~~**"Estudar agora"** abre o Foco com a matéria~~ (12/11/2026).
- [ ] **Matéria como assunto que atravessa o app** (caderno, leitura, fontes).

## 3. Leitura

Já existem: estante em prateleiras, leitor de EPUB e PDF com fontes e cores, sumário, marcadores, notas, grifo no EPUB, caneta no PDF.
- [x] ~~**Régua de leitura**, **leitura em voz alta** e **busca no livro**~~ (12/11/2026).
- [ ] **Grifo de texto no PDF** (precisa da camada de texto do PDF; hoje o PDF é só imagem na tela).
- [ ] **Fichamento** (citação, resumo, comentário, paráfrase) em ABNT, com exportação.

## 4. Outros módulos

- [x] ~~**Dinheiro**: importar o extrato do banco (OFX ou CSV); avisar conta a vencer~~ (12/11/2026).
- [ ] **Minha organização**: ligar cartão com prazo à Agenda; compartilhar um quadro.
- [x] ~~**Modo baixa energia**: mostrar o remédio a partir da medicação cadastrada na Saúde~~ (12/11/2026).
- [ ] **Contas para a recuperação**: Dropbox e Nextcloud/WebDAV (avaliar).

## 5. Depende de Dan (não é código)

- [ ] **Parte 5 de `docs/configurar-contas.md`**: ligar a Google Classroom API e acrescentar as 3 permissões. Sem isso, "Ligar a conta Google" em Contas conectadas não funciona.
- [ ] **Conta Microsoft (OneDrive)**: o código e o workflow estão prontos (`ORBITA_MICROSOFT_CLIENT_ID`); falta registrar o app na Microsoft (Parte 3).
- [ ] **Testes no Windows e no iPad** da 0.51.x: IA mexendo no caderno com chave de verdade e o desfazer; Fontes com PDF grande; DOI/ISBN no Windows; Zotero do computador; Classroom; Espaço segurado para a mão; caneta do Windows virada para apagar; menu flutuante.
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

- A `main` do `-rbita` foi avançada em 12/11/2026 até a branch de trabalho (`claude/awesome-allen-kkfoij`); antes, tinha parado em 25/10. **Ao terminar uma rodada, levar o trabalho para a `main`** (com `[skip ci]` na mensagem quando a versão já estiver publicada, para não montar o instalador do Windows à toa).
