# motor-web

O banco do Órbita (o mesmo código Rust do Windows, em `apps/desktop/src-tauri/src/banco`) compilado para
WebAssembly, para a versão de navegador usar o mesmo SQLite criptografado. Decisão em
`docs/decisoes/0011-motor-unico.md`.

## Como montar

Pré-requisitos (uma vez): `rustup target add wasm32-unknown-unknown` e
`cargo install wasm-bindgen-cli --version <versão> --locked`. A versão do `wasm-bindgen-cli` tem que ser
**igual** à da crate `wasm-bindgen` em `Cargo.lock` (hoje 0.2.130); se uma mudar, mude a outra (e o
workflow `.github/workflows/instalador-windows.yml`).

Depois, em `apps/desktop`:

```
pnpm motor
```

Isso roda `cargo build --release --target wasm32-unknown-unknown` aqui e o `wasm-bindgen --target web`,
gerando `apps/desktop/src/web/motor/` (pasta fora do git). Sem ela, o build de navegador abre, mas avisa
"rode pnpm motor" na hora de usar. O Windows não precisa do motor.

## Como a ponte é gerada

O `build.rs` lê `apps/desktop/src-tauri/src/comandos.rs` e, para cada `#[tauri::command]` que só usa o
banco (`estado.com_sessao(|s| ...)`), cria uma função com o mesmo nome e argumentos para o navegador chamar.
Comando novo no Windows entra sozinho na próxima compilação.

Ficam de fora, e precisam de versão própria no navegador (`apps/desktop/src/web/modoWeb.ts`), os comandos que:

- usam algo do sistema: `.await`, `std::fs`, cofre, backup, IA, ditado, nuvem, `tauri::`, janela, caminhos
  de arquivo (lista `PROIBIDO` no `build.rs`);
- usam tipos, constantes ou funções definidos só em `comandos.rs`.

## Como testar

- Compilar rápido, sem wasm-bindgen: `cargo build --target wasm32-unknown-unknown` aqui (o job
  `testes-nativos` do workflow faz isso, para pegar cedo um comando novo que quebre a ponte).
- Prova no navegador: `prova/` (`index.html` e `teste.cjs`). O `teste.cjs` usa Playwright (Chromium), serve
  a pasta `pkg/` e abre o banco, cria ideias e confere o resultado.
- Não existe ainda um script `teste-web.cjs` em `apps/desktop/scripts`.
