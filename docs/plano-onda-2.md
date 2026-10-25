# Proposta de plano da Onda 2 (vida prática, Windows)

25/10/2026 · **proposta para Dan aprovar**. Nada disto começa antes do portão da Onda 1 (`docs/revisao-onda-1.md`). O que Dan anotar usando o Órbita no dia a dia pode mudar esta ordem.

## Pontos para decidir antes (premissas)

1. **Lembretes com o Órbita fechado.** Remédio e conta a vencer precisam avisar na hora, mas um programa de computador só avisa se estiver aberto. Com a bandeja ligada (etapa 17), ele fica aberto o dia todo. Proposta: ao cadastrar o primeiro remédio, sugerir ligar a bandeja e "abrir com o Windows". Avisar com clareza que, com o Órbita fechado, o aviso não sai. O celular (Onda 3) resolve melhor.
2. **Dinheiro sem ligação com banco.** Open Finance exige empresa autorizada pelo Banco Central; fica fora. Proposta: registro à mão rápido, mais importar o extrato em OFX ou CSV, que quase todo banco exporta.
3. **Caderno: os dois modos completos ficam na Onda 2** (decisão de Dan, 25/10/2026). Não é só o quadro infinito: é também o caderno no estilo Goodnotes, com páginas, capas, folhas, PDF, caneta com pressão e todas as ferramentas. É o maior item da especificação, por isso vira cinco etapas (12 a 16).
   - **Premissa a decidir na etapa 12: um motor só ou dois.** A especificação fala em Excalidraw para o quadro infinito e outro motor para as páginas. Dois motores querem dizer duas ferramentas de caneta, dois formatos de arquivo e um jeito de escrever diferente em cada modo; além disso, o traço do Excalidraw tem cara de rascunho à mão, não de caneta de caderno. Proposta: **um motor próprio para os dois modos** (a página é um quadro com borda; o quadro infinito é o mesmo sem borda), com traço por pressão feito pela biblioteca aberta perfect-freehand. Assim, caneta, laço e formas funcionam igual nos dois modos. O Excalidraw volta a ser opção só se o motor próprio ficar caro demais no quadro infinito.
   - **Pressão e palma no Windows.** A pressão vem da caneta pelo navegador interno (Pointer Events), em canetas Windows Ink e mesas digitalizadoras. A rejeição da palma é: com caneta detectada, o dedo só rola e dá zoom, não desenha. Precisa de teste de Dan num aparelho com caneta.
   - **Acessibilidade de um caderno de desenho.** Desenho é visual por natureza. Mesmo assim: todas as ferramentas pelo teclado, notas de texto e adesivas legíveis pelo leitor de tela, descrição opcional para cada página e imagem, e nada de animação forte no zoom ou ao virar página.
4. **Motor de leitura para o Escuta.** O Escuta usa JavaScript puro (JSX). O pacote `packages/leitor` precisa sair compilado em JS, com tipos à parte, e sem depender do Tauri. Proposta: testar o pacote dentro do Escuta logo na primeira etapa de Leitura, não só no fim.

## Etapas propostas

Cada etapa termina com algo que dá para abrir e ver no Windows.

| # | Etapa | Modelo sugerido |
|---|---|---|
| 1 | **Saúde I:** remédios (dose tomada, estoque, receita vencendo), consultas e exames na agenda | Opus (dados sensíveis, lembretes) |
| 2 | **Saúde II:** registro curto de sono, sintomas e sobrecarga sensorial; plano de crise acessível em 1 clique (e atalho) | Sonnet |
| 3 | **Cuidado psicológico:** sessões na agenda, "o que levar para a sessão", registro pós-sessão, perguntas para o psiquiatra com histórico de doses | Sonnet |
| 4 | **Resumo para a consulta:** junta registros, remédios e perguntas num documento para imprimir ou exportar (PDF). IA opcional, com o aviso de dado sensível | Opus |
| 5 | **Dinheiro I:** contas recorrentes com aviso, gastos por categoria, gastos com interesses sem julgamento | Sonnet |
| 6 | **Dinheiro II:** lista de espera de compras (prazo antes de comprar), metas de reserva, importar extrato OFX ou CSV | Sonnet |
| 7 | **Vida acadêmica:** disciplinas, aulas, provas e trabalhos no calendário; leituras com status; TCC como projeto com "onde parei" | Sonnet |
| 8 | **Hobbies e interesses:** arquivo de hiperfocos com notas, imagens e links, sem metas | Sonnet |
| 9 | **Leitura I (motor):** `packages/leitor` com EPUB (foliate-js) e PDF (PDF.js), fontes, cores, régua de leitura; teste dentro do Escuta | Opus |
| 10 | **Leitura II:** estante, grifos com cores de significado, notas, marcadores, diário de leitura, busca em todas as anotações | Sonnet |
| 11 | **Leitura III:** fichamentos (citação, resumo, comentário, paráfrase) com ABNT, exportação Word, PDF e Markdown; voz alta | Opus |
| 12 | **Caderno I (base e estante):** pacote `packages/caderno`, decisão do motor (item 3), formato dos cadernos guardado no cofre, estante com pastas e etiquetas, capas (cor, textura, imagem ou SVG seu, galeria pronta), criar caderno escolhendo o modo | Opus |
| 13 | **Caderno II (modo caderno, estilo Goodnotes):** páginas A4, A5 e carta, virar página, miniaturas, índice e marcadores; folhas personalizáveis (papel; liso, pautado, quadriculado, pontilhado, isométrico, planner e partitura; espaçamento, cor e espessura das linhas, margem e cabeçalho; modelo por página; modelos próprios em PDF, PNG ou SVG) | Opus |
| 14 | **Caderno III (escrita à mão):** caneta com sensibilidade à pressão, lápis, pincel e marca-texto, borracha (de traço e de área), rejeição da palma, desfazer e refazer, zoom e rolagem suaves | Opus |
| 15 | **Caderno IV (ferramentas):** laço de seleção para mover, redimensionar e recolorir; formas que se ajustam sozinhas; texto, setas, notas adesivas e imagens; atalhos de teclado para tudo | Opus |
| 16 | **Caderno V (quadro infinito e PDF):** modo quadro infinito com as mesmas ferramentas; importar PDF para anotar por cima (com o PDF.js da Leitura); exportar páginas ou o caderno em PDF; anexar a projeto e nota vira ideia | Opus |
| 17 | **Exportação em formatos abertos** de todos os módulos (CSV, Markdown, JSON, ICS para a agenda) e revisão do backup com os módulos novos | Sonnet |
| 18 | **Fechamento:** revisão dos sete princípios nas telas novas e lista para o portão (grupo de teste neurodivergente) | Opus |

## Por que esta ordem

Saúde e cuidado psicológico vêm primeiro porque são uso diário e pedem mais cuidado com privacidade. Assim, as regras de dado sensível ficam prontas antes do resto. Dinheiro e vida acadêmica vêm em seguida, por serem mais simples. Leitura e caderno são os maiores e ficam juntos no fim, quando a base dos módulos já estiver estável. A Leitura vem antes do caderno porque o PDF.js dela é reaproveitado para anotar PDF no caderno.
