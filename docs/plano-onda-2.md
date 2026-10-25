# Proposta de plano da Onda 2 (vida prática, Windows)

25/10/2026 · **proposta para Dan aprovar**. Nada disto começa antes do portão da Onda 1 (`docs/revisao-onda-1.md`). O que Dan anotar usando o Órbita no dia a dia pode mudar esta ordem.

## Pontos para decidir antes (premissas)

1. **Lembretes com o Órbita fechado.** Remédio e conta a vencer precisam avisar na hora, mas um programa de computador só avisa se estiver aberto. Com a bandeja ligada (etapa 17), ele fica aberto o dia todo. Proposta: ao cadastrar o primeiro remédio, sugerir ligar a bandeja e "abrir com o Windows". Avisar com clareza que, com o Órbita fechado, o aviso não sai. O celular (Onda 3) resolve melhor.
2. **Dinheiro sem ligação com banco.** Open Finance exige empresa autorizada pelo Banco Central; fica fora. Proposta: registro à mão rápido, mais importar o extrato em OFX ou CSV, que quase todo banco exporta.
3. **Caderno infinito é o maior item da especificação inteira.** É do tamanho de um Goodnotes, com caneta com pressão, páginas, capas, PDF e laço. Proposta: dividir em duas fases. Na Onda 2, o quadro infinito (com Excalidraw), cadernos na estante, capas e folhas básicas. Depois, modo caderno com páginas, PDF por cima e caneta com pressão, numa fase própria.
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
| 12 | **Caderno I:** estante de cadernos, quadro infinito (Excalidraw), capas e folhas, anexar a projeto, nota vira ideia | Opus |
| 13 | **Exportação em formatos abertos** de todos os módulos (CSV, Markdown, JSON, ICS para a agenda) e revisão do backup com os módulos novos | Sonnet |
| 14 | **Fechamento:** revisão dos sete princípios nas telas novas e lista para o portão (grupo de teste neurodivergente) | Opus |

Fica para uma fase seguinte: o modo caderno com páginas, PDF anotável e caneta com pressão (item 3 acima).

## Por que esta ordem

Saúde e cuidado psicológico vêm primeiro porque são uso diário e pedem mais cuidado com privacidade. Assim, as regras de dado sensível ficam prontas antes do resto. Dinheiro e vida acadêmica vêm em seguida, por serem mais simples. Leitura e caderno são os maiores e ficam juntos no fim, quando a base dos módulos já estiver estável.
