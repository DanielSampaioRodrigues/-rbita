# 0008 · Ditado local com whisper.cpp

25/10/2026 · decidido pelo Claude com autonomia dada por Dan; **testar no Windows com o microfone de verdade**.

**whisper.cpp embutido no Órbita** (pela biblioteca `whisper-rs`), em vez de um programa à parte. A pessoa só baixa o modelo de voz, sem instalar mais nada. O instalador cresce pouco; o peso fica no modelo, que é opcional.

**Gravação pela parte nativa** (biblioteca `cpal`, microfone padrão do Windows), não pela janela. A voz não passa pela interface, e o Windows não mostra um pedido de permissão do navegador embutido. O áudio é misturado em um canal e convertido para 16 kHz, o que o whisper espera.

**Dois modelos multilíngues**: base (142 MB, mais rápido) e small (466 MB, erra menos em português). Os modelos `.en` são só para inglês. O "large" e o "turbo" seriam mais precisos, mas lentos demais sem placa de vídeo; ficam para depois, se fizer falta.

**Download conferido** pela soma SHA-1 publicada no repositório do whisper.cpp (`models/README.md`). Arquivo diferente é apagado. O download vai para um arquivo `.parcial` e só vira o modelo depois de conferido.

**Silêncio não vira texto.** O whisper inventa frases quando recebe silêncio ("Legendas pela comunidade..."). Se o volume médio fica abaixo de um mínimo, o Órbita diz que não ouviu e lembra da permissão de microfone do Windows.

**Revisão de texto só depois do ditado**, com antes e depois lado a lado. Pôr "revisar" em todo campo pesaria a tela; o ditado é o momento em que a revisão mais ajuda (pontuação e acentos).

**Riscos que só o teste no Windows mostra:** microfone bloqueado nas configurações de privacidade, microfones com formatos raros, tempo de transcrição em computadores mais simples.
