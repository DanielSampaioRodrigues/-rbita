# 0007 · IA: provedores, chaves e sugestão de passos

25/10/2026 · decidido pelo Claude com autonomia dada por Dan; **revisar a mudança de onde ficam as chaves**.

**As chaves de API ficam dentro do banco criptografado, não no Gerenciador de Credenciais do Windows.** A especificação dizia "cofre do Windows". Mudei porque:
- no Gerenciador de Credenciais, qualquer programa aberto na sessão do Windows consegue ler a chave, mesmo com o Órbita bloqueado; dentro do banco, ela só abre com a senha, o PIN ou o Windows Hello;
- a chave vai junto no backup (que é criptografado) e funciona ao restaurar noutro computador, sem colar de novo;
- é um lugar só para tudo o que é sensível.

O custo: quem tiver o backup e a senha tem também a chave. Isso já vale para todos os outros dados. A chave nunca volta para a tela: a interface só vê os quatro últimos caracteres.

**Pedidos feitos pela parte nativa (Rust), não pela tela.** A chave não passa pela interface, e a política de segurança da janela continua sem liberar sites de fora.

**Duas integrações.** Claude (formato da Anthropic) e "compatível com GPT", que serve para GPT, Gemini, Grok, Sabiá e Ollama, mudando só o endereço. Só aceita `https://`, menos o próprio computador (Ollama, `http://localhost`), para a chave nunca viajar sem criptografia.

**Sem nomes de modelo fixos no código** (só uma sugestão para o Claude). "Conferir" pede a lista de modelos ao provedor: confere a chave sem gastar créditos e não envelhece quando surgem modelos novos.

**Recomendação para a IA local pela memória do computador**, sem citar modelos específicos, pelo mesmo motivo.

**Quebrar em passos: a pessoa vê antes o que vai ser enviado** e aperta um botão para pedir. Vai só o nome do projeto, o da etapa, os passos que já existem e, no projeto inteiro, o próximo passo do "onde parei". A resposta vira uma lista para marcar, editar, tirar ou completar; só o que foi confirmado é gravado.

**Dados sensíveis.** O bloqueio ("não enviar dados de saúde e terapia para fora do computador") já existe e é conferido na parte nativa, mas só vai ter efeito quando houver dados desse tipo (Onda 2) e na conversa (etapa 15).
