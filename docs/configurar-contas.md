# Passo a passo: ligar o Órbita ao Google e à Microsoft

Para a opção "Guardar na minha conta Google ou Microsoft". Tudo gratuito. Faça na ordem, com calma; pode parar entre uma parte e outra.

Quando um campo pedir um endereço, copie exatamente o que está aqui.

---

## Parte 1: ligar as páginas públicas (2 minutos)

O Google e a Microsoft pedem uma página de apresentação e uma política de privacidade. Elas já estão escritas; falta ligar a publicação.

1. Abra **github.com/DanielSampaioRodrigues/orbita-versoes/settings/pages**
2. Em **Source**, deixe **Deploy from a branch**.
3. Em **Branch**, escolha `claude/orbita-setup-planning-cfbqzz` e a pasta **/ (root)**. Clique em **Save**.
4. Espere uns 2 minutos e abra **https://danielsampaiorodrigues.github.io/orbita-versoes/**. Se a página do Órbita aparecer, deu certo.

---

## Parte 2: Google (uns 15 minutos)

### 2.1 Criar o projeto
1. Abra **console.cloud.google.com** e entre com a sua conta Google.
2. No alto, clique no seletor de projeto (ao lado do logo "Google Cloud") e em **Novo projeto**.
3. Nome: `Órbita`. Clique em **Criar**. Espere ele ficar selecionado no alto da tela.

### 2.2 Ligar o Google Drive
1. No menu (☰), vá em **APIs e serviços > Biblioteca**.
2. Procure **Google Drive API**, abra e clique em **Ativar**.

### 2.3 Tela de permissão
1. No menu, vá em **APIs e serviços > Tela de consentimento OAuth** (pode aparecer como **Google Auth Platform**). Clique em **Começar** se aparecer.
2. **Nome do app:** `Órbita`. **E-mail de suporte:** o seu.
3. **Público-alvo:** **Externo**.
4. **Informações de contato:** o seu e-mail. Aceite os termos e clique em **Criar**.
5. Vá em **Branding** (ou "Informações do app") e preencha:
   - **Página inicial:** `https://danielsampaiorodrigues.github.io/orbita-versoes/`
   - **Política de privacidade:** `https://danielsampaiorodrigues.github.io/orbita-versoes/privacidade.html`
   - **Não envie logo.** Logo faz o Google pedir uma análise que demora semanas. Sem logo, não precisa.
   - Salve.
6. Vá em **Acesso a dados** (ou "Escopos") > **Adicionar ou remover escopos**. Marque estes três (dá para buscar pelo nome) e salve:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/drive.appdata`
7. Vá em **Público-alvo** e clique em **Publicar app** (sai de "Teste" para "Em produção"). Confirme. Em "Teste", a ligação com a conta cai a cada 7 dias; em produção, não.

### 2.4 Criar a chave do Órbita
1. Vá em **Clientes** (ou **APIs e serviços > Credenciais > Criar credenciais > ID do cliente OAuth**).
2. **Tipo de aplicativo:** **App para computador** (Desktop app). Nome: `Órbita Windows`. Clique em **Criar**.
3. Vão aparecer dois códigos: **ID do cliente** e **Chave secreta do cliente**. Deixe essa janela aberta para o passo 4.

---

## Parte 3: Microsoft (uns 10 minutos)

1. Abra **entra.microsoft.com** e entre com a sua conta Microsoft (Outlook, Hotmail ou do Windows).
   - Se ele pedir para criar uma assinatura do Azure ou um cartão de crédito, **pare** e me mande um print. Tem outro caminho.
2. Vá em **Aplicativos > Registros de aplicativo > Novo registro**.
3. **Nome:** `Órbita`.
4. **Tipos de conta:** marque **Contas em qualquer diretório organizacional e contas Microsoft pessoais** (a opção que inclui Skype e Xbox).
5. **URI de redirecionamento:** escolha **Cliente público/nativo (móvel e área de trabalho)** e escreva `http://localhost`
6. Clique em **Registrar**.
7. Na página que abrir, copie o **ID do aplicativo (cliente)**. É o código do passo 4.
8. No menu do app, vá em **Autenticação**. Lá embaixo, em **Permitir fluxos de clientes públicos**, marque **Sim** e salve.
9. Vá em **Permissões de APIs > Adicionar uma permissão > Microsoft Graph > Permissões delegadas**. Marque **Files.ReadWrite.AppFolder** e **offline_access** (o **User.Read** já vem marcado). Clique em **Adicionar permissões**.
10. Em **Identidade visual e propriedades** (Branding), preencha:
    - **URL da home page:** `https://danielsampaiorodrigues.github.io/orbita-versoes/`
    - **URL da política de privacidade:** `https://danielsampaiorodrigues.github.io/orbita-versoes/privacidade.html`
    - Salve.

---

## Parte 4: guardar os códigos no GitHub (5 minutos)

Igual ao que você fez com a chave das atualizações.

1. Abra **github.com/DanielSampaioRodrigues/-rbita/settings/secrets/actions**
2. **New repository secret**, um de cada vez:

| Name | O que colar |
|---|---|
| `ORBITA_GOOGLE_CLIENT_ID` | o **ID do cliente** do Google (passo 2.4) |
| `ORBITA_GOOGLE_CLIENT_SECRET` | a **Chave secreta do cliente** do Google (passo 2.4) |
| `ORBITA_MICROSOFT_CLIENT_ID` | o **ID do aplicativo (cliente)** da Microsoft (passo 3.7) |

3. Me avise com um "pronto". A próxima versão já sai com o login funcionando.

---

### Por que esses códigos não são perigosos como a chave das atualizações

Eles só dizem "este é o app Órbita". Não dão acesso a nenhuma conta: quem entra é sempre a própria pessoa, no site do Google ou da Microsoft, e ela vê exatamente o que o Órbita pede (só a pasta do app). Mesmo assim, ficam nos segredos do GitHub e não no código, por organização.
