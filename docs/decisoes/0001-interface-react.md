# 0001 · Interface em React

25/10/2026 · aprovado por Dan

**Decisão.** A interface usa React com TypeScript e Vite, num monorepo com pnpm.

**Por quê.**
- O Excalidraw (caderno infinito) e o React Flow (mapa mental) são feitos em React.
- React Aria e dnd-kit dão componentes e arrastar e soltar acessíveis por teclado, o que cobre o princípio 7.
- É o framework em que o Claude erra menos, e todo o código fica com ele.

**Descartado.** Svelte e Solid: mais leves, mas sem essas bibliotecas prontas. O peso extra do React não se nota num app de computador.

**Limites.** Temas usam variáveis CSS e o motor de leitura é TypeScript puro, para não ficarem presos ao React.
