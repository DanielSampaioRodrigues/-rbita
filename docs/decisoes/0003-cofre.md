# 0003 · Cofre: senha, PIN e chave de recuperação

25/10/2026 · aprovado por Dan

**Como funciona.** Uma chave de 256 bits, sorteada no aparelho, criptografa o banco inteiro (SQLCipher). Essa chave nunca é gravada aberta: o arquivo `cofre.json` guarda só "envelopes", cópias dela trancadas (XChaCha20-Poly1305) por:

| Envelope | Tranca com | Observação |
| --- | --- | --- |
| senha | Argon2id da senha (64 MB, 3 passadas, cerca de 0,3 s) | Sempre existe |
| recuperação | Argon2id das 6 palavras | Sempre existe |
| PIN | Argon2id do PIN, com um segredo do aparelho como "pimenta" | Só neste computador |
| abrir direto | o segredo do aparelho | Só neste computador |
| Windows Hello | o segredo do aparelho, liberado só depois da confirmação do Windows | Só neste computador |

O segredo do aparelho fica no Gerenciador de Credenciais do Windows, preso ao usuário. Sem ele, o PIN não serve, nem com uma cópia do arquivo.

**Por que não só PIN.** Um PIN sozinho, como única tranca, cai em poucos dias contra quem copiar o arquivo (backup na nuvem, pendrive, notebook roubado). Por isso a senha forte fica por trás e o PIN só abre neste aparelho, com limite de 5 tentativas.

**Por que 6 palavras e não 12.** O elo mais fraco é a senha. Seis palavras de uma lista de 2.048 dão cerca de 66 bits; com o custo do Argon2, testar todas leva muito mais que uma vida. Mais palavras só dificultariam a digitação.

**Por que não recuperar por e-mail ou SMS.** Exigiria um servidor capaz de abrir os dados, contas de usuário e responsabilidade pela guarda de dados de saúde e terapia (LGPD). Em troca: arquivo de recuperação, impressão, cópia para o próprio e-mail, pessoa de confiança e, com a sincronização futura, recuperação por outro aparelho aberto.

**Limite honesto.** PIN e abrir direto protegem contra quem mexe no computador, não contra um vírus no usuário do Windows. A tela avisa isso.

**Detalhes.**
- Senhas são normalizadas (Unicode NFC): o mesmo acento digitado de jeitos diferentes abre igual.
- O `cofre.json` é gravado num arquivo temporário e depois trocado, para nunca ficar pela metade.
- Um banco encontrado sem cofre (criação interrompida) é renomeado, nunca apagado.
- As palavras ficam guardadas dentro do banco criptografado, para poderem ser vistas de novo com a senha.
- Exclusões são marcadas (`excluido_em`), não apagadas, para a sincronização futura.

**Windows Hello** (25/10/2026). O Windows confirma a pessoa (digital, rosto ou PIN do Windows) e só então o Órbita usa o segredo do aparelho. O pedido é preso à janela do Órbita (`RequestVerificationForWindowAsync`), para não abrir atrás dela. A proteção é do mesmo nível do PIN: contra quem mexe no computador, não contra um vírus no usuário. Se o Windows Hello deixar de funcionar, o Órbita pede a senha.
