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

## Retomar daqui (fim da sessão de 03/11/2026, versão 0.49.0 publicada no Windows e no navegador)
- Tudo commitado na branch `claude/awesome-allen-kkfoij`. Nada pendente de publicação.
- Combinado com Dan: **juntar os pedidos e só publicar quando ele mandar** (economiza minutos do Actions). Cada publicação sobe a versão (a próxima é 0.50.0).
- Ideias para depois (Dan ainda não pediu para fazer):
  - **IA no navegador** (iPad/celular): hoje nenhuma função de IA funciona lá, nem o "Planejar com a IA".
  - **Compartilhar um quadro** da Minha organização (ex.: TCC com a Ariana).
  - Pastas de projetos: **arrastar** para reordenar e arrastar o cartão para dentro da pasta (hoje é por setas e pelo botão "Pastas").
  - Sincronização: decidir se a chave muda quando a pessoa liga a "proteção extra".
  - Domínio orbita.arcano3.com.br: parado, esperando o INPI.
