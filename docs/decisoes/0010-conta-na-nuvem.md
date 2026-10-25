# 0010 · Recuperação guardada na conta Google ou Microsoft

25/10/2026 · aprovado por Dan (etapa B de "Menos burocracia"). **Google cadastrado e ligado na 0.22.0.** Microsoft pendente: conta pessoal não registra app sem diretório (tentar Azure for Students pelo pacote de estudante do GitHub). Todas as plataformas e contas: tabela na especificação, "Contas para guardar a recuperação".

**O que é.** Opcional. O Órbita guarda, numa pasta do app na conta da própria pessoa, dois arquivos: a chave de recuperação (as 6 palavras) e um backup, que já é criptografado. Num computador novo, a pessoa entra com a conta, escolhe como abrir (Windows Hello, PIN ou direto) e os dados voltam.

**Sem servidor do Órbita.** O login acontece no navegador e volta para o próprio computador (`127.0.0.1`, porta sorteada), com PKCE. A renovação do acesso fica dentro do banco criptografado. Não existe conta do Órbita.

**Permissão mínima.** Google: `drive.appdata` (pasta escondida do app, classificada pelo Google como "recomendada e não sensível", sem análise demorada) e o e-mail. Microsoft: `Files.ReadWrite.AppFolder` (pasta "Aplicativos/Órbita") e o e-mail. O Órbita não vê nenhum outro arquivo.

**Limite honesto, dito na tela e na política.** Como a chave fica junto do backup, quem entrar na conta da pessoa consegue recuperar os dados do Órbita. É o mesmo nível de confiança de guardar documentos no Drive; com verificação em duas etapas, é mais seguro que um papel com as palavras. Quem não quiser continua só com as 6 palavras.

**Quando envia.** Ao ligar a conta e, depois, uma vez por dia (15 segundos depois de abrir, se a última cópia tiver mais de 20 horas). Falha não atrapalha: fica anotada em Ajustes. "Enviar uma cópia agora" força.

**Desligar.** "Só desligar" ou "Desligar e apagar da conta". No Google, o Órbita também revoga o acesso; na Microsoft, a tela indica onde tirar (account.live.com/consent/Manage).

**Identificadores.** O ID do Google, o segredo de app de computador do Google (que o próprio Google diz não ser segredo de verdade) e o ID da Microsoft entram na montagem pelos segredos do GitHub, não pelo código. Sem eles, a opção some da tela.

**Páginas públicas** exigidas pelo Google e pela Microsoft: `https://danielsampaiorodrigues.github.io/orbita-versoes/` e `.../privacidade.html` (repositório `orbita-versoes`).

**Apple** fica para a Onda 3 (exige conta de desenvolvedor e só faz sentido com Mac e iPhone).
