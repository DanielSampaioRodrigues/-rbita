# O que falta implementar

25/10/2026 · versão 0.29.2. Lista feita comparando `docs/especificacao.md` com o que já existe. Riscar conforme for feito.

## 1. Pendências da Onda 1 (o que está pela metade)

- [x] **Atualização dentro do app**: procurar, ver o que mudou, instalar ou adiar (0.20.0). A 0.20.0 é instalada à mão uma última vez.
- [x] **Etiquetas e ligações em projetos e tarefas** (0.19.0).
- [x] **Anexos**: imagens, arquivos e links em ideias, projetos e tarefas, dentro do cofre (0.19.0).
- [x] **Rotinas com imagens** (0.19.0).
- [x] **Quadro de ideias com arrastar** entre colunas, também pelo teclado (0.19.0).
- [x] **Ícones do tema**: traço e pontas ajustáveis (0.19.0). Desenhar ícones próprios fica para a galeria da comunidade.
- [x] **Conversa com a IA**: pedir mudanças na lista separada pela captura (0.19.0).
- [x] **Auditoria automática de acessibilidade** (axe-core, WCAG 2.2 AA): sem problemas nos temas claro e escuro (0.19.0).
- [x] **Primeira configuração leve** (etapa A, 0.21.0): sem inventar senha; Windows Hello, PIN ou abrir direto, e as 6 palavras como recuperação. Senha opcional.
- [x] **Guardar a recuperação na conta Google** (etapa B, 0.22.0).
- [ ] **Conta Microsoft (OneDrive) no Windows**: o código está pronto; falta registrar o app na Microsoft. Conta pessoal não registra sem diretório: tentar o Azure for Students pelo pacote de estudante do GitHub, ou uma conta do Azure. Depois, guardar o ID em `ORBITA_MICROSOFT_CLIENT_ID` nos segredos do GitHub (passo a passo em `docs/configurar-contas.md`, parte 3).
- [ ] **Avaliar Dropbox e Nextcloud/WebDAV** como contas extras para a recuperação (tabela na especificação).
- [ ] **Testes de Dan no Windows** do que foi feito nesta rodada: ligar a conta Google (0.22.0) e ver a cópia em Ajustes; instalar do zero num computador ou usuário novo do Windows para ver a primeira configuração leve e o "trazer meus dados da minha conta"; PIN errado 5 vezes abrindo com as 6 palavras.
- [ ] **Teste com leitor de tela de verdade** (NVDA), de preferência com quem usa. Só dá para fazer no Windows. Primeira rodada de Dan (0.29.1): tudo leu, menos as opções de energia (corrigido na 0.29.2, falta reconferir). Falta a rodada com alguém que usa leitor de tela no dia a dia.
- [ ] **Portão da Onda 1**: Dan usar no dia a dia por algumas semanas e aprovar (lista em `docs/revisao-onda-1.md`).

## 2. Onda 2: vida prática (Windows)

Plano em etapas em `docs/plano-onda-2.md`.

- [ ] **Saúde** (começado na 0.30.0):
  - [x] Remédios com confirmação de dose, controle de estoque, aviso de receita vencendo e lembrete no horário (pela bandeja). Falta teste de Dan no Windows.
  - [x] Consultas e exames: por ora pela Agenda (um compromisso já avisa antes). Falta uma marcação própria de "consulta/exame" e o "resumo para a consulta".
  - [x] Registro curto de sono, sintomas e sobrecarga sensorial (0.31.0).
  - [x] Plano de crise acessível em 1 clique e por atalho (Ctrl+Shift+C) (0.31.0).
  - [x] Resumo para levar à consulta: junta remédios e registros do período, para copiar e colar (0.32.0). As perguntas entram com o módulo de Cuidado psicológico. Export direto em PDF/arquivo fica para a etapa de exportação (17).
- [ ] **Cuidado — reescrita como "meus profissionais de saúde"** (visão acordada 26/10/2026; a 0.33.0 entregou só três listas numa tela, que Dan achou raso):
  - [x] Base: "o que levar", "perguntas" e "o que ficou" numa tela só (0.33.0).
  - [ ] **Lista de profissionais** (não só psi: neuro, nutri, fisio...), cada um com nome, especialidade e contato. Fronteira decidida: Saúde = coisas, Cuidado = pessoas.
  - [ ] **Painel por profissional**: consultas (próxima + histórico por data, na Agenda com lembrete), "o que levar"/"o que ficou" por consulta, perguntas, linha do tempo da evolução.
  - [ ] **Painéis por tipo**: psiquiatra puxa medicação/doses/efeitos da Saúde e monta o resumo; psicólogo acompanha temas.
  - [ ] **Texto rico** (CampoRico, que já existe) em todo campo de anotação — hoje é texto simples.
