# 0011 · Um motor só para Windows e navegador

**Data:** 02/11/2026 · **Situação:** aceita (prova feita) · **Decisão de Dan:** caminho B

## Problema

Para entrar com Google e sincronizar, Windows e navegador precisam guardar os dados do mesmo jeito.
Hoje não guardam:

- **Windows:** banco SQLite criptografado (SQLCipher) com 9 tabelas genéricas (`item`, `evento`,
  `registro`, `anexo`, `anexo_conteudo`, `etiqueta`, `etiquetagem`, `ligacao`, `config`). Todo registro tem
  `alterado_em` e `excluido_em` (apagar só marca). Pronto para sincronizar.
- **Navegador:** uma reimplementação em TypeScript (`criarSimulacao` em `api.ts`) com ~36 listas no
  formato das telas, apagando de verdade e sem data de alteração em tudo. Toda função existe duas vezes,
  e o backup de um lado não abre no outro.

## Caminhos considerados

- **A · Tradutor:** converter as 36 listas do navegador para as 9 tabelas e de volta. Rápido de começar,
  mas mantém a duplicação e é frágil (um campo esquecido estraga dados ao sincronizar).
- **B · Motor único:** compilar o mesmo código Rust do banco (`src-tauri/src/banco`) para WebAssembly e
  usá-lo no navegador. Uma implementação só, mesmo formato, mesmo backup; prepara também o mobile oficial.

## Prova (02/11/2026)

Em `crates/motor-web/`, que inclui os arquivos **reais** de `src-tauri/src/banco` e `erro.rs` por `#[path]`:

- Todo o código do banco compilou para `wasm32-unknown-unknown` sem mudança, com `rusqlite 0.41`
  (que usa `sqlite-wasm-rs` sozinho no navegador).
- Única correção no código real: `agora_ms` passou a usar `chrono` (o relógio de `std::time` não existe
  no navegador). `migrar` virou `pub(crate)`. Os 132 testes do Windows continuam passando.
- No Chromium: banco aberto com as **mesmas 3 migrações**, 502 ideias criadas e listadas em ~0,1 s,
  acentos preservados, ids UUIDv7.
- **SQLCipher 4.19 roda no navegador** (`sqlite-wasm-rs` com a opção `sqlcipher`).
- **Guardar e reabrir:** o banco vira bytes (`serialize`, ~280 KB com 502 ideias) e reabre igual
  (`deserialize`).
- Tamanho do motor: 1,8 MB, **693 KB comprimido**.

## Decisão

Caminho **B**. O navegador passa a rodar o mesmo motor do Windows. A simulação em TypeScript fica só
para testes e para a prévia de desenvolvimento.

## Plano (etapa 1 da sincronização)

1. Tirar o banco do app Tauri para um pacote Rust próprio (`crates/nucleo`), usado pelo Windows e pelo
   navegador. Os comandos de `comandos.rs` que só leem e gravam no banco passam a ter uma ponte única,
   para que `api.ts` chame o mesmo nome nos dois lados.
2. Navegador: banco em memória; ao gravar, `serialize` → trancado com a chave do cofre web (AES-GCM, como
   hoje) → IndexedDB. O cofre web (senha, PIN, 6 palavras) continua igual.
3. Backup portátil: um formato só (o banco em bytes, trancado), que abre no Windows e no navegador.
4. Anexos (imagens e arquivos) continuam na tabela `anexo_conteudo`, no mesmo banco.

## Consequências

- Os dados de teste que já estão no navegador **não passam** para o motor novo (combinado com Dan:
  eram testes). Amigos só começam a testar depois desta etapa.
- Funções que dependem do sistema (IA, ditado, notificações, arquivos) continuam com versões próprias
  no navegador.
- O motor adiciona ~700 KB ao primeiro carregamento do site (depois fica guardado pelo service worker).
