//! Backup em arquivo único.
//!
//! O arquivo leva uma cópia do banco (já criptografado com a chave dos dados)
//! e os envelopes que valem em qualquer computador: senha e chave de
//! recuperação. PIN e Windows Hello não viajam, porque só valem neste aparelho.
//!
//! Formato: `ORBITABK` + tamanho do cabeçalho (4 bytes) + cabeçalho JSON + banco.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::banco;
use crate::cofre::cripto::Chave;
use crate::cofre::{Cofre, EnvelopesPortateis, ModoAbrir};
use crate::erro::Erro;

const MAGICA: &[u8; 8] = b"ORBITABK";
const VERSAO: u32 = 1;
pub const EXTENSAO: &str = "orbita-backup";
/// Quantos backups automáticos ficam guardados na pasta.
pub const MANTER_AUTOMATICOS: usize = 7;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cabecalho {
    pub versao: u32,
    pub criado_em: i64,
    pub versao_app: String,
    pub envelopes: EnvelopesPortateis,
    pub tamanho: u64,
    pub sha256: String,
}

/// O que a tela mostra antes de pedir a senha.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Informacao {
    pub criado_em: i64,
    pub versao_app: String,
}

pub enum Segredo {
    Senha(String),
    Palavras(String),
}

fn aspas_sql(caminho: &Path) -> String {
    caminho.to_string_lossy().replace('\'', "''")
}

/// Copia o banco aberto para um arquivo novo, com a mesma chave (cópia consistente).
fn exportar_banco(conn: &Connection, chave: &Chave, destino: &Path) -> Result<(), Erro> {
    if destino.exists() {
        fs::remove_file(destino)?;
    }
    let versao: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    let comando = zeroize::Zeroizing::new(format!(
        "ATTACH DATABASE '{}' AS copia KEY \"x'{}'\";",
        aspas_sql(destino),
        hex::encode(chave.as_ref())
    ));
    conn.execute_batch(&comando)?;
    let resultado = conn
        .query_row("SELECT sqlcipher_export('copia')", [], |_| Ok(()))
        .and_then(|_| conn.execute_batch(&format!("PRAGMA copia.user_version = {versao};")));
    conn.execute_batch("DETACH DATABASE copia;")?;
    resultado?;
    Ok(())
}

/// Grava num temporário ao lado e troca, para nunca deixar um backup pela metade.
fn gravar_seguro(destino: &Path, partes: &[&[u8]]) -> Result<(), Erro> {
    let temporario = destino.with_extension("parcial");
    {
        let mut f = fs::File::create(&temporario)?;
        for p in partes {
            f.write_all(p)?;
        }
        f.sync_all()?;
    }
    fs::rename(&temporario, destino)?;
    Ok(())
}

pub fn criar(cofre: &Cofre, conn: &Connection, chave: &Chave, destino: &Path) -> Result<(), Erro> {
    let copia = cofre.pasta().join("backup-em-andamento.db");
    exportar_banco(conn, chave, &copia)?;
    let dados = fs::read(&copia);
    let _ = fs::remove_file(&copia);
    let dados = dados?;

    let cabecalho = Cabecalho {
        versao: VERSAO,
        criado_em: banco::agora_ms(),
        versao_app: env!("CARGO_PKG_VERSION").to_string(),
        envelopes: cofre.envelopes_portateis()?,
        tamanho: dados.len() as u64,
        sha256: hex::encode(Sha256::digest(&dados)),
    };
    let json = serde_json::to_vec(&cabecalho).map_err(|e| Erro::Interno(e.to_string()))?;
    let tamanho = (json.len() as u32).to_le_bytes();
    gravar_seguro(destino, &[MAGICA, &tamanho, &json, &dados])
}

fn invalido(motivo: &str) -> Erro {
    Erro::BackupInvalido(motivo.to_string())
}

