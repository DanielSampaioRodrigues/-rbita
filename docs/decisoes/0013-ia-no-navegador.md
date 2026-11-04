# 0013 · IA na versão de navegador

**Data:** 04/11/2026 · **Situação:** feita (testada no Chromium com provedor de mentira; falta Dan testar no iPad) ·
**Base:** `0007-ia-provedores.md` e `0011-motor-unico.md`.

## Problema

Na versão de navegador (iPad) nenhuma função de IA funcionava: a tela dizia "use no Windows". O pedido
ao provedor era feito pelo Rust do Windows (reqwest), que não roda no navegador. Os provedores e as
chaves já estavam no banco criptografado e já viajavam pela sincronização, então faltava só o envio.

Exigência: **uma fonte só** para os textos enviados à IA e para a conferência das respostas (o Rust).
Nada de repetir instruções ou validação em TypeScript.

## Caminhos considerados

- **A · reqwest dentro do motor (WebAssembly).** O reqwest tem versão para navegador (usa o `fetch` por
  baixo). Mas o motor é síncrono: o banco fica num `RefCell` e cada comando roda de uma vez. Para esperar a
  resposta seria preciso tornar a ponte assíncrona (`wasm-bindgen-futures`) e garantir que o banco não fica
  emprestado durante a espera (bloquear o Órbita no meio quebraria). Além disso, o reqwest no navegador
  esconde o motivo da falha (sem internet e bloqueio do provedor viram o mesmo erro genérico), não tem tempo
  limite próprio e aumenta o motor.
- **B · Separar "montar o pedido" de "ler a resposta" (escolhido).** O Rust monta o pedido inteiro
  (endereço, cabeçalhos com a chave, corpo) e confere a resposta; quem envia é cada plataforma.

## Decisão

Caminho **B**, nos dois lados, para o Windows e o navegador rodarem **o mesmo código**:

- `src-tauri/src/ia/protocolo.rs` (puro, sem rede): o formato de cada provedor. `pedido_completar`,
  `pedido_modelos`, `pedido_imagem` (inclui o formato próprio do Google para os modelos "gemini-...-image"),
  `pedido_baixar`, e as leituras (`ler_resposta`, que traduz a situação HTTP em português; `ler_completar`,
  `ler_modelos_*`, `ler_imagem`). Também `falha_de_rede`, as mensagens de quando o pedido nem chega.
- `src-tauri/src/ia/fluxo.rs` (puro, lê o banco): cada ordem (`planejar_com_ia`, `organizar_texto_ia`,
  `ajustar_organizacao_ia`, `revisar_texto_ia`, `gerar_tema_ia`, `desenhar_icones_ia`, `modelos_imagem_ia`,
  `gerar_imagem_ia`, `testar_provedor_ia`) vira passos: `avancar(banco, ordem, argumentos, resposta)`
  devolve **"pedir"** (um pedido e uma etapa) ou **"pronto"** (o resultado já validado). Sem estado entre os
  passos: cada passo relê o banco a partir dos mesmos argumentos. A imagem do Gemini que recusa a resolução
  alta pede de novo sem ela (etapa 1); a imagem que vem só como link é baixada (etapa 2).
- **Windows:** `comandos.rs` roda o laço (`rodar_ia`) e `ia/cliente.rs` só envia, com reqwest. O banco não
  fica preso durante a espera.
- **Navegador:** o motor inclui o módulo `ia` por `#[path]` (sem `cliente.rs`, que fica só no Windows) e
  exporta `ia_avancar`, `ia_falha_de_rede` e `ia_comandos`. `apps/desktop/src/web/iaWeb.ts` roda o mesmo laço
  com `fetch` (sem cookies, sem endereço de origem, tempo limite de 180 s como no Windows). Em `modoWeb.ts`,
  o `chamar` manda as ordens de IA para esse laço; as telas não mudam.
- **Cadastro de provedores** (`estado_ia`, `salvar_provedor_ia`, `remover_provedor_ia`, `definir_funcao_ia`,
  `bloquear_sensivel_ia`) só mexe no banco: entrou sozinho na ponte gerada do motor (o `build.rs` deixou de
  barrar `ia::` e passou a barrar só o envio pela rede, `cliente::`, e a memória do computador).
- **Dado sensível:** a regra continua no mesmo lugar (`provedor_da_funcao`), então o aviso e o bloqueio são
  iguais nos dois lados: com o bloqueio ligado, o pedido nem é montado.

## Provedores no navegador (pré-voo CORS conferido a partir do endereço publicado)

- **Claude:** aceita, com o cabeçalho `anthropic-dangerous-direct-browser-access: true`. O pedido do Claude
  sempre leva esse cabeçalho (fora do navegador ele não muda nada), para Windows e navegador mandarem o mesmo.
- **GPT, Gemini (endereço compatível e o próprio do Google), Grok:** aceitam.
- **Sabiá (Maritaca):** recusa. Ao falhar, a mensagem diz: "Este provedor não aceita ser chamado pelo
  navegador. Na versão de navegador, use outro provedor (Claude, GPT, Gemini ou Grok), ou use este no app do
  Windows." A janela de cadastro avisa antes, quando a pessoa escolhe o Sabiá no navegador.
- **Ollama:** só num computador, com o Órbita aberto no navegador do mesmo computador, e com a variável
  `OLLAMA_ORIGINS` liberando o endereço do Órbita. No iPad não roda. A janela explica; a dica de memória do
  computador some no navegador (o navegador não sabe dizer).
- Falha de rede de outro provedor: sem internet (o navegador sabe dizer) → "Este aparelho está sem
  internet..."; com internet → explica que pode ser a internet ou um provedor que não aceita o navegador.

## Chave

A chave sai do banco só dentro do pedido montado pelo motor, que vai direto para o `fetch`. Não passa pela
tela, pelo console nem pelo armazenamento do navegador. O `Debug` do pedido em Rust esconde os cabeçalhos.
No navegador, como em qualquer app que chama a API direto, a chave fica na memória da página enquanto o
pedido acontece; quem já abriu o Órbita (PIN, senha) já tem acesso a ela de qualquer jeito.

## Consequências

- Mudar uma instrução, um limite ou a leitura de uma resposta muda os dois lados na próxima compilação.
- Motor do navegador: 2,49 MB, ~894 KB comprimido com gzip (inclui também a sincronização, que entrou depois
  da medida da decisão 0011).
- Testes: `cargo test --lib ia` (protocolo e fluxo sem rede, e o envio do Windows com um servidor de
  mentira), `src/web/iaWeb.test.ts` e `scripts/teste-web-ia.cjs` (Playwright, com o provedor imitado:
  cadastrar o Claude, Sabiá bloqueado, Planejar com a IA até criar as etapas, Separar com IA).