- [x] ~~Trava extra opcional para saúde e cuidado psicológico~~ — **descartada** (decisão de Dan, 26/10/2026): atrito desnecessário; o cofre já protege tudo.
- [ ] **Dinheiro** (0.35.0; aprofundado na 0.40.0):
  - [x] Gastos, contas recorrentes, lista de espera, metas (0.35.0).
  - [x] Grupos de gasto personalizáveis com cor; tabela por mês (3/6/12 meses); gráficos de pizza (por grupo) e barras (por mês) (0.40.0). Falta teste de Dan no Windows.
  - [ ] Gráfico de linha (evolução); filtro por grupo e por "interesse especial" na visão.
  - [ ] Importar extrato do banco (OFX ou CSV) — parsing próprio, numa próxima versão.
  - [ ] Avaliar notificar a conta a vencer.
- [ ] **Vida acadêmica — reescrita como "mesa de estudos"** (visão acordada 26/10/2026; a 0.34.0 entregou só o cadastro, que Dan achou raso):
  - [x] Base: matérias, provas/trabalhos/deveres com data, "o que vem aí", notas e média (0.34.0).
  - [ ] **Grade de horário semanal** (dias × horários), ligada à semana-modelo da Agenda; aula = bloco fixo da matéria.
  - [ ] **Matéria = etiqueta de assunto** que atravessa o app (acionável no Leitor e no Caderno). A matéria recolhe tudo do assunto. Sub-assuntos depois.
  - [ ] **Trabalhos acadêmicos como projetos** (não só TCC: IC, publicações, artigos, seminários), reusando Projetos, com passos, "onde parei" e **agendamento para trás** ("entrega sexta → comece terça").
  - [ ] **"O que fazer agora"** no topo (próxima entrega/passo, contagem de dias sentida); liga no modo baixa energia.
  - [ ] **Conexões**: prova/entrega → evento na Agenda com aviso; "estudar agora" → timer de Foco por matéria; material da aula por matéria (anexos); leituras por assunto na estante.
  - [ ] Encolher nota/média para detalhe opcional dentro da matéria.
  - [ ] Dependências: grifos por assunto precisam do Leitor pronto; páginas por assunto precisam do Caderno.
- [x] **Hobbies e interesses** (0.36.0): arquivo de interesses/hiperfocos com notas, imagens e links (pelos anexos), sem metas. Falta teste de Dan no Windows.
  - [x] **Quadro livre** por hobby (na branch, ainda não publicado): cartões soltos de texto, arquivo, imagem, link e áudio gravado, arrastáveis pelo mouse e pelo teclado; posição guardada. Áudio pelo microfone (MediaRecorder) salvo no cofre via `anexar_bytes`. **Falta teste de Dan no Windows — o microfone no WebView2 e a renderização não dá para validar na nuvem.**
  - [ ] Redimensionar cartões; conectar cartões; fundo/cor do quadro.
- [ ] **Leitura** (começada na 0.37.0):
  - [x] Estante com status (quero/lendo/lido/pausado) e diário de leitura (onde parei, impressões, datas). Falta teste de Dan no Windows.
  - [x] Pacote `packages/leitor` (sem React/Tauri, reaproveitável no Escuta) com o leitor de EPUB (epub.js) e PDF (PDF.js): fontes (inclusive dislexia), cores de papel, tamanho e modo páginas/rolagem; lembra onde parou (0.38.0). **Falta teste de Dan no Windows — a renderização não foi validada na nuvem.** Limite de 300 MB por arquivo (reusa os anexos do cofre) (0.39.0).
  - [x] Painel de ajustes do leitor com espaçamento entre linhas, margem e alinhamento; troca de fonte do EPUB corrigida (injeção de `@font-face` no iframe); PDF esconde os ajustes que são só do EPUB (0.41.0). Falta teste de Dan no Windows.
  - [x] Biblioteca em prateleiras (grupos) com cor por livro e selo de status; livro muda de prateleira por um seletor (0.41.0). Falta teste de Dan no Windows.
  - [x] Marcadores, notas e grifos (grifo de texto no EPUB), caneta/marca-texto/borracha no PDF, com painel lateral de anotações (na branch, ainda não publicado). **Falta teste de Dan no Windows.**
  - [x] Arrastar livros entre prateleiras com o mouse e pelo teclado (dnd-kit) (na branch, ainda não publicado).
  - [ ] No leitor: régua de leitura, leitura em voz alta, busca no livro, sumário navegável, dicionário.
  - [ ] Grifo de texto no PDF (precisa da camada de texto no render do PDF, hoje só canvas).
  - [ ] Fichamentos (citação, resumo, comentário, paráfrase) com ABNT; exportar Word/PDF/Markdown.
  - [ ] Busca em todas as anotações; IA opcional para explicar/resumir. Testar o pacote dentro do Escuta.
