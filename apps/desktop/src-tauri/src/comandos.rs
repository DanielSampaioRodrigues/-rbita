//! Comandos que a interface chama. A chave dos dados só existe em memória
//! enquanto o Órbita está aberto; "Bloquear" a apaga.

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;
use tauri::State;

use crate::banco::{self, notas::Nota};
use crate::cofre::cripto::Chave;
use crate::cofre::{palavras, Cofre, ModoAbrir, Situacao};
use crate::erro::Erro;

const CONFIG_PALAVRAS: &str = "palavras_recuperacao";

struct Sessao {
    conn: Connection,
    /// Guardada para as próximas etapas (backup); apagada da memória ao bloquear.
    #[allow(dead_code)]
    chave: Chave,
}

pub struct Estado {
    cofre: Cofre,
    sessao: Mutex<Option<Sessao>>,
}

impl Estado {
    pub fn new(cofre: Cofre) -> Self {
        Self { cofre, sessao: Mutex::new(None) }
    }

    fn iniciar_sessao(&self, chave: Chave) -> Result<(), Erro> {
        let conn = banco::abrir(&self.cofre.caminho_banco(), &chave)?;
        *self.sessao.lock().unwrap() = Some(Sessao { conn, chave });
        Ok(())
    }

    fn com_sessao<T>(&self, f: impl FnOnce(&Sessao) -> Result<T, Erro>) -> Result<T, Erro> {
        let guarda = self.sessao.lock().unwrap();
        f(guarda.as_ref().ok_or(Erro::Bloqueado)?)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SituacaoCompleta {
    #[serde(flatten)]
    situacao: Situacao,
    aberto: bool,
}

#[tauri::command]
pub async fn situacao(estado: State<'_, Estado>) -> Result<SituacaoCompleta, Erro> {
    Ok(SituacaoCompleta { situacao: estado.cofre.situacao()?, aberto: estado.sessao.lock().unwrap().is_some() })
}

/// Cria o cofre, já deixa aberto e devolve as 6 palavras para a pessoa guardar.
#[tauri::command]
pub async fn criar_cofre(estado: State<'_, Estado>, senha: String, modo: ModoAbrir, pin: Option<String>) -> Result<Vec<String>, Erro> {
    let (chave, palavras) = estado.cofre.criar(&senha, modo, pin.as_deref())?;
    estado.iniciar_sessao(chave)?;
    estado.com_sessao(|s| banco::gravar_config(&s.conn, CONFIG_PALAVRAS, &palavras.join(" ")))?;
    Ok(palavras)
}

#[tauri::command]
pub async fn abrir_com_senha(estado: State<'_, Estado>, senha: String) -> Result<(), Erro> {
    let chave = estado.cofre.abrir_com_senha(&senha)?;
    estado.iniciar_sessao(chave)
}

#[tauri::command]
pub async fn abrir_com_pin(estado: State<'_, Estado>, pin: String) -> Result<(), Erro> {
    let chave = estado.cofre.abrir_com_pin(&pin)?;
    estado.iniciar_sessao(chave)
}

#[tauri::command]
pub async fn abrir_direto(estado: State<'_, Estado>) -> Result<(), Erro> {
    let chave = estado.cofre.abrir_direto()?;
    estado.iniciar_sessao(chave)
}

/// Só confere as palavras, sem abrir. Serve para a tela avisar antes de pedir a nova senha.
#[tauri::command]
pub async fn conferir_palavras(estado: State<'_, Estado>, texto: String) -> Result<(), Erro> {
    estado.cofre.abrir_com_palavras(&texto).map(|_| ())
}

/// Esqueci a senha: as palavras abrem o cofre e a pessoa define uma senha nova.
#[tauri::command]
pub async fn recuperar(estado: State<'_, Estado>, texto: String, nova_senha: String) -> Result<(), Erro> {
    let chave = estado.cofre.abrir_com_palavras(&texto)?;
    estado.cofre.trocar_senha(&chave, &nova_senha)?;
    estado.iniciar_sessao(chave)
}

#[tauri::command]
pub async fn ler_arquivo_recuperacao(caminho: PathBuf) -> Result<String, Erro> {
    let tamanho = std::fs::metadata(&caminho)?.len();
    if tamanho > 64 * 1024 {
        return Err(Erro::Arquivo("o arquivo é grande demais para ser uma chave de recuperação".into()));
    }
    let texto = std::fs::read_to_string(&caminho)?;
    let lidas = palavras::ler_arquivo(&texto).map_err(|posicoes| Erro::PalavrasErradas { posicoes })?;
    Ok(lidas.join(" "))
}

#[tauri::command]
pub async fn gravar_arquivo_recuperacao(estado: State<'_, Estado>, caminho: PathBuf) -> Result<(), Erro> {
    let palavras = estado.com_sessao(|s| banco::ler_config(&s.conn, CONFIG_PALAVRAS))?.unwrap_or_default();
    let lista: Vec<String> = palavras.split_whitespace().map(String::from).collect();
    std::fs::write(&caminho, palavras::texto_do_arquivo(&lista))?;
    Ok(())
}

/// Mostra as palavras de novo. Pede a senha, mesmo com o Órbita aberto.
#[tauri::command]
pub async fn ver_palavras(estado: State<'_, Estado>, senha: String) -> Result<Vec<String>, Erro> {
    estado.cofre.abrir_com_senha(&senha)?;
    let palavras = estado.com_sessao(|s| banco::ler_config(&s.conn, CONFIG_PALAVRAS))?.unwrap_or_default();
    Ok(palavras.split_whitespace().map(String::from).collect())
}

#[tauri::command]
pub async fn trocar_senha(estado: State<'_, Estado>, atual: String, nova: String) -> Result<(), Erro> {
    let chave = estado.cofre.abrir_com_senha(&atual)?;
    estado.cofre.trocar_senha(&chave, &nova)
}

#[tauri::command]
pub async fn mudar_modo(estado: State<'_, Estado>, senha: String, modo: ModoAbrir, pin: Option<String>) -> Result<(), Erro> {
    let chave = estado.cofre.abrir_com_senha(&senha)?;
    estado.cofre.mudar_modo(&chave, modo, pin.as_deref())
}

#[tauri::command]
pub async fn bloquear(estado: State<'_, Estado>) -> Result<(), Erro> {
    *estado.sessao.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn listar_notas(estado: State<'_, Estado>) -> Result<Vec<Nota>, Erro> {
    estado.com_sessao(|s| banco::notas::listar(&s.conn))
}

#[tauri::command]
pub async fn criar_nota(estado: State<'_, Estado>, texto: String) -> Result<Nota, Erro> {
    estado.com_sessao(|s| banco::notas::criar(&s.conn, &texto))
}

#[tauri::command]
pub async fn excluir_nota(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| banco::notas::excluir(&s.conn, &id))
}
