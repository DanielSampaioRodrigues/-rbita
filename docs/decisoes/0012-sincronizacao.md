# 0012 · Sincronização entre aparelhos pelo Drive da pessoa

**Data:** 02/11/2026 · **Situação:** em construção (2a e 2b feitas; 2c espera a credencial do Google) ·
**Base:** `0011-motor-unico.md` (Windows e navegador rodam o mesmo banco).

## O que Dan pediu (especificação, "Entrar com Google e sincronizar")

Tudo o que se faz num aparelho aparece no outro, sozinho. Sem servidor do Órbita: pela pasta escondida
do app no Google Drive da própria pessoa (`drive.appdata`). Sem internet, guarda e manda depois. Mesmo
item editado em dois aparelhos: vale o mais recente. Os dados vão trancados com uma senha que só a pessoa
sabe (nem o Google lê). Um aviso discreto mostra o estado ("Sincronizado há 1 min").

## Desenho

**Um arquivo por aparelho.** Cada aparelho tem um id próprio e grava no Drive **só o seu** arquivo
(`aparelho-<id>.orbita-sync`): o retrato de todas as linhas sincronizáveis do banco, trancado. Ele lê os
arquivos dos outros e junta no próprio banco. Como ninguém escreve no arquivo de outro, não há briga por
arquivo; como a junção é "linha a linha, vale a mais recente", a ordem não importa e repetir não estraga
(todos convergem para o mesmo resultado).

**Linha a linha, vale a mais recente.** As 9 tabelas já têm `id`, `alterado_em` e `excluido_em`. Para cada
linha vinda de outro aparelho: se não existe aqui, entra; se existe, fica a de `alterado_em` maior (empate:
o maior id de aparelho, para todos decidirem igual). Apagar é só uma linha com `excluido_em`, então o
apagado continua apagado nos outros.

**Configurações.** A tabela `config` ganha `alterado_em` (migração nova). Só viajam as chaves que são da
pessoa, não do aparelho: `valor:*` (dados de módulo: rotinas, focos, energia, estante, mapas, estudos),
`limite_projetos_ativos`, `media_aprovacao`, `basicos_do_dia`, `plano_de_crise`. Viajam também as chaves
de IA (`ia` e `ia_chave:*`), a pedido de Dan: ficam trancadas como o resto. **Não viajam:** conta da nuvem
(`nuvem`), backup automático (`backup_auto_*`), chave de recuperação do aparelho (`palavras_recuperacao`), a
chave de sincronização e o id do aparelho.

**Anexos (imagens, livros, áudios).** O conteúdo não vai dentro do retrato: vai uma vez só, num arquivo
por conteúdo, nomeado pelo seu resumo (SHA-256) — `anexo-<sha256>.orbita-sync`. O retrato só diz qual
resumo cada anexo usa; quem não tem aquele conteúdo, baixa.

**Tranca.** Uma **chave de sincronização** aleatória tranca tudo (XChaCha20-Poly1305). Ela fica no Drive
dentro de um envelope aberto pela **senha de sincronização** da pessoa (Argon2id, o mesmo dos backups). No
aparelho, a chave fica dentro do banco criptografado. Aparelho novo: entra no Google, digita a senha,
abre o envelope e passa a sincronizar. **Recuperação** no modelo com Google (etapa 2d, conforme a
especificação): senha simples + PIN igual em todos os aparelhos + 6 perguntas pessoais; as 6 palavras deixam
de ser obrigatórias (continuam só para quem usa sem conta, e não viajam).

**Quem faz o quê.** O motor (Rust, igual nos dois lados) monta e junta os retratos e tranca/destranca. O
"maestro" (TypeScript, igual nos dois lados, porque a interface do Windows também é web) decide quando
sincronizar e fala com o Drive por um adaptador: no navegador, pela credencial web do Google; no
Windows, pela conta já ligada desde a 0.22.0. Nos testes, por uma pasta de mentira.

**Quando.** Ao abrir, a cada ~60 s com o app aberto, ao voltar para o app e logo depois de uma mudança
(com espera curta para juntar várias). Sem internet: marca que há coisa por enviar e tenta de novo.

## Como ficou na prática (etapa 2a, 02/11/2026)

