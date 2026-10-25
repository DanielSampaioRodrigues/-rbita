//! Chave do aparelho: um segredo aleatório guardado pelo sistema (no Windows,
//! o Gerenciador de Credenciais, preso ao usuário). Sem ele, o PIN não serve
//! para nada, nem numa cópia do arquivo levada para outro computador.

#[cfg(test)]
use std::collections::HashMap;
#[cfg(test)]
use std::sync::Mutex;

use crate::cofre::cripto::{nova_chave, Chave};
use crate::erro::Erro;

pub trait GuardaDoAparelho: Send + Sync {
    fn ler(&self, id_cofre: &str) -> Result<Option<Chave>, Erro>;
    fn gravar(&self, id_cofre: &str, chave: &Chave) -> Result<(), Erro>;
    fn apagar(&self, id_cofre: &str) -> Result<(), Erro>;

    /// Lê a chave do aparelho ou cria uma nova.
    fn obter_ou_criar(&self, id_cofre: &str) -> Result<Chave, Erro> {
        if let Some(c) = self.ler(id_cofre)? {
            return Ok(c);
        }
        let nova = nova_chave();
        self.gravar(id_cofre, &nova)?;
        Ok(nova)
    }
}

fn hex_para_chave(texto: &str) -> Option<Chave> {
    let bytes = zeroize::Zeroizing::new(hex::decode(texto.trim()).ok()?);
    if bytes.len() != 32 {
        return None;
    }
    let mut chave = zeroize::Zeroizing::new([0u8; 32]);
    chave.copy_from_slice(&bytes);
    Some(chave)
}

/// Guarda do sistema operacional.
pub struct GuardaDoSistema {
    pub servico: String,
}

impl GuardaDoSistema {
    fn entrada(&self, id_cofre: &str) -> Result<keyring::Entry, Erro> {
        keyring::Entry::new(&self.servico, &format!("aparelho-{id_cofre}"))
            .map_err(|e| Erro::Interno(format!("cofre do sistema: {e}")))
    }
}

impl GuardaDoAparelho for GuardaDoSistema {
    fn ler(&self, id_cofre: &str) -> Result<Option<Chave>, Erro> {
        match self.entrada(id_cofre)?.get_password() {
            Ok(texto) => Ok(hex_para_chave(&zeroize::Zeroizing::new(texto))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(Erro::Interno(format!("cofre do sistema: {e}"))),
        }
    }

    fn gravar(&self, id_cofre: &str, chave: &Chave) -> Result<(), Erro> {
        let texto = zeroize::Zeroizing::new(hex::encode(chave.as_ref()));
        self.entrada(id_cofre)?
            .set_password(&texto)
            .map_err(|e| Erro::Interno(format!("cofre do sistema: {e}")))
    }

    fn apagar(&self, id_cofre: &str) -> Result<(), Erro> {
        match self.entrada(id_cofre)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(Erro::Interno(format!("cofre do sistema: {e}"))),
        }
    }
}

/// Guarda em memória, para os testes.
#[cfg(test)]
#[derive(Default)]
pub struct GuardaEmMemoria(pub(crate) Mutex<HashMap<String, [u8; 32]>>);

#[cfg(test)]
impl GuardaDoAparelho for GuardaEmMemoria {
    fn ler(&self, id_cofre: &str) -> Result<Option<Chave>, Erro> {
        Ok(self.0.lock().unwrap().get(id_cofre).map(|c| zeroize::Zeroizing::new(*c)))
    }
    fn gravar(&self, id_cofre: &str, chave: &Chave) -> Result<(), Erro> {
        self.0.lock().unwrap().insert(id_cofre.to_string(), **chave);
        Ok(())
    }
    fn apagar(&self, id_cofre: &str) -> Result<(), Erro> {
        self.0.lock().unwrap().remove(id_cofre);
        Ok(())
    }
}
