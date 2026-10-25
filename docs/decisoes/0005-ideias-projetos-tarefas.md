# 0005 · Ideias, projetos e tarefas

25/10/2026 · decidido pelo Claude com autonomia dada por Dan; revisar.

**Dados.** Tudo na tabela `item`, com `tipo` (ideia, projeto, tarefa) e `estado`. A migração 2 acrescentou `pai_id` (hierarquia) e `ordem` (ordem manual), e transformou as notas de teste em ideias guardadas. O cartão "onde parei" fica no campo `dados` do projeto, em JSON. "Ideia virou projeto" fica registrado na tabela `ligacao`.

**Escolhas que Dan pode querer mudar.**
- Limite padrão de **3** projetos ativos.
- Nomes na tela: **Ideias** (no lugar de "estacionamento") e **Pausar/Retomar** (no lugar de "hibernar"), seguindo o princípio da linguagem literal.
- Atalho global **Ctrl + Alt + Espaço**. Ctrl + Shift costuma trocar o idioma do teclado no Windows, por isso foi evitado.
- Tarefas em **dois níveis** (etapa e subtarefa). Mais níveis complicariam a lista sem ganho claro.
- O quadro mostra **todas** as tarefas (etapas e subtarefas); a subtarefa indica a etapa de origem.
- Concluir um projeto não pede confirmação: dá para reabrir com um clique.
- Excluir pede confirmação; a exclusão é marcada no banco (não apagada de fato), para a sincronização futura.

**Acessibilidade.** Arrastar no quadro usa dnd-kit, com sensor de teclado e avisos em português para leitor de tela. Toda ação de arrastar também existe no menu da tarefa.
