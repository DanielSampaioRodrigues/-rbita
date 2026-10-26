# @orbita/leitor

Motor de leitura de EPUB (epub.js) e PDF (PDF.js), sem React e sem Tauri, para
ser reaproveitado no leitor da Arcano 3 e na biblioteca do Escuta.

- `tipos.ts` — tipos comuns (configuração de leitura, localização, sumário).
- `estilo.ts` — lógica pura que transforma a configuração em CSS (testável).
- `leitor.ts` — a classe `Leitor`, que abre um livro num elemento da página e
  controla páginas, fonte, cores e posição.

A renderização depende do navegador (DOM/canvas); a parte visual só é validada
rodando o app de verdade.