/// Lê e confere o arquivo inteiro, sem abrir nada.
pub fn ler(origem: &Path) -> Result<(Cabecalho, Vec<u8>), Erro> {
    let bruto = fs::read(origem)?;
    if bruto.len() < 12 || &bruto[..8] != MAGICA {
        return Err(invalido("este arquivo não é um backup do Órbita"));
    }
    let tamanho = u32::from_le_bytes(bruto[8..12].try_into().unwrap()) as usize;
    let fim = 12usize.checked_add(tamanho).filter(|f| *f <= bruto.len()).ok_or_else(|| invalido("o arquivo está incompleto"))?;
    let cabecalho: Cabecalho = serde_json::from_slice(&bruto[12..fim]).map_err(|_| invalido("o arquivo está danificado"))?;
    if cabecalho.versao > VERSAO {
        return Err(invalido("o backup foi feito por uma versão mais nova do Órbita; atualize o Órbita antes"));
    }
    let dados = bruto[fim..].to_vec();
    if dados.len() as u64 != cabecalho.tamanho || hex::encode(Sha256::digest(&dados)) != cabecalho.sha256 {
        return Err(invalido("o arquivo está incompleto ou danificado"));
    }
    Ok((cabecalho, dados))
}

pub fn informacao(origem: &Path) -> Result<Informacao, Erro> {
    let (c, _) = ler(origem)?;
    Ok(Informacao { criado_em: c.criado_em, versao_app: c.versao_app })
}

/// Restaura um backup. Quem chama precisa ter fechado o banco antes.
/// Os dados atuais vão para `anteriores/<data>/`, nunca são apagados.
/// Devolve a chave dos dados restaurados e o jeito de abrir que ficou valendo.
pub fn restaurar(cofre: &Cofre, origem: &Path, segredo: &Segredo) -> Result<(Chave, ModoAbrir), Erro> {
    let (cabecalho, dados) = ler(origem)?;
    let chave = match segredo {
        Segredo::Senha(s) => cabecalho.envelopes.abrir_com_senha(s)?,
        Segredo::Palavras(p) => cabecalho.envelopes.abrir_com_palavras(p)?,
    };

    // Confere que o banco abre (e atualiza, se for de versão antiga) antes de mexer em qualquer coisa.
    fs::create_dir_all(cofre.pasta())?;
    let novo = cofre.pasta().join("restaurando.db");
    gravar_seguro(&novo, &[&dados])?;
    if let Err(e) = banco::abrir(&novo, &chave) {
        let _ = fs::remove_file(&novo);
        return Err(e);
    }

    let modo_anterior = cofre.situacao()?.modo;
    guardar_atuais(cofre)?;
    fs::rename(&novo, cofre.caminho_banco())?;
    let modo = cofre.instalar_restauracao(cabecalho.envelopes, &chave, modo_anterior)?;
    Ok((chave, modo))
}

/// Move o banco e o cofre atuais para uma pasta de segurança.
fn guardar_atuais(cofre: &Cofre) -> Result<Option<PathBuf>, Erro> {
    let arquivos: Vec<PathBuf> = ["orbita.db", "cofre.json"].iter().map(|n| cofre.pasta().join(n)).filter(|p| p.exists()).collect();
    if arquivos.is_empty() {
        return Ok(None);
    }
    let marca = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let destino = cofre.pasta().join("anteriores").join(marca);
    fs::create_dir_all(&destino)?;
    for a in arquivos {
        fs::rename(&a, destino.join(a.file_name().unwrap()))?;
    }
    Ok(Some(destino))
}

pub fn nome_automatico(data: &str) -> String {
    format!("orbita-auto-{data}.{EXTENSAO}")
}

/// Faz o backup automático do dia na pasta escolhida e apaga os automáticos
/// mais antigos (só os que o próprio Órbita criou), mantendo os últimos 7.
pub fn automatico(cofre: &Cofre, conn: &Connection, chave: &Chave, pasta: &Path) -> Result<PathBuf, Erro> {
    fs::create_dir_all(pasta)?;
    let destino = pasta.join(nome_automatico(&chrono::Local::now().format("%Y-%m-%d").to_string()));
    criar(cofre, conn, chave, &destino)?;

    let mut automaticos: Vec<PathBuf> = fs::read_dir(pasta)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("orbita-auto-") && n.ends_with(&format!(".{EXTENSAO}")))
        })
        .collect();
    automaticos.sort();
    let sobrando = automaticos.len().saturating_sub(MANTER_AUTOMATICOS);
    for antigo in &automaticos[..sobrando] {
        let _ = fs::remove_file(antigo);
    }
    Ok(destino)
}

