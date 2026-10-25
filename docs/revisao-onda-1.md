# Revisão da Onda 1 e portão

25/10/2026 · versão 0.16.0. A Onda 1 está construída. Pela especificação, a Onda 2 só começa quando esta passar pelo portão: **Dan usa no dia a dia por algumas semanas e aprova**.

## Os sete princípios, tela por tela

| Princípio | Como está | O que falta ou fica de olho |
|---|---|---|
| 1. Previsibilidade | Bloco "O que mudou" no Início a cada versão. O bloqueio automático diz por que bloqueou. A bandeja avisa na primeira vez que fechar só esconde. A IA mostra o que vai enviar antes de enviar. | Ainda não há atualização automática: cada versão é um instalador novo, então nada muda sem a pessoa instalar. Quando houver atualização automática, ela precisa poder ser adiada. |
| 2. Baixo estímulo | Botão sempre na barra lateral (Ctrl + Shift + B): tira cor forte, fundo e animações. Avisos sem som. Ditado gravando sem piscar. | Conferir no Windows se as notificações do sistema saem mesmo sem som. |
| 3. Sem culpa | Pausar projeto é um estado normal, com "onde parei". Prazos aparecem como data, sem contagem regressiva nem vermelho. Energia registra sem julgar. | Nada encontrado. |
| 4. Sem gamificação punitiva | Não há sequências, pontos nem perdas. | Nada encontrado. |
| 5. Captura sem atrito | Ctrl + Alt + Espaço de qualquer programa, também com o Órbita na bandeja. Ditado em todo campo de texto. Separar com IA é opcional. | Medir no uso real quanto tempo leva capturar por voz (abrir, falar, transcrever). |
| 6. Retomar importa | Cartão "onde parei" em todo projeto e no Início. Timer de foco continua depois de fechar ou bloquear. | Leituras e caderno chegam na Onda 2. |
| 7. Acessibilidade | Três fontes (Atkinson, Lexend, OpenDyslexic), tamanho, densidade, espaçamento. Contraste testado (7:1 no texto) em todos os temas, também no editor e na importação. Tudo pelo teclado, com lista no F1. Linguagem simples. | Não testei com leitor de tela de verdade (NVDA). Vale um teste com quem usa. |

Busca no código: nenhuma cor vermelha, nenhum som, transições só de cor, desligadas no baixo estímulo e com "reduzir animações" do Windows.

## Critério de pronto da onda

- **Funciona sem internet e sem perder dados ao fechar:** sim. Só IA de fora e o download do modelo de voz usam internet, e são opcionais.
- **Respeita os sete princípios:** ver acima.
- **Atalhos de teclado e baixo estímulo:** sim.
- **Backup testado (salvar, apagar e restaurar):** teste automático com todo tipo de dado (ideias, projetos com datas, tarefas com prazo, compromissos que se repetem, rotinas, energia, provedor de IA com chave). Falta o teste à mão no Windows (lista abaixo).

## O que só dá para testar no Windows (lista para Dan)

1. **Instalar** a versão mais nova (Actions > Instalador Windows > Artifacts).
2. **Backup à mão:** Ajustes > Backup > Fazer backup agora. Depois, em outro usuário do Windows ou outro computador, Restaurar um backup com a senha. Conferir se tudo voltou.
3. **Bandeja:** ligar em Ajustes > Janela e bloqueio, fechar a janela, ver o ícone perto do relógio, usar Ctrl + Alt + Espaço, sair pelo menu do ícone.
4. **Bloqueio automático:** escolher 5 min, não mexer, ver se bloqueia e se a mensagem explica.
5. **Ditado:** instalar o modelo, ditar num campo, ver o tempo de transcrição e a qualidade em português.
6. **IA:** colar uma chave, conferir, sugerir passos num projeto, separar uma captura.
7. **Windows Hello e PIN:** abrir e bloquear algumas vezes.
8. **Usar no dia a dia por algumas semanas** e anotar o que incomoda, o que falta e o que sobra.

## Riscos conhecidos

- O instalador não tem assinatura digital: o Windows mostra um aviso na instalação. Assinar custa dinheiro; decidir antes do lançamento (Onda 4).
- Microfone bloqueado na privacidade do Windows faz o ditado "não ouvir nada" (o Órbita avisa).
- Em computadores mais simples, o modelo de voz "Mais preciso" pode demorar; o "Rápido" é a saída.
