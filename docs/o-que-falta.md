# O que falta implementar

25/10/2026 · versão 0.18.0. Lista feita comparando `docs/especificacao.md` com o que já existe. Riscar conforme for feito.

## 1. Pendências da Onda 1 (o que está pela metade)

- [ ] **Atualização dentro do app**: botão "procurar atualização", mostrando o que mudou e com opção de adiar (princípio 1). Hoje cada versão é um instalador novo, baixado à mão.
- [ ] **Etiquetas e ligações em projetos e tarefas** (hoje só nas ideias). A especificação diz que todo item tem etiquetas e ligações.
- [ ] **Anexos**: imagens, arquivos e links presos a ideias, projetos e tarefas. A tabela `anexo` existe no banco desde o começo, mas ainda não é usada.
- [ ] **Rotinas com imagens**: hoje os passos têm só ícones; a especificação fala em imagens ou ícones.
- [ ] **Quadro de ideias com arrastar** entre colunas (hoje, troca-se a etiqueta dentro da ideia).
- [ ] **Temas com ícones próprios**: a especificação fala em pacotes de tema com ícones. As fontes ficaram como escolha da pessoa, de propósito, por acessibilidade.
- [ ] **Conversa com a IA em várias mensagens**: hoje é "Separar com IA" na captura, de uma vez.
- [ ] **Teste com leitor de tela de verdade** (NVDA), de preferência com quem usa.
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
- [ ] **Caderno infinito**: estante de cadernos, quadro infinito, modo caderno com páginas, capas e folhas personalizáveis, PDF para anotar, caneta com pressão, ferramentas (laço, formas, notas adesivas). Proposta: dividir em duas fases.
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
