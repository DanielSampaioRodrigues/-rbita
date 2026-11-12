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
7. Acessibilidade sensorial e cognitiva: fontes para dislexia, densidade ajustável, contraste garantido por padrão (a pessoa pode liberar a trava para si, com saída rápida pelo baixo estímulo), atalhos de teclado para tudo, linguagem simples e literal.

## Decisões técnicas

- **App:** Tauri 2 (Windows primeiro; Mac, Android e iOS do mesmo código).
- **Interface:** React + TypeScript + Vite, com React Aria e dnd-kit para acessibilidade por teclado. Temas em variáveis CSS. Monorepo com pnpm (`apps/desktop`, `packages/*`).
- **Instalador:** o GitHub Actions monta o instalador do Windows; Dan baixa e testa. Não há como rodar o Windows aqui.
- **Versão de navegador (iPad):** o mesmo app, com os dados criptografados no aparelho (`apps/desktop/src/web/`, build com `VITE_ORBITA_WEB=1`). Publica pelo mesmo workflow, disparando à mão com a escolha "navegador" (só Linux, barato), na subpasta `app/` do site do `orbita-versoes` (`…/orbita-versoes/app/`). Nunca trocar a fonte do GitHub Pages: ela serve as páginas exigidas pelo Google. Detalhes na especificação, em "Versão de navegador". **Toda publicação no navegador sobe o número da versão** (senão o iPad troca de versão sem avisar, contra o princípio 1). **Sem minutos do Actions**, publicar direto da sessão: `pnpm motor` e depois `VITE_ORBITA_WEB=1 pnpm exec vite build` em `apps/desktop` (pré-requisitos na sessão: `rustup target add wasm32-unknown-unknown` e `cargo install wasm-bindgen-cli --version 0.2.130 --locked`, a versão tem que ser a do `crates/motor-web/Cargo.lock`), depois copiar `dist-web/` para `app/` na branch `claude/orbita-setup-planning-cfbqzz` do `orbita-versoes` (pedir o repositório com add_repo) e dar push; conferir `…/orbita-versoes/app/versao.json`. O navegador roda o mesmo banco do Windows (`crates/motor-web`; ver `docs/decisoes/0011-motor-unico.md`); um comando novo em `comandos.rs` que só usa o banco entra sozinho na ponte; se depender do sistema, precisa de versão própria em `src/web/modoWeb.ts`.
- **Cuidado com os minutos do GitHub Actions (importante).** A conta de Dan é plano de estudante, com minutos de Actions limitados por mês (e orçamento de gasto em US$ 0 por padrão, que bloqueia em vez de cobrar). O runner do Windows gasta minuto **em dobro**. Em outubro/2026, buildar o instalador a cada commit esgotou o mês numa noite e travou tudo. Por isso o workflow foi ajustado: **o instalador do Windows só roda na branch principal ou sob demanda (`workflow_dispatch`)**; a cada push roda só o teste leve do Rust no Linux. **Não force builds do Windows à toa:** acumule o trabalho e dispare **um** build quando Dan quiser testar (ele já publica a versão). Nunca religar o build do Windows a cada push.
- **A `main` acompanha o trabalho.** Ao terminar uma rodada, levar a branch de trabalho para a `main` (avanço direto, sem reescrever história). Se a versão já estiver publicada, pôr `[skip ci]` na mensagem do último commit, para o GitHub não montar o instalador do Windows de novo. A lista do que falta (`docs/o-que-falta.md`) só vale conferida no código.
- **Versões e atualização:** a cada versão nova, subir o número em `package.json`, `tauri.conf.json` e `Cargo.toml` e reescrever `apps/desktop/notas-da-versao.md` (o que mudou, em linguagem simples). O GitHub assina e publica sozinho no repositório público `orbita-versoes`, e o app avisa. Nunca pôr a chave privada de assinatura no repositório (fica nos segredos do GitHub).
- **Dados:** local-first, SQLite criptografado, funciona sem internet e sem conta. Backup em arquivo único criptografado; exportação em formatos abertos.
- **Modelo de dados comum:** item, evento, registro e anexo, com etiquetas e ligações entre si.
- **Pacotes compartilhados:** o motor de leitura (EPUB/PDF) fica em pacote separado, reaproveitável no leitor da Arcano 3 e no Escuta. Tentar o mesmo para o motor de temas e o caderno.
- **IA opcional:** nenhuma função depende dela. Provedores por chave própria (Claude, GPT, Gemini, Grok, Sabiá), provedor por função e opção local como download separado. Fora do caderno, a IA propõe e a pessoa confirma antes de gravar. **No caderno (decisão de Dan, 04/11/2026), a IA tem liberdade total**: pode editar, formatar, mover, apagar e criar páginas direto, mas o Órbita guarda antes uma cópia do que ela vai mexer e sempre oferece "Desfazer tudo o que a IA fez"; o original nunca se perde de vez. Avisar antes de enviar dados de saúde ou terapia a provedor externo.
- **SVG importado** passa sempre por limpeza de segurança (remover scripts e links externos).
- **Privacidade:** sem telemetria, sem anúncios, sem rastreamento; alinhado à LGPD. Nunca colocar chaves de API ou dados pessoais no repositório.

## Ondas

1. Base e coração (Windows): base, temas e fundos, visualizações; Ideias e projetos, Tempo e rotina, Energia; IA, conversa e ditado.
2. Vida prática (Windows): Dinheiro, Saúde, Cuidado psicológico e psiquiátrico, Vida acadêmica, Hobbies, Caderno infinito, Leitura; backup e exportação.
3. Mac e mobile; sincronização opcional criptografada.
4. Lançamento e comunidade.

Cada onda só começa quando a anterior passa pelo portão definido na especificação.
