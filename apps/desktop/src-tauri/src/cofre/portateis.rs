//! Envelopes que viajam no backup: senha e chave de recuperação (6 palavras).
//! Valem em qualquer aparelho, ao contrário do PIN e do Windows Hello.
//!
//! Este arquivo é usado pelo Windows (dentro de `cofre`) e pelo motor do navegador
//! (`crates/motor-web`, por `#[path]`). Não pode usar arquivos nem nada do sistema.

use serde::{Deserialize, Serialize};
use unicode_normalization::UnicodeNormalization;

use super::cripto::{aleatorio, derivar, destrancar, trancar, Chave, Envelope, ParametrosKdf};
use super::palavras;
use crate::erro::Erro;

/// Envelopes que viajam no backup.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EnvelopesPortateis {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub senha: Option<Envelope>,
    pub recuperacao: Envelope,
}

pub(crate) fn rotulo(tipo: &str, id: &str) -> String {
    format!("orbita:{tipo}:v1:{id}")
}

/// Mesma senha, mesmos bytes, não importa como o teclado compôs os acentos.
pub(crate) fn bytes_da_senha(senha: &str) -> zeroize::Zeroizing<Vec<u8>> {
    zeroize::Zeroizing::new(senha.nfc().collect::<String>().into_bytes())
}

pub(crate) fn envelope_com_kdf(chave: &Chave, segredo: &[u8], tipo: &str, id: &str, pimenta: Option<&[u8]>, kdf: ParametrosKdf) -> Result<Envelope, Erro> {
    let sal = aleatorio::<16>().to_vec();
    let tranca = derivar(segredo, &sal, kdf, pimenta)?;
    trancar(chave, &tranca, &rotulo(tipo, id), Some(kdf), sal)
}

pub(crate) fn envelope_por_segredo(chave: &Chave, segredo: &[u8], tipo: &str, id: &str, pimenta: Option<&[u8]>) -> Result<Envelope, Erro> {
    envelope_com_kdf(chave, segredo, tipo, id, pimenta, ParametrosKdf::PADRAO)
}

/// Os parâmetros do Argon2 ficam no próprio envelope: quem abre usa os que vieram.
pub(crate) fn abrir_envelope_por_segredo(env: &Envelope, segredo: &[u8], tipo: &str, id: &str, pimenta: Option<&[u8]>) -> Result<Option<Chave>, Erro> {
    let kdf = env.kdf.ok_or_else(|| Erro::Interno("envelope sem parâmetros".into()))?;
    let tranca = derivar(segredo, &env.sal, kdf, pimenta)?;
    Ok(destrancar(env, &tranca, &rotulo(tipo, id)))
}

impl EnvelopesPortateis {
    pub fn abrir_com_senha(&self, senha: &str) -> Result<Chave, Erro> {
        let env = self.senha.as_ref().ok_or(Erro::SemSenha)?;
        abrir_envelope_por_segredo(env, &bytes_da_senha(senha), "senha", &self.id, None)?.ok_or(Erro::SenhaErrada)
    }

    pub fn tem_senha(&self) -> bool {
        self.senha.is_some()
    }

    pub fn abrir_com_palavras(&self, texto: &str) -> Result<Chave, Erro> {
        let lidas = palavras::ler(texto).map_err(|posicoes| Erro::PalavrasErradas { posicoes })?;
        abrir_envelope_por_segredo(&self.recuperacao, palavras::juntar(&lidas).as_bytes(), "recuperacao", &self.id, None)?
            .ok_or(Erro::ChaveDeRecuperacaoErrada)
    }

    #[allow(dead_code)] // usado pelo navegador
    /// Envelope da senha, com o custo escolhido (o navegador usa um custo próprio).
    pub fn envelope_da_senha(chave: &Chave, senha: &str, id: &str, kdf: ParametrosKdf) -> Result<Envelope, Erro> {
        envelope_com_kdf(chave, &bytes_da_senha(senha), "senha", id, None, kdf)
    }

    #[allow(dead_code)] // usado pelo navegador
    /// Envelope das 6 palavras (aceita o mesmo jeito de digitar que a tela de abrir).
    pub fn envelope_das_palavras(chave: &Chave, texto: &str, id: &str, kdf: ParametrosKdf) -> Result<Envelope, Erro> {
        let lidas = palavras::ler(texto).map_err(|posicoes| Erro::PalavrasErradas { posicoes })?;
        envelope_com_kdf(chave, palavras::juntar(&lidas).as_bytes(), "recuperacao", id, None, kdf)
    }
}
