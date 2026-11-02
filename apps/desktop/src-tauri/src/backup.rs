//! Backup em arquivo único.
//!
//! O arquivo leva o banco inteiro e os envelopes que valem em qualquer aparelho:
//! senha e chave de recuperação. PIN e Windows Hello não viajam, porque só valem
//! neste computador.
//!
//! O formato está em `portatil.rs` e é o mesmo no navegador (versão 2): o banco em
//! bytes simples, trancado com a chave dos dados. O Windows continua lendo a versão 1
//! (o banco cifrado com SQLCipher dentro), dos backups feitos até a 0.45.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use zeroize::Zeroizing;

use crate::banco;
use crate::cofre::cripto::Chave;
use crate::cofre::{palavras, Cofre, EnvelopesPortateis, ModoAbrir};
use crate::erro::Erro;
use crate::portatil::{self, Origem, VERSAO_SQLCIPHER};

pub use crate::portatil::{Cabecalho, Informacao, Segredo};

pub const EXTENSAO: &str = "orbita-backup";
/// Quantos backups automáticos ficam guardados na pasta.
pub const MANTER_AUTOMATICOS: usize = 7;

fn aspas_sql(caminho: &Path) -> String {
    caminho.to_string_lossy().replace('\'', "''")
}

/// O banco aberto em bytes simples (sem SQLCipher), sem gravar nada aberto no disco:
/// copia para um banco na memória sem chave e pega os bytes dele.
pub(crate) fn banco_simples(conn: &Connection) -> Result<Zeroizing<Vec<u8>>, Erro> {
    let versao: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    conn.execute_batch("ATTACH DATABASE ':memory:' AS simples KEY '';")?;
    let resultado = (|| -> Result<Zeroizing<Vec<u8>>, Erro> {
        conn.query_row("SELECT sqlcipher_export('simples')", [], |_| Ok(()))?;
        conn.execute_batch(&format!("PRAGMA simples.user_version = {versao};"))?;
        serializar(conn, c"simples")
    })();
    conn.execute_batch("DETACH DATABASE simples;")?;
    resultado
}

/// Copia os bytes de um esquema (`sqlite3_serialize`). O `serialize` do rusqlite pede
/// a conexão como `&mut`, e a sessão só empresta `&Connection`; por isso a chamada direta.
fn serializar(conn: &Connection, esquema: &std::ffi::CStr) -> Result<Zeroizing<Vec<u8>>, Erro> {
    use rusqlite::ffi;
    let mut tamanho: ffi::sqlite3_int64 = 0;
    // SAFETY: o ponteiro da conexão vale enquanto `conn` existe; o SQLite devolve uma cópia
    // nova (flags 0), que lemos e liberamos com `sqlite3_free`.
    unsafe {
        let p = ffi::sqlite3_serialize(conn.handle(), esquema.as_ptr(), &mut tamanho, 0);
        if p.is_null() || tamanho <= 0 {
            return Err(Erro::Interno("não consegui copiar o banco para o backup".into()));
        }
        let copia = Zeroizing::new(std::slice::from_raw_parts(p, tamanho as usize).to_vec());
        std::ptr::write_bytes(p, 0, tamanho as usize);
        ffi::sqlite3_free(p.cast());
        Ok(copia)
    }
}

