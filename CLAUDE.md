# CLAUDE.md — Órbita

Orientações para o Claude Code neste repositório. A fonte de verdade do produto é `docs/especificacao.md`; leia-a antes de qualquer tarefa nova.

## Sobre o dono do projeto

- Dan (Daniel Sampaio Rodrigues) é designer, editor e estudante de psicologia, autista. **Não programa**: todo o código fica com o Claude.
- Fale sempre em **português**, de forma direta e simples. Explique decisões técnicas em linguagem leiga, em poucas linhas.
- Dan prefere ser questionado nas premissas antes da execução. Se algo na especificação parecer errado ou arriscado, diga antes de construir.
- Design e qualidade visual são muito importantes para ele.
- Público: pessoas neurodivergentes em geral (autistas, TDAH, dislexia, altas habilidades e outras). Não trate o app como só de TDAH nem só de autismo.

## Como trabalhar

1. **Planeje antes de programar.** Para cada etapa nova, proponha o plano em etapas pequenas e espere aprovação.
2. **Etapas pequenas e testáveis.** Cada etapa termina com algo que Dan consegue abrir e ver funcionando no Windows.
3. **Commits pequenos e descritivos**, em português.
4. **Teste antes de dizer que está pronto.** Rode os testes e o build; não declare pronto o que não foi verificado.
5. **Mantenha a especificação viva.** Quando uma decisão mudar, atualize `docs/especificacao.md` no mesmo commit.
6. **Indique o modelo.** Ao propor uma etapa, sugira se ela pede Opus (arquitetura, decisões difíceis, revisões) ou Sonnet (implementação repetitiva), para poupar crédito.

## Princípios de design (inegociáveis)

Toda tela e função passam por estes sete princípios. Em conflito, vencem os princípios.

1. Previsibilidade: nada muda sem aviso; atualizações mostram o que mudou e podem ser adiadas.
2. Baixo estímulo por padrão: sem som, sem animação forte, sem notificação insistente; botão de baixo estímulo sempre disponível.
3. Sem culpa: pausar é válido; nada de sequências que zeram nem vermelho gritante.
4. Sem gamificação punitiva.
5. Captura sem atrito: registrar algo leva segundos, por texto ou voz, de qualquer tela.
6. Retomar importa tanto quanto começar: cartão "onde parei" em projetos, leituras e tarefas longas.
7. Acessibilidade sensorial e cognitiva: fontes para dislexia, densidade ajustável, contraste garantido, atalhos de teclado para tudo, linguagem simples e literal.

## Decisões técnicas

- **App:** Tauri 2 (Windows primeiro; Mac, Android e iOS do mesmo código).
- **Interface:** TypeScript com framework de componentes web (propor e justificar a escolha no plano da Onda 1).
- **Dados:** local-first, SQLite criptografado, funciona sem internet e sem conta. Backup em arquivo único criptografado; exportação em formatos abertos.
- **Modelo de dados comum:** item, evento, registro e anexo, com etiquetas e ligações entre si.
- **Pacotes compartilhados:** o motor de leitura (EPUB/PDF) fica em pacote separado, reaproveitável no leitor da Arcano 3 e no Escuta. Tentar o mesmo para o motor de temas e o caderno.
- **IA opcional:** nenhuma função depende dela. Provedores por chave própria (Claude, GPT, Gemini, Grok, Sabiá), provedor por função e opção local como download separado. A IA propõe e a pessoa confirma antes de gravar qualquer coisa. Avisar antes de enviar dados de saúde ou terapia a provedor externo.
- **SVG importado** passa sempre por limpeza de segurança (remover scripts e links externos).
- **Privacidade:** sem telemetria, sem anúncios, sem rastreamento; alinhado à LGPD. Nunca colocar chaves de API ou dados pessoais no repositório.

## Ondas

1. Base e coração (Windows): base, temas e fundos, visualizações; Ideias e projetos, Tempo e rotina, Energia; IA, conversa e ditado.
2. Vida prática (Windows): Dinheiro, Saúde, Cuidado psicológico e psiquiátrico, Vida acadêmica, Hobbies, Caderno infinito, Leitura; backup e exportação.
3. Mac e mobile; sincronização opcional criptografada.
4. Lançamento e comunidade.

Cada onda só começa quando a anterior passa pelo portão definido na especificação.
