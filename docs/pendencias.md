# Pendências anotadas por Dan (para a próxima atualização)

Teste da 0.45.1 no iPad, 29/10/2026. Caderno "ficou bom"; pressão da caneta funcionou.

## Caderno
1. **Folha solta mesmo com "escrever só com a caneta":** a mão apoiada ainda arrasta a página e dá zoom sem querer. Dan sugeriu um botão "travar o caderno"; avaliar solução melhor (ex.: com "só caneta" ligado, ignorar pan/zoom de toque durante e logo após um traço da caneta; travar por padrão e só rolar com dois dedos; ou botão de cadeado). — **Feito na 0.45.2** (falta testar no iPad).
2. **"Só caneta" ligado por padrão** em iPad e tablets em geral (não esperar a primeira detecção de caneta). — **Feito na 0.45.2** (falta testar no iPad).
3. **Barra de ferramentas:** não fica claro que algumas ferramentas (formas etc.) se expandem e que a barra se arrasta para mudar de lado; ela não "pula" sozinha. Deixar isso visível (dica na primeira vez, alça evidente). — **Feito na 0.45.2** (falta testar no iPad).
4. **Barra nas posições de cima/baixo fica grossa demais**; nas laterais fica fina mas não encaixa na página (fica quadrada). Redesenhar a barra para ficar bonita e encaixada nas quatro posições, com um padrão único. — **Feito na 0.45.2** (falta testar no iPad).
5. **Criar página ao arrastar:** ao puxar além da última página (lateral ou vertical), a pessoa deve *sentir* que a página está nascendo e soltar para criar; o menu continua como alternativa. — **Feito na 0.45.2** (falta testar no iPad).
6. **Lápis:** parece falhar um pouco com a Pencil (Dan não tem certeza se foi uso errado). Verificar. — **Feito na 0.45.2** (falta testar no iPad).
7. **Modelos de pincel:** giz, spray, pincel seco, aquarela etc., escolhíveis na ferramenta pincel. — **Feito na 0.45.2** (falta testar no iPad).

## Decisões pendentes de Dan (levantadas pelos agentes)
- Energia: camuflagem entra no saldo ou só marca? — **Decidido em 04/11: entra no saldo (pouco = 1, muito = 2). Feito.**
- Dinheiro: "Saiu" soma gastos + contas fixas (conta paga registrada como gasto conta duas vezes). — **Corrigido em 04/11: o gasto diz qual conta paga.**

## Aparência
8. **"Igual ao Windows" → "Igual ao sistema":** a opção de modo de cor (e qualquer outro texto que cite "Windows" onde vale para iPad, Mac e Android) deve usar "sistema", um padrão só para todas as versões. — **Feito** (a tela já dizia "Igual ao sistema").

## Caderno — pastas
9. **Ícone de pasta mais 3D** (hoje ficou chapado), **menor** (não precisa do quadradão grande) e com **cor por pasta** escolhida pela pessoa. — **Feito na 0.45.2** (falta testar no iPad).

## Textos
10. "neste computador" em textos que também aparecem no iPad/celular (ex.: cabeçalho de Ajustes: "ficam salvas neste computador") → "neste aparelho" onde valer para todas as versões. — **Feito em 04/11** (textos do Windows Hello, Ollama e ditado continuam com "computador", porque só existem lá).

