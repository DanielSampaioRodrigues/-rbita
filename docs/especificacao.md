# Órbita — Especificação

24/10/2026 · Daniel Sampaio Rodrigues

## Visão e propósito

O Órbita é um organizador de vida completo para pessoas neurodivergentes (autistas, com TDAH, dislexia, altas habilidades e outras formas de neurodivergência), gratuito, em português, com os dados no próprio aparelho e interface totalmente personalizável.

**Problema que resolve.** Pessoas neurodivergentes costumam ter muitas ideias e abrir muitas frentes ao mesmo tempo. Sem um jeito de priorizar, pausar e retomar, isso vira frustração. Ao mesmo tempo, precisam de previsibilidade e de uma vida organizada.

**Posicionamento.** Já existem apps para neurodivergentes, como o Tiimo e o Structured. O espaço vazio é outro: eles são em inglês, cobram assinatura, guardam dados na nuvem deles, focam mais em TDAH e personalizam pouco a interface. Este programa ocupa justamente esse espaço:

- em português;
- gratuito, distribuído por doação;
- local-first, com os dados no aparelho;
- pensado para a neurodivergência como um todo, não só para TDAH;
- com personalização total, do temático ao neutro.

**Primeiro usuário.** O próprio Dan, organizando suas frentes no Windows. Mac e mobile vêm depois dos testes.

**Objetivo secundário.** Fortalecer o engajamento e a presença profissional de Dan junto à comunidade neurodivergente.

## Princípios de design

Cada tela e cada função passam por estes sete princípios. Quando uma ideia nova entrar em conflito com eles, vencem os princípios.

1. **Previsibilidade.** Nada muda sem aviso. As atualizações mostram o que mudou e podem ser adiadas. As transições de atividade são avisadas com antecedência. A semana-modelo é fixa e visível.
2. **Baixo estímulo por padrão.** Sem som, sem animação forte e sem notificações insistentes, a menos que a pessoa ligue. O botão de baixo estímulo leva tudo ao neutro com um clique.
3. **Sem culpa.** Pausar é uma ação válida, não um fracasso. Não há sequências de dias que zeram, nem tarefas atrasadas em vermelho gritante, nem mensagens de cobrança.
4. **Sem gamificação punitiva.** Recompensas, se houver, são opcionais e nunca tiram nada da pessoa.
5. **Captura sem atrito.** Registrar uma ideia, um gasto ou um sintoma leva poucos segundos, por texto ou voz, de qualquer tela.
6. **Retomar é tão importante quanto começar.** Todo projeto, leitura ou tarefa longa guarda onde parou e qual é o próximo passo.
7. **Acessibilidade sensorial e cognitiva.** Fontes para dislexia, densidade ajustável, contraste garantido por padrão (a pessoa pode liberar a trava para si, com saída rápida), atalhos de teclado para tudo e linguagem simples e literal, sem ironia nem metáforas ambíguas.

**Textos da interface são literais.** Nomes como "estacionamento de ideias" e "hibernação" valem neste documento; na tela, os botões e títulos usam termos literais, como "Guardar para depois" e "Pausar projeto". Tudo que pode ser arrastado também pode ser movido pelo teclado.

## Módulos

São dez módulos sobre uma base comum: o mesmo item pode aparecer em lista, kanban, mapa mental, linha do tempo ou calendário, e os módulos se conectam entre si (um remédio do módulo de saúde aparece na agenda; uma leitura acadêmica vira projeto).

### 1. Ideias e projetos (o coração)

- **Captura rápida** de ideias por texto ou voz, com transcrição local.
- **Estacionamento de ideias**: a ideia fica guardada sem virar compromisso até a pessoa decidir.
- **Limite de projetos ativos**, definido pela pessoa (1 a 50, padrão 6; muda em Ajustes ou dentro de Projetos). Ao passar do limite, o programa pede para hibernar outro.
- **Hibernação sem culpa** com **cartão "onde parei"**: em que ponto estava, próximo passo, arquivos e links.
- Etapas, subtarefas e quebra de tarefas grandes em passos pequenos (com ajuda de IA opcional).
- Visualizações: lista, kanban, mapa mental, linha do tempo e calendário.

**Como ficou na Onda 1 (etapas 5 a 7).**
- **Capturar**: botão no topo da barra lateral e atalho **Ctrl + Alt + Espaço**, que funciona de qualquer programa, mesmo com o Órbita minimizado. Se o Órbita estiver bloqueado, a captura abre logo depois de desbloquear. Tudo capturado vai para **Ideias** (o "estacionamento").
- **Ideias**: guardar, editar, excluir e **virar projeto** (o texto vira o título; a ideia fica ligada ao projeto). Desde novembro/2026 (relato de Dan: a anotação se perdia), **a nota, as etiquetas e os anexos vão junto**: a nota vira as **Anotações** do projeto, as etiquetas são copiadas e os anexos passam a aparecer também no projeto (é o mesmo anexo, com mais uma ligação; o arquivo não é duplicado). Tudo num passo só, no banco. Se a ficha da ideia estiver aberta com texto ou nota ainda não salvos, "Virar projeto" grava antes de converter. A ficha avisa: "Ao virar projeto, a nota, as etiquetas e os anexos vão junto."
- **Sobre o projeto** (no código, `anotacoes`): seção "Sobre o projeto" logo abaixo do título, antes do "Onde parei" (pedido de Dan: faltava um lugar para escrever sobre o projeto em si; primeiro o que ele é, depois o momento atual), com o mesmo editor de texto da nota da ideia (Markdown), que **grava sozinho** ao parar de escrever e mostra discretamente "Guardando…" / "Tudo guardado.". Fica em `dados.anotacoes` do projeto, até 20 000 caracteres, sem mudar o esquema do banco. Projeto que veio de uma ideia mostra a linha "Veio da ideia guardada em [data]". **Projetos convertidos antes desta mudança**: enquanto `anotacoes` nunca foi gravado, a leitura mostra a nota da ideia de origem (pela ligação "virou"), **sem gravar na leitura** (gravar mudaria o `alterado_em` e poderia gerar conflito na sincronização, que mescla linha a linha); passa a gravar no projeto quando a pessoa edita. Apagar tudo fica gravado como vazio, e a nota antiga não volta. As anotações entram na exportação.
- **Projetos**: estados **ativo, pausado e concluído**. Limite de ativos definido pela pessoa (padrão 3, de 1 a 20). Ao esbarrar no limite, o Órbita mostra os ativos para pausar um, oferece mudar o limite ou, para projeto novo, criar já pausado. Nunca passa por cima do limite sem a pessoa decidir.
- **Estado "Em uso"** (decisão de novembro/2026): projeto pronto e funcionando, mas que pede um cuidado de vez em quando (ex.: o MAPS da editora). **Não conta no limite de projetos ativos.** Fica num grupo próprio em Projetos ("Em uso", entre Ativos e Pausados), e o alto da página mostra um resumo literal: "Tocando: 3 de 6 · Em uso: 2". Na página do projeto há "Mover para Em uso" e, de volta, "Mover para Ativo" (que respeita o limite pelo fluxo de sempre). Texto de ajuda: "Pronto e funcionando, mas sob seu cuidado. Não conta no limite de projetos ativos. Se for mexer pra valer, mova para Ativo." Na linha do tempo, a faixa fica num tom suave do destaque.
- **Lembrete "rever a cada N meses"** (só para projetos em uso, **desligado por padrão**; 1, 2, 3, 6 ou 12 meses): fica no JSON `dados` do projeto (`revisarMeses` e `revisadoEm`), sem mudar o esquema do banco, e viaja na sincronização junto com a linha do projeto. A contagem começa quando o projeto entra em "Em uso" (ou quando o lembrete é ligado). Quando a data passa, o cartão do projeto mostra, em tom suave (nada de vermelho, nada de notificação), "Hora de dar uma olhada"; o botão **"Olhei"** na página do projeto recomeça a contagem.
- **Pastas de projetos** (pedido de Dan, novembro/2026; ex.: "Produtos da editora"): pastas criadas pela pessoa, que funcionam como **atalhos**. Um projeto pode estar em várias pastas; tirar de uma pasta ou apagar a pasta **não apaga o projeto** nem o tira das outras, e todos os projetos continuam sempre em **"Todos"**, com os grupos por estado de sempre (Ativos, Em uso, Pausados, Concluídos). No alto de Projetos fica uma fileira de pastas, de tamanho moderado, com o **mesmo desenho 3D das pastas do Caderno** (componente compartilhado `componentes/Pasta3D.tsx`, mesma paleta de dez cores, chapado no baixo estímulo) e o número de projetos dentro: "Todos" primeiro (escolhido por padrão), depois as pastas na ordem da pessoa e "+ Nova pasta". Tocar numa pasta mostra só os projetos dela, ainda agrupados por estado (e também na linha do tempo), com o cabeçalho "Pasta: Nome" e os botões "Voltar para Todos", "Renomear ou mudar a cor", mover para a esquerda/direita (reordenar pelo teclado ou toque) e "Apagar pasta" (pergunta: "Apagar a pasta "Nome"? Os projetos continuam em Todos."). O resumo "Tocando: X de N · Em uso: Y" é sempre de todos os projetos. A pasta escolhida fica lembrada **no aparelho** (`localStorage`, chave `orbita.pasta-projetos`); se ela for apagada (aqui ou em outro aparelho), a tela volta para Todos. **Pôr e tirar**: no cartão do projeto, o botão de pasta ao lado abre o menu "Pôr em pasta" (caixinhas, vale na hora, e "Nova pasta com este projeto"); dentro do projeto, a linha discreta "Pastas: …" com o botão **"Pastas"** abre a janela de caixinhas, com "Nova pasta" ali mesmo (a cor vem da primeira cor da paleta ainda não usada; dá para mudar depois). **Dados**, no modelo comum e sem mudar o esquema: a pasta é um `item` do tipo `pasta_projeto` (nome em `titulo`, posição em `ordem`, cor em `dados.cor`); a pertença é uma `ligacao` do tipo `na_pasta` (projeto → pasta) com **id fixo por par** (`na_pasta:<projeto>:<pasta>`), para que dois aparelhos que põem o mesmo projeto na mesma pasta não criem duas linhas e "pôr" num e "tirar" no outro se resolvam pelo mais recente. Apagar a pasta marca como excluídas a pasta e as pertenças dela na mesma hora, e isso viaja na sincronização (as duas tabelas já entram nela). Pôr em pasta não muda a data de alteração do projeto (que ordena a lista). Como a pasta é uma linha só, renomear num aparelho e reordenar no outro ao mesmo tempo fica com a mudança mais recente, como qualquer item. As pastas entram na exportação (no JSON, `pastasDeProjetos` e o campo `pastas` de cada projeto; no resumo em Markdown, "pastas: …" na linha do projeto).
- **Cartão "onde parei"** em todo projeto, editável a qualquer hora: em que ponto estava, próximo passo e links. Ao pausar, o Órbita oferece anotar (tudo opcional).
- **Início** abre com "Continuar de onde parei": os projetos ativos com o próximo passo de cada um.
- **Tarefas** em dois níveis (etapas e subtarefas), estados a fazer, fazendo e feita, ordem manual. Visualização em **lista** (caixas de seleção) ou **quadro** (colunas A fazer, Fazendo e Feito), com arrastar por mouse, caneta ou teclado, e um menu em cada tarefa com as mesmas ações.

**Como ficou na Onda 1 (etapa 13).**
- **Datas e prazos**: todo projeto pode ter começo e prazo, e toda tarefa pode ter prazo, sempre opcionais. Os prazos aparecem na **agenda** (dia, semana e mês) com uma bandeirinha, e um clique abre o projeto. O prazo aparece como data, nunca como contagem regressiva nem em vermelho.
- **Linha do tempo** em Projetos (botão Lista / Linha do tempo): uma faixa por projeto, do começo ao prazo, com a marca de hoje. Projetos pausados ficam em cinza. Projeto sem prazo tem a faixa tracejada no fim; sem datas, aparece a partir do dia em que foi criado. Os prazos de tarefas aparecem como losangos na faixa do projeto.
- **Mapa mental** das tarefas do projeto (terceira opção ao lado de Lista e Quadro): o projeto no centro, etapas e subtarefas em volta. Tudo pelo teclado: setas andam, Enter cria ao lado, Ctrl + Enter cria dentro, F2 renomeia, Espaço marca como feito e Delete exclui. São os mesmos itens da lista e do quadro, com o mesmo limite de dois níveis.

