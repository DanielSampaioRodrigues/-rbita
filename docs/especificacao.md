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
7. **Acessibilidade sensorial e cognitiva.** Fontes para dislexia, densidade ajustável, contraste garantido, atalhos de teclado para tudo e linguagem simples e literal, sem ironia nem metáforas ambíguas.

**Textos da interface são literais.** Nomes como "estacionamento de ideias" e "hibernação" valem neste documento; na tela, os botões e títulos usam termos literais, como "Guardar para depois" e "Pausar projeto". Tudo que pode ser arrastado também pode ser movido pelo teclado.

## Módulos

São dez módulos sobre uma base comum: o mesmo item pode aparecer em lista, kanban, mapa mental, linha do tempo ou calendário, e os módulos se conectam entre si (um remédio do módulo de saúde aparece na agenda; uma leitura acadêmica vira projeto).

### 1. Ideias e projetos (o coração)

- **Captura rápida** de ideias por texto ou voz, com transcrição local.
- **Estacionamento de ideias**: a ideia fica guardada sem virar compromisso até a pessoa decidir.
- **Limite de projetos ativos**, definido pela pessoa. Ao passar do limite, o programa pede para hibernar outro.
- **Hibernação sem culpa** com **cartão "onde parei"**: em que ponto estava, próximo passo, arquivos e links.
- Etapas, subtarefas e quebra de tarefas grandes em passos pequenos (com ajuda de IA opcional).
- Visualizações: lista, kanban, mapa mental, linha do tempo e calendário.

**Como ficou na Onda 1 (etapas 5 a 7).**
- **Capturar**: botão no topo da barra lateral e atalho **Ctrl + Alt + Espaço**, que funciona de qualquer programa, mesmo com o Órbita minimizado. Se o Órbita estiver bloqueado, a captura abre logo depois de desbloquear. Tudo capturado vai para **Ideias** (o "estacionamento").
- **Ideias**: guardar, editar, excluir e **virar projeto** (o texto vira o título; a ideia fica ligada ao projeto).
- **Projetos**: estados **ativo, pausado e concluído**. Limite de ativos definido pela pessoa (padrão 3, de 1 a 20). Ao esbarrar no limite, o Órbita mostra os ativos para pausar um, oferece mudar o limite ou, para projeto novo, criar já pausado. Nunca passa por cima do limite sem a pessoa decidir.
- **Cartão "onde parei"** em todo projeto, editável a qualquer hora: em que ponto estava, próximo passo e links. Ao pausar, o Órbita oferece anotar (tudo opcional).
- **Início** abre com "Continuar de onde parei": os projetos ativos com o próximo passo de cada um.
- **Tarefas** em dois níveis (etapas e subtarefas), estados a fazer, fazendo e feita, ordem manual. Visualização em **lista** (caixas de seleção) ou **quadro** (colunas A fazer, Fazendo e Feito), com arrastar por mouse, caneta ou teclado, e um menu em cada tarefa com as mesmas ações.

### 2. Tempo e rotina

- Agenda diária e semanal visual, com semana-modelo.
- Rotinas passo a passo, com imagens ou ícones opcionais.
- Avisos de transição antes da troca de atividade.
- Timer visual de foco e de pausa.

### 3. Energia

- Registro rápido do nível de energia do dia.
- Planejamento por energia: tarefas marcadas como leves, médias ou pesadas.
- **Modo baixa energia**, que mostra só o essencial: remédio, comer, uma tarefa.

### 4. Dinheiro

- Contas recorrentes com aviso antecipado.
- Registro de gastos simples, por categoria.
- **Lista de espera de compras**, com prazo definido pela pessoa (por exemplo, 48 horas) antes de comprar.
- Gastos com interesses especiais visíveis, sem julgamento.
- Metas de reserva.

### 5. Saúde

- Medicação com confirmação de dose tomada, controle de estoque e aviso de receita vencendo.
- Consultas e exames com lembrete.
- Registro curto de sono, sintomas e sobrecarga sensorial.
- **Resumo para levar à consulta**, gerado a partir dos registros.
- **Plano de crise** para meltdown ou shutdown, escrito pela pessoa num momento bom: sinais, o que ajuda, com quem falar.
- **Integração com dados de saúde e relógios inteligentes** (Onda 3, só no app de celular):
  - **iPhone e Apple Watch**: Apple Saúde (HealthKit).
  - **Android** (Samsung, Xiaomi, Google, Fitbit e outros): Health Connect, que reúne os dados do Samsung Health, do Mi Fitness e de outros apps (compatibilidade de cada marca a confirmar). Garmin, se entrar, exige integração própria.
  - Dados úteis: sono, frequência cardíaca e variabilidade (como sinal possível de estresse e sobrecarga), passos e atividade, ciclo menstrual.
  - **Somente leitura**, com a pessoa escolhendo cada tipo de dado; tudo fica no aparelho e entra nos registros e no resumo para a consulta.
  - Os dados são apresentados como apoio à percepção da própria pessoa, nunca como diagnóstico nem alerta alarmista.
  - O computador recebe esses dados pela sincronização entre aparelhos; Windows e Mac não acessam o Apple Saúde nem o Health Connect diretamente.
  - Futuro: app no relógio para captura rápida, confirmação de remédio e avisos de transição discretos por vibração.

