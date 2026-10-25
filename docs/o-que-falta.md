# O que falta implementar

25/10/2026 · versão 0.22.0. Lista feita comparando `docs/especificacao.md` com o que já existe. Riscar conforme for feito.

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
- [ ] **Teste com leitor de tela de verdade** (NVDA), de preferência com quem usa. Só dá para fazer no Windows.
- [ ] **Portão da Onda 1**: Dan usar no dia a dia por algumas semanas e aprovar (lista em `docs/revisao-onda-1.md`).

## 2. Onda 2: vida prática (Windows)

Plano em etapas em `docs/plano-onda-2.md`.

- [ ] **Saúde**: remédios com confirmação de dose, estoque e receita vencendo; consultas e exames; registro de sono, sintomas e sobrecarga sensorial; plano de crise; resumo para levar à consulta.
- [ ] **Cuidado psicológico e psiquiátrico**: sessões, "o que levar para a sessão", registro pós-sessão, perguntas para o psiquiatra com histórico de doses.
- [ ] **Trava extra opcional** para saúde e cuidado psicológico.
- [ ] **Dinheiro**: contas recorrentes com aviso, gastos por categoria, lista de espera de compras, gastos com interesses sem julgamento, metas de reserva, importar extrato (OFX ou CSV).
- [ ] **Vida acadêmica**: disciplinas, aulas, provas e trabalhos no calendário; leituras com status; TCC como projeto.
- [ ] **Hobbies e interesses**: arquivo de hiperfocos com notas, imagens e links, sem metas.
- [ ] **Leitura**: pacote `packages/leitor` (EPUB e PDF), estante, leitor completo (fontes, cores, régua, voz alta, busca, sumário, dicionário), grifos com cores, notas, fichamentos com ABNT, diário de leitura, busca em todas as anotações, IA para explicar e resumir. Testar o pacote dentro do Escuta.
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
- [ ] Galeria de temas da comunidade, incluindo **conjuntos de ícones redesenhados** (hoje o tema e a IA mudam só o traço e as pontas; redesenhar os ícones com IA ficou para cá, porque a IA tende a desenhar cada ícone num estilo).
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
- [ ] **Levar o trabalho para a branch principal (`main`)** do `-rbita` e do `orbita-versoes`. Hoje tudo, inclusive as páginas públicas e a publicação das versões, roda na branch de trabalho `claude/orbita-setup-planning-cfbqzz`. Se ela for trocada, mudar também a origem do GitHub Pages.
