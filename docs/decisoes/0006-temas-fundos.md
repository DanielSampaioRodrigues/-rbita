# 0006 · Temas, fundos e contraste automático

25/10/2026 · decidido pelo Claude com autonomia dada por Dan; revisar o visual dos temas.

**Contraste garantido sem bloquear a escolha.** Em vez de analisar a imagem e recusar, o Órbita deixa a pessoa escolher qualquer fundo e ajusta a área de conteúdo (cor do tema por cima, com desfoque leve) até o texto passar no contraste. A conta (`opacidadeNecessaria`) é pura e testada; o app só lê os pixels com canvas. Barra lateral e cartões ficam opacos: assim o ajuste só precisa cuidar do texto solto sobre a página.

**Fundos guardados nas preferências.** A foto vai reduzida (JPEG, até 1920 px) para o armazenamento local da janela, fora do cofre, como o resto da aparência. Se a pessoa usar fotos pessoais sensíveis como fundo, vale lembrar disso (anotado para a revisão de privacidade).

**SVG com DOMPurify.** Biblioteca madura e mantida, em vez de uma limpeza feita à mão. Por cima dela, o Órbita bloqueia qualquer link que não seja interno (`#id`) ou imagem embutida, e limpa o CSS dentro do SVG. Testado com scripts, `onload`, `foreignObject`, `iframe`, `javascript:`, `@import` e `url()` externos.

**Animação desligada por padrão** (princípio 2). Congelar é tirar `animate`, `animateTransform`, `animateMotion`, `set` e as animações de CSS.

**Fica para a etapa 12:** editor de tema (ajustar cada cor com prévia), importar e exportar tema em arquivo único e a tela inicial montável.