### 6. Cuidado psicológico e psiquiátrico

- Sessões de terapia e consultas psiquiátricas na agenda, com lembrete.
- **"O que levar para a sessão"**: anotações feitas durante a semana.
- Registro curto do que ficou de cada sessão.
- **Perguntas para o psiquiatra**, com histórico de medicação, doses e efeitos percebidos, ligado ao módulo de saúde.

### 7. Vida acadêmica

- Disciplinas, aulas, prazos, provas e trabalhos num calendário único.
- Leituras com status: a ler, lendo, fichada.
- Projetos longos (TCC, artigos) com o mesmo cartão "onde parei".

### 8. Hobbies e interesses

- Arquivo de interesses e hiperfocos, com notas, imagens e links.
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
- Base técnica: biblioteca de quadro livre de código aberto (por exemplo, Excalidraw) para o modo infinito, mais um motor de páginas para o modo caderno; entrada por caneta também no iPad e em mesas digitalizadoras.

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
- **Fontes**: Atkinson Hyperlegible Next (padrão), Lexend e OpenDyslexic, à escolha, todas embutidas no app. O espaçamento entre letras e linhas ganha destaque, porque tem evidência um pouco melhor que a troca de fonte.
- **Ícones**: Lucide, de traço fino e uniforme.
- **Preferências visuais fora do cofre**: fonte, tamanho, cores e baixo estímulo ficam num arquivo próprio, sem criptografia, porque a tela de senha precisa abrir já com a aparência da pessoa. Não são dados sensíveis.
- **Liberdade com uma trava**: a pessoa pode mudar fundo, cores, fontes, cantos, sombras, ícones e a disposição da tela inicial. A única trava é a legibilidade: se uma escolha deixar o texto ilegível, o Órbita ajusta o painel e avisa o que mudou, sem bloquear a escolha.

## Privacidade e dados

Os dados ficam no aparelho da pessoa, criptografados, e só saem dali se ela quiser. Isso pesa especialmente em saúde, dinheiro e cuidado psicológico.

- **Local-first**: o programa funciona inteiro sem internet e sem conta.
- **Criptografia** do banco de dados inteiro, com uma chave sorteada no aparelho. Essa chave fica trancada de três jeitos:
  - **senha** (mínimo de 12 caracteres; uma frase de 3 ou 4 palavras funciona bem), digitada raramente: na criação, em backups, em aparelho novo e quando o PIN falha;
  - **chave de recuperação**: 6 palavras sorteadas da lista padrão em português (sem acentos, reconhecidas pelas 4 primeiras letras), mais um **arquivo de recuperação**, para quem esqueceu a senha;
  - **jeito de abrir no dia a dia**, escolhido por aparelho: **Windows Hello** (digital, rosto ou PIN do Windows; padrão quando o computador tem), **PIN** (de 4 a 8 números; padrão quando não há Windows Hello), **senha** ou **abrir direto**. O Windows Hello, o PIN e o abrir direto usam um segredo guardado pelo Windows (Gerenciador de Credenciais): numa cópia do arquivo levada para outro computador, eles não servem. Depois de 5 erros seguidos de PIN, o Órbita pede a senha. Nada é apagado por tentativas erradas.
- **Recuperação sem servidor.** Não há recuperação por e-mail ou SMS: isso exigiria um servidor capaz de abrir os dados, contra a promessa de que os dados não saem do aparelho, e contra a LGPD no caso de dados de saúde e terapia. No lugar disso:
  - a chave pode ser salva em arquivo (pendrive, nuvem), impressa, copiada para o próprio e-mail ou entregue a uma pessoa de confiança;
  - pode ser vista de novo em Ajustes, com a senha;
  - as telas de recuperação são calmas, um passo por vez, sem tempo limite;
  - com a sincronização (Onda 3), um aparelho já aberto poderá criar uma senha nova para o outro.
- **Trava extra opcional** para os módulos de saúde e de cuidado psicológico.
- **Backup** em arquivo único criptografado (`.orbita-backup`), que a pessoa guarda onde quiser (pendrive, Drive, iCloud). Abre com a senha ou com as 6 palavras, em qualquer computador; PIN e Windows Hello não viajam no backup.
  - **Na hora**, por Ajustes, ou **automático** (opcional, desligado por padrão): ao fechar ou bloquear, uma vez por dia, numa pasta escolhida, guardando os últimos 7. Se o automático falhar, Ajustes mostra o motivo.
  - **Restaurar** confere a senha e o arquivo inteiro antes de mexer em qualquer coisa. Os dados atuais vão para uma pasta de segurança (`anteriores`), nunca são apagados. Na primeira tela há "Já tenho um backup do Órbita", para computador novo.
- **Exportação** dos dados em formatos abertos (por exemplo, CSV e Markdown), para ninguém ficar preso ao programa.
- **Sincronização entre aparelhos** só numa onda futura e sempre opcional, com criptografia de ponta a ponta.
- **IA opcional**: nenhuma função depende de IA. Se a pessoa ativar, ela sabe exatamente o que é enviado e para onde.
- Sem coleta de uso, sem anúncios e sem rastreamento. Alinhado à LGPD.

