//! Só as peças do cofre que valem em qualquer aparelho (os mesmos arquivos do Windows).
//! O cofre do dia a dia no navegador fica em `apps/desktop/src/web/cofreWeb.ts` (WebCrypto).

#[path = "../../../../apps/desktop/src-tauri/src/cofre/cripto.rs"]
pub mod cripto;
#[path = "../../../../apps/desktop/src-tauri/src/cofre/palavras.rs"]
#[allow(dead_code)]
pub mod palavras;
#[path = "../../../../apps/desktop/src-tauri/src/cofre/portateis.rs"]
#[allow(dead_code)]
mod portateis;
pub use portateis::EnvelopesPortateis;
