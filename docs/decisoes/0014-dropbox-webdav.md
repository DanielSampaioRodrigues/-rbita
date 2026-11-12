# 0014 · Dropbox e Nextcloud/WebDAV para guardar a recuperação (avaliação)

12/11/2026 · **proposta, esperando Dan decidir.** Avaliação pedida na lista do que falta ("Contas para a recuperação: Dropbox e Nextcloud/WebDAV"). Nada foi programado ainda.

## O que já existe

A recuperação na conta da pessoa (decisão 0010) guarda dois arquivos numa pasta só do app: a chave de recuperação e um backup criptografado. Hoje vale com o Google Drive (feito) e o OneDrive (código pronto, esperando o registro do app na Microsoft). A sincronização entre aparelhos (decisão 0012) usa a mesma base no Google Drive.

## Dropbox

**Como seria.** Igual ao Google e à Microsoft: um "app" registrado no Dropbox, com acesso só a uma pasta do app ("Aplicativos/Órbita"), login no navegador com PKCE (sem segredo guardado no código) e renovação do acesso guardada dentro do banco criptografado.

**A favor.**
- Cadastro gratuito, feito pela própria pessoa dona do app (Dan), sem análise demorada para começar.
- A permissão de "pasta do app" existe e é a mínima: o Órbita não veria nenhum outro arquivo.
- A API do Dropbox aceita chamadas do navegador: daria para valer **também na versão de navegador (iPad)**, não só no Windows.
- Muita gente já usa (estudantes inclusive), e o plano gratuito tem espaço de sobra para dois arquivos.

**Contra / cuidados.**
- Um cadastro a mais para manter (como o Google).
- Enquanto o app estiver "em desenvolvimento" no Dropbox, há um limite de pessoas que podem ligar a conta (pelo que conheço, cerca de 500); para passar disso, pede-se a aprovação de produção. Conferir na documentação do Dropbox na hora de cadastrar.
- O jeito de voltar do login para o programa do Windows (endereço `127.0.0.1` com porta sorteada, como no Google) precisa ser conferido nas regras de endereço de retorno do Dropbox; se não aceitar porta sorteada, há o caminho de copiar e colar um código, que é menos cômodo.

**Esforço.** Uma etapa, parecida com a do Google: o módulo de envio e leitura da pasta do app e as telas de ligar e desligar, reaproveitando o que já existe. Dan faz o cadastro (uns 10 minutos, com passo a passo em `docs/configurar-contas.md`).

## Nextcloud ou WebDAV (servidor próprio)

**Como seria.** Sem cadastro: a pessoa informa o endereço do servidor e uma **senha de app** (o Nextcloud gera uma em Ajustes > Segurança; outras nuvens WebDAV têm algo parecido). O Órbita guarda os dois arquivos numa pasta "Orbita" do servidor. A senha de app fica dentro do banco criptografado.

**A favor.**
- Nada passa por empresa grande; bom para quem já tem servidor próprio, da universidade ou da família.
- Sem cadastro do lado do Órbita.

**Contra / cuidados.**
- **No navegador (iPad), quase sempre não funciona**: o servidor precisa autorizar chamadas vindas de outro site (CORS), e o Nextcloud não faz isso por padrão. Só daria certo se a pessoa mexesse na configuração do servidor. Um "intermediário" do Órbita resolveria, mas é contra a regra de não ter servidor próprio.
- No Windows e no Mac funciona, pelo Rust (sem a trava do navegador).
- Público pequeno, e a pessoa precisa saber o que é endereço WebDAV e senha de app: pede linguagem bem literal e um passo a passo.

**Esforço.** Uma etapa menor que a do Dropbox no Windows (sem login no navegador); no navegador, só uma explicação de por que não dá.

## Recomendação

1. **Dropbox: fazer**, depois do OneDrive (que já está pronto e só espera o registro). Vale no Windows e no navegador, com a mesma promessa das outras contas.
2. **Nextcloud/WebDAV: fazer só no Windows (e no Mac, na Onda 3)**, como opção avançada "Servidor próprio", **se Dan achar que o público justifica**. No navegador, a opção aparece com a explicação do servidor, sem prometer o que não funciona.
3. Nos dois casos, valem as regras de sempre: só a pasta do app, nada passa por servidor do Órbita, o limite honesto aparece na tela e as 6 palavras continuam como alternativa sem conta.

## O que Dan decide

- Fazer o Dropbox agora (antes ou depois de destravar o OneDrive)?
- Nextcloud/WebDAV: vale para o público do Órbita, ou fica para depois?
