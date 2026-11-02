//! Backup portátil (formato 2): o mesmo arquivo `.orbita-backup` no Windows e no navegador.
//!
//! Este arquivo é usado pelo Windows (`backup.rs`) e pelo motor do navegador
//! (`crates/motor-web`, por `#[path]`). Só trabalha com bytes: nada de arquivos nem do sistema.
//!
//! Formato: `ORBITABK` + tamanho do cabeçalho (4 bytes, little-endian) + cabeçalho JSON + conteúdo.
//!
//! - Cabeçalho: `versao` (2), `criadoEm`, `versaoApp`, `origem` ("windows" ou "navegador"),
//!   os envelopes da senha e das 6 palavras (Argon2id + XChaCha20-Poly1305, os mesmos do cofre),
//!   `tamanho` e `sha256` do conteúdo e o `nonce` da tranca.
//! - Conteúdo: o banco SQLite em bytes simples (como sai do `serialize`), trancado com
//!   XChaCha20-Poly1305 pela chave dos dados. Sem SQLCipher, para o navegador abrir sem ele.
//!
//! A versão fica dentro do JSON (e não logo depois de `ORBITABK`) de propósito: um Órbita antigo
//! que só conhece a versão 1 lê o cabeçalho e avisa "atualize o Órbita", em vez de quebrar.
//! A versão 1 (só Windows) levava o banco cifrado com SQLCipher; o Windows continua lendo.

// Algumas peças só são usadas pelo navegador (ou só pelo Windows).
#![allow(dead_code)]

use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use crate::cofre::cripto::{aleatorio, Chave, ParametrosKdf};
use crate::cofre::EnvelopesPortateis;
use crate::erro::Erro;

pub const MAGICA: &[u8; 8] = b"ORBITABK";
/// Versão que este código grava.
pub const VERSAO: u32 = 2;
/// Formato antigo do Windows (banco cifrado com SQLCipher dentro).
pub const VERSAO_SQLCIPHER: u32 = 1;
/// Onde as 6 palavras ficam guardadas dentro do banco (tabela `config`), para "Ver a chave".
pub const CONFIG_PALAVRAS: &str = "palavras_recuperacao";

/// Custo do Argon2 dos envelopes criados no navegador: o mesmo do Windows (64 MB, 3 passadas).
/// Medido no Chromium (WebAssembly, 02/11/2026): ~0,2 s por tentativa; no iPad deve ficar perto
/// de 1 s. Quem abre usa os parâmetros gravados no envelope; se um dia o navegador precisar de um
/// custo mais leve, basta mudar aqui (o Windows continua abrindo).
pub const KDF_NAVEGADOR: ParametrosKdf = ParametrosKdf::PADRAO;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Origem {
    Windows,
    Navegador,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cabecalho {
    pub versao: u32,
    pub criado_em: i64,
    pub versao_app: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origem: Option<Origem>,
    pub envelopes: EnvelopesPortateis,
    pub tamanho: u64,
    pub sha256: String,
    /// Só na versão 2: o nonce da tranca do conteúdo.
    #[serde(default, skip_serializing_if = "Vec::is_empty", with = "hex::serde")]
    pub nonce: Vec<u8>,
}

/// O que a tela mostra antes de pedir a senha.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Informacao {
    pub criado_em: i64,
    pub versao_app: String,
    /// Sem senha, o backup abre com as 6 palavras, e a pessoa escolhe como abrir no dia a dia.
    pub tem_senha: bool,
    pub versao: u32,
    pub origem: Option<Origem>,
}

pub enum Segredo {
    Senha(String),
    Palavras(String),
}

fn invalido(motivo: &str) -> Erro {
    Erro::BackupInvalido(motivo.to_string())
}

fn rotulo_dados(id: &str) -> String {
    format!("orbita:backup:v2:{id}")
}