#[cfg(test)]
mod testes {
    use std::sync::Arc;

    use super::*;
    use crate::banco::notas;
    use crate::cofre::aparelho::GuardaEmMemoria;

    const SENHA: &str = "gato azul na janela";

    struct Ambiente {
        _pasta: tempfile::TempDir,
        cofre: Cofre,
    }

    fn ambiente() -> Ambiente {
        let pasta = tempfile::tempdir().unwrap();
        let cofre = Cofre::new(pasta.path().join("dados"), Arc::new(GuardaEmMemoria::default()));
        Ambiente { _pasta: pasta, cofre }
    }

    /// Cria um cofre com duas notas e faz backup. Devolve as palavras.
    fn preparar(a: &Ambiente, destino: &Path, modo: ModoAbrir) -> Vec<String> {
        let (chave, palavras) = a.cofre.criar(SENHA, modo, Some("2468")).unwrap();
        let conn = banco::abrir(&a.cofre.caminho_banco(), &chave).unwrap();
        notas::criar(&conn, "primeira").unwrap();
        notas::criar(&conn, "segunda").unwrap();
        criar(&a.cofre, &conn, &chave, destino).unwrap();
        palavras
    }

    fn textos_das_notas(cofre: &Cofre, chave: &Chave) -> Vec<String> {
        let conn = banco::abrir(&cofre.caminho_banco(), chave).unwrap();
        notas::listar(&conn).unwrap().into_iter().map(|n| n.texto).collect()
    }

    #[test]
    fn salvar_apagar_e_restaurar_noutro_computador() {
        let origem = ambiente();
        let arquivo = origem._pasta.path().join("meu.orbita-backup");
        preparar(&origem, &arquivo, ModoAbrir::Pin);

        // Computador novo: pasta vazia, outra guarda do aparelho.
        let novo = ambiente();
        let (chave, modo) = restaurar(&novo.cofre, &arquivo, &Segredo::Senha(SENHA.into())).unwrap();
        assert_eq!(modo, ModoAbrir::Senha);
        assert_eq!(textos_das_notas(&novo.cofre, &chave), vec!["segunda", "primeira"]);
        // E a senha continua abrindo o cofre restaurado.
        assert!(novo.cofre.abrir_com_senha(SENHA).is_ok());
    }

    #[test]
    fn restaura_com_as_palavras() {
        let origem = ambiente();
        let arquivo = origem._pasta.path().join("b.orbita-backup");
        let palavras = preparar(&origem, &arquivo, ModoAbrir::Senha);
        let novo = ambiente();
        let (chave, _) = restaurar(&novo.cofre, &arquivo, &Segredo::Palavras(palavras.join(" "))).unwrap();
        assert_eq!(textos_das_notas(&novo.cofre, &chave).len(), 2);
    }

    #[test]
    fn senha_errada_nao_mexe_em_nada() {
        let a = ambiente();
        let arquivo = a._pasta.path().join("b.orbita-backup");
        preparar(&a, &arquivo, ModoAbrir::Senha);
        let antes = fs::read(a.cofre.caminho_banco()).unwrap();
        assert!(matches!(restaurar(&a.cofre, &arquivo, &Segredo::Senha("errada errada errada".into())), Err(Erro::SenhaErrada)));
        assert_eq!(fs::read(a.cofre.caminho_banco()).unwrap(), antes);
        assert!(!a.cofre.pasta().join("anteriores").exists());
    }