Código em `apps/desktop/src-tauri/src/banco/sincronia.rs` (entra no navegador pelo mesmo `#[path]` do banco).
Comandos `sincronia_situacao`, `sincronia_criar_chave(senha)`, `sincronia_entrar(envelope, senha)`,
`sincronia_meu_pacote`, `sincronia_juntar(pacote)`, `sincronia_conteudo(sha)`,
`sincronia_guardar_conteudo(sha, conteudo)` e `sincronia_sair` (bytes em base64), iguais no Windows e no
navegador (ponte gerada) e em `api.ts` (`sincronia*`). A simulação não sincroniza.

**Migração 4.** `config.alterado_em` (padrão 0 nas linhas antigas; `gravar_config` marca a hora, e gravar o
mesmo valor não mexe). Tabela `config_excluida (chave, excluido_em)`: a **lápide** de uma configuração que viaja
e foi apagada (`apagar_config` grava; gravar de novo tira). Escolhi uma tabela à parte, e não um "valor
especial" na própria `config`, para nenhuma leitura de configuração precisar saber de lápides. Tabela
`anexo_resumo (anexo_id, sha256)`: o SHA-256 do conteúdo de cada anexo (calculado uma vez, porque o conteúdo
não muda) ou o que falta baixar. A migração também corrige linhas antigas apagadas sem marcar a alteração
(`alterado_em = excluido_em`), e os 5 lugares do código que faziam isso (etiquetas, ligações, anexos) passaram a
marcar. O id do aparelho (UUIDv7) e a chave de sincronização ficam na `config` (`sincronia_aparelho`,
`sincronia_chave`), que não viajam. Restaurar um backup dá um id novo ao aparelho (o backup pode ir para outro
aparelho, e dois com o mesmo id escreveriam no mesmo arquivo do Drive); a chave fica.

**Retrato (`versao: 1`).** JSON: `{versao, aparelho, criadoEm, tabelas: {nome: {colunas: [...], linhas:
[[...]]}}, config: [{chave, valor|null, alteradoEm}], conteudos: {anexo_id: sha256}}`. As 7 tabelas de dados
(`etiqueta`, `item`, `evento`, `registro`, `anexo`, `etiquetagem`, `ligacao`, nessa ordem, quem é apontado antes),
**com as excluídas**. Colunas pelo nome: coluna que não existe aqui é ignorada; coluna que não veio fica com o
valor daqui (linha existente) ou o padrão da tabela (linha nova), para um aparelho com versão antiga não
apagar o que um mais novo gravou. Retrato de versão mais nova: recusado com "atualize o Órbita". Configurações
de fora da lista que viajam são ignoradas mesmo se vierem no retrato.

**Regra da junção** (numa transação, linha a linha; nunca apaga linha de verdade). Vence a versão de maior
`max(alterado_em, excluido_em)`; empate: a excluída; empate de novo: o conteúdo da linha (texto JSON), e não o
id do aparelho, porque a linha daqui pode ter vindo de um terceiro aparelho: decidindo pelo conteúdo, todos
escolhem igual em qualquer ordem. **Apagar × editar:** editou antes do apagar, fica apagado; **editou depois
do apagar** (sem saber), vale o mais recente: o item volta com a edição (nada se perde, e prepara uma lixeira
futura). Os filhos apagados junto não voltam sozinhos. Anexo que ficou excluído perde o conteúdo também, como
no "Excluir anexo". Linha que não dá para usar (sem id ou data, ou apontando para o que não existe) é contada
em `ignoradas` e não derruba a junção.

**Resumo** devolvido: `{aparelho, entraram, mudaram, ignoradas, configuracoes, faltamConteudos}` (SHA-256 dos
conteúdos de anexo que faltam aqui). `sincronia_guardar_conteudo` confere o SHA-256 antes de gravar.

**Tranca.** Pacote = `ORBITASY` + versão (1) + formato (0 cru, 1 deflate) + nonce (24 bytes) + XChaCha20-Poly1305;
cabeçalho e rótulo (`orbita:sync:retrato` ou `orbita:sync:anexo:<sha>`) entram como dados associados, então
um anexo não passa por outro nem por retrato. O retrato vai **comprimido** (`miniz_oxide`, puro Rust); conteúdo
de anexo vai cru (imagem e PDF já são comprimidos). Descompressão limitada a 512 MB. Envelope da chave:
JSON `{versao: 1, kdf, sal, nonce, cifra}`, Argon2id com o custo do backup (64 MB, 3 passadas) e senha de
pelo menos 12 caracteres. Senha errada: `senha_errada`; pacote de outra chave: erro, e nada muda no banco.
`sincronia_criar_chave` num aparelho que já tem chave não troca a chave (só faz outro envelope dela).