/// Lê e confere o arquivo inteiro (tamanho e soma de conferência), sem abrir nada.
/// Devolve o cabeçalho e o conteúdo (ainda trancado).
pub fn ler(bruto: &[u8]) -> Result<(Cabecalho, &[u8]), Erro> {
    if bruto.len() < 12 || &bruto[..8] != MAGICA {
        return Err(invalido("este arquivo não é um backup do Órbita"));
    }
    let tamanho = u32::from_le_bytes(bruto[8..12].try_into().unwrap()) as usize;
    let fim = 12usize.checked_add(tamanho).filter(|f| *f <= bruto.len()).ok_or_else(|| invalido("o arquivo está incompleto"))?;
    let cabecalho: Cabecalho = serde_json::from_slice(&bruto[12..fim]).map_err(|_| invalido("o arquivo está danificado"))?;
    if cabecalho.versao > VERSAO {
        return Err(invalido("o backup foi feito por uma versão mais nova do Órbita; atualize o Órbita antes"));
    }
    let dados = &bruto[fim..];
    if dados.len() as u64 != cabecalho.tamanho || hex::encode(Sha256::digest(dados)) != cabecalho.sha256 {
        return Err(invalido("o arquivo está incompleto ou danificado"));
    }
    if cabecalho.versao == VERSAO && cabecalho.nonce.len() != 24 {
        return Err(invalido("o arquivo está danificado"));
    }
    Ok((cabecalho, dados))
}

pub fn informacao(bruto: &[u8]) -> Result<Informacao, Erro> {
    let (c, _) = ler(bruto)?;
    Ok(Informacao { criado_em: c.criado_em, versao_app: c.versao_app, tem_senha: c.envelopes.tem_senha(), versao: c.versao, origem: c.origem })
}

/// Monta o arquivo de backup a partir do banco em bytes simples (sem SQLCipher).
/// Os envelopes são os do cofre de quem faz o backup (trancam a mesma `chave`).
pub fn montar(banco: &[u8], chave: &Chave, envelopes: EnvelopesPortateis, origem: Origem, versao_app: &str) -> Result<Vec<u8>, Erro> {
    if !banco.starts_with(b"SQLite format 3\0") {
        return Err(Erro::Interno("o banco para o backup não está em bytes simples".into()));
    }
    let nonce = aleatorio::<24>();
    let cifra = XChaCha20Poly1305::new(chave.as_ref().into())
        .encrypt(XNonce::from_slice(nonce.as_ref()), Payload { msg: banco, aad: rotulo_dados(&envelopes.id).as_bytes() })
        .map_err(|_| Erro::Interno("falha ao trancar o backup".into()))?;
    let cabecalho = Cabecalho {
        versao: VERSAO,
        criado_em: crate::banco::agora_ms(),
        versao_app: versao_app.to_string(),
        origem: Some(origem),
        envelopes,
        tamanho: cifra.len() as u64,
        sha256: hex::encode(Sha256::digest(&cifra)),
        nonce: nonce.to_vec(),
    };
    let json = serde_json::to_vec(&cabecalho).map_err(|e| Erro::Interno(e.to_string()))?;
    let mut saida = Vec::with_capacity(12 + json.len() + cifra.len());
    saida.extend_from_slice(MAGICA);
    saida.extend_from_slice(&(json.len() as u32).to_le_bytes());
    saida.extend_from_slice(&json);
    saida.extend_from_slice(&cifra);
    Ok(saida)
}

/// Abre a chave dos dados com a senha ou com as 6 palavras do backup.
pub fn destrancar_chave(cabecalho: &Cabecalho, segredo: &Segredo) -> Result<Chave, Erro> {
    match segredo {
        Segredo::Senha(s) => cabecalho.envelopes.abrir_com_senha(s),
        Segredo::Palavras(p) => cabecalho.envelopes.abrir_com_palavras(p),
    }
}

/// Destranca o banco de um backup versão 2. Devolve os bytes simples do SQLite.
pub fn abrir_banco(cabecalho: &Cabecalho, conteudo: &[u8], chave: &Chave) -> Result<Zeroizing<Vec<u8>>, Erro> {
    if cabecalho.versao != VERSAO {
        return Err(invalido(
            "ele foi feito por uma versão antiga do Órbita para Windows, que só abre no Windows. Abra no Windows, atualize o Órbita e faça um backup novo",
        ));
    }
    let aberto = XChaCha20Poly1305::new(chave.as_ref().into())
        .decrypt(XNonce::from_slice(&cabecalho.nonce), Payload { msg: conteudo, aad: rotulo_dados(&cabecalho.envelopes.id).as_bytes() })
        .map_err(|_| invalido("os dados dentro dele não abriram"))?;
    let aberto = Zeroizing::new(aberto);
    if !aberto.starts_with(b"SQLite format 3\0") {
        return Err(invalido("os dados dentro dele estão danificados"));
    }
    Ok(aberto)
}

