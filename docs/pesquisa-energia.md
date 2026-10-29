# Pesquisa: energia em pessoas neurodivergentes

Base para o módulo Energia do Órbita. Olhar **neuroafirmativo**: o problema não é a pessoa "ter pouca energia", e sim o desencontro entre o que o ambiente pede e o que o corpo e a mente conseguem dar. O app ajuda a enxergar esse desencontro, sem diagnosticar e sem cobrar.

## O que a pesquisa e a comunidade dizem

**Teoria das colheres.** Christine Miserandino (2003) explicou a vida com lúpus com um punhado de colheres: cada ação do dia gasta uma, e elas acabam. A imagem se espalhou para autismo, TDAH, doenças crônicas e saúde mental porque torna visível um custo que ninguém vê. Lição para o app: energia é limitada **e** cada coisa tem um custo, que muda de pessoa para pessoa. ([butyoudontlooksick.com](https://butyoudontlooksick.com/xmedia-press/introducing-the-official-the-spoon-theory-i-am-a-spoonie-video-by-christine-miserandino), [Wikipedia](https://en.wikipedia.org/wiki/Spoon_theory))

**Energy accounting (contabilidade de energia).** Método da psicóloga autista Maja Toudal, depois livro com Tony Attwood (2024). Funciona como uma conta bancária: algumas coisas **retiram** energia (socializar, barulho, luz, imprevistos) e outras **depositam** (ficar só, interesse especial, sono). A pessoa monta a própria lista e acompanha o saldo para perceber o burnout cedo. É a ideia mais prática para o módulo. ([JKP](https://us.jkp.com/products/energy-accounting), [folheto de Attwood & Garnett](https://www.attwoodandgarnettevents.com/cdn/shop/files/Energy_Accounting_Handout.pdf))

**Burnout autista.** Raymaker e colegas (2020), pesquisa participativa com pessoas autistas, definiram o burnout autista como exaustão crônica, perda de habilidades e menor tolerância a estímulos, vindo de estresse acumulado, falta de apoio e pouca chance de se recuperar. É diferente do burnout de trabalho e da depressão. Lição: o perigo é o **acúmulo** de dias no negativo, não um dia ruim. ([PMC7313636](https://pmc.ncbi.nlm.nih.gov/articles/PMC7313636), [PubMed](https://pubmed.ncbi.nlm.nih.gov/32851204/))

**Sobrecarga, shutdown e meltdown.** Quando a carga sensorial, social ou emocional passa do limite, o corpo responde: shutdown (desligar, falar menos, travar) ou meltdown (explosão que não é escolha). Os primeiros sinais costumam ser pessoais e reconhecíveis ("a luz começa a incomodar", "perco as palavras"). Quem os conhece antes consegue sair da situação a tempo. Lição: a lista de sinais tem que ser **da pessoa**, escrita num momento bom.

**Monotropismo.** Murray, Lesser e Lawson (2005) descrevem a atenção autista como um "túnel": muito recurso concentrado em poucos interesses de cada vez. Isso dá foco profundo, mas torna caro **trocar** de tarefa e faz o corpo sumir do radar durante o hiperfoco. Também explica por que o interesse especial costuma **repor** energia. ([Autism, 2005](https://monotropism.org/murray-lesser-lawson/))

**Interocepção diferente.** Muitas pessoas autistas e com TDAH percebem diferente os sinais internos (fome, sede, cansaço, vontade de ir ao banheiro); os estudos ainda divergem sobre os detalhes, mas o relato é comum. Na prática, o cansaço é notado tarde, quando já virou sobrecarga. Lição: um lembrete gentil e opcional ("como está o corpo?") ajuda a perceber antes. ([revisão Frontiers 2025](https://www.frontiersin.org/articles/10.3389/fpsyt.2025.1573263/full), [revisão 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9832174/))

**Masking (camuflagem) e seu custo.** Esconder traços para se encaixar consome muita energia, e o custo vem depois. Cassidy e colegas (2018) acharam a camuflagem associada a maior risco de ideação suicida em adultos autistas (estudo transversal; mostra associação, não causa). Lição: "passei o dia mascarando" é um gasto real e merece entrar na conta. ([Molecular Autism, 2018](https://nottingham-repository.worktribe.com/output/947594/risk-markers-for-suicidality-in-autistic-adults))

**Descanso ativo e passivo; recuperação sensorial.** Nem todo descanso repõe igual. Para muita gente neurodivergente, "descansar" vendo rede social ainda gasta (muito estímulo). Repõe mais o que **baixa a entrada sensorial** (quarto escuro, fone com cancelamento, peso, silêncio) ou o que traz prazer previsível (interesse especial, movimento repetitivo, stimming). Lição: a lista de reposição é pessoal, e o app não deve dizer o que "conta" como descanso.

## Propostas para o módulo

1. **O que gasta e o que repõe** (*implementada*). A pessoa cadastra atividades com peso de −3 a +3 e marca o que fez hoje. O módulo mostra o saldo do dia em frase neutra ("hoje gastou mais do que repôs") e sugere, sem cobrar, uma coisa que costuma repor. Ajuda a ver o acúmulo antes do burnout (energy accounting).
2. **Meus sinais de sobrecarga** (*implementada*). Lista pessoal ("começo a falar menos", "luz incomoda"). Ao lado de cada sinal, um botão "Estou sentindo isso", que anota o momento e abre o modo baixa energia. Ajuda a agir no começo, quando ainda dá.
3. **Como está o corpo?** (proposta). Lembrete opcional, desligado por padrão, de hora em hora: água, comida, banheiro, pausa. Aviso discreto no alto do app; sem notificação do sistema quando o baixo estímulo estiver ligado. Precisa ficar montado na moldura do app (fora do módulo).
4. **Semana em saldo** (proposta). Uma faixa com os últimos 7 dias mostrando só "gastou mais", "equilibrado", "repôs mais", em palavras. Se três dias seguidos ficarem no negativo, uma frase gentil: "Os últimos dias pediram muito. Que tal planejar um tempo de reposição?" Sem cor vermelha.
5. **Kit de recuperação sensorial** (proposta). Atalho para a lista do que repõe com foco sensorial (escuro, silêncio, peso), que abre junto do modo baixa energia. Liga com os planos de "coisas que fazem bem" do módulo Cuidado.
6. **Custo da camuflagem** (proposta). Ao registrar o dia, uma pergunta opcional: "Precisou se camuflar hoje? pouco / médio / muito", que entra como gasto. Valida um custo invisível.
7. **Dias pesados à vista** (proposta). Olhar a agenda dos próximos dias e avisar com antecedência quando houver muitos compromissos sociais seguidos, sugerindo reservar um tempo de reposição antes e depois.
8. **Exportar para a terapia** (proposta). Resumo de algumas semanas (saldo, sinais anotados, níveis) para levar à psicóloga, só se a pessoa quiser, em formato aberto.