**Como ficou depois do primeiro teste de Dan (versão 0.17.0).**
- **Ideias** ganharam nota, etiquetas com cor (a cor aparece sempre junto do nome e fica neutra no baixo estímulo), ligações entre ideias, busca sem acento e filtro por etiqueta. Visualizações: **lista, mural, quadro** (uma coluna por etiqueta) e **mapa** (agrupado por etiqueta). Ideias não têm linha do tempo nem calendário de propósito: ideia não tem data.
- **Etiquetas valem na hora** (desde a 0.47.x): na ficha da ideia e na janela de etiquetas de projetos e tarefas, marcar, desmarcar e criar etiqueta grava no mesmo toque (fechar sem "Salvar" não perde); o "Salvar" fica para texto, nota e ligações. Criar etiqueta fica sempre à vista (nome, cor, botão), também no painel "Etiquetas das ideias". **Cor da ideia**: escolha própria (paleta das etiquetas ou "Sem cor"), gravada na hora em `dados.cor` do item; sem cor própria, vale a cor da primeira etiqueta. Lista e mural usam essa cor.
- **Tarefas de um projeto** têm as cinco visualizações da especificação: lista, quadro, mapa mental, **linha do tempo** e **calendário**. Tarefas sem prazo aparecem à parte, com um botão para dar prazo, sem cobrança.
- **Criar tema com IA** no editor de tema: a pessoa descreve, a IA propõe cores e um desenho em SVG, e tudo passa pela conferência de contraste e pela limpeza de SVG. Dá para pedir ajustes conversando. Com GPT, Gemini ou Grok, também imagem (PNG), se a conta tiver modelo de imagem; a tela explica o que cada IA consegue e por quê. Para a imagem, a pessoa escolhe o modelo de imagem da conta (separado do modelo que escreve as cores) e pode procurar modelos novos com um botão. Há também a resolução da imagem (Normal ou Alta; Alta guarda o fundo com até 2560 px, Normal com até 1920 px). As listas de modelos (de texto e de imagem) mostram só a geração mais nova de cada linha, pela regra do nome (sem cópias com data, sem prévias que já têm versão final, sem modelos de voz, busca ou código); "Ver todos" mostra a lista inteira, e o modelo em uso nunca some. No Ollama a lista fica inteira, porque é o que a pessoa instalou. No Gemini, os modelos "gemini-…-image" usam o formato próprio do Google (generateContent); os "imagen" e os do GPT e do Grok usam o formato compatível (/images/generations). O tema criado pela IA já passa a valer no app e entra na lista de temas na hora; mudanças à mão pedem "Salvar e usar". Há também o botão "Criar um tema novo", que começa do zero (cores neutras, sem fundo, ícones padrão).

**Texto livre e IA nas caixas (versão 0.18.0).**
- **Formatação completa nas caixas de texto longo** (nota da ideia, "onde parei", notas de compromisso): negrito, itálico, sublinhado, marca-texto, título, listas, lista de tarefas com caixinha, citação e link, com os atalhos de sempre (Ctrl + B, I, U, Z, Y). O texto fica guardado em **Markdown**, formato aberto. Links ficam guardados, mas o Órbita não abre sites sozinho. Campos de uma linha (títulos, nomes) continuam simples de propósito.
- **Reescrever com IA em toda caixa de texto** (menos senhas, números e endereços): botão ✨ ao lado do microfone, com revisar ortografia, deixar mais claro, mais curto, mais detalhado, transformar em tópicos, tom mais leve, tom mais formal e "do meu jeito" (a pessoa escreve o pedido). O resultado aparece sempre como antes e depois; nada muda sem a pessoa escolher. Usa a IA escolhida para "Revisar e reescrever textos".
- O aviso de dado sensível não dispara mais por "autismo" ou "TDAH": num app para pessoas neurodivergentes, são palavras do dia a dia. Diagnóstico, laudo, remédio e terapia continuam avisando.

**Pendências da Onda 1 fechadas (versão 0.19.0).**
- **Etiquetas e ligações em projetos e tarefas**, não só em ideias. Na página do projeto, um bloco "Etiquetas, ligações e anexos"; nas tarefas, pelo menu de cada uma. As etiquetas aparecem na lista e no quadro de tarefas. Ligações valem nos dois sentidos (ideia ↔ projeto, projeto ↔ projeto).
- **Anexos** em ideias, projetos e tarefas: imagens (com miniatura e visualização grande), arquivos (PDF e outros, até 20 MB cada) e links. Ficam **dentro do cofre criptografado** e entram no backup. Para abrir com outro programa, o Órbita grava uma cópia temporária, apagada na próxima vez que ele abrir; dá também para salvar uma cópia onde a pessoa quiser. Links só http e https.
- **Rotinas com imagem**: cada passo pode ter uma foto ou desenho próprio, que substitui o ícone e aparece grande no modo Começar.
- **Conversa com a IA na captura**: depois de "Separar com IA", a pessoa pede mudanças em linguagem livre e a IA refaz a lista, sempre para conferir de novo antes de guardar. Vão só os itens marcados; os pedidos ficam listados.
- **Quadro de ideias com arrastar**: soltar em outra coluna troca a etiqueta daquela coluna pela nova; "Sem etiqueta" tira todas. Nos dois quadros (ideias e tarefas), as setas do teclado pulam de coluna em coluna; Enter abre a ideia.
- **Ícones do tema** (ampliado na 0.23.0): além do traço e das pontas, o tema escolhe a **família** (linhas limpas, arredondada ou geométrica, de bibliotecas abertas: Lucide, Phosphor e Tabler), o **preenchimento** (na arredondada: só linha, cheio ou dois tons) e um **efeito** (rabiscado, carimbo ou brilho, que somem no baixo estímulo). A IA de temas escolhe tudo isso a partir de pedidos como "punk". **Desenhar ícones com IA (experimental):** a IA desenha os quase 100 ícones do zero, em lotes, usando os primeiros como modelo de estilo; aviso claro de que podem sair irregulares e gastam mais créditos; prévia antes de aplicar; cada desenho passa pela limpeza de SVG e a cor vira a do tema; o que não sair fica com o ícone pronto; botão para voltar aos ícones prontos.
- **Personalização** é uma função da IA como as outras (IA e modelo próprios), escolhida no painel "Criar com IA" do editor de tema e também em Ajustes.
- A criação de tema com IA também propõe e ajusta esse estilo ("ícones mais grossos"). Galeria da comunidade com conjuntos de ícones: Onda 4.
- **Acessibilidade**: auditoria automática (axe-core, regras WCAG 2.2 AA) em todas as telas, nos temas claro e escuro, sem problemas. O mapa mental virou uma árvore de verdade para leitores de tela. O teste com NVDA, de preferência com quem usa leitor de tela, continua pendente.

### 2. Tempo e rotina

- Agenda diária e semanal visual, com semana-modelo.
- Rotinas passo a passo, com imagens ou ícones opcionais.
- Avisos de transição antes da troca de atividade.
- Timer visual de foco e de pausa.

**Como ficou na Onda 1 (etapa 8).**
- **Agenda** em quatro visualizações: dia, semana (segunda a domingo), mês e **semana-modelo**.
- Compromissos com data, horário de começo e fim (ou dia inteiro), notas e **repetição**: todo dia, em dias da semana escolhidos ou todo mês, com data final opcional. Num compromisso que se repete, dá para **tirar só um dia** sem mexer nos outros.
- **Semana-modelo**: compromissos marcados como "bloco fixo" (aulas, trabalho, terapia). Aparecem tracejados e mais claros em toda a agenda, e numa visualização própria com os sete dias.
- O **Início** mostra os compromissos de hoje.
- Horários em lista, sem grade de horas: mais fácil de ler e de usar pelo teclado.

**Como ficou na Onda 1 (etapa 9).**
- **Rotinas** com passos em ordem; cada passo pode ter ícone (lista de 19, sempre com o nome escrito ao lado) e minutos. "Começar" mostra um passo por vez, em letra grande, com Voltar, Próximo e Sair a qualquer momento. Sem contagem de dias seguidos.
- **Foco**: timer visual (um disco que diminui) de foco ou pausa, com durações fixas para escolher. Continua contando enquanto a pessoa navega e aparece na barra lateral. Ao terminar, aviso discreto no app e notificação do Windows, **sem som**.
- **Avisos de transição**: ligados por padrão, 10 minutos antes de cada compromisso com horário (5, 10, 15 ou 30). Aparecem no alto do app e, se a pessoa quiser, como notificação silenciosa do Windows. Um aviso por compromisso e dia.
- **Limite**: os avisos só funcionam com o Órbita aberto e desbloqueado, porque a agenda fica no cofre criptografado. Manter o Órbita na área de notificação ao fechar a janela fica para a etapa de fechamento.

### 3. Energia

- Registro rápido do nível de energia do dia.
- Planejamento por energia: tarefas marcadas como leves, médias ou pesadas.
- **Modo baixa energia**, que mostra só o essencial: remédio, comer, uma tarefa.

**Como ficou na Onda 1 (etapa 10).**
- **Registro rápido** no Início e na página Energia: cinco níveis com o nome escrito (muito baixa, baixa, média, boa, muito boa) e um desenho de barras. Um clique registra; pode registrar várias vezes no dia. Histórico dos últimos 14 dias em barras (média do dia), sem julgamento.
- **Peso das tarefas**: leve, média ou pesada, no menu de cada tarefa. "Tarefas para agora" mostra as tarefas dos projetos ativos, as leves primeiro.
- **Modo baixa energia** (Ctrl + Shift + E): a tela inteira vira "Só o essencial", com os **básicos do dia** (padrão: tomar o remédio, comer alguma coisa, beber água; editáveis), **uma tarefa** leve (com "mostrar outra"), a agenda de hoje e o registro de energia. Frase fixa: "Hoje é dia de fazer só o essencial. Está tudo bem." Quando o módulo Saúde chegar (Onda 2), o remédio virá da medicação cadastrada.

### 4. Dinheiro

Mais que um registro de gastos: um lugar para **entender** para onde o dinheiro vai, com calma e sem culpa.

- **Grupos personalizáveis** criados pela pessoa (mercado, transporte, **assinaturas**, **hobbies/hiperfoco**...), cada um com cor. O gasto entra num grupo; a marca "interesse especial" continua como um filtro à parte, para ver esses gastos sem julgamento.
- **Registro de gastos** rápido, ligado a um grupo.
- **Tabela por mês**: grupos nas linhas, meses nas colunas, para comparar e enxergar a evolução; dá para filtrar por período e por grupo.
- **Visualizações para compreender os gastos**: gráfico de **pizza** (distribuição por grupo no período), de **coluna/barra** (por mês ou por grupo) e de **linha** (evolução do total). Sempre com rótulos escritos e cores que também funcionam para quem não as distingue (acessibilidade), e sem alarme: é informação, não cobrança.
- **Contas recorrentes** com aviso antecipado (as assinaturas entram aqui).
- **Lista de espera de compras**, com prazo definido pela pessoa (por exemplo, 48 horas) antes de comprar.
- **Metas de reserva.**
- Importar extrato (OFX ou CSV) continua previsto, como passo próprio.

*Estado atual (0.35.0): a primeira versão tem gastos por categoria de texto, contas, lista de espera e metas. Os grupos, a tabela por mês e os gráficos são a reescrita acordada com Dan (26/10/2026), a construir.*

### Minha organização (quadros como no Trello) — decisões de Dan, 26/10 e 02/11/2026

Pessoas neurodivergentes (autistas em especial) se apoiam muito em listas ao longo do dia. Este módulo é um organizador do dia a dia **no jeito do Trello**, que Dan usa: um quadro com uma coluna por área da vida (por exemplo "Fazendo hoje – Geral", "Trabalho", "Faculdade", "Outros – Projetos pessoais e Lazer"), cartões com caixinha de feito (riscados quando feitos), cores de coluna, setas ← → para mudar a coluna de lugar, contador e "Escreva e tecle Enter".