/// Backup versão 2 aberto: a chave dos dados, o banco em bytes simples e o cabeçalho.
pub struct Aberto {
    pub chave: Chave,
    pub banco: Zeroizing<Vec<u8>>,
    pub cabecalho: Cabecalho,
}

/// Lê, confere e abre um backup versão 2 com a senha ou as palavras.
pub fn abrir(bruto: &[u8], segredo: &Segredo) -> Result<Aberto, Erro> {
    let (cabecalho, conteudo) = ler(bruto)?;
    let chave = destrancar_chave(&cabecalho, segredo)?;
    let banco = abrir_banco(&cabecalho, conteudo, &chave)?;
    Ok(Aberto { chave, banco, cabecalho })
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::cofre::cripto::nova_chave;

    const SENHA: &str = "gato azul na janela";
    const PALAVRAS: &str = "abacate abater abelha abismo abrigar absurdo";

    fn banco_simples() -> Vec<u8> {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE t (x TEXT); INSERT INTO t VALUES ('olá');").unwrap();
        conn.serialize(rusqlite::MAIN_DB).unwrap().to_vec()
    }

    fn envelopes(chave: &Chave, kdf: ParametrosKdf) -> EnvelopesPortateis {
        let id = "teste-id".to_string();
        EnvelopesPortateis {
            senha: Some(EnvelopesPortateis::envelope_da_senha(chave, SENHA, &id, kdf).unwrap()),
            recuperacao: EnvelopesPortateis::envelope_das_palavras(chave, PALAVRAS, &id, kdf).unwrap(),
            id,
        }
    }

    #[test]
    fn montar_e_abrir_ida_e_volta() {
        let chave = nova_chave();
        let banco = banco_simples();
        let bruto = montar(&banco, &chave, envelopes(&chave, ParametrosKdf::PADRAO), Origem::Navegador, "9.9.9").unwrap();
        let info = informacao(&bruto).unwrap();
        assert!(info.tem_senha);
        assert_eq!((info.versao, info.origem, info.versao_app.as_str()), (2, Some(Origem::Navegador), "9.9.9"));

        let a = abrir(&bruto, &Segredo::Senha(SENHA.into())).unwrap();
        assert_eq!(*a.chave, *chave);
        assert_eq!(a.banco.as_slice(), banco.as_slice());
        // As palavras abrem também, digitadas só com as 4 primeiras letras.
        let b = abrir(&bruto, &Segredo::Palavras("abac abat abel abis abri absu".into())).unwrap();
        assert_eq!(b.banco.as_slice(), banco.as_slice());
        // Nada aberto no arquivo.
        assert!(!bruto.windows(3).any(|j| j == "olá".as_bytes()));
    }

    #[test]
    fn senha_errada_e_arquivo_mexido_nao_abrem() {
        let chave = nova_chave();
        let bruto = montar(&banco_simples(), &chave, envelopes(&chave, ParametrosKdf::PADRAO), Origem::Windows, "1").unwrap();
        assert!(matches!(abrir(&bruto, &Segredo::Senha("errada errada errada".into())), Err(Erro::SenhaErrada)));
        let mut mexido = bruto.clone();
        let ultimo = mexido.len() - 1;
        mexido[ultimo] ^= 1;
        assert!(matches!(abrir(&mexido, &Segredo::Senha(SENHA.into())), Err(Erro::BackupInvalido(_))));
        assert!(matches!(ler(b"ORBITABK"), Err(Erro::BackupInvalido(_))));
    }

    #[test]
    fn quem_abre_usa_o_custo_gravado_no_envelope() {
        // O custo vai no envelope: quem abre não precisa saber de onde veio nem qual era.
        let chave = nova_chave();
        let outro = ParametrosKdf { memoria_kib: 2048, iteracoes: 2, paralelismo: 1 };
        let bruto = montar(&banco_simples(), &chave, envelopes(&chave, outro), Origem::Navegador, "1").unwrap();
        assert!(abrir(&bruto, &Segredo::Senha(SENHA.into())).is_ok());
    }
}