**Medições** (banco médio de teste: 2.000 ideias, 100 projetos com 10 tarefas, 2.000 registros de energia =
5.100 linhas; Linux, compilação de teste, sem otimização): retrato em JSON **1.081 KB → 59 KB** comprimido e
trancado (o texto de teste é repetitivo; com dados reais, esperar 4–6× menor); montar 55 ms; comprimir e
trancar 79 ms; juntar num banco vazio 172 ms; juntar de novo (nada muda) 39 ms. No Chromium, criar a chave
(Argon2) levou ~0,2 s. Motor do navegador: 2,18 MB, **~800 KB comprimido** (+~55 KB).


## Como ficou na prática (etapa 2b, 02/11/2026)

**Maestro** (`apps/desktop/src/sincronia/maestro.ts`, TypeScript puro, igual no Windows e no navegador).
Um ciclo: (1) só segue se o motor diz que este aparelho tem a chave; (2) lista a pasta **numa chamada só**
e baixa só os `aparelho-*` cuja `versao` mudou desde a última vez, juntando cada um; (3) busca os
`anexo-<sha>` que faltam aqui (os que ainda não estão na pasta ficam para o próximo ciclo); (4) manda os
conteúdos de anexo daqui que faltam na pasta (antes do retrato, para quem ler o retrato já achar o anexo);
(5) manda o próprio retrato se algo mudou. Retrato de outro aparelho que não abre (estragado, outra chave)
não trava o resto: o ciclo segue, o aviso mostra o erro e aquele arquivo é tentado de novo no próximo ciclo.

**Como saber se algo mudou aqui: a "marca" do motor.** Comando novo `sincronia_marca` (`api.sincroniaMarca()`):
SHA-256 do retrato **sem a hora de montagem** (o retrato sai sempre na mesma ordem, então o mesmo banco dá a
mesma marca), mais a lista dos conteúdos de anexo que este aparelho tem e dos que faltam. Escolhi isso, e não
um "houve mudança" na interface, porque nem toda gravação passa pelo aviso de mudança das telas; a marca pega
qualquer mudança no que viaja e ignora o que não viaja. Custa montar o retrato (~55 ms no banco médio, sem
trancar), uma vez por ciclo. Depois de juntar algo de outro aparelho a marca muda e o retrato daqui é
reenviado uma vez; o outro lado junta, nada muda lá, e para (converge).

**O que o maestro lembra fica só na memória** (versão vista de cada arquivo, última marca enviada). Guardar no
cofre de valores faria esse controle **viajar** (as chaves `valor:*` viajam) e mudar a própria marca a cada
ciclo, num vaivém sem fim. Custo: ao abrir o app, o primeiro ciclo baixa todos os retratos uma vez e manda o
daqui uma vez.

**Quando** (`src/sincronia/agenda.ts`): ao abrir (cofre desbloqueado), a cada 60 s com o app visível, ao voltar
para o app (`visibilitychange`/`focus`, com folga de 5 s para os dois eventos não pedirem dois ciclos) e 3 s
depois de uma mudança feita aqui (`avisarMudanca`; várias seguidas viram um ciclo só). **Nunca dois ciclos ao
mesmo tempo:** pedido no meio de um ciclo vira "mais um logo depois" (mudança e "Sincronizar agora") ou é
ignorado (relógio, voltar). Bloquear desmonta o provedor e para tudo; desbloquear sincroniza de novo. Depois de
juntar algo que mudou, o maestro chama `avisarMudanca` (as telas recarregam); esse aviso não conta como mudança
daqui.

**Aviso discreto** (`src/sincronia/AvisoSincronia.tsx`), ao lado das setas de navegação, no alto da área de
conteúdo: fica visível com o menu recolhido, some no modo imersivo (caderno) e no modo de baixa energia. Só
aparece com a sincronização ligada (há pasta e chave). Textos literais (bloco `sincronia` em `textos/pt-BR.ts`):
"Sincronizado agora", "Sincronizado há 1 min" (h, dias), "Sincronizando…", "Sem internet: guardado neste
aparelho", "Precisa entrar de novo na conta", "Não deu para sincronizar: <motivo>". Princípio 2: sem animação;
"Sincronizando…" só aparece se o ciclo passa de 1,2 s (os de todo minuto são rápidos e o texto não pisca);
durante um ciclo rápido continua o estado de antes. Problema = borda e texto normais, nunca vermelho. Toque abre um
painel pequeno: estado, "Última vez: hoje às 14:32", uma frase do que acontece agora e "Sincronizar agora".
Acessível: botão com foco por teclado, painel com título (Esc fecha), e uma região `role="status"`
`aria-live="polite"` que só fala quando o **tipo** de estado muda (não a cada minuto, nem o primeiro
"sincronizado" ao abrir; só a volta depois de um problema).