- **Tudo é quadro.** Ao criar não se escolhe "quadro ou lista": o quadro nasce com "A fazer / Fazendo / Feito" (renomeáveis). A **forma de ver** é só exibição e troca a qualquer momento, guardada por quadro (e sincronizada): **Quadro** (colunas lado a lado, rolagem para os lados) ou **Lista** (tudo um embaixo do outro, agrupado por coluna, com as caixinhas; o grupo recolhe).
- **Migração sem perda:** quadros antigos de estilo "lista" continuam abrindo, como quadro com a coluna única deles, mostrados na vista Lista (sem cabeçalho, como antes) até a pessoa trocar. O campo `estilo` fica só por compatibilidade.
- **Cartão completo** (janela própria; Enter abre, Esc fecha; tudo é guardado sozinho pouco depois de cada mudança): título, **descrição com formatação** (o mesmo editor do app: negrito, itálico, listas, títulos, links; Markdown), **checklists** com nome (uma ou mais), **etiquetas coloridas do quadro** (cor + nome, nunca só cor), **data de entrega** com hora opcional, **anexos** (os mesmos do app, presos ao cartão), **capa** (cor da paleta ou imagem anexada), cor do cartão inteiro, caixinha de feito, **arquivar**, **mover** para outra coluna ou outro quadro e **copiar** (a cópia não leva os anexos; ao ir para outro quadro, as etiquetas que faltam lá são criadas).
- **Cartão fechado mostra sinais:** capa no topo, etiquetas, data (tom de atenção suave quando vence em até 2 dias, vence hoje ou já passou; nunca vermelho), progresso da checklist ("3/5"), clipe com o número de anexos e ícone de descrição. Cada sinal tem texto para leitor de tela.
- **No quadro:** fundo do quadro (do tema, cor da paleta, gradiente suave ou imagem própria de até 8 MB, reduzida e guardada como anexo do quadro; no baixo estímulo fica apagado), **busca** (tecla /) e **filtro** (palavra, etiquetas, "vence nos próximos 7 dias (e os que já passaram da data)", "esconder os feitos"; aviso de quantos cartões estão escondidos), **Arquivados** (ver, restaurar ou apagar de vez cartões e colunas arquivados), **recolher coluna** (faixa fina com o nome, que ainda recebe cartões arrastados), "Arquivar os feitos" na vista Lista (no lugar do antigo "limpar os feitos", que apagava).
- Arrastar com mouse, caneta, dedo (segurar 150 ms) e teclado (dnd-kit); botões de subir/descer/apagar aparecem pelo teclado. Com filtro ligado, arrastar entre os visíveis não tira os escondidos do lugar. Alvos de 44 px no toque; sem animação; sombras leves.
- **Dados:** tabela item (org_quadro / org_coluna / org_cartao). Campos novos em `dados` (JSON): quadro (cor, vista, etiquetas, fundo), coluna (cor, recolhida, arquivada), cartão (cor, prazo, hora, descrição, checklists, etiquetas, capa, arquivado). Ao gravar, o JSON antigo é mesclado (chaves desconhecidas ficam, para versões futuras não perderem nada). A contagem de anexos é calculada ao listar. Sem comando novo: tudo passa pelos comandos que já existiam, então o navegador recebeu sozinho.
- **Fica para depois:** compartilhar um quadro com outra pessoa (precisa de desenho próprio de segurança; ver a ideia registrada no relatório de 02/11/2026), ligação com Agenda e Projetos, arrastar colunas (hoje são as setas).

### 5. Saúde

**A Saúde não é só carga negativa (decisão de Dan, 26/10/2026).** Hoje ela só coleta sintoma, crise e sobrecarga — isso ensina a pessoa a se ver como um conjunto de problemas. O módulo precisa dar peso igual ao que vai **bem**: potencialidades, o que faz bem, estratégias que funcionam. O objetivo é uma **visão holística de si**, com muitos gráficos, não um prontuário de queixas.

- Medicação com confirmação de dose tomada, controle de estoque e aviso de receita vencendo.
- Consultas e exames com lembrete.
- **Registros**, negativos e positivos: sono, sintomas e sobrecarga sensorial, mas também **coisas boas** — o que fez bem, uma potencialidade exercida, um momento de regulação. Cada registro tem intensidade e nota.
- **Planos de crise e estratégias**: a pessoa cria **vários** planos, não só um. Cada plano pode ser um **plano de crise** (meltdown/shutdown: sinais, o que ajuda, com quem falar) ou uma **estratégia de potencialidade / coisas que fazem bem** (o que me regula, o que me dá energia, meu kit de autocuidado). Escritos num momento bom. (O atalho de crise segue levando ao plano de crise.)
- **Gráficos para uma visão holística**: ao longo do tempo, sono, crises, sintomas e também as **coisas positivas** — lado a lado, para a pessoa enxergar padrões e enxergar o que vai bem, não só o que pesa. Sem vermelho gritante, sem alarme; é percepção de si, nunca diagnóstico.
- **Resumo para levar à consulta**, gerado a partir dos registros.
- **Integração com dados de saúde e relógios inteligentes** (Onda 3, só no app de celular):
  - **iPhone e Apple Watch**: Apple Saúde (HealthKit).
  - **Android** (Samsung, Xiaomi, Google, Fitbit e outros): Health Connect, que reúne os dados do Samsung Health, do Mi Fitness e de outros apps (compatibilidade de cada marca a confirmar). Garmin, se entrar, exige integração própria.
  - Dados úteis: sono, frequência cardíaca e variabilidade (como sinal possível de estresse e sobrecarga), passos e atividade, ciclo menstrual.
  - **Somente leitura**, com a pessoa escolhendo cada tipo de dado; tudo fica no aparelho e entra nos registros e no resumo para a consulta.
  - Os dados são apresentados como apoio à percepção da própria pessoa, nunca como diagnóstico nem alerta alarmista.
  - O computador recebe esses dados pela sincronização entre aparelhos; Windows e Mac não acessam o Apple Saúde nem o Health Connect diretamente.
  - Futuro: app no relógio para captura rápida, confirmação de remédio e avisos de transição discretos por vibração.

### 6. Cuidado — meus profissionais de saúde

Não é só psicólogo e psiquiatra: pessoas neurodivergentes costumam acompanhar **vários profissionais ao mesmo tempo** (neurologista, nutricionista, fisioterapeuta, clínico, terapeuta ocupacional...). O módulo é o acompanhamento de cada um deles ao longo do tempo.

**Fronteira com o módulo Saúde (decidida por Dan, 26/10/2026): Saúde = coisas, Cuidado = pessoas.** A Saúde cuida de medicação, exames pontuais, registros de sintoma/sono e plano de crise. O Cuidado cuida da **relação de acompanhamento com cada profissional**: as consultas que se repetem, o que levar e o que ficou, a evolução. A medicação não é redigitada aqui — ela é cadastrada na Saúde e **aparece** no painel do psiquiatra.

- **Lista dos seus profissionais**, que você adiciona (nome, especialidade, contato). Não são abas fixas; é a sua lista real.
- **Ao entrar num profissional, um painel de acompanhamento completo:**
  - **Consultas**: a próxima (com data e contagem) e o histórico, por data. Entram na Agenda com lembrete.
  - **Antes da consulta** ("o que levar") e **depois** ("o que ficou"), por consulta.
  - **Perguntas** para aquele profissional.
  - **Linha do tempo** da evolução ao longo das consultas.
  - **Painéis por tipo**: no psiquiatra, puxa a medicação, doses e efeitos percebidos do módulo Saúde e monta o resumo para levar; no psicólogo, acompanha os temas.
- **Texto rico em todo campo de anotação** (negrito, listas, títulos), reaproveitando o editor que já existe no app — porque aqui a pessoa escreve muito.

*Estado atual (0.33.0): a primeira versão é rasa — três listas ("o que levar", "perguntas", "o que ficou") numa tela só, com texto simples. A visão de hub por profissional acima é a reescrita acordada com Dan, ainda a construir.*

### 7. Vida acadêmica

Serve do ensino fundamental e médio à faculdade e à pós. O vocabulário e as telas não pressupõem faculdade (um adolescente na escola é um usuário esperado) nem param nela (um estudante com iniciação científica, publicações e projetos também é).

**A ideia central: a matéria é um hub, não uma linha de lista.** O módulo não serve para *guardar* a vida acadêmica, e sim para *reuni-la* e responder "o que eu estudo agora?". Cada matéria recolhe tudo que pertence a ela — aulas, tarefas, trabalhos, leituras, grifos e páginas de caderno — e o topo do módulo mostra o próximo passo, não a média.

- **Grade de horário semanal.** As matérias aparecem dispostas num quadro de dias × horários, como a agenda de um caderno estudantil — não uma lista. As aulas são blocos fixos da semana-modelo da Agenda, ligados à matéria; a grade do Estudos e a semana-modelo são a mesma coisa vista de dois jeitos.
- **Matéria = assunto = etiqueta que atravessa o app.** Cada matéria carrega uma etiqueta de assunto. Essa etiqueta é acionável no **Leitor** (grifos e notas marcados por assunto) e no **Caderno** (páginas marcadas por assunto). Assim a matéria recolhe sozinha tudo que carrega aquele assunto: o livro, os grifos daquele livro, as anotações, os trabalhos. Começa pela matéria como etiqueta; sub-assuntos (uma matéria "Direito" com "Constitucional", "Penal") ficam para depois.
- **Trabalhos acadêmicos são projetos, não entregas avulsas.** Não só o TCC: seminário, artigo, publicação, iniciação científica, monografia — coisas contínuas. Cada um é um **projeto** de verdade (passos, subtarefas, cartão "onde parei", prazo), reaproveitando o módulo de Ideias e projetos, com vínculo à matéria/assunto. Inclui **agendamento para trás**: uma entrega grande na sexta sugere "comece na terça", para atacar a iniciação de tarefa e a cegueira de tempo.
- **Atividades curtas** (prova, dever de casa) seguem simples: matéria e data, marcar como feito. "O que vem aí" mostra o que está chegando, com a contagem de dias sentida ("faltam 3 dias"); liga no modo baixa energia com uma tarefa leve de estudo.
- **Conexões (o módulo não é ilha):** prova e entrega viram eventos da Agenda com aviso de transição; "estudar agora" abre o **timer de Foco** amarrado à matéria; material da aula (links, PDFs) por matéria usa os anexos; as **leituras** por assunto vivem na estante da Leitura.
- **Notas e média** encolhem para um detalhe opcional dentro da matéria: média ponderada e uma média de aprovação ajustável (6 na escola, 7 em muitas faculdades). **Nota é informação, não julgamento** — sem vermelho gritante, sem "você vai reprovar", sem comparação com os outros (princípios 3 e 4). Quem não quiser acompanhar, não precisa.

**Sequência.** A grade semanal, trabalho-como-projeto, o "o que fazer agora", as ligações com Agenda e Foco e o encolhimento da nota podem ser construídos independentemente. A etiqueta de assunto já fica plantada na matéria desde cedo, mas as conexões com **grifos** (precisa do Leitor pronto) e com **páginas de caderno** (precisa do Caderno) só acendem quando esses módulos existirem.

*Estado atual (0.34.0): a primeira versão entregue é o cadastro — matérias, atividades e média. A visão de hub acima é a reescrita acordada com Dan (26/10/2026), ainda a construir.*

### 8. Hobbies e interesses

- Arquivo de interesses e hiperfocos, com notas, imagens e links.
- Cada interesse abre num **quadro livre** com cartões soltos (texto, arquivo, imagem, link, áudio) que a pessoa arrasta, e uma **camada de desenho à mão** sobre o quadro todo (modo quadro branco: caneta com cores e espessura, borracha que apaga por partes, desfazer, limpar), reaproveitando o motor de traços do caderno.
- Espaço de prazer, sem metas nem cobrança de produtividade.

### 9. Caderno infinito

- **Vários cadernos**, quantos a pessoa quiser, organizados numa **estante** com pastas e etiquetas (por exemplo: faculdade, terapia, ideias, desenho).
- **Dois modos, à escolha da pessoa**, em cada caderno:
  - **Quadro infinito**: espaço sem bordas, que cresce para todos os lados, bom para mapas, rascunhos e ideias soltas.
  - **Modo caderno**, no estilo Goodnotes: páginas com tamanho definido (A4, A5, carta), viradas uma a uma, com índice e marcadores.
- **Capas personalizáveis**: cor, textura, imagem ou SVG da própria pessoa, título e etiqueta; galeria de capas prontas, temáticas e neutras.
- **Folhas personalizáveis**:
  - cor e textura do papel (branco, creme, pólen, cinza, escuro);
  - modelo de linhas: liso, pautado, quadriculado, pontilhado, isométrico, planner e partitura;
  - espaçamento das linhas, cor e espessura das linhas, margem e cabeçalho ligados ou desligados;
  - modelo diferente por página, se a pessoa quiser, e importação de modelos próprios (PDF, PNG ou SVG).