    #[test]
    fn restaurar_por_cima_guarda_os_dados_atuais_e_mantem_o_hello() {
        let a = ambiente();
        let arquivo = a._pasta.path().join("b.orbita-backup");
        preparar(&a, &arquivo, ModoAbrir::Hello);
        // Depois do backup, uma nota nova que não está nele.
        let chave = a.cofre.abrir_com_senha(SENHA).unwrap();
        notas::criar(&banco::abrir(&a.cofre.caminho_banco(), &chave).unwrap(), "depois do backup").unwrap();

        let (chave, modo) = restaurar(&a.cofre, &arquivo, &Segredo::Senha(SENHA.into())).unwrap();
        assert_eq!(modo, ModoAbrir::Hello);
        assert!(a.cofre.abrir_depois_do_hello().is_ok());
        assert_eq!(textos_das_notas(&a.cofre, &chave).len(), 2);

        let guardadas: Vec<_> = fs::read_dir(a.cofre.pasta().join("anteriores")).unwrap().collect();
        assert_eq!(guardadas.len(), 1);
        let pasta = guardadas[0].as_ref().unwrap().path();
        assert!(pasta.join("orbita.db").exists() && pasta.join("cofre.json").exists());
    }

    #[test]
    fn recusa_arquivo_estranho_ou_danificado() {
        let a = ambiente();
        let arquivo = a._pasta.path().join("b.orbita-backup");
        preparar(&a, &arquivo, ModoAbrir::Senha);

        let estranho = a._pasta.path().join("foto.jpg");
        fs::write(&estranho, b"nao sou backup").unwrap();
        assert!(matches!(ler(&estranho), Err(Erro::BackupInvalido(_))));

        let mut bruto = fs::read(&arquivo).unwrap();
        let ultimo = bruto.len() - 1;
        bruto[ultimo] ^= 0xff;
        let danificado = a._pasta.path().join("danificado.orbita-backup");
        fs::write(&danificado, &bruto).unwrap();
        assert!(matches!(ler(&danificado), Err(Erro::BackupInvalido(_))));

        bruto.truncate(bruto.len() / 2);
        fs::write(&danificado, &bruto).unwrap();
        assert!(matches!(ler(&danificado), Err(Erro::BackupInvalido(_))));
    }

    #[test]
    fn o_backup_nao_guarda_nada_aberto() {
        let a = ambiente();
        let arquivo = a._pasta.path().join("b.orbita-backup");
        let palavras = preparar(&a, &arquivo, ModoAbrir::Senha);
        let bruto = fs::read(&arquivo).unwrap();
        let texto = String::from_utf8_lossy(&bruto);
        assert!(!texto.contains(SENHA));
        assert!(!texto.contains(&palavras.join(" ")));
        assert!(!bruto.windows(8).any(|j| j == b"primeira"));
    }

    #[test]
    fn automatico_guarda_so_os_ultimos_7_e_nao_toca_em_outros_arquivos() {
        let a = ambiente();
        let (chave, _) = a.cofre.criar(SENHA, ModoAbrir::Senha, None).unwrap();
        let conn = banco::abrir(&a.cofre.caminho_banco(), &chave).unwrap();
        let pasta = a._pasta.path().join("Drive");
        fs::create_dir_all(&pasta).unwrap();
        for dia in 1..=9 {
            fs::write(pasta.join(nome_automatico(&format!("2026-01-0{dia}"))), b"antigo").unwrap();
        }
        fs::write(pasta.join("minha-planilha.xlsx"), b"da pessoa").unwrap();
        fs::write(pasta.join("backup-manual.orbita-backup"), b"manual").unwrap();

        let feito = automatico(&a.cofre, &conn, &chave, &pasta).unwrap();
        assert!(ler(&feito).is_ok());
        let nomes: Vec<String> = fs::read_dir(&pasta).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
        assert_eq!(nomes.iter().filter(|n| n.starts_with("orbita-auto-")).count(), MANTER_AUTOMATICOS);
        assert!(nomes.contains(&"minha-planilha.xlsx".to_string()));
        assert!(nomes.contains(&"backup-manual.orbita-backup".to_string()));
        assert!(!nomes.contains(&nome_automatico("2026-01-01")));
    }
}
