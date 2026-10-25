# O que falta implementar

25/10/2026 · versão 0.19.0. Lista feita comparando `docs/especificacao.md` com o que já existe. Riscar conforme for feito.

## 1. Pendências da Onda 1 (o que está pela metade)

- [ ] **Atualização dentro do app**: botão "procurar atualização", mostrando o que mudou e com opção de adiar (princípio 1). Hoje cada versão é um instalador novo, baixado à mão. **Espera uma decisão de Dan**: criar um repositório público só para os instaladores (`orbita-versoes`) e guardar a chave de assinatura das atualizações como segredo do GitHub.
- [x] **Etiquetas e ligações em projetos e tarefas** (0.19.0).
- [x] **Anexos**: imagens, arquivos e links em ideias, projetos e tarefas, dentro do cofre (0.19.0).
- [x] **Rotinas com imagens** (0.19.0).
- [x] **Quadro de ideias com arrastar** entre colunas, também pelo teclado (0.19.0).
- [x] **Ícones do tema**: traço e pontas ajustáveis (0.19.0). Desenhar ícones próprios fica para a galeria da comunidade.
- [x] **Conversa com a IA**: pedir mudanças na lista separada pela captura (0.19.0).
- [x] **Auditoria automática de acessibilidade** (axe-core, WCAG 2.2 AA): sem problemas nos temas claro e escuro (0.19.0).
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
- [ ] **Sincronização opcional** criptografada de ponta a ponta (decidir onde: pasta da pessoa na nuvem ou servidor pequeno).
- [ ] Ditado no Mac e no celular (hoje o microfone só grava no Windows).
- [ ] IA no celular só por chave (sem IA local).
- [ ] Apple Saúde e Health Connect (sono, frequência cardíaca, passos, ciclo), só leitura.
- [ ] Futuro: app no relógio (captura, confirmar remédio, avisos por vibração).

## 4. Onda 4: lançamento e comunidade

- [ ] Distribuição gratuita, página do projeto e de doação, onde hospedar os instaladores.
- [ ] Galeria de temas da comunidade.
- [ ] Assinatura digital do instalador do Windows (tira o aviso "O Windows protegeu o computador").
- [ ] Lojas de aplicativo ou versão web instalável no celular.
- [ ] Decidir sobre código aberto.

## 5. Decisões em aberto (não são código)

- [ ] Consultar o nome Órbita no INPI.
- [ ] Motor de temas compartilhado com o Escuta ou separado.
- [ ] Como o Escuta recebe o motor de leitura (dependência do GitHub ou pacote privado).
- [ ] Qual modelo local oferecer como opção sem chave (hoje: Ollama, com a recomendação pela memória do computador).
