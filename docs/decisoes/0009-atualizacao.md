# 0009 · Atualização dentro do app

25/10/2026 · aprovado por Dan (repositório e segredos criados por ele).

**Plugin oficial de atualização do Tauri**, com assinatura própria. Cada instalador é assinado no GitHub com uma chave privada que fica só nos segredos do repositório (e numa cópia guardada por Dan). A chave pública vai no app (`tauri.conf.json`). O Órbita só instala uma versão se a assinatura conferir; um instalador trocado no caminho é recusado.

**Instaladores num repositório público à parte** (`orbita-versoes`). O código continua privado no `-rbita`; o app precisa baixar sem login, então os arquivos de versão ficam públicos. O GitHub do `-rbita` publica lá com uma chave de acesso que só escreve nesse repositório (`TOKEN_VERSOES`).

**Publica só quando a versão muda.** Todo envio de código ainda monta o instalador para teste (em Artifacts); a publicação acontece quando a versão do `tauri.conf.json` ainda não existe no `orbita-versoes`. As notas vêm de `apps/desktop/notas-da-versao.md`, que deve ser atualizado junto com a versão.

**Princípio 1 (previsibilidade).** Ao abrir, o Órbita só consulta se há versão nova (opção que dá para desligar) e mostra um aviso calmo. Nada é baixado sem a pessoa mandar. A janela mostra o que mudou antes, com "Instalar agora" e "Agora não". A consulta não envia nenhum dado da pessoa; o GitHub vê só o endereço de internet, como em qualquer download.

**No Windows**, a instalação é em modo passivo: aparece só uma barra de progresso do instalador, e o Órbita abre de novo sozinho. Os dados ficam na pasta do usuário e não são tocados.

**Primeira vez:** a versão 0.20.0 ainda precisa ser instalada à mão. Dali em diante, as versões novas chegam pelo app.

**Descartado:** loja da Microsoft (conta, revisão e espera a cada versão) e servidor próprio (custo e manutenção).
