//! Peças de criptografia: derivar chave de uma senha (Argon2id) e trancar
//! ou destrancar a chave dos dados (XChaCha20-Poly1305).

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use crate::erro::Erro;

pub type Chave = Zeroizing<[u8; 32]>;

/// Custo da derivação. Cada tentativa de adivinhar a senha leva por volta de
/// meio segundo e 64 MB de memória, o que torna ataques em massa inviáveis.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
pub struct ParametrosKdf {
    pub memoria_kib: u32,
    pub iteracoes: u32,
    pub paralelismo: u32,
}

impl ParametrosKdf {
    #[cfg(not(test))]
    pub const PADRAO: Self = Self { memoria_kib: 64 * 1024, iteracoes: 3, paralelismo: 1 };
    /// Nos testes, custo baixo para não demorar; a lógica é a mesma.
    #[cfg(test)]
    pub const PADRAO: Self = Self { memoria_kib: 1024, iteracoes: 1, paralelismo: 1 };
}

/// Uma chave trancada: só abre com a chave certa e o rótulo certo.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Envelope {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub kdf: Option<ParametrosKdf>,
    #[serde(with = "hex::serde", default)]
    pub sal: Vec<u8>,
    #[serde(with = "hex::serde")]
    pub nonce: Vec<u8>,
    #[serde(with = "hex::serde")]
    pub cifra: Vec<u8>,
}

pub fn aleatorio<const N: usize>() -> Zeroizing<[u8; N]> {
    let mut bytes = Zeroizing::new([0u8; N]);
    OsRng.fill_bytes(bytes.as_mut());
    bytes
}

pub fn nova_chave() -> Chave {
    aleatorio::<32>()
}

/// Deriva uma chave de 32 bytes a partir de um segredo humano (senha, PIN ou palavras).
/// `pimenta` é um segredo extra guardado fora do arquivo (a chave do aparelho, no caso do PIN).
pub fn derivar(segredo: &[u8], sal: &[u8], parametros: ParametrosKdf, pimenta: Option<&[u8]>) -> Result<Chave, Erro> {
    let params = Params::new(parametros.memoria_kib, parametros.iteracoes, parametros.paralelismo, Some(32))
        .map_err(|e| Erro::Interno(format!("parâmetros do Argon2: {e}")))?;
    let argon = match pimenta {
        Some(p) => Argon2::new_with_secret(p, Algorithm::Argon2id, Version::V0x13, params)
            .map_err(|e| Erro::Interno(format!("Argon2: {e}")))?,
        None => Argon2::new(Algorithm::Argon2id, Version::V0x13, params),
    };
    let mut saida = Zeroizing::new([0u8; 32]);
    argon
        .hash_password_into(segredo, sal, saida.as_mut())
        .map_err(|e| Erro::Interno(format!("Argon2: {e}")))?;
    Ok(saida)
}

/// Tranca `chave_dados` com `chave_tranca`. O rótulo impede trocar um envelope por outro.
pub fn trancar(chave_dados: &Chave, chave_tranca: &Chave, rotulo: &str, kdf: Option<ParametrosKdf>, sal: Vec<u8>) -> Result<Envelope, Erro> {
    let nonce = aleatorio::<24>();
    let cifrador = XChaCha20Poly1305::new(chave_tranca.as_ref().into());
    let cifra = cifrador
        .encrypt(XNonce::from_slice(nonce.as_ref()), Payload { msg: chave_dados.as_ref(), aad: rotulo.as_bytes() })
        .map_err(|_| Erro::Interno("falha ao trancar a chave".into()))?;
    Ok(Envelope { kdf, sal, nonce: nonce.to_vec(), cifra })
}

/// Destranca um envelope. Devolve `None` se a chave estiver errada.
pub fn destrancar(envelope: &Envelope, chave_tranca: &Chave, rotulo: &str) -> Option<Chave> {
    if envelope.nonce.len() != 24 {
        return None;
    }
    let cifrador = XChaCha20Poly1305::new(chave_tranca.as_ref().into());
    let aberto = Zeroizing::new(
        cifrador
            .decrypt(XNonce::from_slice(&envelope.nonce), Payload { msg: &envelope.cifra, aad: rotulo.as_bytes() })
            .ok()?,
    );
    let mut chave = Zeroizing::new([0u8; 32]);
    if aberto.len() != 32 {
        return None;
    }
    chave.copy_from_slice(&aberto);
    Some(chave)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn tranca_e_destranca() {
        let dados = nova_chave();
        let tranca = nova_chave();
        let env = trancar(&dados, &tranca, "teste", None, vec![]).unwrap();
        assert_eq!(*destrancar(&env, &tranca, "teste").unwrap(), *dados);
    }

    #[test]
    fn chave_ou_rotulo_errados_nao_abrem() {
        let dados = nova_chave();
        let tranca = nova_chave();
        let env = trancar(&dados, &tranca, "teste", None, vec![]).unwrap();
        assert!(destrancar(&env, &nova_chave(), "teste").is_none());
        assert!(destrancar(&env, &tranca, "outro").is_none());
    }

    #[test]
    fn derivacao_depende_da_pimenta() {
        let p = ParametrosKdf::PADRAO;
        let a = derivar(b"1234", b"sal-de-16-bytes!", p, Some(b"aparelho-a")).unwrap();
        let b = derivar(b"1234", b"sal-de-16-bytes!", p, Some(b"aparelho-b")).unwrap();
        let c = derivar(b"1234", b"sal-de-16-bytes!", p, Some(b"aparelho-a")).unwrap();
        assert_ne!(*a, *b);
        assert_eq!(*a, *c);
    }
}

#[cfg(test)]
mod medida {
    /// `cargo test --release medir_tempo -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn medir_tempo_da_derivacao_real() {
        let p = super::ParametrosKdf { memoria_kib: 64 * 1024, iteracoes: 3, paralelismo: 1 };
        let inicio = std::time::Instant::now();
        super::derivar(b"gato azul na janela", b"sal-de-16-bytes!", p, None).unwrap();
        println!("derivação real: {:?}", inicio.elapsed());
    }
}