/// Grava os bytes simples de um banco como arquivo cifrado com SQLCipher (a chave dos dados).
fn gravar_cifrado(simples: &[u8], chave: &Chave, destino: &Path) -> Result<(), Erro> {
    if destino.exists() {
        fs::remove_file(destino)?;
    }
    banco::preparar_sqlite();
    let mut mem = Connection::open_in_memory()?;
    mem.deserialize_read_exact(rusqlite::MAIN_DB, simples, simples.len(), true)?;
    let versao: i64 = mem.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    let comando = Zeroizing::new(format!("ATTACH DATABASE '{}' AS cifrado KEY \"x'{}'\";", aspas_sql(destino), hex::encode(chave.as_ref())));
    mem.execute_batch(&comando)?;
    let resultado = mem
        .query_row("SELECT sqlcipher_export('cifrado')", [], |_| Ok(()))
        .and_then(|_| mem.execute_batch(&format!("PRAGMA cifrado.user_version = {versao};")));
    mem.execute_batch("DETACH DATABASE cifrado;")?;
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

/// Os bytes do arquivo de backup (formato 2), com os envelopes dados.
pub(crate) fn montar(conn: &Connection, chave: &Chave, envelopes: EnvelopesPortateis) -> Result<Vec<u8>, Erro> {
    let simples = banco_simples(conn)?;
    portatil::montar(&simples, chave, envelopes, Origem::Windows, env!("CARGO_PKG_VERSION"))
}

pub fn criar(cofre: &Cofre, conn: &Connection, chave: &Chave, destino: &Path) -> Result<(), Erro> {
    let bruto = montar(conn, chave, cofre.envelopes_portateis()?)?;
    gravar_seguro(destino, &[&bruto])
}

/// Lê e confere o arquivo inteiro, sem abrir nada. Devolve o cabeçalho e o conteúdo trancado.
pub fn ler(origem: &Path) -> Result<(Cabecalho, Vec<u8>), Erro> {
    let bruto = fs::read(origem)?;
    let (cabecalho, conteudo) = portatil::ler(&bruto)?;
    Ok((cabecalho, conteudo.to_vec()))
}

pub fn informacao(origem: &Path) -> Result<Informacao, Erro> {
    portatil::informacao(&fs::read(origem)?)
}

/// Restaura um backup (versão 1 ou 2). Quem chama precisa ter fechado o banco antes.
/// Os dados atuais vão para `anteriores/<data>/`, nunca são apagados.
/// Devolve a chave dos dados restaurados e o jeito de abrir que ficou valendo.
/// `escolha`: como abrir no dia a dia depois (obrigatória se o backup não tem senha).
pub fn restaurar(cofre: &Cofre, origem: &Path, segredo: &Segredo, escolha: Option<(ModoAbrir, Option<&str>)>) -> Result<(Chave, ModoAbrir), Erro> {
    let (cabecalho, dados) = ler(origem)?;
    // Confere a escolha antes de mexer em qualquer coisa (um PIN inválido não pode deixar o cofre pela metade).
    match escolha {
        Some((ModoAbrir::Pin, pin)) => crate::cofre::validar_pin(pin.unwrap_or(""))?,
        Some((ModoAbrir::Senha, _)) if !cabecalho.envelopes.tem_senha() => return Err(Erro::SemSenha),
        _ => {}
    }
    if escolha.is_none() && !cabecalho.envelopes.tem_senha() && !matches!(cofre.situacao()?.modo, Some(ModoAbrir::Hello | ModoAbrir::Direto)) {
        return Err(Erro::SemSenha);
    }
    let chave = portatil::destrancar_chave(&cabecalho, segredo)?;

    // Confere que o banco abre (e atualiza, se for de versão antiga) antes de mexer em qualquer coisa.
    fs::create_dir_all(cofre.pasta())?;
    let novo = cofre.pasta().join("restaurando.db");
    let preparado = (|| -> Result<(), Erro> {
        if cabecalho.versao == VERSAO_SQLCIPHER {
            gravar_seguro(&novo, &[&dados])?;
        } else {
            let simples = portatil::abrir_banco(&cabecalho, &dados, &chave)?;
            gravar_cifrado(&simples, &chave, &novo)?;
        }
        let conn = banco::abrir(&novo, &chave)?;
        // As 6 palavras ficam no banco para "Ver a chave". Se o backup não as trouxe
        // e a pessoa acabou de digitá-las, guarda agora.
        if let Segredo::Palavras(texto) = segredo {
            if banco::ler_config(&conn, portatil::CONFIG_PALAVRAS)?.is_none() {
                if let Ok(lidas) = palavras::ler(texto) {
                    banco::gravar_config(&conn, portatil::CONFIG_PALAVRAS, &palavras::juntar(&lidas))?;
                }
            }
        }
        Ok(())
    })();
    if let Err(e) = preparado {
        let _ = fs::remove_file(&novo);
        return Err(e);
    }

    let modo_anterior = cofre.situacao()?.modo;
    guardar_atuais(cofre)?;
    fs::rename(&novo, cofre.caminho_banco())?;
    let modo = cofre.instalar_restauracao(cabecalho.envelopes, &chave, modo_anterior, escolha)?;
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
    use crate::banco::itens;
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

    /// Cria um cofre com duas ideias e faz backup. Devolve as palavras.
    fn preparar(a: &Ambiente, destino: &Path, modo: ModoAbrir) -> Vec<String> {
        let (chave, palavras) = a.cofre.criar(Some(SENHA), modo, Some("2468")).unwrap();
        let conn = banco::abrir(&a.cofre.caminho_banco(), &chave).unwrap();
        itens::criar_ideia(&conn, "primeira").unwrap();
        itens::criar_ideia(&conn, "segunda").unwrap();
        criar(&a.cofre, &conn, &chave, destino).unwrap();
        palavras
    }

    fn textos_das_ideias(cofre: &Cofre, chave: &Chave) -> Vec<String> {
        let conn = banco::abrir(&cofre.caminho_banco(), chave).unwrap();
        itens::listar_ideias(&conn).unwrap().into_iter().map(|n| n.texto).collect()
    }

    #[test]
    fn salvar_apagar_e_restaurar_noutro_computador() {
        let origem = ambiente();
        let arquivo = origem._pasta.path().join("meu.orbita-backup");
        preparar(&origem, &arquivo, ModoAbrir::Pin);

        // Computador novo: pasta vazia, outra guarda do aparelho.
        let novo = ambiente();
        let (chave, modo) = restaurar(&novo.cofre, &arquivo, &Segredo::Senha(SENHA.into()), None).unwrap();
        assert_eq!(modo, ModoAbrir::Senha);
        assert_eq!(textos_das_ideias(&novo.cofre, &chave), vec!["segunda", "primeira"]);
        // E a senha continua abrindo o cofre restaurado.
        assert!(novo.cofre.abrir_com_senha(SENHA).is_ok());
    }

    #[test]
    fn restaura_com_as_palavras() {
        let origem = ambiente();
        let arquivo = origem._pasta.path().join("b.orbita-backup");
        let palavras = preparar(&origem, &arquivo, ModoAbrir::Senha);
        let novo = ambiente();
        let (chave, _) = restaurar(&novo.cofre, &arquivo, &Segredo::Palavras(palavras.join(" ")), None).unwrap();
        assert_eq!(textos_das_ideias(&novo.cofre, &chave).len(), 2);
    }

    #[test]
    fn senha_errada_nao_mexe_em_nada() {
        let a = ambiente();
        let arquivo = a._pasta.path().join("b.orbita-backup");
        preparar(&a, &arquivo, ModoAbrir::Senha);
        let antes = fs::read(a.cofre.caminho_banco()).unwrap();
        assert!(matches!(restaurar(&a.cofre, &arquivo, &Segredo::Senha("errada errada errada".into()), None), Err(Erro::SenhaErrada)));
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
        itens::criar_ideia(&banco::abrir(&a.cofre.caminho_banco(), &chave).unwrap(), "depois do backup").unwrap();

        let (chave, modo) = restaurar(&a.cofre, &arquivo, &Segredo::Senha(SENHA.into()), None).unwrap();
        assert_eq!(modo, ModoAbrir::Hello);
        assert!(a.cofre.abrir_depois_do_hello().is_ok());
        assert_eq!(textos_das_ideias(&a.cofre, &chave).len(), 2);

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
        let (chave, _) = a.cofre.criar(Some(SENHA), ModoAbrir::Senha, None).unwrap();
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

    /// O portão da Onda 1: salvar, apagar tudo e restaurar, com todo tipo de dado.
    #[test]
    fn salvar_apagar_e_restaurar_com_todos_os_dados() {
        use crate::banco::{energia, eventos, rotinas};
        use crate::ia;

        let origem = ambiente();
        let (chave, _) = origem.cofre.criar(Some(SENHA), ModoAbrir::Pin, Some("2468")).unwrap();
        let conn = banco::abrir(&origem.cofre.caminho_banco(), &chave).unwrap();
        let ideia = itens::criar_ideia(&conn, "Livro sobre faróis").unwrap();
        itens::salvar_nota_ideia(&conn, &ideia.id, "Um farol por capítulo").unwrap();
        let arte = crate::banco::etiquetas::criar(&conn, "Arte", "rosa").unwrap();
        crate::banco::etiquetas::definir_do_item(&conn, &ideia.id, &[arte.id]).unwrap();
        let projeto = itens::criar_projeto(&conn, "TCC", true).unwrap();
        itens::definir_datas_projeto(&conn, &projeto.id, Some("2026-10-01"), Some("2026-12-15")).unwrap();
        let etapa = itens::criar_tarefa(&conn, &projeto.id, "Revisão de literatura").unwrap();
        itens::criar_tarefa(&conn, &etapa.id, "Fichar 5 artigos").unwrap();
        itens::definir_prazo_tarefa(&conn, &etapa.id, Some("2026-11-03")).unwrap();
        let inicio = 1_793_000_000_000;
        eventos::salvar(
            &conn,
            eventos::Evento {
                id: String::new(),
                titulo: "Terapia".into(),
                inicio,
                fim: Some(inicio + 3_600_000),
                dia_inteiro: false,
                repeticao: Some(eventos::Repeticao { frequencia: "semanal".into(), dias: vec![4], ate: None }),
                modelo: false,
                notas: String::new(),
                excecoes: vec![],
                cor: None,
            },
        )
        .unwrap();
        let rotina = rotinas::criar(&conn, "Manhã").unwrap();
        let passo = rotinas::salvar_passo(&conn, &rotina.id, rotinas::Passo { titulo: "Tomar água".into(), minutos: Some(1), ..Default::default() }).unwrap();
        crate::banco::anexos::anexar_arquivo(&conn, &passo.id, "copo.png", b"imagem-do-copo").unwrap();
        energia::registrar(&conn, 2, "dia pesado").unwrap();
        crate::banco::valores::gravar(&conn, "foco.salvos", r#"[{"id":"a","nome":"Estudar","minutos":45,"pausa":10}]"#).unwrap();
        let claude = ia::Provedor { id: String::new(), tipo: ia::TipoProvedor::Claude, nome: "Claude".into(), url: "https://api.anthropic.com".into(), modelo: "claude-opus-5-5".into() };
        ia::salvar_provedor(&conn, claude, Some("sk-ant-chave-1234")).unwrap();

        let arquivo = origem._pasta.path().join("tudo.orbita-backup");
        criar(&origem.cofre, &conn, &chave, &arquivo).unwrap();
        drop(conn);

        // Apagar: os dados somem do computador; sobra só o arquivo de backup.
        let backup_fora = tempfile::tempdir().unwrap();
        let copia = backup_fora.path().join("tudo.orbita-backup");
        fs::copy(&arquivo, &copia).unwrap();
        drop(origem);

        let novo = ambiente();
        let (chave, _) = restaurar(&novo.cofre, &copia, &Segredo::Senha(SENHA.into()), None).unwrap();
        let conn = banco::abrir(&novo.cofre.caminho_banco(), &chave).unwrap();
        let i = &itens::listar_ideias(&conn).unwrap()[0];
        assert_eq!((i.texto.as_str(), i.nota.as_str(), i.etiquetas.len()), ("Livro sobre faróis", "Um farol por capítulo", 1));
        let p = itens::listar_projetos(&conn).unwrap().into_iter().find(|p| p.titulo == "TCC").unwrap();
        assert_eq!((p.inicio.as_deref(), p.prazo.as_deref()), (Some("2026-10-01"), Some("2026-12-15")));
        let tarefas = itens::listar_tarefas(&conn, &p.id).unwrap();
        assert_eq!(tarefas.len(), 2);
        assert!(tarefas.iter().any(|t| t.titulo == "Revisão de literatura" && t.prazo.as_deref() == Some("2026-11-03")));
        let ev = eventos::listar(&conn, inicio - 1, inicio + 1).unwrap();
        assert!(ev.iter().any(|e| e.titulo == "Terapia" && e.repeticao.is_some()));
        let r = rotinas::listar(&conn).unwrap();
        assert_eq!(r[0].passos[0].titulo, "Tomar água");
        // O anexo (conteúdo dentro do banco) volta junto.
        let img = r[0].passos[0].imagem.clone().expect("imagem do passo");
        assert_eq!(crate::banco::anexos::conteudo(&conn, &img).unwrap(), b"imagem-do-copo");
        assert_eq!(energia::listar(&conn, 0, i64::MAX).unwrap()[0].nota, "dia pesado");
        // O cofre de valores (focos salvos, rotinas, energia) volta junto.
        assert_eq!(crate::banco::valores::ler(&conn, "foco.salvos").unwrap().as_deref(), Some(r#"[{"id":"a","nome":"Estudar","minutos":45,"pausa":10}]"#));
        let e = ia::estado(&conn).unwrap();
        assert_eq!(e.provedores[0].final_chave.as_deref(), Some("1234"));
        // A senha continua abrindo o cofre restaurado.
        assert!(novo.cofre.abrir_com_senha(SENHA).is_ok());
    }

    #[test]
    fn backup_sem_senha_abre_com_as_palavras_e_pede_o_jeito_de_abrir() {
        let origem = ambiente();
        let pasta = tempfile::tempdir().unwrap();
        let arquivo = pasta.path().join("sem-senha.orbita-backup");
        let (chave, palavras) = origem.cofre.criar(None, ModoAbrir::Pin, Some("2468")).unwrap();
        let conn = banco::abrir(&origem.cofre.caminho_banco(), &chave).unwrap();
        itens::criar_ideia(&conn, "sem senha").unwrap();
        criar(&origem.cofre, &conn, &chave, &arquivo).unwrap();
        assert!(!informacao(&arquivo).unwrap().tem_senha);

        let novo = ambiente();
        let segredo = Segredo::Palavras(palavras.join(" "));
        // Sem dizer como abrir, não restaura (não há senha para voltar).
        assert!(matches!(restaurar(&novo.cofre, &arquivo, &segredo, None), Err(Erro::SemSenha)));
        assert!(matches!(restaurar(&novo.cofre, &arquivo, &segredo, Some((ModoAbrir::Senha, None))), Err(Erro::SemSenha)));
        let (chave, modo) = restaurar(&novo.cofre, &arquivo, &segredo, Some((ModoAbrir::Pin, Some("1357")))).unwrap();
        assert_eq!(modo, ModoAbrir::Pin);
        assert_eq!(textos_das_ideias(&novo.cofre, &chave), vec!["sem senha"]);
        assert!(novo.cofre.abrir_com_pin("1357").is_ok());
    }

    /// Monta um backup no formato antigo (versão 1, até a 0.45): o banco cifrado com SQLCipher dentro.
    fn criar_v1(cofre: &Cofre, conn: &Connection, chave: &Chave, destino: &Path) {
        use sha2::{Digest, Sha256};
        let copia = cofre.pasta().join("v1.db");
        let versao: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        conn.execute_batch(&format!("ATTACH DATABASE '{}' AS copia KEY \"x'{}'\";", aspas_sql(&copia), hex::encode(chave.as_ref()))).unwrap();
        conn.query_row("SELECT sqlcipher_export('copia')", [], |_| Ok(())).unwrap();
        conn.execute_batch(&format!("PRAGMA copia.user_version = {versao}; DETACH DATABASE copia;")).unwrap();
        let dados = fs::read(&copia).unwrap();
        fs::remove_file(&copia).unwrap();
        let cab = serde_json::json!({
            "versao": 1, "criadoEm": 1, "versaoApp": "0.45.2",
            "envelopes": cofre.envelopes_portateis().unwrap(),
            "tamanho": dados.len(), "sha256": hex::encode(Sha256::digest(&dados)),
        });
        let json = serde_json::to_vec(&cab).unwrap();
        gravar_seguro(destino, &[portatil::MAGICA, &(json.len() as u32).to_le_bytes(), &json, &dados]).unwrap();
    }

    #[test]
    fn ainda_restaura_backup_antigo_versao_1() {
        let origem = ambiente();
        let (chave, palavras) = origem.cofre.criar(Some(SENHA), ModoAbrir::Senha, None).unwrap();
        let conn = banco::abrir(&origem.cofre.caminho_banco(), &chave).unwrap();
        itens::criar_ideia(&conn, "do backup antigo").unwrap();
        let arquivo = origem._pasta.path().join("antigo.orbita-backup");
        criar_v1(&origem.cofre, &conn, &chave, &arquivo);
        assert_eq!(informacao(&arquivo).unwrap().versao, 1);

        let novo = ambiente();
        let (chave, _) = restaurar(&novo.cofre, &arquivo, &Segredo::Senha(SENHA.into()), None).unwrap();
        assert_eq!(textos_das_ideias(&novo.cofre, &chave), vec!["do backup antigo"]);
        let outro = ambiente();
        let (chave, _) = restaurar(&outro.cofre, &arquivo, &Segredo::Palavras(palavras.join(" ")), None).unwrap();
        assert_eq!(textos_das_ideias(&outro.cofre, &chave).len(), 1);
    }

    #[test]
    fn backup_novo_e_versao_2_e_o_banco_restaurado_fica_cifrado_no_disco() {
        let origem = ambiente();
        let arquivo = origem._pasta.path().join("v2.orbita-backup");
        let palavras = preparar(&origem, &arquivo, ModoAbrir::Senha);
        let info = informacao(&arquivo).unwrap();
        assert_eq!((info.versao, info.origem), (2, Some(Origem::Windows)));
        // O conteúdo é o banco em bytes simples, trancado: abre com a chave, sem SQLCipher.
        let aberto = portatil::abrir(&fs::read(&arquivo).unwrap(), &Segredo::Palavras(palavras.join(" "))).unwrap();
        let mut mem = Connection::open_in_memory().unwrap();
        mem.deserialize_read_exact(rusqlite::MAIN_DB, aberto.banco.as_slice(), aberto.banco.len(), true).unwrap();
        let n: i64 = mem.query_row("SELECT count(*) FROM item WHERE tipo = 'ideia'", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 2);

        let novo = ambiente();
        let (chave, _) = restaurar(&novo.cofre, &arquivo, &Segredo::Senha(SENHA.into()), None).unwrap();
        assert_eq!(textos_das_ideias(&novo.cofre, &chave).len(), 2);
        let disco = fs::read(novo.cofre.caminho_banco()).unwrap();
        assert!(!disco.starts_with(b"SQLite format 3"), "o banco restaurado precisa ficar cifrado");
        assert!(!disco.windows(8).any(|j| j == b"primeira"));
        assert!(fs::read_dir(novo.cofre.pasta()).unwrap().all(|e| !e.unwrap().file_name().to_string_lossy().contains("restaurando")));
    }

    // ── Testes cruzados com o navegador (rodam à mão; ver scripts/teste-web.cjs) ──

    /// Gera um backup do Windows (uma ideia e um compromisso) com o custo real do Argon2,
    /// para o navegador abrir. `ORBITA_CRUZADO=/tmp/x cargo test --release gerar_backup_do_windows -- --ignored`
    /// Grava `do-windows.orbita-backup` e `do-windows.json` (senha e palavras) na pasta.
    #[test]
    #[ignore]
    fn gerar_backup_do_windows() {
        use crate::banco::eventos;
        use crate::cofre::cripto::ParametrosKdf;
        let pasta = PathBuf::from(std::env::var("ORBITA_CRUZADO").expect("defina ORBITA_CRUZADO"));
        fs::create_dir_all(&pasta).unwrap();
        let a = ambiente();
        let (chave, palavras) = a.cofre.criar(Some(SENHA), ModoAbrir::Senha, None).unwrap();
        let conn = banco::abrir(&a.cofre.caminho_banco(), &chave).unwrap();
        banco::gravar_config(&conn, portatil::CONFIG_PALAVRAS, &palavras.join(" ")).unwrap();
        itens::criar_ideia(&conn, "Ideia vinda do Windows").unwrap();
        // Hoje ao meio-dia, para aparecer na Agenda do navegador sem navegar.
        let inicio = chrono::Local::now().date_naive().and_hms_opt(12, 0, 0).unwrap().and_local_timezone(chrono::Local).unwrap().timestamp_millis();
        eventos::salvar(
            &conn,
            eventos::Evento {
                id: String::new(),
                titulo: "Compromisso vindo do Windows".into(),
                inicio,
                fim: Some(inicio + 3_600_000),
                dia_inteiro: false,
                repeticao: None,
                modelo: false,
                notas: String::new(),
                excecoes: vec![],
                cor: None,
            },
        )
        .unwrap();
        // Envelopes com o custo real do Windows (os testes usam um custo baixo).
        let real = ParametrosKdf { memoria_kib: 64 * 1024, iteracoes: 3, paralelismo: 1 };
        let id = a.cofre.envelopes_portateis().unwrap().id;
        let envelopes = EnvelopesPortateis {
            senha: Some(EnvelopesPortateis::envelope_da_senha(&chave, SENHA, &id, real).unwrap()),
            recuperacao: EnvelopesPortateis::envelope_das_palavras(&chave, &palavras.join(" "), &id, real).unwrap(),
            id,
        };
        let bruto = montar(&conn, &chave, envelopes).unwrap();
        fs::write(pasta.join("do-windows.orbita-backup"), &bruto).unwrap();
        fs::write(pasta.join("do-windows.json"), serde_json::json!({ "senha": SENHA, "palavras": palavras }).to_string()).unwrap();
        println!("backup do Windows em {}", pasta.display());
    }

    /// Abre o backup feito no navegador pelo teste `scripts/teste-web.cjs --cruzado <pasta>`
    /// (`do-navegador.orbita-backup` + `do-navegador.json`) e confere os dados.
    /// `ORBITA_CRUZADO=/tmp/x cargo test --release abrir_backup_do_navegador -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn abrir_backup_do_navegador() {
        use crate::banco::eventos;
        let pasta = PathBuf::from(std::env::var("ORBITA_CRUZADO").expect("defina ORBITA_CRUZADO"));
        let arquivo = pasta.join("do-navegador.orbita-backup");
        let dados: serde_json::Value = serde_json::from_str(&fs::read_to_string(pasta.join("do-navegador.json")).unwrap()).unwrap();
        let senha = dados["senha"].as_str().unwrap().to_string();
        let palavras: Vec<String> = dados["palavras"].as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect();
        let info = informacao(&arquivo).unwrap();
        assert_eq!((info.versao, info.origem, info.tem_senha), (2, Some(Origem::Navegador), true));

        let conferir = |cofre: &Cofre, chave: &Chave| {
            let conn = banco::abrir(&cofre.caminho_banco(), chave).unwrap();
            let ideias: Vec<String> = itens::listar_ideias(&conn).unwrap().into_iter().map(|n| n.texto).collect();
            println!("ideias: {ideias:?}");
            assert!(ideias.iter().any(|t| t == "Ideia logo antes do backup"));
            assert!(ideias.iter().any(|t| t == "Ideia de teste com acentuação ção"));
            let ev = eventos::listar(&conn, 0, i64::MAX).unwrap();
            println!("compromissos: {:?}", ev.iter().map(|e| e.titulo.as_str()).collect::<Vec<_>>());
            assert!(ev.iter().any(|e| e.titulo == "Consulta teste"));
            // As 6 palavras vieram dentro do banco (para "Ver a chave").
            assert_eq!(banco::ler_config(&conn, portatil::CONFIG_PALAVRAS).unwrap(), Some(palavras.join(" ")));
        };
        let com_senha = ambiente();
        let inicio = std::time::Instant::now();
        let (chave, modo) = restaurar(&com_senha.cofre, &arquivo, &Segredo::Senha(senha.clone()), None).unwrap();
        println!("restaurado com a senha em {:?}", inicio.elapsed());
        assert_eq!(modo, ModoAbrir::Senha);
        conferir(&com_senha.cofre, &chave);
        assert!(com_senha.cofre.abrir_com_senha(&senha).is_ok());

        let com_palavras = ambiente();
        let (chave, _) = restaurar(&com_palavras.cofre, &arquivo, &Segredo::Palavras(palavras.join(" ")), None).unwrap();
        conferir(&com_palavras.cofre, &chave);
        assert!(com_palavras.cofre.abrir_com_palavras(&palavras.join(" ")).is_ok());
    }
}
