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

## Retomar daqui (04/11/2026, depois da 0.50.0: rodada do caderno e do editor, ainda sem publicar)
- Tudo commitado na branch `claude/awesome-allen-kkfoij`. **Nada desta rodada foi publicado.** Dan pediu para **juntar tudo numa atualização só** (a 0.51.0), com o painel de IA e o resto do plano. Publicar só quando ele mandar.
- Feito nesta rodada (detalhes na especificação, parte do caderno):
  - editor completo (TipTap) com abas Início, Inserir, Página e Revisar; estilos prontos (Órbita, ABNT, APA...); documento com páginas de verdade; caixa de texto com a barra completa e alças;
  - fontes: normas acadêmicas (com substitutas de mesma medida), as do Órbita, 15 livres e as do aparelho (Rust `fontes.rs` no Windows; lista completa do iPadOS no navegador); botão "Aa" (maiúsculas/minúsculas, versalete, Shift+F3);
  - estilos de parágrafo próprios (criar a partir do parágrafo, atualizar, lista "Meus estilos"; banco `caderno.estilos`, viajam na sincronização) e capitular;
  - tema próprio do caderno (opcional); pinça com o polegar; cores no baixo estímulo no app todo;
  - aviso de dado sensível só na primeira vez com cada provedor (`ia.avisoSensivel`);
  - **exportar e compartilhar**: PDF com texto de verdade (motor próprio, `exportar/medir.ts` + `pdf.ts`), Word, PNG, TXT e MD; Compartilhar no iPad, "Salvar como" no Windows.
- **Etapas do plano aprovado, feitas nesta rodada**: painel lateral (Páginas, IA, Biblioteca); painel de IA (pedidos prontos e livres, imagem da página, fotos do quadro, propostas); mapa mental desenhado; biblioteca (seleção, modelo de página, texto); referências ABNT/APA/Vancouver (citation-js + CSL, DOI/ISBN); corretor da escrita à mão (sob pedido, troca por cursiva).
- **Rodada final da 0.51 (aprovada por Dan em 04/11/2026: "pode juntar tudo e publicar", "faculdade usa o Classroom")**, nesta ordem, cada uma com commit; no fim, **publicar a 0.51.0 no navegador e no Windows**:
  1. ~~estilos de caractere~~ (feito);
  2. ~~**IA com liberdade total no caderno**~~ (feito; testado no navegador com IA simulada: pintar, apagar, formatar, mapa, desfazer, cópia guardada ao sair e voltar): a IA devolve um plano de mudanças (JSON) que o app aplica direto (editar texto da página e das caixas, formatar, mover, apagar, criar e reordenar páginas, mapa), com cópia antes e "Desfazer tudo o que a IA fez" (regra nova no CLAUDE.md);
  3. ~~**Fontes do caderno**~~ (feito; testado no navegador com PDF de 3 páginas, Word e EPUB; falta testar a foto lida pela IA com provedor de verdade) (algo como o NotebookLM, que não tem API para contas pessoais): PDFs, Word, imagens e notas; texto extraído no aparelho (pdf.js, mammoth); busca local dos trechos (BM25); respostas com citação [F2 p.14] que abrem a fonte na página; resumo, fichamento ABNT, guia de estudo, perguntas, mapa mental das fontes;
  4. **conectores**: Zotero (web com chave e local no Windows pelo Rust), Google Drive (salvar com `drive.file`; abrir pelo seletor de arquivos do sistema, que já mostra o Drive no iPad e a pasta do Drive no Windows), Google Docs (enviar .docx convertido e abrir), Classroom (turmas, tarefas e prazos; anexar e entregar, com confirmação) — Dan faz os passos no painel do Google (escrever o passo a passo em `docs/configurar-contas.md`); até a verificação do Google, só para usuários de teste.
- **Ficou para depois**: sumário automático pelos títulos; "ensinar a minha letra" no corretor; Google Drive direto (precisa do passo de Dan no Google); a IA extrair os campos de uma referência bagunçada (hoje: DOI/ISBN ou à mão).
- Conectores diretos: Google Drive depende de Dan acrescentar `drive.file` no painel do Google; Classroom pede revisão; OneDrive espera o registro na Microsoft.
- **Para Dan testar quando sair a 0.51** (iPad e Windows): editor (o que "não funcionava" na 0.50), fontes (inclusive se as do Adobe Fonts aparecem no Windows), estilos próprios, capitular, Enviar (PDF no WhatsApp pelo Compartilhar; Salvar como no Windows; abrir o .docx no Word).

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
