# 0004 · Backup em arquivo único

25/10/2026 · aprovado por Dan

**Formato.** `ORBITABK` + tamanho do cabeçalho + cabeçalho JSON + cópia do banco.
- A cópia do banco é feita com `sqlcipher_export`, já criptografada com a chave dos dados: o backup não precisa de uma segunda criptografia.
- O cabeçalho leva os envelopes da senha e da chave de recuperação (os mesmos do `cofre.json`), a data, a versão do app e o SHA-256 da cópia, para detectar arquivo incompleto ou danificado.
- PIN e Windows Hello ficam de fora: só valem no aparelho onde foram criados.

**Restauração.** Lê e confere o arquivo, abre com a senha ou as palavras, testa o banco num arquivo à parte e só então troca. O banco e o cofre atuais vão para `anteriores/<data e hora>/`. Windows Hello e abrir direto continuam como estavam; PIN volta para senha, porque o PIN não pode ser recriado sem a pessoa.

**Automático.** Desligado por padrão. Ligado, roda ao bloquear e ao fechar a janela, no máximo uma vez a cada 20 horas, na pasta escolhida. Nome `orbita-auto-AAAA-MM-DD.orbita-backup`; guarda os 7 mais recentes e só apaga arquivos com esse padrão, nunca outros arquivos da pasta. Falhas ficam registradas e aparecem em Ajustes.

**Por que não criptografar de novo com outra chave.** Seria mais código sem ganho: quem tem a senha já abre o banco; quem não tem, não abre nem o banco nem o backup.
