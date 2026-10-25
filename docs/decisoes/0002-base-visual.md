# 0002 · Base visual: fontes, preferências e contraste

25/10/2026 · aprovado por Dan

**Fontes.** Atkinson Hyperlegible Next é a padrão; Lexend e OpenDyslexic são opções. Todas vão dentro do app, para funcionar sem internet.
A OpenDyslexic vem direto do projeto original (versão 0.990), e não do pacote @fontsource, porque a versão do pacote (0.920) desenha o "ó" com o acento fora do lugar.
A licença reserva o nome "OpenDyslexic": a fonte não pode ser alterada sem trocar de nome.

**Preferências fora do cofre.** As preferências visuais ficam no armazenamento local da janela, sem criptografia. A tela de senha precisa abrir já com a fonte e o contraste da pessoa. São lidas antes do primeiro desenho, para a tela não piscar com outras cores.

**Cores como variáveis.** Cada tema é uma lista de cores (pacote `@orbita/temas`) convertida em variáveis CSS. Os temas futuros trocam só essas variáveis.

**Contraste testado.** Um teste automático mede todo par de texto e fundo de cada tema, nos modos claro e escuro, com e sem baixo estímulo. Mínimos: 7:1 no texto principal, 4,5:1 no texto secundário e no destaque, 3:1 em bordas de controle e foco. O build falha se algum ficar abaixo.

**Baixo estímulo.** Troca a cor de destaque por cinza, tira sombras, animações e transições. O "reduzir animações" do Windows também desliga as transições.
