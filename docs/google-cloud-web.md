# Login com Google na versão de navegador (iPad): o que Dan faz no Google

Para o Órbita do iPad entrar com Google e sincronizar, o Google precisa de um segundo
"cadastro" do app, do tipo **Aplicativo da Web**. O cadastro do Windows (da 0.22.0)
continua igual; este é um a mais, **no mesmo projeto**.

Leva uns 5 minutos.

## Passo a passo

1. Abra **console.cloud.google.com** e entre com a sua conta.
2. No alto da página, confira se o projeto escolhido é **o mesmo do Órbita** (o que você
   usou na versão 0.22.0). Se não for, clique no nome do projeto e escolha o certo.
3. No menu da esquerda, vá em **APIs e serviços** → **Credenciais**.
4. Clique em **+ Criar credenciais** → **ID do cliente OAuth**.
5. Em **Tipo de aplicativo**, escolha **Aplicativo da Web**.
6. Em **Nome**, escreva: `Órbita navegador`.
7. Em **Origens JavaScript autorizadas**, clique em **+ Adicionar URI** duas vezes e escreva:
   - `https://danielsampaiorodrigues.github.io`
   - `http://localhost:1420` (para eu testar no computador)
8. Em **URIs de redirecionamento autorizados**, **não coloque nada**. Deixe vazio.
9. Clique em **Criar**. Vai aparecer uma janela com o **ID do cliente** (termina em
   `.apps.googleusercontent.com`) e uma "chave secreta do cliente".
10. **Copie só o ID do cliente e me mande.** Ele não é segredo (vai aberto no site, e o
    Google só aceita pedidos vindos dos endereços do passo 7). A chave secreta **não**
    precisa: não mande e não guarde em lugar nenhum.
11. Ainda no menu da esquerda, vá em **Tela de consentimento OAuth** (às vezes aparece
    como **Google Auth Platform**) e confira duas coisas:
    - em **Acesso a dados** (ou **Escopos**), está o `.../auth/drive.appdata`
      ("Ver, criar e excluir os próprios dados de configuração no Google Drive");
    - em **Público** (ou **Usuários de teste**), o seu e-mail está na lista. Se não
      estiver, clique em **+ Adicionar usuários** e coloque.
12. Pronto. Me mande o ID e eu ligo o login na próxima versão do navegador.

## Onde o ID entra (para o Claude)

- Na constante `CLIENTE_WEB_GOOGLE`, no começo de `apps/desktop/src/sincronia/googleWeb.ts`.
  Escolhi a constante (e não um arquivo `.env`) porque os `.env` ficam fora do repositório
  (`.gitignore`) e o ID não é segredo: assim o build da sessão e o do GitHub Actions saem
  iguais, sem passo a mais.
- Se um dia preferir trocar sem mexer no código, `VITE_GOOGLE_CLIENT_ID_WEB=<id>` no build
  web vale mais que a constante.
- Enquanto a constante estiver vazia, `googleDisponivel()` devolve falso e a opção não aparece.

## Observações

- O endereço de teste é `localhost:1420` (a porta fixa do Órbita no `vite.config.ts`), não 5173.
- Enquanto o app estiver "Em teste" no Google, só os e-mails da lista de usuários de teste
  conseguem entrar. Para abrir a outras pessoas, é preciso publicar o app na tela de
  consentimento (o `drive.appdata` não exige análise demorada).
- O Windows não usa este cadastro: lá a conta é a mesma ligada desde a 0.22.0.