## Retomar daqui (04/11/2026, 0.51.0 publicada)
- **0.51.0 publicada**: navegador no ar (`…/orbita-versoes/app/versao.json` = 0.51.0) e o Windows também (build sob demanda, run 41842409339, sucesso; `latest.json` do orbita-versoes = 0.51.0, o app avisa sozinho). Notas em `apps/desktop/notas-da-versao.md`.
- O que entrou (detalhes na especificação, parte do caderno): editor completo (estilos prontos e da pessoa, estilos de letra, capitular, documento com páginas, fontes do aparelho e das normas, "Aa", referências ABNT/APA/Vancouver); Enviar (PDF, Word, PNG, TXT, MD); painel lateral (Páginas, IA, Fontes, Biblioteca); **IA com liberdade total no caderno** com cópia antes e "Desfazer tudo o que a IA fez"; **Fontes do caderno** (tipo NotebookLM); mapa mental; biblioteca; corretor da escrita à mão; tema do caderno; aviso de saúde uma vez por provedor; **Contas conectadas** (Drive, Docs, Classroom, Zotero).
- **Dan precisa fazer**: a Parte 5 de `docs/configurar-contas.md` (ligar a Google Classroom API e acrescentar 3 permissões no painel do Google) e testar com a conta da faculdade. Sem isso, "Ligar a conta Google" em Contas conectadas dá erro de permissão.
- **Testar no Windows e no iPad** (pedir a Dan, de uma vez): IA mexendo no caderno com um provedor de verdade (pedir "organize em tópicos", "pinte os títulos de azul", "apague a página 3") e o desfazer; Fontes com um PDF grande da faculdade (lentidão? texto certo?) e a foto lida pela IA; DOI/ISBN no Windows (antes, a lista de endereços do app bloqueava); Zotero do computador; Classroom (tarefas, prazo na agenda, entregar pelo Drive).
- **Limite conhecido**: o Google não deixa app de fora anexar nem entregar tarefa do professor no Classroom (documentação da API: `modifyAttachments` e `turnIn` só para o app que criou a tarefa). A entrega é: salvar no Drive pelo Órbita e tocar em Entregar no Classroom.
- **Ficou para depois**: sumário automático; ensinar a minha letra; IA extrair campos de referência; seletor do Drive dentro do Órbita (Google Picker); análise do Google para os escopos do Classroom (Onda 4); PDF digitalizado lido pela IA página por página.

## Antes (04/11/2026: versão 0.50.0 publicada no navegador e no Windows)
- Tudo commitado na branch `claude/awesome-allen-kkfoij`. **0.50.0 publicada** (navegador e Windows). Combinado: juntar os pedidos e só publicar quando Dan mandar; a próxima é a **0.51.0**.
- Feito nesta rodada (ver a especificação, "Decisões de 04/11/2026"):
  - textos "neste aparelho"; camuflagem no saldo da Energia; conta fixa paga sem contar duas vezes no Dinheiro; arrastar pastas e projetos em Projetos;
  - **IA no navegador** (decisão 0013): o Rust monta os pedidos e confere as respostas, o navegador só envia;
  - **Caderno**: página inteira na tela e virar a página; rolagem, pinça e gestos próprios (2 dedos desfazem, 3 refazem, 1 dedo 2 toques aproxima, 4 dedos tela limpa); piso de pressão e traço sem falhas; cores da folha com amostras reais; visão das páginas; adicionar página antes/depois/no fim; barra no estilo Goodnotes com barra de contexto; forma ao segurar; laser; capa como página 1 (com conversão dos cadernos antigos); página de texto e documento de texto.
- **Para Dan testar no iPad** (só dá no aparelho de verdade):
  1. Escrever rápido e devagar com a Pencil (caneta, lápis, pincel): o traço não pode mais falhar.
  2. Arrastar a folha com um dedo (com "só caneta" ligado), pinça para aproximar, dois dedos dois toques (desfazer) e três dedos dois toques (refazer).
  3. A página cabe inteira na tela, em pé e deitado, com a barra em cada lado.
  4. Palma apoiada não deve rolar nem dar zoom (o limite da palma mudou de 30 para 70 px).
  5. Cor da folha e linhas mudam a página que está na tela; "Outra cor" abre o seletor.
  6. Abrir um caderno antigo: a capa antiga deve virar a página 1 do jeito que estava.
  7. IA no Safari com uma chave real (Claude, GPT, Gemini ou Grok): Planejar com a IA e Separar com IA.
- Ideias para depois (Dan ainda não pediu): compartilhar um quadro da Minha organização; quadro infinito do caderno; arrastar para reordenar páginas na visão de páginas; imagens dentro da página de texto; domínio orbita.arcano3.com.br (esperando o INPI).