- Importar PDF para anotar por cima, e exportar páginas ou cadernos inteiros em PDF.
- Escrita com caneta, mouse ou dedo, com **sensibilidade à pressão** e rejeição da palma da mão.
- Ferramentas: caneta, lápis, pincel, marca-texto, borracha, formas que se ajustam sozinhas, texto, setas, notas adesivas, imagens e laço de seleção para mover, redimensionar e recolorir.
- Ligado ao resto: um rascunho pode ser anexado a um projeto, e uma nota pode virar ideia no estacionamento.
- Base técnica: **motor próprio único** para os dois modos (decisão de Dan, 26/10/2026), no pacote `@orbita/caderno`, com traço por pressão pela biblioteca aberta **perfect-freehand** (cara de caneta, não de rascunho). A página é uma cena com borda; o quadro infinito é a mesma cena sem borda. Excalidraw e tldraw foram descartados (traço de rascunho; acoplamento a React; no caso do tldraw, licença comercial com marca d'água). Entrada por caneta também no iPad e em mesas digitalizadoras.
- **Os dois modos completos entram na Onda 2** (decisão de Dan, 25/10/2026): não só o quadro infinito, mas o caderno no estilo Goodnotes com tudo acima (páginas, capas, folhas, PDF, pressão e todas as ferramentas). Por ser o maior item da especificação, fica dividido em cinco etapas em `docs/plano-onda-2.md`.

### 10. Leitura

- **Estante de livros** com status: quero ler, lendo, lido e pausado (abandonar um livro não é fracasso). Metas de leitura só se a pessoa quiser.
- **Leitor de EPUB e PDF completo**:
  - fonte, tamanho, entrelinha, margens e alinhamento ajustáveis, incluindo fontes para dislexia;
  - cor do fundo (branco, creme, pólen, cinza, escuro) e modo de páginas ou rolagem;
  - régua de leitura que destaca a linha atual e escurece o resto;
  - leitura em voz alta, com velocidade ajustável;
  - busca no livro, sumário navegável e dicionário.
- **Marcações**: grifos em várias cores com significado definido pela pessoa, notas na margem, marcadores e escrita com caneta por cima, com sensibilidade à pressão.
- **Fichamentos**: modelos prontos (citação, resumo, comentário, paráfrase) gerados a partir dos grifos, sempre com página ou posição. Exportação em Word, PDF ou Markdown, com referência no padrão ABNT.
- **Diário de leitura**: onde parei, impressões, data de início e fim.
- **Busca em todas as anotações** de todos os livros ao mesmo tempo.
- IA opcional para explicar um trecho, resumir um capítulo ou ajudar no fichamento.
- Ligado ao resto: o livro pode ficar ligado a uma disciplina da vida acadêmica, um fichamento pode ir para um caderno e uma leitura longa pode virar projeto.
- Base técnica: motores de código aberto para EPUB e PDF (por exemplo, foliate-js ou epub.js, e PDF.js). Decidido: o motor de leitura é construído aqui, como um pacote separado, e reaproveitado no leitor da Arcano 3 e na biblioteca do Escuta.

## Personalização e interface

A interface deve ir além da do Escuta: a pessoa monta o próprio ambiente, do mais temático ao mais neutro, sem nunca perder a legibilidade.

**Fundos aceitos**

| Formato | Uso | Observação |
| --- | --- | --- |
| Cor sólida e gradiente | Fundo simples | Escolhidos no próprio programa |
| Textura e padrão | Papel, tecido, grafismos | Padrões podem se repetir em mosaico |
| PNG, JPG, WebP | Fotos e imagens da pessoa | Com desfoque e escurecimento ajustáveis |
| SVG | Ilustrações, padrões vetoriais, molduras | Nítido em qualquer tamanho e leve |

**SVG em detalhe.** O vetor escala sem perder resolução em qualquer tela, do celular ao monitor 4K. Quando o SVG usar cores "neutras" (o padrão `currentColor`), ele pode herdar as cores do tema e mudar junto com ele. SVG pode conter código escondido, então todo arquivo importado passa por uma **limpeza de segurança** que remove scripts e links externos. SVG animado é aceito, mas congela automaticamente no modo baixo estímulo. Outros vetores (PDF, AI, EPS) ficam fora da primeira versão; a pessoa exporta em SVG antes.

**Outros recursos**

- **Contraste automático**: ao escolher um fundo, os painéis se ajustam (opacidade, desfoque, cor do texto) para manter o texto legível, com verificação de contraste mínimo.
- **Pacotes de tema completos**: cores, fontes, ícones, cantos, sombras e fundo. Exemplos temáticos: Biblioteca, Espaço, Floresta. Exemplos neutros: Papel, Cinza calmo, Mínimo.
- **Editor de tema** para ajustar cada elemento, com pré-visualização ao vivo.
- **Layout montável**: a tela inicial em blocos que a pessoa arrasta, redimensiona, liga e desliga.
- **Botão de baixo estímulo**: tudo neutro, sem animação e sem cor forte, com um clique e de volta com outro.
- **Importar e exportar temas** num arquivo único, para a comunidade compartilhar.
- Densidade, tamanho de fonte e espaçamento ajustáveis; modo claro e escuro.

**Como ficou na Onda 1 (etapa 11).**
- **Seis temas prontos**, cada um em claro e escuro: Papel, Cinza calmo e Mínimo (neutros); Biblioteca, Espaço e Floresta (temáticos, com fundo sugerido). Cada tema define cores, arredondamento dos cantos e sombras. A fonte continua sendo escolha da pessoa, por acessibilidade.
- **Fundos**: o do tema, cor lisa, três gradientes feitos com as cores do tema, seis padrões desenhados (pontos, linhas, grade, papel, estrelas, folhas), **foto da pessoa** (reduzida para no máximo 1920 px, com desfoque e escurecimento ajustáveis) e **SVG da pessoa**.
- **SVG**: limpeza de segurança com DOMPurify (sem scripts, eventos, foreignObject, iframes, links externos nem CSS que busque algo de fora). Se o SVG usa `currentColor`, ganha a cor do tema. Fica **parado por padrão**; "permitir animação" só vale se o Windows não estiver com "reduzir animações".
- **Contraste automático**: o Órbita lê até 48 × 48 pontos do fundo e calcula a menor opacidade da área de conteúdo que mantém texto ≥ 7:1 e texto suave e destaque ≥ 4,5:1. Fotos: regra valendo em 98% dos pontos, piso de 30% e leve desfoque atrás dos painéis. Desenhos (padrões, SVG): até 15% dos pontos podem ser as linhas (que ainda precisam de 3:1), sem desfoque, para o desenho aparecer nítido. Mostra em Ajustes o valor aplicado. A barra lateral e os cartões ficam sempre opacos.
- **"Quanto o fundo aparece"** (0.23.1): controle deslizante em Aparência > Tema e fundo. No começo (padrão) vale a conta acima; arrastando até o fim, a opacidade desce até o mínimo de leitura da WCAG AA (texto ≥ 4,5:1, texto suave e destaque ≥ 3:1), nunca abaixo. Fora do começo, um aviso lembra que o contraste caiu. Some no baixo estímulo.
- **Baixo estímulo** leva o fundo ao liso, além de tirar a cor de destaque e as animações.
- Os temas e o cálculo de contraste ficam no pacote `@orbita/temas`, sem React, para poderem ir ao Escuta.

**Como ficou na Onda 1 (etapa 12).**
- **Editor de tema**: "criar um tema a partir deste" (ou editar um tema próprio). Cada uma das 11 cores, em claro e escuro, com seletor e código hexadecimal; arredondamento dos cantos (retos, suaves, médios, redondos) e sombras. **Prévia ao vivo** e lista de **contraste par a par** (texto, texto secundário, destaque, avisos, contornos e foco sobre fundo, painéis e áreas destacadas; texto sobre o destaque). As cores que não passam ficam marcadas; **"Ajustar sozinho"** escurece ou clareia só essas. Só salva quando tudo passa.
- **Arquivo de tema** `.orbita-tema` (JSON legível) para exportar e importar. Na importação: confere cada cor, **corrige o contraste se precisar** (e avisa), limpa de novo qualquer SVG e não aceita fotos.
- **Tela inicial montável**: "Organizar a tela inicial" mostra os blocos (Capturar, Energia, Hoje, Continuar de onde parei, Ideias guardadas, O que mudou) com alça para arrastar, botões de subir, descer, largo/estreito e esconder; os escondidos voltam com "Mostrar". Em telas largas, duas colunas.
- **Fontes**: Atkinson Hyperlegible Next (padrão), Lexend e OpenDyslexic, à escolha, todas embutidas no app. O espaçamento entre letras e linhas ganha destaque, porque tem evidência um pouco melhor que a troca de fonte.
- **Ícones**: Lucide, de traço fino e uniforme.
- **Preferências visuais fora do cofre**: fonte, tamanho, cores e baixo estímulo ficam num arquivo próprio, sem criptografia, porque a tela de senha precisa abrir já com a aparência da pessoa. Não são dados sensíveis.
- **Liberdade com uma trava**: a pessoa pode mudar fundo, cores, fontes, cantos, sombras, ícones e a disposição da tela inicial. A única trava é a legibilidade: se uma escolha deixar o texto ilegível, o Órbita ajusta o painel e avisa o que mudou, sem bloquear a escolha.
- **Trava de contraste liberável** (decisão de Dan, 0.26.0): as regras de contraste valem para quem faz o app, não para a escolha da pessoa sobre a própria tela, e há quem prefira cores mais vivas ou contraste mais baixo. Em Aparência > Tema e fundo, "Liberar a trava de contraste" (desligado por padrão) faz o controle "Quanto o fundo aparece" ir até o fundo inteiro (sem cobertura), deixa salvar no editor cores que não passam (as marcações continuam como informação; com a trava ligada, "Salvar e usar" pergunta se a pessoa quer voltar às cores, ajustar sozinho e salvar, ou salvar assim liberando a trava) e faz a IA e a importação de temas manterem as cores como vieram. Proteções: Ctrl + Shift + B (baixo estímulo) volta o contraste e deixa o fundo liso na hora, sem precisar ler a tela; a tela de entrada (bloqueada) sempre usa a trava; os temas guardados não são alterados, e a trava age só na hora de mostrar. Temas para a futura galeria da comunidade continuam precisando passar no teste. "Mostrar o fundo com as cores originais" (0.27.0) tira todo o filtro (véu, desfoque do painel, desfoque e escurecimento da foto) e liga junto a trava liberada; os valores escolhidos ficam guardados e voltam ao desligar. "Caixas: de opacas a vidro" (0.28.0) deixa cartões e barra lateral transparentes com desfoque de 12 px por trás; com a trava, a transparência para no mínimo de leitura (WCAG AA) medido com a cor da superfície sobre o fundo; sem a trava, vai até zero; no baixo estímulo, as caixas voltam a ser opacas. "Contorno nas letras" (0.28.3, ligado por padrão quando a trava está liberada): sombra da cor do fundo em volta do texto, faixa translúcida atrás dos textos fora das caixas e caixas de vidro com pelo menos 60% de cor; pode ser desligado.
- **Editor de tema ao vivo** (0.29.1): enquanto o editor está aberto, o app inteiro mostra o tema em edição (mesma regra do salvar, sem gravar nada); ao cancelar, volta ao que está salvo.
- **Menu Aparência** (0.29.0): tema e fundo, leitura (fonte, tamanho, espaços) e tela (claro/escuro, densidade, baixo estímulo) saíram de Ajustes para um item próprio do menu, logo acima de Ajustes (atalho Ctrl + 8). Ajustes fica com o funcionamento: avisos, limite de projetos, segurança, janela, atualização, backup, conta na nuvem, IA e ditado.
- **Setas de voltar e avançar** (0.29.0): no alto da área de conteúdo, como num navegador; lembram as funções e os projetos visitados (até 50 passos). Alt + ← e Alt + →, e os botões laterais do mouse. Sem para onde ir, ficam apagadas no mesmo lugar.
- **Ajustar sozinho** mexe primeiro só nas cores de frente; se os fundos pedem letras opostas, o texto segue os painéis e o fundo da janela e as áreas destacadas mudam de claridade.
- **Cores da imagem** (IA): "Suaves" (padrão, calmo e com pouco contraste) ou "Vivas" (fiel ao estilo pedido).

## Privacidade e dados

Os dados ficam no aparelho da pessoa, criptografados, e só saem dali se ela quiser. Isso pesa especialmente em saúde, dinheiro e cuidado psicológico.

- **Local-first**: o programa funciona inteiro sem internet e sem conta.
- **Criptografia** do banco de dados inteiro, com uma chave sorteada no aparelho. Essa chave fica trancada de três jeitos:
  - **chave de recuperação**: 6 palavras sorteadas da lista padrão em português (sem acentos, reconhecidas pelas 4 primeiras letras), mais um **arquivo de recuperação**. É a tranca que vale em qualquer computador: backups, aparelho novo e quando o PIN ou o Windows Hello falham;
  - **senha** opcional (mínimo de 12 caracteres), criada em Ajustes por quem prefere digitar uma senha em vez das 6 palavras (desde a versão 0.21.0; antes era obrigatória);
  - **jeito de abrir no dia a dia**, escolhido por aparelho: **Windows Hello** (digital, rosto ou PIN do Windows; padrão quando o computador tem), **PIN** (de 4 a 8 números; padrão quando não há Windows Hello), **senha** ou **abrir direto**. O Windows Hello, o PIN e o abrir direto usam um segredo guardado pelo Windows (Gerenciador de Credenciais): numa cópia do arquivo levada para outro computador, eles não servem. Depois de 5 erros seguidos de PIN, o Órbita pede as 6 palavras (ou a senha, se houver). Nada é apagado por tentativas erradas.
- **Recuperação sem servidor.** Não há recuperação por e-mail ou SMS: isso exigiria um servidor capaz de abrir os dados, contra a promessa de que os dados não saem do aparelho, e contra a LGPD no caso de dados de saúde e terapia. No lugar disso:
  - a chave pode ser salva em arquivo (pendrive, nuvem), impressa, copiada para o próprio e-mail ou entregue a uma pessoa de confiança;
  - pode ser vista de novo em Ajustes, com a senha;
  - as telas de recuperação são calmas, um passo por vez, sem tempo limite;
  - com a sincronização (Onda 3), um aparelho já aberto poderá criar uma senha nova para o outro.
- **Menos burocracia, com conta da própria pessoa** (decisão de Dan, 25/10/2026; ainda não feito). Senha, 6 palavras e arquivo assustam, levam a anotar em papel e deixam sem saída quem perde tudo. Mudanças planejadas:
  - **Etapa A (primeira configuração leve), feita na versão 0.21.0:** a pessoa não inventa senha. Escolhe como abrir no dia a dia (Windows Hello recomendado, PIN ou abrir direto) e guarda a recuperação. As 6 palavras são a tranca forte (cerca de 66 bits, mais forte que a maioria das senhas inventadas). A senha vira opcional, em Ajustes, para quem prefere. Onde hoje se pede a senha (PIN errado 5 vezes, Windows Hello falhando, backup), valem as 6 palavras ou a senha, se houver. Cofres já criados não mudam.
  - **Etapa B (proteger com a conta Google ou Microsoft): Google feito na versão 0.22.0; Microsoft com o código pronto, esperando o registro do app** (`docs/configurar-contas.md`, decisão 0010; plano por plataforma logo abaixo): a chave de recuperação e uma cópia criptografada do backup ficam numa pasta escondida do app, no Google Drive ou no OneDrive **da própria pessoa**. Perdeu o computador: instala o Órbita, entra com a conta e tudo volta. O Google e a Microsoft guardam, mas não leem o conteúdo, e o Órbita não tem servidor nem conta própria. O limite é dito na tela: a segurança passa a ser a da conta da pessoa (com verificação em duas etapas), e quem perder a conta perde essa forma de recuperar. As 6 palavras continuam como alternativa.
  - **Apple:** "Entrar com Apple" com iCloud chega com as versões de Mac e iPhone (Onda 3), porque exige a conta de desenvolvedor da Apple. No Windows, quem usa Apple pode escolher a conta Microsoft ou guardar o backup na pasta do iCloud Drive para Windows.
  - Na Onda 3, a mesma base vira a sincronização entre computador e celular.

### Entrar com Google e sincronizar (decisão de Dan, 29/10/2026; senha opcional em 03/11/2026; telas feitas na etapa 2d, esperando a credencial do Google para o navegador)

Dan vai testar no Windows e no iPad ao mesmo tempo e quer que tudo apareça nos dois. O modelo combinado:

- **Entrar com Google é o caminho principal**, em destaque na primeira tela, com nome e foto do perfil. Outros provedores (Microsoft, Apple…) entram depois. "Usar sem conta" continua existindo, menor, porque o app funciona sem conta.
- **Google só na primeira vez em cada aparelho** (ou depois de sair da conta). No dia a dia abre pelo PIN, sem internet.
- **Sincronização automática** pela pasta escondida do app no Google Drive da própria pessoa, sem servidor do Órbita. Sem internet, as mudanças ficam guardadas e sobem quando ela volta. Cada aparelho guarda **uma cópia completa**. Mesmo item editado em dois aparelhos sem internet: vale o mais recente (depois, avaliar guardar os dois).
- **A senha de sincronização é opcional (decisão de Dan, 03/11/2026, "opção 2").** **Padrão: "só o Google"**: entrar na mesma conta Google basta para um aparelho novo sincronizar, sem senha a mais. Os dados continuam indo trancados para o Drive, mas quem entrar na conta Google da pessoa consegue abri-los. **Opcional: "Proteção extra: trancar também com uma senha minha"** (caixinha desligada por padrão, ao ligar no primeiro aparelho, com a troca explicada em duas linhas: sem ela, quem entrar na sua conta Google poderia abrir seus dados; com ela, ninguém lê sem a senha, mas é uma senha a mais para lembrar). Com a proteção, a senha simples escolhida pela pessoa é pedida uma vez em cada aparelho novo e nem quem entra na conta lê os dados. Em **Ajustes > Sincronizar aparelhos** dá para ligar a proteção (senha nova e, em seguida, as 6 perguntas) ou desligar (confirmação literal: "Seus dados continuam trancados, mas quem entrar na sua conta Google poderá abri-los"). Ligar ou desligar não troca a chave: os aparelhos já conectados continuam iguais.
- **Esqueceu a senha (só com a proteção extra):** **PIN + 6 perguntas pessoais** que a própria pessoa escreve (respostas conferidas sem ligar para acento e maiúscula). O **PIN é o mesmo em todos os aparelhos** (nos dois modos). A tela avisa o limite: alguém muito próximo pode saber as respostas. Sem a proteção extra não há senha a esquecer, então não há perguntas. As 6 palavras deixam de ser obrigatórias.
- **Como ficou (etapa 2d, 02/11/2026; detalhes em `docs/decisoes/0012-sincronizacao.md`):** Ajustes ganhou o assunto "Sincronizar aparelhos" (ligar, perguntas, senha nova, "Desligar neste aparelho", que deixa os dados aqui e no Drive). Num aparelho novo, o PIN escolhido é conferido com o dos outros e passa a abrir aquele aparelho; **no primeiro aparelho, quem já abre com Windows Hello continua com o Hello** (o PIN vale para os aparelhos novos e para a recuperação). Aparelho novo que já tem dados escolhe "Juntar tudo" (padrão) ou "Usar só os do Drive" (os daqui vão antes para um arquivo de backup). As perguntas ficam abertas no Drive (precisam aparecer antes de abrir); as respostas não ficam em lugar nenhum. Pode pular as perguntas e fazer depois. A primeira tela só mostra o Google em destaque quando o login do Google existir no navegador; **no Windows, a conta liga depois, em Ajustes** (o login lá guarda a renovação dentro do banco criptografado, que só existe depois de criar o cofre).
- **Perdeu o Google:** nos aparelhos que já usa, tudo continua lá e abre pelo PIN; dali faz backup e liga outra conta. Só perde tudo quem perder o Google **e** todos os aparelhos sem ter backup: por isso o backup automático é oferecido no cadastro.
- **Endereço da versão de navegador:** `orbita.arcano3.com.br` (subdomínio do domínio de Dan, só um apontamento no registro.br), configurado **depois** da confirmação do nome, porque o login do Google fica preso ao endereço.
- **Ordem:** (1) login com Google no navegador; (2) sincronizar navegador e Drive; (3) login e sincronização no Windows (aproveitando o cliente Google da 0.22.0).
- **Antes de tudo, um motor só (decisão de 02/11/2026, ver `docs/decisoes/0011-motor-unico.md`):** o navegador passa a rodar o mesmo código Rust do banco do Windows, compilado para WebAssembly (prova feita: compila sem mudança, SQLCipher roda no navegador, 693 KB comprimido). Assim os dois guardam igual, o backup abre nos dois lados (feito: formato 2 do `.orbita-backup`, ver "Backup") e a sincronização fica simples. Os dados de teste do navegador não passam para o motor novo. Amigos testam depois desta etapa.
- **O que viaja (02/11/2026):** os dados de todos os módulos e as configurações da pessoa, **inclusive os provedores e as chaves de IA** (pedido de Dan: cadastrar a chave num aparelho e usar em todos; vão trancadas como o resto). Não viajam: conta da nuvem, backup automático, as 6 palavras e o que é do aparelho. Motor da sincronização feito (etapa 2a, ver `docs/decisoes/0012-sincronizacao.md`).
- **Decisões de Dan (03/11/2026):** (1) no navegador, a conta Google (nome, e-mail, foto) fica guardada **dentro do cofre** como dica: ao reabrir o app, um toque basta para voltar a sincronizar; o acesso do Google nunca é guardado. (2) Quem abre o computador com o Windows Hello continua com ele; o PIN igual em todos os aparelhos vale para os aparelhos novos e para a recuperação.
- **Sinal de sincronização (pedido de Dan, 02/11/2026):** um aviso discreto no canto mostra "Sincronizado há 1 min", "Enviando…" ou "Sem internet: guardado neste aparelho". Entra junto com a sincronização (etapa 3), sem animação forte (princípio 2).
- **Não esperar o INPI:** começar no endereço atual (`danielsampaiorodrigues.github.io`). Com a sincronização, mudar de endereço depois só pede acrescentar a origem nova no Google; os dados voltam do Drive. O identificador do app no Windows (`br.com.arcano3.orbita`) **nunca muda**, mesmo que o nome mude: é ele que aponta para a pasta dos dados.

### Contas para guardar a recuperação: plano por plataforma

Decisão de Dan (25/10/2026): a opção "Guardar na minha conta" precisa existir em **todas as plataformas** do Órbita e com **todas as contas** que fizerem sentido. Cada combinação pede um cadastro próprio no provedor e um jeito próprio de voltar do login para o app.

| Conta | Windows | Mac | Android | iPhone e iPad | Situação |
|---|---|---|---|---|---|
| Google (Drive) | Feito (0.22.0) | Onda 3 | Onda 3 | Onda 3 | Cadastro feito no Google Cloud (cliente "App para computador"). Mac usa o mesmo tipo; Android e iOS pedem clientes próprios. |
| Microsoft (OneDrive) | **Pendente** | Onda 3 | Onda 3 | Onda 3 | Código pronto desde a 0.22.0. Falta o registro do app: conta pessoal não registra sem diretório; tentar pelo Azure for Students (pacote de estudante do GitHub) ou conta do Azure. |
| Apple (iCloud) | Não dá (a Apple não oferece iCloud a programas de Windows) | Onda 3 | Não dá | Onda 3 | Exige conta de desenvolvedor da Apple (cerca de US$ 99 por ano) e CloudKit. No Windows e no Android, quem usa Apple escolhe outra conta ou a pasta do iCloud Drive para Windows. |
| Dropbox | A avaliar | A avaliar | A avaliar | A avaliar | Tem pasta do app, como Google e Microsoft. Cadastro gratuito. |
| Nextcloud ou WebDAV | A avaliar | A avaliar | A avaliar | A avaliar | Para quem tem servidor próprio. Sem cadastro: a pessoa informa o endereço. |
| Proton Drive | Esperar | Esperar | Esperar | Esperar | Ainda sem acesso aberto para apps de fora. Rever quando houver. |

Regras para todas: só a pasta do app (nunca o resto da conta), login no navegador ou no sistema com PKCE, nada passa por servidor do Órbita, o limite honesto aparece na tela e as 6 palavras continuam como alternativa sem conta. Na Onda 3, a mesma base vira a sincronização entre aparelhos.
- **Sem trava extra por módulo.** Decidido por Dan (26/10/2026): o cofre já protege tudo; pedir senha de novo só para saúde ou cuidado psicológico é atrito que atrapalha, contra o princípio de baixo estímulo. Num app pessoal e local, não compensa.
- **Backup** em arquivo único criptografado (`.orbita-backup`), que a pessoa guarda onde quiser (pendrive, Drive, iCloud). Abre com a senha ou com as 6 palavras, em qualquer computador; PIN e Windows Hello não viajam no backup.
  - **Na hora**, por Ajustes, ou **automático** (opcional, desligado por padrão): ao fechar ou bloquear, uma vez por dia, numa pasta escolhida, guardando os últimos 7. Se o automático falhar, Ajustes mostra o motivo.
  - **Restaurar** confere a senha e o arquivo inteiro antes de mexer em qualquer coisa. Os dados atuais vão para uma pasta de segurança (`anteriores`), nunca são apagados. Na primeira tela há "Já tenho um backup do Órbita", para computador novo.
  - **Mesmo arquivo no Windows e no navegador (formato 2, desde a 0.46).** `ORBITABK` + tamanho do cabeçalho (4 bytes) + cabeçalho JSON + conteúdo. O cabeçalho tem `versao: 2`, `criadoEm`, `versaoApp`, `origem` ("windows" ou "navegador"), os envelopes da senha e das 6 palavras (Argon2id 64 MB/3 passadas + XChaCha20-Poly1305, os mesmos do cofre do Windows), o tamanho, a soma SHA-256 e o nonce. O conteúdo é o banco SQLite em bytes simples, trancado com XChaCha20-Poly1305 pela chave dos dados (sem SQLCipher, para o navegador não precisar dele). O código que monta e abre é um só, em Rust (`src-tauri/src/portatil.rs`), usado pelo Windows e pelo motor do navegador. A versão fica dentro do JSON para um Órbita antigo avisar "atualize" em vez de quebrar. No Windows, o banco vira bytes simples na memória (nada aberto vai para o disco) e, ao restaurar, volta a ser gravado cifrado com SQLCipher. Restaurar mantém a chave dos dados do backup, e as 6 palavras vão dentro do banco (para "Ver a chave"). O Windows continua lendo o formato 1 (até a 0.45). No navegador, a senha e as palavras do dia a dia continuam com PBKDF2 (mais rápido); os envelopes Argon2 que viajam no backup ficam guardados à parte no cofre do navegador.
- **Exportação** dos dados em formatos abertos (por exemplo, CSV e Markdown), para ninguém ficar preso ao programa.
- **Sincronização entre aparelhos** só numa onda futura e sempre opcional, com criptografia de ponta a ponta.
- **IA opcional**: nenhuma função depende de IA. Se a pessoa ativar, ela sabe exatamente o que é enviado e para onde.
- Sem coleta de uso, sem anúncios e sem rastreamento. Alinhado à LGPD.

## IA e assistente

A IA é opcional e a pessoa escolhe o provedor que preferir. Nenhuma função depende dela.

- **Chave própria (API)**: Claude, GPT, Gemini, Grok e Sabiá. A pessoa cola a chave da própria conta, e o custo de uso fica com ela.
- **Opção local**: um modelo rodando no próprio computador, sem chave, sem custo e sem os dados saírem do aparelho.
- **Provedor e modelo por função**: dá para usar um na conversa e outro na revisão de texto, e escolher o modelo de cada um (por exemplo, um modelo menor e mais barato para revisar e um maior para quebrar tarefas).
- **Janela de conversa**: a pessoa fala ou escreve do jeito que vier ("tenho consulta quinta, preciso pagar a luz e tive uma ideia de livro"), e a IA separa e lança cada coisa no módulo certo.
- **A IA propõe, a pessoa confirma**: antes de gravar, aparece a lista do que vai ser lançado e onde, para aprovar, editar ou descartar. Nada entra sem confirmação.
- **Ditado em todo lugar**: botão de microfone em todo campo de texto, com transcrição local.
- **Revisão de texto**: a IA revisa o que foi digitado ou transcrito e mostra o antes e o depois.
- **Aviso de envio sensível**: antes de mandar dados de saúde ou de terapia a um provedor externo, o programa avisa. A pessoa pode bloquear o envio desses módulos.

**Sobre a IA local.** É um download opcional, separado do instalador, para o programa continuar leve. Ao ativar, o Órbita avalia o computador e recomenda o modelo que cabe nele.

- **Na Onda 1**, a opção local é o **Ollama**, programa gratuito que a pessoa instala à parte; o Órbita detecta e conversa com ele. Embutir o modelo no próprio Órbita fica para depois, se fizer falta.
- GPT, Gemini, Grok, Sabiá e Ollama usam o mesmo formato de conexão; na prática são duas integrações: Claude e "compatível com GPT".
- As chaves de API ficam dentro do banco criptografado do Órbita (só abrem com a senha, o PIN ou o Windows Hello), nunca em texto aberto, e nunca voltam para a tela. Vão junto no backup, que também é criptografado. (Antes: "no cofre do Windows"; mudou na etapa 14, ver `docs/decisoes/0007-ia-provedores.md`.)

**Como ficou na Onda 1 (etapa 14).**
- **Ajustes > Inteligência artificial (opcional)**: adicionar provedores (Claude, GPT, Gemini, Grok, Sabiá, Ollama ou outro compatível), colar a chave, **conferir** (o Órbita pede a lista de modelos, o que testa a chave sem gastar créditos) e escolher o modelo. Cada provedor mostra o modelo e os quatro últimos caracteres da chave.
- **Provedor e modelo por função**: quebrar tarefas, conversa e revisão de texto. O primeiro provedor cadastrado vale para todas; dá para trocar ou escolher "não usar IA". Desde a 0.22.2, cada função também escolhe o modelo, numa lista buscada na conta da pessoa (sem gastar créditos); sem escolha, vale o modelo padrão do provedor.
- **Ollama**: sem chave; o Órbita lê a memória do computador e diz que tamanho de modelo deve rodar bem.
- **Planejar com a IA** (antes "Sugerir passos com IA"; virou conversa em novembro/2026, pedido de Dan): no botão do projeto, no menu de cada etapa e no mapa mental. Abre uma janela com **conversa** de um lado e **proposta** do outro (em tela estreita, iPad em pé ou celular, uma embaixo da outra).
  - **Conversa**: caixa de texto com o microfone do ditado (e Ctrl + Enter para enviar). A pessoa conta o que quiser; dá para pedir uma proposta sem escrever nada. Depois continua a conversa ("junta 2 e 3", "falta divulgação") e a IA devolve a proposta revisada.
  - **O que vai para a IA**, a cada mensagem: o nome do projeto, as **Anotações** (ou, em projeto vindo de ideia que nunca editou as anotações, a nota da ideia, como a tela mostra; até 6 000 caracteres), o "onde parei" (texto e próximo passo), as etapas e subtarefas que já existem com o estado de cada uma, a **proposta atual já com as mudanças feitas à mão** (só o que está marcado) e a conversa (as 20 falas mais recentes). Nada fica guardado no provedor: cada pedido leva tudo de novo.
  - **Aviso discreto** dentro da janela, sem alerta: "Vai para [IA]: o nome, as anotações, o onde parei, as etapas e o que você escrever aqui." e "Cada mensagem usa a sua chave de IA." Com IA local, diz que nada sai do computador. O aviso de **dado sensível** continua como nas outras funções: se o projeto ou a conversa parecem falar de saúde ou terapia, avisa antes de enviar (uma vez por conversa) e, com o bloqueio ligado, não envia.
  - **Proposta**: etapas com subtarefas, validada na parte nativa (`src-tauri/src/ia/planejar.rs`): até 12 etapas, até 10 subtarefas cada, até 120 caracteres por item, e uma frase curta opcional explicando (até 300). Resposta em formato errado vira "A IA respondeu num formato que o Órbita não entendeu. Tente de novo." com o botão **Tentar de novo**.
  - Duas formas, alternáveis (a escolha fica lembrada no aparelho): **Lista**, editável (mudar texto, desmarcar, apagar, acrescentar etapa ou subtarefa; desmarcar a etapa tira as subtarefas dela), e **Mapa**, uma árvore simples só de leitura com o projeto no começo, as etapas e as subtarefas marcadas. O leitor de tela anuncia quando chega uma proposta nova.
  - **Nada é gravado até "Aprovar e criar"**, que cria as etapas e subtarefas marcadas no fim do projeto. Depois a janela diz o que criou e oferece **Desfazer** (apaga o que acabou de criar, com as subtarefas) e **Fechar**. Se der erro no meio, o que já foi criado também pode ser desfeito.
  - **Numa etapa**, a mesma janela propõe passos que viram subtarefas dela, sem nível a mais (o Órbita tem dois níveis).
  - Usa o provedor e o modelo escolhidos para a função "Quebrar tarefas em passos". Na versão de navegador a IA ainda não existe, então o botão não aparece.
- **Erros em linguagem simples**: chave recusada, limite ou créditos, modelo não encontrado, sem internet, Ollama fechado, demora.
- **Bloqueio de dados sensíveis** em Ajustes, já conferido na parte nativa; passa a valer quando a conversa (etapa 15) e os módulos de saúde (Onda 2) existirem.

**Como ficou na Onda 1 (etapa 15).**
- A "janela de conversa" virou o botão **Separar com IA** dentro de **Capturar** (Ctrl + Alt + Espaço, de qualquer tela). Assim a captura continua igual para quem não usa IA, e quem usa escreve tudo de uma vez no mesmo lugar. Uma conversa de várias mensagens fica para depois, se fizer falta.
- A IA separa o texto em **ideias, tarefas de projetos ativos e compromissos** (com dia e, se a pessoa disse, hora). Vão junto só a data de hoje e os nomes dos projetos ativos.
- **Confira antes de guardar**: cada item pode ser desmarcado, editado, trocado de tipo, de projeto ou de dia. Tarefa sem projeto ou compromisso sem dia não deixam guardar até a pessoa decidir. A parte nativa confere tudo o que a IA devolve: data ou hora inválida, tipo desconhecido ou compromisso sem dia viram ideia, para nada se perder.
- **Aviso de dado sensível**: se o texto parece falar de saúde ou terapia e o provedor é de fora do computador, o Órbita avisa antes de enviar e oferece guardar como ideia, sem IA. Com o bloqueio ligado em Ajustes, não envia. A detecção é por palavras e, na dúvida, avisa.

**Como ficou na Onda 1 (etapa 16).**
- **Ditado local** com o whisper.cpp, embutido no Órbita. O modelo de voz é baixado à parte, em Ajustes > Ditado: **Rápido** (142 MB) ou **Mais preciso** (466 MB, recomendado com 8 GB de memória ou mais). O download é conferido pela soma publicada pelo whisper.cpp; arquivo diferente é descartado. Fica só um modelo no disco; dá para trocar ou remover.
- **Microfone em todo campo de texto** (menos senhas e números): o botão dentro do campo ou **Ctrl + Shift + M** começa e para; **Esc** cancela. Enquanto grava, o botão fica na cor de destaque e uma linha escrita diz o que está acontecendo, sem piscar nem som. A transcrição é feita no computador, em português; a voz não sai do aparelho. Gravação de até 5 minutos por vez.
- Silêncio não vira texto: se o áudio não tem som suficiente, o Órbita diz que não ouviu e lembra da permissão de microfone do Windows (o whisper costuma "inventar" frases quando recebe silêncio).
- Depois de ditar: **Desfazer o ditado** e, se houver IA escolhida para a revisão, **Revisar com IA**, que mostra **como está e revisado** lado a lado; a pessoa escolhe. Texto que parece de saúde ou terapia passa pelo mesmo aviso da etapa 15.
- Por enquanto o ditado grava só no Windows; Mac e celular entram na Onda 3.
- **Velocidade** (0.16.1, depois do teste de Dan): falas curtas usam uma janela de áudio do tamanho da fala em vez dos 30 s fixos do whisper, sem marcas de tempo e sem refazer a decodificação; o whisper.cpp é compilado para processadores comuns (AVX2). Depois de ditar, o Órbita mostra quanto tempo levou.

**Como ficou na Onda 1 (etapa 17, fechamento).**
- **Bandeja do sistema**, opcional (Ajustes > Janela e bloqueio): fechar a janela só a esconde; o ícone perto do relógio abre, captura e sai. Na primeira vez, uma notificação explica onde o Órbita ficou. Sem a bandeja, fechar fecha, como antes.
- **Bloqueio automático**, opcional (nunca, 5, 15, 30 minutos, 1, 2, 4 ou 8 horas, 1, 3 ou 7 dias sem mexer no mouse nem no teclado; de 1 dia para cima aparece um aviso de que o aparelho fica aberto por dias). Conta pela hora do último uso, não por timer longo. Desligado por padrão. Não bloqueia com o timer de foco correndo. A tela de desbloqueio diz que foi o bloqueio automático e que nada se perdeu.
- **Backup testado** com todo tipo de dado: salvar, apagar e restaurar em outro lugar.
- **Revisão dos sete princípios** e lista do que testar no Windows: `docs/revisao-onda-1.md`.

- Peso aproximado: um modelo pequeno ocupa de 2 a 5 GB em disco e precisa de 8 GB de memória ou mais para rodar bem; a transcrição local ocupa de 142 MB a 466 MB, conforme o modelo de voz escolhido.
- Uso indicado: lançar itens a partir da conversa, organizar, resumir e revisar texto.
- Limite: é mais lento e menos capaz que Claude, GPT ou Gemini em conversas longas ou complexas.
- No mobile, a IA local fica para depois; lá a pessoa usa a chave de um provedor.

## Arquitetura técnica

Uma base de código única gera todas as versões. O Windows vem primeiro; Mac, Android e iOS saem do mesmo código depois.

| Camada | Proposta | Por quê |
| --- | --- | --- |
| Aplicativo | Tauri 2 | Uma base para Windows, Mac, Android e iOS; instalador leve |
| Interface | React + TypeScript + Vite; React Aria (componentes acessíveis) e dnd-kit (arrastar com teclado) | Excalidraw e React Flow são em React; acessibilidade por teclado pronta; temas em variáveis CSS, independentes do React |
| Banco de dados | SQLite local criptografado (SQLCipher, pela parte nativa em Rust) | Funciona sem internet; arquivo único fácil de fazer backup |
| Transcrição de voz | Modelo local (Whisper, baixado à parte) | Áudio não sai do aparelho |
| Instalador | GitHub Actions monta o instalador do Windows a cada etapa | Dan testa sem instalar ferramentas de programação |
| Repositório | GitHub privado | Histórico, backup e decisão sobre código aberto no lançamento |
| Construção | Claude Code | Repositório, testes e commits; concepção e design ficam no chat |

**Estrutura de dados.** Todos os módulos compartilham alguns tipos básicos: item (ideia, projeto, tarefa, leitura), evento (agenda), registro (energia, sintoma, gasto, sessão) e anexo (imagem, arquivo, link). Cada tipo tem etiquetas e ligações com outros itens. É isso que permite ver os mesmos dados em várias visualizações e conectar os módulos.

**Cofre de valores.** `valores(chave, json)` para dados pequenos de módulo, dentro do banco criptografado (na tabela `config`, com o prefixo `valor:`, que a interface não consegue ultrapassar), no backup e na exportação JSON. Rotinas (`rotinas.personalizacao`, `rotinas.feitos`), Foco (`foco.salvos`), Energia (`energia.contas`, `energia.corpo`), Leitura (`leitura.estante`), mapa mental dos projetos (`projetos.mapa.<id>`) e Estudos (`estudos.extras`) usam. Dado pessoal nunca fica no `localStorage`; o que estava lá migra sozinho para o cofre na primeira leitura e sai de lá.

**Preparado para sincronizar.** Desde a Onda 1, todo registro tem identificador único, data de alteração e exclusão marcada (em vez de apagar de fato). Isso deixa a sincronização da Onda 3 possível sem refazer o banco.

**Estrutura de pastas.**

```
apps/desktop/        o app (interface em src/, parte nativa em src-tauri/)
packages/nucleo/     modelo de dados comum
packages/temas/      motor de temas e fundos, limpeza de SVG, contraste
packages/leitor/     motor de leitura EPUB/PDF, em TypeScript puro, sem React (Onda 2)
packages/caderno/    caderno infinito (Onda 2)
docs/                especificação e registro de decisões
```

**Pacotes compartilhados.** O motor de leitura (e, se possível, o motor de temas e o caderno) fica em pacotes separados dentro do repositório, para poder ser reaproveitado no leitor da Arcano 3 e no Escuta sem depender do Órbita inteiro.

- **Escuta**: Electron, interface em React escrita em JavaScript (não TypeScript), empacotada com Vite, cofre cifrado por senha. Como o Electron usa o mesmo navegador por dentro (Chromium) que o Órbita no Windows, o motor de leitura escrito em TypeScript puro roda lá sem adaptação. O pacote é entregue já convertido em JavaScript, com as descrições de tipos à parte, para o Escuta usar sem precisar de TypeScript. O motor de temas, por usar variáveis CSS, também serve ao Escuta.
- **Arcano 3**: o sistema atual é só de automação e o site está no início; não pesa nas decisões agora.
- **Identificador do app**: `br.com.arcano3.orbita`.

**Distribuição.** No Windows e no Mac, instalador próprio com botão de atualização. **Feito no Windows (versão 0.20.0)**: instaladores assinados publicados no repositório público `orbita-versoes`; em Ajustes > Atualizações, "Procurar atualização" mostra o que mudou, com "Instalar agora" e "Agora não"; ao abrir, o Órbita só avisa (opção que dá para desligar). Detalhes em `docs/decisoes/0009-atualizacao.md`. No mobile, as lojas exigem conta de desenvolvedor: a Apple cobra cerca de US$ 99 por ano e a Google, uma taxa única de US$ 25 (valores a confirmar). Uma versão web instalável é a alternativa sem custo.

**Versão de navegador (teste no iPad, adiantada da Onda 3; versão 0.44.4).** Para Dan testar no iPad sem custo, o mesmo app roda no navegador e vira um app na tela de início ("Adicionar à Tela de Início": ícone e tela cheia). Decisões:
- **Mesmos dados, mesma proteção do Windows, só que no aparelho.** Liga com `VITE_ORBITA_WEB=1` no build. A chave dos dados é aleatória e fica trancada pela senha (opcional), pelas 6 palavras (sempre) e pelo aparelho (PIN ou abrir direto), com a criptografia do próprio navegador (PBKDF2-SHA-256 e AES-GCM). Os dados ficam trancados no armazenamento do navegador (IndexedDB). Código em `apps/desktop/src/web/`.
- **Os dados não se encontram com os do Windows** até a sincronização da Onda 3, mas **o backup é o mesmo arquivo nos dois lados** (etapa 1 da sincronização, 02/11/2026): um backup feito no Windows abre no navegador e um feito no navegador abre no Windows, com a senha ou as 6 palavras. Formato no item "Backup" (seção de segurança, logo antes de "IA e assistente"). O navegador roda o mesmo banco do Windows (`crates/motor-web`, decisão 0011); o banco fica em memória e é guardado trancado (AES-GCM) no IndexedDB. Backups antigos do navegador (JSON `orbita-backup-web` versão 2) continuam abrindo aqui; os do Windows anteriores à 0.46 (versão 1, com SQLCipher dentro) só abrem no Windows: basta fazer um backup novo lá depois de atualizar.
- **Nada muda sem aviso:** um service worker guarda cada versão; o app continua na versão de agora, inclusive sem internet, até a pessoa aceitar a nova pelo aviso de atualização (com o que mudou).
- **Publicação:** em `https://danielsampaiorodrigues.github.io/orbita-versoes/app/`, na subpasta `app/` da mesma branch do GitHub Pages que serve a página inicial e a de privacidade (`claude/orbita-setup-planning-cfbqzz` do repositório público `orbita-versoes`; trocar essa fonte derruba as páginas exigidas pelo Google). Disparada à mão no workflow (escolha "navegador"), só na máquina Linux. Vão só os arquivos prontos; o código-fonte continua privado.
- **Endereço e dados:** o navegador guarda os dados por endereço (domínio). Se um dia o app mudar para um domínio próprio, os dados do iPad não vão sozinhos: passam pelo backup (ou pela sincronização, quando existir).
- **Ainda não existe no navegador:** IA (avisa e pede para usar no Windows), ditado do computador (no iPad, usa-se o microfone do teclado), backup automático numa pasta e lembretes com o app fechado. Livros EPUB/PDF funcionam desde a 0.46.0 (o arquivo vira anexo dentro do banco, até 25 MB por livro).
- **Cartão "Instalar o Órbita" (0.45.0):** só no navegador e só enquanto o app não está na tela de início. Aparece uma vez por visita; "Agora não" esconde por 7 dias, "Não mostrar mais" esconde para sempre. No iPhone/iPad explica Compartilhar → Adicionar à Tela de Início; em outros navegadores usa o botão nativo de instalar quando existe.
- **Publicação sem minutos do Actions:** o build web pode ser feito na sessão e copiado para `app/` da branch do Pages (feito assim na 0.45.0).

**Decisões da versão 0.45.0 (29/10/2026, lista de falhas e melhorias de Dan, testada no iPad):**
- **Navegação:** setas de voltar/avançar com 44 px e traço grosso; entre elas, um botão abre a lista das últimas telas (segurar "voltar" também abre). Pular para uma tela do histórico não apaga o "avançar".
- **Menu lateral organizável:** no modo organizar do Início, o menu aceita reordenar (arrastar/subir/descer) e esconder seções; `prefs.menu = { ordem, ocultos }`, validado como `inicio`. Travadas (nunca escondidas): `inicio`, `aparencia` (saída rápida do baixo estímulo) e `ajustes`. Seção escondida continua acessível por atalho e histórico.
- **Início:** "Organizar a tela inicial" oferece um bloco-atalho para cada módulo. Atalhos novos entram **escondidos** (princípio 1: nada muda sem a pessoa pedir).
- **Hobbies:** cartões com `React.memo`, traço em andamento direto no canvas, miniatura de até 720 px guardada junto do original, áudio como objectURL na sessão e no formato que o aparelho grava (WebM/MP4); personalização de fundo e de cartão guardada junto do desenho do quadro (sem campo novo no Rust); grade 8 px; zoom 40–250 %; pressão da Pencil no desenho. Fora: zoom lembrado; ícones de lupa/menos.
- **Saúde:** abas Hoje / Remédios / Histórico / Planos e consultas; registro rápido em uma tela; gatilhos sensoriais gravados na primeira linha da nota ("Gatilhos: …", sem mudar o banco; os criados pela pessoa reaparecem a partir dos registros dos últimos 6 meses); consultas usam os profissionais do Cuidado (sem lista separada). Fora: consulta virar evento da Agenda com lembrete.
- **Cuidado:** consulta marcada pode virar compromisso de dia inteiro na Agenda (interruptor ligado por padrão; marca `[cuidado:<id>]` nas notas evita duplicar; mudar/tirar a data atualiza lá). Próxima consulta em destaque no cabeçalho, três blocos literais, "já falado" recolhido, botão fixo "Quero lembrar de falar disso". A frase "consultas entram na Agenda com lembrete" foi removida por não ser verdade.
- **Estudos:** nível escolhido (fundamental, médio, técnico, graduação, pós, curso livre, ou "do meu jeito": nome próprio + período/vocabulário/notas/créditos/pesquisa escolhidos pela pessoa) adapta vocabulário e abas; Esta semana; bimestres; créditos/semestre; aba Pesquisa na pós. Leitura grava como "dever" e entrega como "trabalho" no banco, com o tipo real nos extras. Extras vão para o cofre de valores (`estudos.*`); etapa futura: campos próprios no Rust.
- **Ideias/Projetos:** mapa mental em tela livre (pan, pinça, Ctrl+roda; arrastar com pointer events, dedo com 150 ms; setas movem o item, Tab navega; alça cria ligação real via `ligarItens`, não muda o pai — falta comando Rust para isso); quadro com sensores unificados (`projetos/sensores.ts`); "Onde parei" no topo do projeto com tempo relativo; progresso sem porcentagem. Posições do mapa vão para o cofre de valores.
- **Dinheiro:** três abas (Este mês / Planejar / Entender); entradas de dinheiro (`registrar_entrada`, `listar_entradas`, `excluir_entrada`, tipo `entrada` na tabela de registros); gasto com `momento` e `nota`; tabela explícita com cabeçalho e coluna fixos. "Saiu" = gastos + contas fixas (conta paga registrada também como gasto conta duas vezes — decisão pendente de Dan). Fora: editar gasto/entrada, entradas no CSV/JSON.
- **Leitura:** posição de leitura e ajustes do leitor no cofre de valores (`leitura.config`, `leitura.posicao.<id>`); estante de capas (grade 2–7 por linha), capa gerada por título (cor + textura; cor escolhida tem prioridade), prateleiras editáveis e reordenáveis, arrastar com dnd-kit, "Continuar lendo" no topo, progresso informado à mão. Fora: capa extraída do EPUB (motor não tem), busca/filtro, ordem manual dentro da prateleira.
- **Minha organização:** cartões compactos em grade na página principal; cor inteira em quadro, coluna e cartão (10 tons, versão clara e escura, texto por contraste calculado, ≥ 4,5:1; no baixo estímulo as cores ficam apagadas); arrastar com dnd-kit (toque: segurar 150 ms). Desde 02/11/2026, como no Trello: vista Quadro/Lista trocável, cartão completo (descrição, checklists, etiquetas do quadro, data e hora, anexos, capa), fundo, filtro, arquivados e coluna recolhida — tudo no campo `dados` do item, sem migração de banco (ver a seção do módulo). Fora: arrastar colunas, compartilhar quadro.
- **Agenda:** cor por compromisso (mesma paleta das etiquetas; faixa lateral + fundo tingido a 13%; texto na cor do tema). A cor é guardada junto das notas no banco nativo, sem mudar a estrutura. Não vai para o `.ics`.
- **Rotinas:** cor, ícone/emoji, dias da semana e horário sugerido por rotina; progresso de hoje sem culpa. **Pendência:** por enquanto guardado só no aparelho (fora do cofre e do backup) — falta o lado Rust guardar esses campos.
- **Foco:** quatro mostradores (disco, ponteiro, ampulheta, barra) e focos salvos (nome, foco, pausa). **Pendência:** focos salvos fora do cofre e do backup até existir o comando Rust.
- **Energia:** pesquisa em `docs/pesquisa-energia.md`, com as 8 propostas feitas: "o que gasta / o que repõe" com saldo neutro e sugestão de reposição; "meus sinais de sobrecarga" com "Estou sentindo isso" → baixa energia; **"Como está o corpo?"** (preferência `lembreteCorpo`: desligado, 1 h, 2 h ou 3 h; desligado por padrão; faixa discreta no canto, nunca notificação do sistema nem som, sem roubar o foco, ainda mais apagada no baixo estímulo; só conta o tempo com o cofre aberto e não conta as horas com o computador dormindo; botões água, comida, banheiro, pausa e "Agora não"; o que é marcado vai para o cofre em `energia.corpo`); **semana em saldo** (7 linhas em palavras, sem gráfico e sem vermelho; com 3 dias seguidos gastando mais, uma frase gentil sugerindo reposição; hoje sem marcação não quebra a sequência); **kit de recuperação sensorial** (lista pessoal com ideias de um toque, "Usar agora" anota o uso e a sugestão de reposição passa a considerar o kit; aparece também no modo baixa energia; aponta para as estratégias da Saúde pelo atalho do plano de crise, sem copiar dados); **custo da camuflagem** (pergunta opcional nada / um pouco / muito no "gasta e repõe"; aparece como marca na semana; por decisão, **não** entra na conta do saldo); **dias pesados à vista** (lê a Agenda dos próximos 7 dias, hoje incluso; dia com 3+ compromissos ou 2+ dias seguidos com 2+ geram um aviso neutro; blocos da semana-modelo não contam; não cria nada na Agenda); **levar para a terapia** (só quando a pessoa pede: 2, 3 ou 4 semanas em Markdown com saldo de cada dia, energia média, camuflagem, sinais sentidos e kit usado; mostra o texto antes, copia ou salva em arquivo; aviso literal de que nada sai do aparelho sozinho). Kit, usos do kit e camuflagem ficam em `energia.contas`.
- **Aparência (redesenho):** abas Tema/Fundo/Letras/Tela/Baixo estímulo, prévia ao vivo fixa, saída rápida no topo; coleção "Rua" com 11 fundos SVG determinísticos em `packages/temas/src/urbanos.ts` (versão tinta p/ claro, neon suave p/ escuro; lisos no baixo estímulo; contraste medido nos pixels); 6 fontes extras via `@fontsource` (só latino, +599 KB carregados sob demanda, em `fontes/extras.css` e `fontes/catalogo.ts`). Pendência: lista de fontes do Caderno ainda com as 3 antigas.
- **Aparência:** editor de tema abre no modo atual (claro/escuro); imagem própria de fundo vai para o IndexedDB (limite 8 MB), não para as preferências.
- **Ajustes:** menu curto por assuntos (8 entradas, busca, duas colunas quando a página tem ≥ 736 px de largura, seção lembrada na sessão); bloqueio automático até 7 dias (aviso literal a partir de 1 dia; contagem por carimbo de tempo, vale em segundo plano); limite de projetos ativos de 1 a 50 (padrão 6), nos Ajustes e em Projetos.
- **Caderno (revisão grande):** seleção própria (marquee, Shift, alças, teclado), pressão real da caneta no motor (`packages/caderno`: antes fingia pela velocidade), texto sem caixa, grupos, camadas por nível, régua com ângulo/unidade, borracha por pedaço ou objeto (pega imagens), formas estendidas e seta com conector (prende na caixa do objeto, não no contorno), "escrever só com a caneta" (liga sozinha ao detectar caneta), pinça 50–400 %, rolagem lateral, painel de configurações do Caderno (localStorage, não sensível). Lógica de edição sem tela em `caderno/edicao.ts`.
- **Caderno:** traços e folhas em cache (cor marca na hora); botão "+ Página" e página nova ao rolar além da última; no Safari, após a primeira Pencil, dedo rola e caneta escreve.
- **Em espera (INPI):** endereço `orbita.arcano3.com.br` e login com Google.

**Decisões da versão 0.45.2 (29/10/2026, Caderno depois do teste da 0.45.1 no iPad com Apple Pencil):**
- **Rejeição da palma:** com "só caneta" ligado, nenhum toque rola nem dá zoom enquanto a caneta encosta e por 600 ms depois que ela levanta; toque com área de contato > 30 px (palma, `Touch.radiusX/Y`) nunca rola nem dá zoom; com a mão apoiada na folha, um segundo dedo também não dá pinça. A caneta é acompanhada por eventos de ponteiro (`pointerType: "pen"`) e, no Safari, por `touchType: "stylus"`.
- **Cadeado "Travar a folha"** (na barra de ferramentas e na engrenagem, lembrado em `caderno-trava`): desliga rolagem e zoom por toque (`touch-action: none` na área inteira); só a caneta escreve (o dedo não risca). Para navegar: setas de página e "Página N" na barra de cima, o índice, teclado e roda do mouse.
- **"Só caneta" ligado por padrão em tablet e celular** (iPad inclusive: Macintosh + toque); notebook com tela de toque fica desligado. A escolha da pessoa vale.
- **Barra de ferramentas:** uma pílula flutuante única nas quatro posições (52 px de espessura, cantos redondos, sombra leve, 10 px da borda, centralizada no lado; rola por dentro se não couber). Opções da ferramenta (pincéis, formas, borracha, texto, seleção, seta) abrem num **painel flutuante ao lado da barra**, com "Ajustes" e fechar; tocar de novo na ferramenta abre/fecha o painel. Caneta, lápis e marca-texto continuam: tocar de novo abre os ajustes.
- **Alça de arrastar** (seis pontinhos) numa ponta da barra: arrastar até um lado mostra uma faixa tracejada "Solte para pôr a barra aqui"; toque simples passa para o próximo lado; pelo teclado, setas escolhem o lado. Ferramentas com painel têm um ▸ no canto. Na primeira vez, um balão explica (lembrado em `caderno-dica-barra`).
- **Página nova ao puxar:** depois da última página, um "fantasma" tracejado da página nova cresce com o puxão (sem animação, só o tamanho acompanha); passando de 85 % e soltando (ou parando a rolagem), cria; voltando antes, não cria. Última página vazia continua impedindo criar outra.
- **Lápis:** a pressão da Pencil ganha um piso (35 %): encostar de leve fica mais fino, mas não some (era a "falha"). Desenho em duas camadas (borda mais clara, miolo mais escuro), contínuo.
- **Modelos de pincel** no motor (`packages/caderno/src/pinceis.ts`): redondo, giz, spray, pincel seco, aquarela e caneta caligráfica. O traço guarda `pincel?` e `semente?` (traços antigos = redondo); as texturas são determinísticas (sorteio com semente; borda por ruído fixo de posição), e o começo do traço não muda enquanto ele cresce. Cada traço vira camadas SVG (`desenhoDeTraco`), em cache por traço (WeakMap). Prévia de cada modelo no painel.
- **Pastas da estante:** desenho 3D em SVG (aba, papel aparecendo, frente inclinada, gradiente e sombra suaves), do tamanho de um caderno na grade, com **cor por pasta** (10 tons suaves, `PastaCaderno.cor`, guardada em `dados` no banco; pastas antigas = areia). O nome fica embaixo, na cor de texto do tema. No baixo estímulo, a pasta fica chapada (sem gradiente, brilho nem sombra).

## Ondas de construção

A arquitetura nasce completa, mas a construção vem em quatro ondas. As duas primeiras entregam o programa completo no Windows; Mac e mobile só entram depois dos testes. Cada onda só começa quando a anterior passa pelo seu portão.

1. **Onda 1 · Base e coração (Windows)**
   - Base: banco criptografado, **backup básico** (salvar e restaurar), motor de temas e fundos (com SVG), as cinco visualizações.
   - Módulos: Ideias e projetos, Tempo e rotina, Energia; IA, conversa e ditado.
   - **Marco "mínimo usável"** no meio da onda (captura, projetos, lista e kanban): Dan começa a usar no dia a dia antes do fim.
   - Mapa mental e linha do tempo ficam no fim da onda e podem passar para a Onda 2 se atrasarem o uso diário. (Feitos na etapa 13.)
   - Portão: Dan usa no dia a dia por algumas semanas e aprova. (Onda 1 construída na versão 0.16.0; portão em andamento.)
2. **Onda 2 · Vida prática (Windows)**
   - Módulos: Dinheiro, Saúde, Cuidado psicológico e psiquiátrico.
   - Vida acadêmica, Hobbies, Caderno infinito, Leitura; exportação em formatos abertos.
   - Portão: grupo de teste neurodivergente usa e aprova.
3. **Onda 3 · Mac e mobile**
   - Versões Mac, Android, iOS e iPad a partir do mesmo código.
   - Sincronização opcional entre aparelhos, criptografada de ponta a ponta.
   - Integração com Apple Saúde e Health Connect (relógios inteligentes).
   - Portão: estável em todas as plataformas.
4. **Onda 4 · Lançamento e comunidade**
   - Distribuição gratuita, página do projeto, galeria de temas da comunidade.
   - Decisão sobre código aberto.

**Critério de pronto de toda onda**

- Funciona sem internet e sem perder dados ao fechar o programa.
- Respeita os sete princípios de design.
- Tem atalhos de teclado e funciona no modo baixo estímulo.
- Backup testado: salvar, apagar e restaurar.

## Decisões em aberto

Já decidido (25/10/2026): interface em React; backup básico na Onda 1; senha forte com PIN no dia a dia e chave de recuperação de 6 palavras; sem recuperação por e-mail ou SMS; (atualizado no mesmo dia: senha passa a ser opcional e a recuperação pode ficar na conta Google ou Microsoft da própria pessoa, sem servidor do Órbita; ver "Menos burocracia"); IA local via Ollama na Onda 1.

Já decidido: o crédito de US$ 250 do Claude na nuvem será usado neste projeto e no Prelo; a IA entra com escolha de provedor; o nome é Órbita.

- [ ] Consultar o nome Órbita no INPI (classes 9 e 42), antes de configurar o endereço e o login do Google. Busca na internet (29/10/2026): nenhum app de organização pessoal chamado "Órbita" em português; existem a Orbita (empresa americana de assistentes de saúde por IA) e um projeto de código aberto em inglês. "Orbi" está mais ocupado (planejador com IA para iPhone, de 2026, e o Wi-Fi da Netgear).
- [ ] Código aberto ou não, decidido no lançamento.
- [ ] Motor de temas compartilhado com o Escuta ou totalmente separado.
- [ ] Qual modelo local oferecer como opção sem chave.
- [ ] Grupo de teste diverso (autistas, TDAH, dislexia, altas habilidades) a partir da Onda 2.
- [ ] Lojas de aplicativo ou versão web instalável para o mobile. Atenção: a integração com Apple Saúde e Health Connect só funciona em app nativo de loja; a versão web não acessa esses dados.
- [ ] Onde hospedar os instaladores e a página de doação.
- [ ] Como o Escuta vai receber o motor de leitura (dependência direta do repositório no GitHub ou pacote privado), decidido na Onda 2.
- [ ] Assinatura digital do instalador do Windows (até lá, o Windows mostra um aviso ao instalar).
- [x] Sincronização: pasta da própria pessoa no Google Drive, sem servidor do Órbita; edições em dois aparelhos sem internet: vale a mais recente. Ver "Entrar com Google e sincronizar" (29/10/2026).