- [ ] **Caderno** com os dois modos completos (decisão de Dan): estante, capas e folhas personalizáveis, modo caderno no estilo Goodnotes com páginas, PDF para anotar, caneta com pressão e rejeição da palma, todas as ferramentas (lápis, pincel, marca-texto, borracha, laço, formas, texto, setas, notas adesivas, imagens) e quadro infinito. Cinco etapas no plano da Onda 2.
- [ ] **Exportação em formatos abertos** de todos os módulos (CSV, Markdown, JSON, ICS para a agenda).
- [ ] Remédio do modo baixa energia vindo da medicação cadastrada.
- [ ] Portão: grupo de teste neurodivergente usa e aprova.

## 3. Onda 3: Mac e celular

- [ ] Versões Mac, Android, iOS e iPad do mesmo código.
- [ ] **Sincronização opcional** criptografada de ponta a ponta. Caminho mais provável: a mesma pasta do app na conta da pessoa (Drive, OneDrive, iCloud) usada desde a 0.22.0 para a recuperação, sem servidor do Órbita.
- [ ] Ditado no Mac e no celular (hoje o microfone só grava no Windows).
- [ ] **"Guardar na minha conta" em todas as plataformas**: Google, Microsoft e Apple (iCloud, só no Mac e no iPhone/iPad) no Mac, Android, iPhone e iPad, cada uma com seu cadastro no provedor (tabela em `docs/especificacao.md`, "Contas para guardar a recuperação").
- [ ] IA no celular só por chave (sem IA local).
- [ ] Apple Saúde e Health Connect (sono, frequência cardíaca, passos, ciclo), só leitura.
- [ ] Futuro: app no relógio (captura, confirmar remédio, avisos por vibração).

## 4. Onda 4: lançamento e comunidade

- [ ] Distribuição gratuita, página do projeto e de doação, onde hospedar os instaladores.
- [ ] Galeria de temas da comunidade, incluindo conjuntos de ícones (desde a 0.23.0 há três famílias prontas, efeitos e o desenho de ícones com IA, experimental).
- [ ] **Importar coleção de ícones em SVG** (por exemplo, comprada ou baixada de um banco como o Magnific/Freepik): a pessoa escolhe os arquivos e liga cada um a um ícone do Órbita. Uso pessoal tudo bem; para publicar na galeria, conferir a licença da coleção.
- [ ] **Logo do Órbita no login do Google** (exige a verificação de marca do Google, que leva semanas; hoje a tela de permissão aparece sem logo).
- [ ] Assinatura digital do instalador do Windows (tira o aviso "O Windows protegeu o computador").
- [ ] Lojas de aplicativo ou versão web instalável no celular.
- [ ] Decidir sobre código aberto.

## 5. Decisões em aberto (não são código)

- [ ] Consultar o nome Órbita no INPI.
- [ ] Motor de temas compartilhado com o Escuta ou separado.
- [ ] Como o Escuta recebe o motor de leitura (dependência do GitHub ou pacote privado).
- [ ] Qual modelo local oferecer como opção sem chave (hoje: Ollama, com a recomendação pela memória do computador).
- [ ] Conta de desenvolvedor da Apple: individual (aparece o nome de Dan) ou de empresa (com CNPJ, aparece a marca). Decidir perto da Onda 3.
- [x] **Levar o trabalho para a branch principal (`main`)** do `-rbita` (feito na 0.29.2: `main` e `claude/orbita-setup-planning-cfbqzz` estão iguais; sessões novas trabalham a partir do `main`).
- [ ] O mesmo no `orbita-versoes`: as páginas públicas ainda saem da branch `claude/orbita-setup-planning-cfbqzz` de lá. Se trocar, mudar também a origem do GitHub Pages.
