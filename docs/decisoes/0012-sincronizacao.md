# 0012 · Sincronização entre aparelhos pelo Drive da pessoa

**Data:** 02/11/2026 · **Situação:** em construção (etapas 2a e 2b; 2c espera a credencial do Google) ·
**Base:** `0011-motor-unico.md` (Windows e navegador rodam o mesmo banco).

## O que Dan pediu (especificação, "Entrar com Google e sincronizar")

Tudo o que se faz num aparelho aparece no outro, sozinho. Sem servidor do Órbita: pela pasta escondida
do app no Google Drive da própria pessoa (`drive.appdata`). Sem internet, guarda e manda depois. Mesmo
item editado em dois aparelhos: vale o mais recente. Os dados vão trancados com uma senha que só a pessoa
sabe (nem o Google lê). Um aviso discreto mostra o estado ("Sincronizado há 1 min").

## Desenho

**Um arquivo por aparelho.** Cada aparelho tem um id próprio e grava no Drive **só o seu** arquivo
(`aparelho-<id>.orbita-sync`): o retrato de todas as linhas sincronizáveis do banco, trancado. Ele lê os
arquivos dos outros e junta no próprio banco. Como ninguém escreve no arquivo de outro, não há briga por
arquivo; como a junção é "linha a linha, vale a mais recente", a ordem não importa e repetir não estraga
(todos convergem para o mesmo resultado).

**Linha a linha, vale a mais recente.** As 9 tabelas já têm `id`, `alterado_em` e `excluido_em`. Para cada
linha vinda de outro aparelho: se não existe aqui, entra; se existe, fica a de `alterado_em` maior (empate:
o maior id de aparelho, para todos decidirem igual). Apagar é só uma linha com `excluido_em`, então o
apagado continua apagado nos outros.

**Configurações.** A tabela `config` ganha `alterado_em` (migração nova). Só viajam as chaves que são da
pessoa, não do aparelho: `valor:*` (dados de módulo: rotinas, focos, energia, estante, mapas, estudos),
`limite_projetos_ativos`, `media_aprovacao`, `basicos_do_dia`, `plano_de_crise`. **Não viajam:** chaves de
IA (`ia`, por segurança), conta da nuvem (`nuvem`), backup automático (`backup_auto_*`), chave de
recuperação do aparelho (`palavras_recuperacao`) e o id do aparelho.

**Anexos (imagens, livros, áudios).** O conteúdo não vai dentro do retrato: vai uma vez só, num arquivo
por conteúdo, nomeado pelo seu resumo (SHA-256) — `anexo-<sha256>.orbita-sync`. O retrato só diz qual
resumo cada anexo usa; quem não tem aquele conteúdo, baixa.

**Tranca.** Uma **chave de sincronização** aleatória tranca tudo (XChaCha20-Poly1305). Ela fica no Drive
dentro de um envelope aberto pela **senha de sincronização** da pessoa (Argon2id, o mesmo dos backups). No
aparelho, a chave fica dentro do banco criptografado. Aparelho novo: entra no Google, digita a senha,
abre o envelope e passa a sincronizar.

**Quem faz o quê.** O motor (Rust, igual nos dois lados) monta e junta os retratos e tranca/destranca. O
"maestro" (TypeScript, igual nos dois lados, porque a interface do Windows também é web) decide quando
sincronizar e fala com o Drive por um adaptador: no navegador, pela credencial web do Google; no
Windows, pela conta já ligada desde a 0.22.0. Nos testes, por uma pasta de mentira.

**Quando.** Ao abrir, a cada ~60 s com o app aberto, ao voltar para o app e logo depois de uma mudança
(com espera curta para juntar várias). Sem internet: marca que há coisa por enviar e tenta de novo.

## Etapas

- **2a** motor da sincronização (Rust) e testes de convergência entre dois bancos.
- **2b** maestro, adaptador de mentira, aviso "Sincronizado há…", e teste com dois navegadores.
- **2c** login com Google no navegador + adaptador do Drive (precisa da credencial "Aplicativo da Web").
- **2d** telas de aparelho novo: senha de sincronização, PIN igual em todos os aparelhos, 6 perguntas.

## Limites conhecidos

- Edição do **mesmo item** em dois aparelhos sem internet: o texto de um dos lados some (vale o mais
  recente). Avaliar depois guardar os dois.
- O retrato é o banco inteiro (sem os anexos): cresce com o uso. Medir; se pesar, passar para pacotes
  só com o que mudou.
- Relógio errado num aparelho pode fazer uma edição antiga "ganhar". Mitigação: guardar também a ordem
  local da edição e avisar quando o relógio parecer muito fora.