**Ligar no app.** `ProvedorSincronia` (montado em `App.tsx` só com o cofre aberto) cria o maestro quando
`armazenamentoAtual()` devolve uma pasta. Hoje devolve `null` (o Drive é da 2c), ou a **pasta de mentira** no modo
de teste: `localStorage["orbita-sync-teste"] = "1"` ou `?sync-teste` no endereço (fica lembrado). A pasta de teste
é sempre no mesmo site (`/__pasta-teste/`), nunca outro endereço. Funções `ligarComoPrimeiro(senha)` (cria a chave e
grava `chave.orbita-sync`) e `entrarComSenha(senha)` (baixa o envelope e abre) ficam prontas para a tela da 2d; no
modo de teste, elas e a `api` ficam em `window.__orbitaSincronia` para o teste de ponta a ponta.

**Pasta de mentira** (`src/sincronia/pastaDeMentira.ts`): `PastaNaMemoria` (testes do maestro; finge sem internet e
acesso negado) e `PastaHttp`, que fala com `scripts/pasta-teste.cjs` (arquivos na memória do servidor; com "sem
internet" responde 503, com "negado" 401). Escolhi o servidor HTTP porque dois contextos do Playwright não dividem
IndexedDB nem nada: só um servidor deixa dois navegadores trocarem arquivos. O `pnpm dev` também serve a pasta.

**Testes.** `src/sincronia/maestro.test.ts` (vitest, com um motor de mentira): convergência criar/editar/apagar,
só baixa o que mudou e só envia quando muda, anexo uma vez só, anexo que chega depois, sem internet guarda e manda
depois, acesso negado, retrato estragado não trava, nunca dois ciclos, parar, textos do aviso e a agenda (relógio
falso). `src/banco/sincronia.rs`: a marca só muda quando algo que viaja muda. **Ponta a ponta**
(`scripts/teste-sync.cjs`, com o build web): dois navegadores; liga no A com senha e entra no B; ideia criada na
tela do A vai sozinha em ~3 s e aparece na tela do B; editada no B muda no A ao voltar para o app; apagada no A
some no B; imagem anexada chega igual e trancada na pasta; bloqueado busca ao abrir; sem internet e acesso negado
mostram o aviso certo e recuperam; painel abre pelo teclado. Tudo certo, 0 erros de console.


- **2a** motor da sincronização (Rust) e testes de convergência entre dois bancos.
- **2b** maestro, adaptador de mentira, aviso "Sincronizado há…", e teste com dois navegadores. **Feita.**
- **2c** login com Google no navegador + adaptador do Drive (precisa da credencial "Aplicativo da Web").
- **2d** telas de aparelho novo: senha de sincronização, PIN igual em todos os aparelhos, 6 perguntas.

## Limites conhecidos

- `ligarComoPrimeiro` sobrescreve `chave.orbita-sync`: a tela da 2d precisa conferir antes se já existe um
  envelope na pasta (aí é "entrar", não "criar"), senão um segundo aparelho trocaria a chave dos outros.
- Se o envelope sumir da pasta, os aparelhos que já têm a chave continuam sincronizando, mas um aparelho novo não
  entra até alguém gravar o envelope de novo (precisa da senha; fica para a 2d).

- Edição do **mesmo item** em dois aparelhos sem internet: o texto de um dos lados some (vale o mais
  recente, linha inteira, não campo a campo). Avaliar depois guardar os dois.
- A IA viaja, mas no navegador ainda não funciona: a configuração chega e fica guardada lá sem uso. Um
  provedor local (endereço `localhost`) viaja também e só funciona no aparelho onde ele roda.
- O retrato é o banco inteiro (sem os anexos): cresce com o uso. Medir; se pesar, passar para pacotes
  só com o que mudou.
- Relógio errado num aparelho pode fazer uma edição antiga "ganhar". Mitigação: guardar também a ordem
  local da edição e avisar quando o relógio parecer muito fora.
