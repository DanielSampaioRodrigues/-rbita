# 0012 · Sincronização entre aparelhos pelo Drive da pessoa

**Data:** 02/11/2026 · **Situação:** em construção (2a, 2b e 2d feitas; 2c pronta no código, espera a credencial do Google para o navegador) ·
**Base:** `0011-motor-unico.md` (Windows e navegador rodam o mesmo banco).

## O que Dan pediu (especificação, "Entrar com Google e sincronizar")

Tudo o que se faz num aparelho aparece no outro, sozinho. Sem servidor do Órbita: pela pasta escondida
do app no Google Drive da própria pessoa (`drive.appdata`). Sem internet, guarda e manda depois. Mesmo
item editado em dois aparelhos: vale o mais recente. Os dados vão trancados para o Drive; desde 03/11/2026
a senha que só a pessoa sabe é **opcional** ("proteção extra", ver "Dois modos da tranca"). Um aviso discreto
mostra o estado ("Sincronizado há 1 min").

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

**Tranca.** Uma **chave de sincronização** aleatória tranca tudo (XChaCha20-Poly1305). No Drive, ela fica
de um de dois jeitos (ver "Dois modos da tranca", decisão de Dan de 03/11/2026): **aberta** (modo "conta",
o padrão: entrar na conta Google basta) ou dentro de um envelope aberto pela **senha de sincronização** da
pessoa (modo "senha", a "proteção extra"; Argon2id, o mesmo dos backups). No aparelho, a chave fica dentro
do banco criptografado. Aparelho novo: entra no Google e, só no modo senha, digita a senha. **Recuperação** no modelo com Google (etapa 2d, conforme a
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


## Como ficou na prática (etapa 2d, 02/11/2026)

**Onde os aparelhos trocam arquivos** (`armazenamentoAtual()` em `ProvedorSincronia.tsx`): modo de teste → pasta de
mentira; navegador → `criarDriveRest({ pegarToken: loginGoogle().pegarToken })` quando o login do Google existe nesta
versão (`googleDisponivel()`); Windows → `criarDriveRest({ pegarToken: tokenDoWindows() })` quando o Google está
cadastrado (`nuvemDisponivel().google`). O Drive entra **mesmo sem login feito**: sem acesso, ele responde "precisa
entrar de novo", e o aviso do alto mostra isso com o botão **"Entrar com Google"**, que chama `entrar()` direto do toque
(o Safari do iPad exige). No Windows, entrar é o `nuvemConectar("google")` de sempre (a mesma conta de Backup e nuvem).

**Arquivos novos na pasta.** `recuperacao.orbita-sync`: as 6 perguntas **em texto** (precisam aparecer antes de abrir)
e um segundo envelope da chave de sincronização, aberto por Argon2id(PIN + as 6 respostas normalizadas) com custo
**maior que o da senha** (128 MB, 4 passadas; PIN e respostas pessoais têm menos acaso que uma senha comprida). As
respostas nunca são guardadas. As perguntas entram nos dados associados do envelope: trocar uma pergunta no arquivo faz
ele não abrir mais. Normalização (igual no Rust e no TS): minúsculas, sem acento (NFKD sem as marcas), espaços
colapsados. `pin.orbita-sync`: um resumo Argon2id do PIN, **trancado pela chave de sincronização** (só quem já tem a
chave lê). Serve para um aparelho novo conferir que o PIN é o mesmo dos outros; sem isso, a recuperação feita com o
PIN de lá não abriria com um PIN diferente daqui. Não deixei esse resumo aberto no Drive: com um PIN de 4 números,
qualquer um com acesso à pasta descobriria o PIN e ficaria só com as respostas para adivinhar.

**Comandos novos** (todos no molde `estado.com_sessao`, entram sozinhos na ponte do navegador):
`sincronia_criar_recuperacao(pin, perguntas, respostas)`, `sincronia_perguntas(recuperacao)`,
`sincronia_entrar_por_recuperacao(recuperacao, pin, respostas)`, `sincronia_marca_do_pin(pin)`,
`sincronia_conferir_pin(marca, pin)`, `sincronia_dados_locais()` e `sincronia_esvaziar()`. Erro novo
`respostas_erradas` ("O PIN ou alguma das respostas não confere.").

**Proteção contra trocar a chave dos outros.** `ligarComoPrimeiro` agora confere antes se `chave.orbita-sync` existe; se
existe, lança `JaExisteChave` e não mexe em nada. A tela, nesse caso (outro aparelho ligou enquanto a pessoa preenchia),
explica e vai para "Digite a senha de sincronização". Limite: dois aparelhos gravando a chave no mesmo segundo ainda
podem colidir (o Drive não tem "criar só se não existe"); é raro e fica anotado.

**Telas** (`TelasSincronia.tsx`, `AjustesSincronia.tsx`; textos no bloco `sincronia`):
- **Ajustes > Sincronizar aparelhos** (assunto novo): ligada/desligada, conta, última sincronização, se as perguntas
  foram feitas; "Ligar a sincronização", "Sincronizar agora", "Fazer/Refazer as perguntas", "Criar senha nova" (novo
  envelope da **mesma** chave: os aparelhos que já sincronizam não mudam; é o "um aparelho aberto cria uma senha nova"
  da especificação) e "Desligar neste aparelho" (confirma dizendo que os dados continuam aqui e no Drive). No navegador
  sem a credencial, o cartão explica que ainda não está disponível, sem botão.
- **Assistente** (janela, um passo por vez, "Passo X de Y", foco no primeiro campo ou no título). Primeiro aparelho:
  conta → senha de sincronização (12+ caracteres, com o para quê em três linhas) → PIN (quem já abre com PIN confirma o
  PIN; quem abre com Windows Hello ou direto escolhe um PIN, e **este aparelho continua abrindo como antes**) → 6
  perguntas (pode pular, com aviso calmo do risco) → progresso em lista (trancar a chave, guardar PIN e perguntas,
  primeira sincronização). Aparelho novo: conta → senha (ou "Esqueci a senha" → PIN + 6 respostas → oferece criar uma
  senha nova) → PIN deste aparelho (o mesmo dos outros, conferido pelo `pin.orbita-sync`; vira o PIN de abrir pelo
  "mudar modo" de sempre, confirmando que é a pessoa do jeito que ela já abre; a criptografia do cofre não muda) →
  juntar ("Juntar tudo", padrão, ou "Usar só os do Drive": salva antes um backup deste aparelho, esvazia o que viaja e
  entra) → progresso. Enquanto o assistente está aberto, o maestro fica **pausado**, para nada sincronizar antes da
  escolha de juntar; cancelar no meio desfaz a entrada (`sincronia_sair`).
- **Primeira tela** (`CriarCofre.tsx`): com o login do Google disponível (só navegador; e o modo de teste), "Entrar com
  Google" vem em destaque e "Usar sem conta" continua, menor. Pelo Google: entra → escolhe o PIN → o cofre é criado em
  modo PIN (as 6 palavras deixam de aparecer; continuam em Ajustes > Segurança) → o app abre já no assistente, que confere
  a pasta e segue para "ligar" ou "entrar". **Enquanto `googleDisponivel()` for falso, a primeira tela fica como antes.**
  **No Windows, sem Google na primeira tela:** lá o login guarda a renovação do acesso dentro do banco criptografado,
  que só existe depois de criar o cofre; a conta liga depois, em Ajustes (onde já ficava desde a 0.22.0).

**Testes.** Rust (`banco/sincronia.rs`): recuperação abre com respostas certas em acento/maiúscula/espaços diferentes e
não abre com uma errada nem com o PIN errado; pergunta trocada no arquivo não abre; respostas não aparecem no arquivo;
resumo do PIN só confere o mesmo PIN e só com a chave; esvaziar só antes de ter a chave e só o que viaja. Vitest
(`fluxo.test.ts`): recusa de "ligar como primeiro" com chave na pasta (não cria chave, não troca o envelope), trocar a
senha mantém a chave, recuperação, PIN, normalização e o maestro pausado. Ponta a ponta (`scripts/teste-sync.cjs`, três
navegadores, o C do tamanho de um iPad em pé): A liga pelas telas (conta, senha, PIN, 6 perguntas); B começa como
"primeiro" ao mesmo tempo, descobre a chave do A ao gravar e vai para entrar (a chave na pasta continua a do A), recusa
PIN diferente, junta os dados; C entra pela primeira tela com Google e por "Esqueci a senha" (uma resposta errada não
abre; acento e maiúscula diferentes abrem); "Precisa entrar de novo" recupera pelo botão; "Desligar neste aparelho"
mantém os dados.

**Limites anotados.** Mudar o PIN depois (Ajustes > Segurança) não atualiza o PIN dos outros aparelhos nem a
recuperação: é preciso refazer as perguntas com o PIN novo (a tela de perguntas confere o PIN pelo resumo da pasta).
No navegador, o acesso do Google fica só na memória (2c): reabrir a aba mostra "Precisa entrar de novo" até um toque.

## Dois modos da tranca: a senha vira opcional (decisão de Dan, 03/11/2026, "opção 2")

**O que mudou.** A senha de sincronização deixou de ser obrigatória. **Padrão: "só o Google"** (modo
**conta**): entrar na conta Google basta para sincronizar. **Opcional: "Proteção extra: trancar também com uma
senha minha"** (modo **senha**): o comportamento de antes (senha + recuperação por PIN + 6 perguntas).

**A troca, sem rodeio.** Nos dois modos os dados vão trancados para o Drive e o Google, como empresa, não tem
motivo para abrir. Mas no modo conta a chave fica **no mesmo Drive**: quem entrar na conta Google da pessoa (ou
quem tiver acesso à pasta do app) consegue abrir os dados. No modo senha, nem quem entra na conta lê sem a
senha; em troca, é uma senha a mais para lembrar. Dan escolheu o padrão sem senha, com a proteção à mão de quem
quiser (a tela explica a troca nas duas linhas da caixinha).

**Arquivo `chave.orbita-sync`, dois formatos:**
- **Modo conta:** JSON versionado e explícito, `{"formato":"orbita-chave","versao":2,"modo":"conta","chave":"<base64>"}`
  (em base64, como os outros arquivos da pasta).
- **Modo senha:** o envelope de sempre (`{versao: 1, kdf, sal, nonce, cifra}`), gravado **no formato antigo**
  para versões anteriores do Órbita continuarem lendo. Arquivo sem `formato` com `versao: 1` = modo senha.
- `formato` diferente, `modo` desconhecido ou arquivo estragado: "danificado"; `versao` maior: "atualize o Órbita".
  Um Órbita antigo (até a 0.47) que ache o arquivo do modo conta não entra (diz que está danificado): é preciso
  atualizar. Aceitável, porque Dan publica as duas versões juntas.

**Comandos novos** (molde `estado.com_sessao`, entram sozinhos na ponte do navegador):
`sincronia_criar_chave_conta()` (primeiro aparelho, modo conta: cria a chave ou usa a que já existe aqui e devolve
o arquivo aberto), `sincronia_entrar_por_conta(arquivo)` (recusa o modo senha), `sincronia_ligar_protecao(senha)`
(envelope com senha **da chave que este aparelho já tem**), `sincronia_desligar_protecao()` (arquivo aberto da mesma
chave) e `sincronia_modo_da_chave(arquivo)` → `"conta" | "senha"`. `sincronia_entrar(arquivo, senha)` aceita os
dois modos (no modo conta a senha é ignorada).

**Ligar e desligar não trocam a chave.** Só muda o jeito de guardá-la no Drive. Os aparelhos que já sincronizam
continuam iguais e os retratos e anexos antigos continuam abrindo. **Limite anotado:** por isso mesmo, ligar a
proteção depois de um tempo no modo conta não "apaga o passado": quem entrou na conta enquanto a chave estava
aberta (ou ver versões antigas do arquivo que o Drive guarde) pode ter copiado a chave, e ela continua valendo.
Trocar a chave de verdade (com todos os aparelhos entrando de novo) fica para depois, se Dan quiser; hoje não há
botão para isso. A recuperação (`recuperacao.orbita-sync`) não é apagada ao desligar a proteção: continua sendo um
envelope da mesma chave e volta a valer se a proteção for ligada de novo com as mesmas perguntas.

**Telas.**
- **Primeiro aparelho:** conta → "Como trancar seus dados" (caixinha **desligada** por padrão, com a troca em duas
  linhas) → com a proteção: senha → PIN → 6 perguntas (como antes); sem ela: PIN e pronto (o botão do PIN vira
  "Ligar a sincronização"). O "Passo X de N" se ajusta (sem proteção, 3 passos; com, 5; um a menos quando o PIN
  já veio da primeira tela). O texto de "pronto" não fala de senha no modo conta.
- **Aparelho novo** (e a primeira tela com Google): ao achar a chave, `entrarPelaConta` olha o modo. Modo conta:
  entra direto e vai para o PIN e juntar (cancelar desfaz, como antes). Modo senha: "Digite a senha de
  sincronização", com "Esqueci a senha".
- **Proteção que impede trocar a chave dos outros:** continua. `ligarComoPrimeiro(arm, api, senha | null)` recusa
  com `JaExisteChave` se a pasta já tem chave, de qualquer modo; a tela então entra na chave que já existe (modo conta:
  direto, com o recado "este aparelho entra na mesma sincronização"; modo senha: pede a senha de lá).
- **Ajustes > Sincronizar aparelhos:** linha "Proteção extra: Ligada/Desligada". Desligada: botão "Ligar a proteção
  extra" (senha nova; em seguida oferece as 6 perguntas, com "Fazer depois"). Ligada: "Fazer/Refazer as perguntas",
  "Criar senha nova" e "Desligar a proteção extra" (confirmação literal). As perguntas só aparecem com a proteção.

**Testes.** Rust: ida e volta do modo conta, entrar por conta, ligar/desligar mantém a mesma chave (pacote antigo
abre e o arquivo aberto volta idêntico), formato antigo lido como modo senha, arquivos estranhos recusados. Vitest
(`fluxo.test.ts`): os dois modos, recusa de "ligar como primeiro" sem senha, ligar/desligar com "Esqueci a senha"
no meio. Ponta a ponta (`scripts/teste-sync.cjs`, quatro navegadores): A liga sem senha; B entra sem senha e junta;
A liga a proteção (senha + perguntas) e B segue sincronizando; C precisa da senha e entra por "Esqueci a senha";
A desliga a proteção (a pasta volta ao arquivo aberto, igual ao do começo); D entra só com a conta.

- **2a** motor da sincronização (Rust) e testes de convergência entre dois bancos.
- **2b** maestro, adaptador de mentira, aviso "Sincronizado há…", e teste com dois navegadores. **Feita.**
- **2c** login com Google no navegador + adaptador do Drive (precisa da credencial "Aplicativo da Web").
- **2d** telas de aparelho novo: senha de sincronização, PIN igual em todos os aparelhos, 6 perguntas. **Feita.**

## Limites conhecidos

- ~~`ligarComoPrimeiro` sobrescreve `chave.orbita-sync`~~ (resolvido na 2d: confere antes e recusa).
- Se o envelope sumir da pasta, os aparelhos que já têm a chave continuam sincronizando, e de qualquer um deles
  "Criar senha nova" grava o envelope de novo (2d).

- Edição do **mesmo item** em dois aparelhos sem internet: o texto de um dos lados some (vale o mais
  recente, linha inteira, não campo a campo). Avaliar depois guardar os dois.
- A IA viaja, mas no navegador ainda não funciona: a configuração chega e fica guardada lá sem uso. Um
  provedor local (endereço `localhost`) viaja também e só funciona no aparelho onde ele roda.
- O retrato é o banco inteiro (sem os anexos): cresce com o uso. Medir; se pesar, passar para pacotes
  só com o que mudou.
- Relógio errado num aparelho pode fazer uma edição antiga "ganhar". Mitigação: guardar também a ordem
  local da edição e avisar quando o relógio parecer muito fora.