## IA e assistente

A IA é opcional e a pessoa escolhe o provedor que preferir. Nenhuma função depende dela.

- **Chave própria (API)**: Claude, GPT, Gemini, Grok e Sabiá. A pessoa cola a chave da própria conta, e o custo de uso fica com ela.
- **Opção local**: um modelo rodando no próprio computador, sem chave, sem custo e sem os dados saírem do aparelho.
- **Provedor por função**: dá para usar um na conversa e outro na revisão de texto.
- **Janela de conversa**: a pessoa fala ou escreve do jeito que vier ("tenho consulta quinta, preciso pagar a luz e tive uma ideia de livro"), e a IA separa e lança cada coisa no módulo certo.
- **A IA propõe, a pessoa confirma**: antes de gravar, aparece a lista do que vai ser lançado e onde, para aprovar, editar ou descartar. Nada entra sem confirmação.
- **Ditado em todo lugar**: botão de microfone em todo campo de texto, com transcrição local.
- **Revisão de texto**: a IA revisa o que foi digitado ou transcrito e mostra o antes e o depois.
- **Aviso de envio sensível**: antes de mandar dados de saúde ou de terapia a um provedor externo, o programa avisa. A pessoa pode bloquear o envio desses módulos.

**Sobre a IA local.** É um download opcional, separado do instalador, para o programa continuar leve. Ao ativar, o Órbita avalia o computador e recomenda o modelo que cabe nele.

- **Na Onda 1**, a opção local é o **Ollama**, programa gratuito que a pessoa instala à parte; o Órbita detecta e conversa com ele. Embutir o modelo no próprio Órbita fica para depois, se fizer falta.
- GPT, Gemini, Grok, Sabiá e Ollama usam o mesmo formato de conexão; na prática são duas integrações: Claude e "compatível com GPT".
- As chaves de API ficam no cofre do Windows, nunca no banco nem em texto aberto.

- Peso aproximado: um modelo pequeno ocupa de 2 a 5 GB em disco e precisa de 8 GB de memória ou mais para rodar bem; a transcrição local ocupa algumas centenas de MB (valores a confirmar na construção).
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

**Distribuição.** No Windows e no Mac, instalador próprio com botão de atualização. No mobile, as lojas exigem conta de desenvolvedor: a Apple cobra cerca de US$ 99 por ano e a Google, uma taxa única de US$ 25 (valores a confirmar). Uma versão web instalável é a alternativa sem custo.

## Ondas de construção

A arquitetura nasce completa, mas a construção vem em quatro ondas. As duas primeiras entregam o programa completo no Windows; Mac e mobile só entram depois dos testes. Cada onda só começa quando a anterior passa pelo seu portão.

1. **Onda 1 · Base e coração (Windows)**
   - Base: banco criptografado, **backup básico** (salvar e restaurar), motor de temas e fundos (com SVG), as cinco visualizações.
   - Módulos: Ideias e projetos, Tempo e rotina, Energia; IA, conversa e ditado.
   - **Marco "mínimo usável"** no meio da onda (captura, projetos, lista e kanban): Dan começa a usar no dia a dia antes do fim.
   - Mapa mental e linha do tempo ficam no fim da onda e podem passar para a Onda 2 se atrasarem o uso diário.
   - Portão: Dan usa no dia a dia por algumas semanas e aprova.
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

Já decidido (25/10/2026): interface em React; backup básico na Onda 1; senha forte com PIN no dia a dia e chave de recuperação de 6 palavras; sem recuperação por e-mail ou SMS; IA local via Ollama na Onda 1.

Já decidido: o crédito de US$ 250 do Claude na nuvem será usado neste projeto e no Prelo; a IA entra com escolha de provedor; o nome é Órbita.

- [ ] Consultar o nome Órbita no INPI.
- [ ] Código aberto ou não, decidido no lançamento.
- [ ] Motor de temas compartilhado com o Escuta ou totalmente separado.
- [ ] Qual modelo local oferecer como opção sem chave.
- [ ] Grupo de teste diverso (autistas, TDAH, dislexia, altas habilidades) a partir da Onda 2.
- [ ] Lojas de aplicativo ou versão web instalável para o mobile. Atenção: a integração com Apple Saúde e Health Connect só funciona em app nativo de loja; a versão web não acessa esses dados.
- [ ] Onde hospedar os instaladores e a página de doação.
- [ ] Como o Escuta vai receber o motor de leitura (dependência direta do repositório no GitHub ou pacote privado), decidido na Onda 2.
- [ ] Assinatura digital do instalador do Windows (até lá, o Windows mostra um aviso ao instalar).
- [ ] Sincronização (Onda 3): onde ficam os dados sincronizados (pasta da própria pessoa no Drive, OneDrive ou iCloud, sem servidor do Órbita; ou um servidor pequeno, mais simples no celular, com custo e manutenção) e como resolver edições feitas em dois aparelhos sem internet.
