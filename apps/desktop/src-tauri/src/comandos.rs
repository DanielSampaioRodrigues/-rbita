//! Comandos que a interface chama. A chave dos dados só existe em memória
//! enquanto o Órbita está aberto; "Bloquear" a apaga.

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;
use tauri::{State, WebviewWindow};

use crate::backup;
use crate::banco::{self, eventos, itens, rotinas};
use crate::cofre::cripto::Chave;
use crate::cofre::{palavras, Cofre, ModoAbrir, Situacao};
use crate::erro::Erro;

const CONFIG_PALAVRAS: &str = "palavras_recuperacao";

struct Sessao {
    conn: Connection,
    /// Usada pelo backup; apagada da memória ao bloquear.
    chave: Chave,
}

const CONFIG_BACKUP_PASTA: &str = "backup_auto_pasta";
const CONFIG_BACKUP_ULTIMO: &str = "backup_auto_ultimo";
const CONFIG_BACKUP_ERRO: &str = "backup_auto_erro";
/// Um backup automático por dia, no máximo.
const INTERVALO_AUTOMATICO_MS: i64 = 20 * 60 * 60 * 1000;

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

    /// Faz o backup automático se estiver ligado e o último tiver mais de 20 horas.
    /// Chamado ao bloquear e ao fechar. Erros ficam guardados para a tela mostrar.
    pub fn backup_automatico_se_preciso(&self, forcar: bool) {
        let _ = self.com_sessao(|s| {
            let Some(pasta) = banco::ler_config(&s.conn, CONFIG_BACKUP_PASTA)? else { return Ok(()) };
            let ultimo: i64 = banco::ler_config(&s.conn, CONFIG_BACKUP_ULTIMO)?.and_then(|v| v.parse().ok()).unwrap_or(0);
            let agora = banco::agora_ms();
            if !forcar && agora - ultimo < INTERVALO_AUTOMATICO_MS {
                return Ok(());
            }
            match backup::automatico(&self.cofre, &s.conn, &s.chave, std::path::Path::new(&pasta)) {
                Ok(_) => {
                    banco::gravar_config(&s.conn, CONFIG_BACKUP_ULTIMO, &agora.to_string())?;
                    banco::apagar_config(&s.conn, CONFIG_BACKUP_ERRO)?;
                }
                Err(e) => banco::gravar_config(&s.conn, CONFIG_BACKUP_ERRO, &e.to_string())?,
            }
            Ok(())
        });
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

#[tauri::command]
pub async fn hello_disponivel() -> Result<bool, Erro> {
    tauri::async_runtime::spawn_blocking(crate::hello::disponivel)
        .await
        .map_err(|e| Erro::Interno(e.to_string()))
}

#[tauri::command]
pub async fn abrir_com_hello(estado: State<'_, Estado>, janela: WebviewWindow) -> Result<(), Erro> {
    confirmar_com_hello(&janela).await?;
    let chave = estado.cofre.abrir_depois_do_hello()?;
    estado.iniciar_sessao(chave)
}

/// Mostra o pedido do Windows Hello por cima da janela do Órbita.
async fn confirmar_com_hello(janela: &WebviewWindow) -> Result<(), Erro> {
    #[cfg(windows)]
    let ponteiro = janela.hwnd().map_err(|e| Erro::Interno(e.to_string()))?.0 as usize;
    #[cfg(not(windows))]
    let ponteiro = {
        let _ = janela;
        0usize
    };
    let resultado = tauri::async_runtime::spawn_blocking(move || {
        crate::hello::confirmar(ponteiro as *mut core::ffi::c_void, "Confirme que é você para abrir o Órbita.")
    })
    .await
    .map_err(|e| Erro::Interno(e.to_string()))?;
    match resultado {
        crate::hello::Resultado::Confirmado => Ok(()),
        crate::hello::Resultado::Cancelado => Err(Erro::HelloCancelado),
        crate::hello::Resultado::Indisponivel => Err(Erro::HelloIndisponivel),
    }
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
    estado.backup_automatico_se_preciso(false);
    *estado.sessao.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn fazer_backup(estado: State<'_, Estado>, caminho: PathBuf) -> Result<(), Erro> {
    estado.com_sessao(|s| backup::criar(&estado.cofre, &s.conn, &s.chave, &caminho))
}

#[tauri::command]
pub async fn info_backup(caminho: PathBuf) -> Result<backup::Informacao, Erro> {
    backup::informacao(&caminho)
}

/// Restaura um backup, com a senha ou as palavras dele. Serve também num computador novo.
#[tauri::command]
pub async fn restaurar_backup(
    estado: State<'_, Estado>,
    caminho: PathBuf,
    senha: Option<String>,
    palavras: Option<String>,
) -> Result<ModoAbrir, Erro> {
    let segredo = match (senha, palavras) {
        (Some(s), _) => backup::Segredo::Senha(s),
        (None, Some(p)) => backup::Segredo::Palavras(p),
        (None, None) => return Err(Erro::SenhaErrada),
    };
    // Confere a senha antes de fechar qualquer coisa.
    let (cabecalho, _) = backup::ler(&caminho)?;
    match &segredo {
        backup::Segredo::Senha(s) => cabecalho.envelopes.abrir_com_senha(s).map(|_| ())?,
        backup::Segredo::Palavras(p) => cabecalho.envelopes.abrir_com_palavras(p).map(|_| ())?,
    }
    // O banco atual precisa estar fechado para ser movido para a pasta de segurança.
    *estado.sessao.lock().unwrap() = None;
    let (chave, modo) = backup::restaurar(&estado.cofre, &caminho, &segredo)?;
    estado.iniciar_sessao(chave)?;
    Ok(modo)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SituacaoBackup {
    pasta: Option<String>,
    ultimo: Option<i64>,
    erro: Option<String>,
}

#[tauri::command]
pub async fn situacao_backup(estado: State<'_, Estado>) -> Result<SituacaoBackup, Erro> {
    estado.com_sessao(|s| {
        Ok(SituacaoBackup {
            pasta: banco::ler_config(&s.conn, CONFIG_BACKUP_PASTA)?,
            ultimo: banco::ler_config(&s.conn, CONFIG_BACKUP_ULTIMO)?.and_then(|v| v.parse().ok()),
            erro: banco::ler_config(&s.conn, CONFIG_BACKUP_ERRO)?,
        })
    })
}

/// Liga (com a pasta escolhida) ou desliga o backup automático. Ao ligar, já faz o primeiro.
#[tauri::command]
pub async fn definir_backup_automatico(estado: State<'_, Estado>, pasta: Option<String>) -> Result<SituacaoBackup, Erro> {
    estado.com_sessao(|s| match &pasta {
        Some(p) => banco::gravar_config(&s.conn, CONFIG_BACKUP_PASTA, p),
        None => {
            banco::apagar_config(&s.conn, CONFIG_BACKUP_PASTA)?;
            banco::apagar_config(&s.conn, CONFIG_BACKUP_ERRO)
        }
    })?;
    if pasta.is_some() {
        estado.backup_automatico_se_preciso(true);
    }
    situacao_backup(estado).await
}

// ---------- Ideias, projetos e tarefas ----------

#[tauri::command]
pub async fn listar_ideias(estado: State<'_, Estado>) -> Result<Vec<itens::Ideia>, Erro> {
    estado.com_sessao(|s| itens::listar_ideias(&s.conn))
}

#[tauri::command]
pub async fn criar_ideia(estado: State<'_, Estado>, texto: String) -> Result<itens::Ideia, Erro> {
    estado.com_sessao(|s| itens::criar_ideia(&s.conn, &texto))
}

#[tauri::command]
pub async fn editar_ideia(estado: State<'_, Estado>, id: String, texto: String) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::editar_ideia(&s.conn, &id, &texto))
}

#[tauri::command]
pub async fn ideia_para_projeto(estado: State<'_, Estado>, id: String, ativo: bool) -> Result<itens::Projeto, Erro> {
    estado.com_sessao(|s| itens::ideia_para_projeto(&s.conn, &id, ativo))
}

#[tauri::command]
pub async fn excluir_item(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::excluir(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_projetos(estado: State<'_, Estado>) -> Result<Vec<itens::Projeto>, Erro> {
    estado.com_sessao(|s| itens::listar_projetos(&s.conn))
}

#[tauri::command]
pub async fn obter_projeto(estado: State<'_, Estado>, id: String) -> Result<itens::Projeto, Erro> {
    estado.com_sessao(|s| itens::obter_projeto(&s.conn, &id))
}

#[tauri::command]
pub async fn criar_projeto(estado: State<'_, Estado>, titulo: String, ativo: bool) -> Result<itens::Projeto, Erro> {
    estado.com_sessao(|s| itens::criar_projeto(&s.conn, &titulo, ativo))
}

#[tauri::command]
pub async fn renomear(estado: State<'_, Estado>, id: String, titulo: String) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::renomear(&s.conn, &id, &titulo))
}

#[tauri::command]
pub async fn mudar_estado_projeto(
    estado: State<'_, Estado>,
    id: String,
    novo: String,
    onde_parei: Option<itens::OndeParei>,
) -> Result<itens::Projeto, Erro> {
    estado.com_sessao(|s| itens::mudar_estado_projeto(&s.conn, &id, &novo, onde_parei))
}

#[tauri::command]
pub async fn salvar_onde_parei(estado: State<'_, Estado>, id: String, onde_parei: itens::OndeParei) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::salvar_onde_parei(&s.conn, &id, onde_parei))
}

#[tauri::command]
pub async fn limite_projetos(estado: State<'_, Estado>) -> Result<u32, Erro> {
    estado.com_sessao(|s| itens::limite(&s.conn))
}

#[tauri::command]
pub async fn definir_limite_projetos(estado: State<'_, Estado>, limite: u32) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::definir_limite(&s.conn, limite))
}

#[tauri::command]
pub async fn listar_tarefas(estado: State<'_, Estado>, projeto_id: String) -> Result<Vec<itens::Tarefa>, Erro> {
    estado.com_sessao(|s| itens::listar_tarefas(&s.conn, &projeto_id))
}

#[tauri::command]
pub async fn criar_tarefa(estado: State<'_, Estado>, pai_id: String, titulo: String) -> Result<itens::Tarefa, Erro> {
    estado.com_sessao(|s| itens::criar_tarefa(&s.conn, &pai_id, &titulo))
}

#[tauri::command]
pub async fn mudar_estado_tarefa(estado: State<'_, Estado>, id: String, novo: String) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::mudar_estado_tarefa(&s.conn, &id, &novo))
}

#[tauri::command]
pub async fn mover_tarefa(estado: State<'_, Estado>, id: String, antes_de: Option<String>) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::mover_item(&s.conn, &id, antes_de.as_deref()))
}

// ---------- Agenda ----------

#[tauri::command]
pub async fn listar_eventos(estado: State<'_, Estado>, de: i64, ate: i64) -> Result<Vec<eventos::Evento>, Erro> {
    estado.com_sessao(|s| eventos::listar(&s.conn, de, ate))
}

#[tauri::command]
pub async fn salvar_evento(estado: State<'_, Estado>, evento: eventos::Evento) -> Result<eventos::Evento, Erro> {
    estado.com_sessao(|s| eventos::salvar(&s.conn, evento))
}

#[tauri::command]
pub async fn pular_data_evento(estado: State<'_, Estado>, id: String, data: String) -> Result<(), Erro> {
    estado.com_sessao(|s| eventos::pular_data(&s.conn, &id, &data))
}

#[tauri::command]
pub async fn excluir_evento(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| eventos::excluir(&s.conn, &id))
}

// ---------- Rotinas ----------

#[tauri::command]
pub async fn listar_rotinas(estado: State<'_, Estado>) -> Result<Vec<rotinas::Rotina>, Erro> {
    estado.com_sessao(|s| rotinas::listar(&s.conn))
}

#[tauri::command]
pub async fn criar_rotina(estado: State<'_, Estado>, titulo: String) -> Result<rotinas::Rotina, Erro> {
    estado.com_sessao(|s| rotinas::criar(&s.conn, &titulo))
}

#[tauri::command]
pub async fn salvar_passo(estado: State<'_, Estado>, rotina_id: String, passo: rotinas::Passo) -> Result<rotinas::Passo, Erro> {
    estado.com_sessao(|s| rotinas::salvar_passo(&s.conn, &rotina_id, passo))
}
