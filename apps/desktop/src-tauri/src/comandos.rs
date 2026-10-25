//! Comandos que a interface chama. A chave dos dados só existe em memória
//! enquanto o Órbita está aberto; "Bloquear" a apaga.

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{State, WebviewWindow};

use crate::backup;
use crate::banco::{self, anexos, energia, etiquetas, eventos, itens, rotinas};
use crate::cofre::cripto::Chave;
use crate::cofre::{palavras, Cofre, ModoAbrir, Situacao};
use crate::erro::Erro;
use crate::ditado::{self, Ditado, EstadoDitado};
use crate::ia::{self, cliente, organizar, quebrar, revisar, tema, EstadoIa, Provedor};
use crate::nuvem::{self, ProvedorNuvem};

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
    /// Computador novo: o que veio da conta, esperando a pessoa escolher como abrir.
    recuperando: Mutex<Option<RecuperacaoNuvem>>,
}

impl Estado {
    pub fn new(cofre: Cofre) -> Self {
        Self { cofre, sessao: Mutex::new(None), recuperando: Mutex::new(None) }
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
pub async fn criar_cofre(estado: State<'_, Estado>, senha: Option<String>, modo: ModoAbrir, pin: Option<String>) -> Result<Vec<String>, Erro> {
    let senha = senha.filter(|s| !s.is_empty());
    let (chave, palavras) = estado.cofre.criar(senha.as_deref(), modo, pin.as_deref())?;
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

/// Abrir com as 6 palavras (PIN bloqueado, Windows Hello falhando, cofre sem senha).
/// Também libera o PIN de novo.
#[tauri::command]
pub async fn abrir_com_palavras(estado: State<'_, Estado>, texto: String) -> Result<(), Erro> {
    let chave = estado.cofre.abrir_com_palavras(&texto)?;
    estado.iniciar_sessao(chave)
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

/// Confirmar que é a pessoa antes de uma ação sensível, mesmo com o Órbita aberto.
/// Vale a senha (se houver), as 6 palavras, o PIN, ou o aparelho (Windows Hello; no
/// "abrir direto" não há o que confirmar).
#[derive(Deserialize)]
#[serde(tag = "tipo", content = "valor", rename_all = "lowercase")]
pub enum Confirmacao {
    Senha(String),
    Palavras(String),
    Pin(String),
    Aparelho,
}

async fn confirmar(estado: &Estado, janela: &WebviewWindow, confirmacao: Confirmacao) -> Result<crate::cofre::cripto::Chave, Erro> {
    match confirmacao {
        Confirmacao::Senha(s) => estado.cofre.abrir_com_senha(&s),
        Confirmacao::Palavras(p) => estado.cofre.abrir_com_palavras(&p),
        Confirmacao::Pin(p) => estado.cofre.abrir_com_pin(&p),
        Confirmacao::Aparelho => match estado.cofre.situacao()?.modo {
            Some(ModoAbrir::Hello) => {
                confirmar_com_hello(janela).await?;
                estado.cofre.abrir_depois_do_hello()
            }
            Some(ModoAbrir::Direto) => estado.cofre.abrir_direto(),
            _ => Err(Erro::AparelhoSemChave),
        },
    }
}

/// Mostra as palavras de novo. Pede confirmação, mesmo com o Órbita aberto.
#[tauri::command]
pub async fn ver_palavras(estado: State<'_, Estado>, janela: WebviewWindow, confirmacao: Confirmacao) -> Result<Vec<String>, Erro> {
    confirmar(&estado, &janela, confirmacao).await?;
    let palavras = estado.com_sessao(|s| banco::ler_config(&s.conn, CONFIG_PALAVRAS))?.unwrap_or_default();
    Ok(palavras.split_whitespace().map(String::from).collect())
}

/// Cria a senha (opcional) ou troca a atual.
#[tauri::command]
pub async fn definir_senha(estado: State<'_, Estado>, janela: WebviewWindow, confirmacao: Confirmacao, nova: String) -> Result<(), Erro> {
    let chave = confirmar(&estado, &janela, confirmacao).await?;
    estado.cofre.trocar_senha(&chave, &nova)
}

#[tauri::command]
pub async fn mudar_modo(estado: State<'_, Estado>, janela: WebviewWindow, confirmacao: Confirmacao, modo: ModoAbrir, pin: Option<String>) -> Result<(), Erro> {
    let chave = confirmar(&estado, &janela, confirmacao).await?;
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
    modo: Option<ModoAbrir>,
    pin: Option<String>,
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
    let escolha = modo.map(|m| (m, pin.as_deref()));
    let (chave, modo) = backup::restaurar(&estado.cofre, &caminho, &segredo, escolha)?;
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

// ---------- Energia ----------

#[tauri::command]
pub async fn registrar_energia(estado: State<'_, Estado>, nivel: u8, nota: String) -> Result<energia::RegistroEnergia, Erro> {
    estado.com_sessao(|s| energia::registrar(&s.conn, nivel, &nota))
}

#[tauri::command]
pub async fn listar_energia(estado: State<'_, Estado>, de: i64, ate: i64) -> Result<Vec<energia::RegistroEnergia>, Erro> {
    estado.com_sessao(|s| energia::listar(&s.conn, de, ate))
}

#[tauri::command]
pub async fn basicos_do_dia(estado: State<'_, Estado>, data: String) -> Result<Vec<energia::Basico>, Erro> {
    estado.com_sessao(|s| energia::basicos_do_dia(&s.conn, &data))
}

#[tauri::command]
pub async fn definir_basicos(estado: State<'_, Estado>, lista: Vec<String>) -> Result<(), Erro> {
    estado.com_sessao(|s| energia::definir_basicos(&s.conn, lista))
}

#[tauri::command]
pub async fn marcar_basico(estado: State<'_, Estado>, data: String, texto: String, feito: bool) -> Result<(), Erro> {
    estado.com_sessao(|s| energia::marcar_basico(&s.conn, &data, &texto, feito))
}

#[tauri::command]
pub async fn tarefas_sugeridas(estado: State<'_, Estado>) -> Result<Vec<energia::TarefaSugerida>, Erro> {
    estado.com_sessao(|s| energia::tarefas_sugeridas(&s.conn))
}

#[tauri::command]
pub async fn definir_peso_tarefa(estado: State<'_, Estado>, id: String, peso: Option<String>) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::definir_peso(&s.conn, &id, peso.as_deref()))
}

// ---------- Arquivos de tema ----------

/** Grava um tema exportado. Só aceita a extensão .orbita-tema. */
#[tauri::command]
pub async fn gravar_arquivo_tema(caminho: PathBuf, conteudo: String) -> Result<(), Erro> {
    if caminho.extension().and_then(|e| e.to_str()) != Some("orbita-tema") {
        return Err(Erro::Arquivo("o arquivo de tema precisa terminar em .orbita-tema".into()));
    }
    std::fs::write(&caminho, conteudo)?;
    Ok(())
}

// ---------- Datas e prazos ----------

#[tauri::command]
pub async fn definir_datas_projeto(estado: State<'_, Estado>, id: String, inicio: Option<String>, prazo: Option<String>) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::definir_datas_projeto(&s.conn, &id, inicio.as_deref(), prazo.as_deref()))
}

#[tauri::command]
pub async fn definir_prazo_tarefa(estado: State<'_, Estado>, id: String, prazo: Option<String>) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::definir_prazo_tarefa(&s.conn, &id, prazo.as_deref()))
}

#[tauri::command]
pub async fn listar_prazos(estado: State<'_, Estado>, de: String, ate: String) -> Result<Vec<itens::Prazo>, Erro> {
    estado.com_sessao(|s| itens::listar_prazos(&s.conn, &de, &ate))
}

// ---------- IA (opcional) ----------

#[tauri::command]
pub async fn estado_ia(estado: State<'_, Estado>) -> Result<EstadoIa, Erro> {
    estado.com_sessao(|s| ia::estado(&s.conn))
}

#[tauri::command]
pub async fn salvar_provedor_ia(estado: State<'_, Estado>, provedor: Provedor, chave: Option<String>) -> Result<EstadoIa, Erro> {
    let chave = chave.map(zeroize::Zeroizing::new);
    estado.com_sessao(|s| ia::salvar_provedor(&s.conn, provedor, chave.as_deref().map(String::as_str)))
}

#[tauri::command]
pub async fn remover_provedor_ia(estado: State<'_, Estado>, id: String) -> Result<EstadoIa, Erro> {
    estado.com_sessao(|s| ia::remover_provedor(&s.conn, &id))
}

#[tauri::command]
pub async fn definir_funcao_ia(estado: State<'_, Estado>, funcao: String, provedor_id: Option<String>, modelo: Option<String>) -> Result<EstadoIa, Erro> {
    estado.com_sessao(|s| ia::definir_funcao(&s.conn, &funcao, provedor_id.as_deref(), modelo.as_deref()))
}

#[tauri::command]
pub async fn bloquear_sensivel_ia(estado: State<'_, Estado>, bloquear: bool) -> Result<EstadoIa, Erro> {
    estado.com_sessao(|s| ia::definir_bloqueio_sensivel(&s.conn, bloquear))
}

/// Testa um provedor ainda não salvo (ou um salvo, se `chave` vier vazia e
/// houver `id`). Devolve os modelos disponíveis.
#[tauri::command]
pub async fn testar_provedor_ia(estado: State<'_, Estado>, provedor: Provedor, chave: Option<String>) -> Result<Vec<String>, Erro> {
    let chave = chave.map(zeroize::Zeroizing::new).filter(|c| !c.trim().is_empty());
    let guardada = if chave.is_none() && !provedor.id.is_empty() {
        estado.com_sessao(|s| ia::provedor_por_id(&s.conn, &provedor.id))?.chave
    } else {
        chave.map(|c| zeroize::Zeroizing::new(c.trim().to_string()))
    };
    let mut provedor = provedor;
    provedor.url = provedor.url.trim().trim_end_matches('/').to_string();
    cliente::listar_modelos(&ia::Escolhido { provedor, chave: guardada }).await
}

#[tauri::command]
pub async fn memoria_do_computador() -> Result<Option<f64>, Erro> {
    Ok(ia::memoria_gb())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Sugestao {
    passos: Vec<String>,
    provedor: String,
    local: bool,
}

/// Pede à IA passos para um projeto ou uma etapa. Não grava nada.
#[tauri::command]
pub async fn sugerir_passos_ia(estado: State<'_, Estado>, alvo: String) -> Result<Sugestao, Erro> {
    let (escolhido, pedido) = estado.com_sessao(|s| Ok((ia::provedor_da_funcao(&s.conn, "quebrar", false)?, quebrar::montar_pedido(&s.conn, &alvo)?)))?;
    let resposta = cliente::completar(&escolhido, quebrar::SISTEMA, &pedido).await?;
    let passos = quebrar::ler_passos(&resposta);
    if passos.is_empty() {
        return Err(Erro::Ia { motivo: "resposta", mensagem: "A IA não sugeriu nenhum passo. Tente de novo.".into() });
    }
    Ok(Sugestao { passos, provedor: escolhido.provedor.nome.clone(), local: escolhido.provedor.local() })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Organizacao {
    itens: Vec<organizar::ItemProposto>,
    provedor: String,
    local: bool,
}

/// Separa um texto solto em ideias, tarefas e compromissos. Não grava nada.
/// `sensivel`: a interface achou sinais de saúde ou terapia no texto.
#[tauri::command]
pub async fn organizar_texto_ia(estado: State<'_, Estado>, texto: String, sensivel: bool) -> Result<Organizacao, Erro> {
    let (escolhido, pedido, projetos) = estado.com_sessao(|s| {
        Ok((ia::provedor_da_funcao(&s.conn, "conversa", sensivel)?, organizar::pedido_de_agora(&s.conn, &texto)?, organizar::projetos_ativos(&s.conn)?))
    })?;
    let resposta = cliente::completar(&escolhido, organizar::SISTEMA, &pedido).await?;
    let itens = organizar::ler_itens(&resposta, &projetos);
    if itens.is_empty() {
        return Err(Erro::Ia { motivo: "resposta", mensagem: "A IA não conseguiu separar o texto. Tente de novo, ou guarde como ideia.".into() });
    }
    Ok(Organizacao { itens, provedor: escolhido.provedor.nome.clone(), local: escolhido.provedor.local() })
}

/// Revisa ortografia e pontuação. Não grava nada: a tela mostra antes e depois.
#[tauri::command]
pub async fn revisar_texto_ia(estado: State<'_, Estado>, texto: String, sensivel: bool, modo: Option<String>, instrucao: Option<String>) -> Result<String, Erro> {
    let texto: String = texto.trim().chars().take(revisar::MAXIMO_DE_CARACTERES).collect();
    if texto.is_empty() {
        return Err(Erro::TextoVazio);
    }
    let escolhido = estado.com_sessao(|s| ia::provedor_da_funcao(&s.conn, "revisao", sensivel))?;
    let sistema = revisar::sistema(modo.as_deref().unwrap_or("revisar"), instrucao.as_deref());
    let revisado = revisar::limpar(&cliente::completar(&escolhido, &sistema, &texto).await?);
    if revisado.is_empty() {
        return Err(Erro::Ia { motivo: "resposta", mensagem: "A revisão veio vazia. Tente de novo.".into() });
    }
    Ok(revisado)
}

// ---------- Ditado (voz para texto, no computador) ----------

#[tauri::command]
pub async fn ditado_estado(ditado: State<'_, Ditado>) -> Result<EstadoDitado, Erro> {
    Ok(ditado.estado())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressoDitado {
    baixado: u64,
    total: u64,
}

/// Baixa o modelo de voz. O andamento chega pelo evento "ditado-progresso".
#[tauri::command]
pub async fn ditado_baixar(app: tauri::AppHandle, ditado: State<'_, Ditado>, modelo: String) -> Result<EstadoDitado, Erro> {
    use tauri::Emitter;
    ditado.baixar(&modelo, |baixado, total| {
        let _ = app.emit("ditado-progresso", ProgressoDitado { baixado, total });
    })
    .await?;
    Ok(ditado.estado())
}

#[tauri::command]
pub async fn ditado_cancelar_download(ditado: State<'_, Ditado>) -> Result<(), Erro> {
    ditado.cancelar_download();
    Ok(())
}

#[tauri::command]
pub async fn ditado_remover(ditado: State<'_, Ditado>) -> Result<EstadoDitado, Erro> {
    ditado.remover()?;
    Ok(ditado.estado())
}

#[tauri::command]
pub async fn ditado_comecar(ditado: State<'_, Ditado>) -> Result<(), Erro> {
    ditado.comecar()
}

/// Para de gravar e transcreve no computador. Pode levar alguns segundos.
#[tauri::command]
pub async fn ditado_parar(app: tauri::AppHandle) -> Result<String, Erro> {
    use tauri::Manager;
    tauri::async_runtime::spawn_blocking(move || {
        let d = app.state::<Ditado>();
        let audio = d.parar()?;
        let ctx = d.contexto()?;
        ditado::transcrever(&ctx, &audio)
    })
    .await
    .map_err(|e| Erro::Interno(e.to_string()))?
}

#[tauri::command]
pub async fn ditado_descartar(ditado: State<'_, Ditado>) -> Result<(), Erro> {
    ditado.descartar();
    Ok(())
}

// ---------- Janela ----------

#[tauri::command]
pub async fn bandeja_ligada(bandeja: State<'_, crate::bandeja::Bandeja>) -> Result<bool, Erro> {
    Ok(bandeja.ligada())
}

#[tauri::command]
pub async fn definir_bandeja(app: tauri::AppHandle, ligar: bool) -> Result<(), Erro> {
    crate::bandeja::definir(&app, ligar)
}

// ---------- Ideias: nota, etiquetas e ligações ----------

#[tauri::command]
pub async fn salvar_nota_ideia(estado: State<'_, Estado>, id: String, nota: String) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::salvar_nota_ideia(&s.conn, &id, &nota))
}

#[tauri::command]
pub async fn listar_etiquetas(estado: State<'_, Estado>) -> Result<Vec<etiquetas::Etiqueta>, Erro> {
    estado.com_sessao(|s| etiquetas::listar(&s.conn))
}

#[tauri::command]
pub async fn criar_etiqueta(estado: State<'_, Estado>, nome: String, cor: String) -> Result<etiquetas::Etiqueta, Erro> {
    estado.com_sessao(|s| etiquetas::criar(&s.conn, &nome, &cor))
}

#[tauri::command]
pub async fn editar_etiqueta(estado: State<'_, Estado>, id: String, nome: String, cor: String) -> Result<(), Erro> {
    estado.com_sessao(|s| etiquetas::editar(&s.conn, &id, &nome, &cor))
}

#[tauri::command]
pub async fn excluir_etiqueta(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| etiquetas::excluir(&s.conn, &id))
}

#[tauri::command]
pub async fn definir_etiquetas_item(estado: State<'_, Estado>, id: String, etiquetas: Vec<String>) -> Result<(), Erro> {
    estado.com_sessao(|s| etiquetas::definir_do_item(&s.conn, &id, &etiquetas))
}

#[tauri::command]
pub async fn ligar_itens(estado: State<'_, Estado>, a: String, b: String, ligar: bool) -> Result<(), Erro> {
    estado.com_sessao(|s| etiquetas::ligar(&s.conn, &a, &b, ligar))
}

// ---------- Tema com IA ----------

/// A IA escreve um tema (JSON). Não grava nada: a tela confere e mostra no editor.
#[tauri::command]
pub async fn gerar_tema_ia(estado: State<'_, Estado>, provedor_id: String, pedido: String, anterior: Option<String>, com_desenho: bool) -> Result<String, Erro> {
    if pedido.trim().is_empty() {
        return Err(Erro::TextoVazio);
    }
    let escolhido = estado.com_sessao(|s| ia::provedor_para(&s.conn, "personalizacao", &provedor_id))?;
    cliente::completar(&escolhido, tema::SISTEMA, &tema::montar_pedido(&pedido, anterior.as_deref(), com_desenho)).await
}

/// Experimental: a IA desenha um lote de ícones (nome e o que mostram) no estilo pedido.
/// Devolve o texto da IA; a tela lê o JSON, limpa cada desenho e mostra antes de aplicar.
#[tauri::command]
pub async fn desenhar_icones_ia(
    estado: State<'_, Estado>,
    provedor_id: String,
    estilo: String,
    icones: Vec<(String, String)>,
    referencia: Option<String>,
) -> Result<String, Erro> {
    if estilo.trim().is_empty() || icones.is_empty() {
        return Err(Erro::TextoVazio);
    }
    let escolhido = estado.com_sessao(|s| ia::provedor_para(&s.conn, "personalizacao", &provedor_id))?;
    cliente::completar(&escolhido, tema::SISTEMA_ICONES, &tema::pedido_de_icones(&estilo, &icones, referencia.as_deref())).await
}

/// Modelos de imagem que a conta da pessoa tem nesse provedor (pode ser nenhum).
#[tauri::command]
pub async fn modelos_imagem_ia(estado: State<'_, Estado>, provedor_id: String) -> Result<Vec<String>, Erro> {
    let escolhido = estado.com_sessao(|s| ia::provedor_por_id(&s.conn, &provedor_id))?;
    if escolhido.provedor.tipo == ia::TipoProvedor::Claude || escolhido.provedor.local() {
        return Ok(vec![]);
    }
    Ok(tema::modelos_de_imagem(&cliente::listar_todos_modelos(&escolhido).await?))
}

/// Gera a imagem de fundo do tema. Devolve um endereço de dados (PNG).
#[tauri::command]
pub async fn gerar_imagem_ia(estado: State<'_, Estado>, provedor_id: String, modelo: String, pedido: String, alta: bool, vivas: bool) -> Result<String, Erro> {
    let escolhido = estado.com_sessao(|s| ia::provedor_por_id(&s.conn, &provedor_id))?;
    cliente::gerar_imagem(&escolhido, &modelo, &tema::pedido_de_imagem(&pedido, vivas), alta).await
}

#[tauri::command]
pub async fn itens_ligados(estado: State<'_, Estado>, id: String) -> Result<Vec<itens::ItemResumo>, Erro> {
    estado.com_sessao(|s| itens::resumo_ligados(&s.conn, &id))
}

// ---------- Anexos ----------

#[tauri::command]
pub async fn listar_anexos(estado: State<'_, Estado>, item: String) -> Result<Vec<anexos::Anexo>, Erro> {
    estado.com_sessao(|s| anexos::listar_do_item(&s.conn, &item))
}

/// Lê o arquivo escolhido e guarda dentro do banco criptografado.
#[tauri::command]
pub async fn anexar_arquivo(estado: State<'_, Estado>, item: String, caminho: String) -> Result<anexos::Anexo, Erro> {
    let caminho = PathBuf::from(caminho);
    let tamanho = std::fs::metadata(&caminho)?.len() as usize;
    if tamanho > anexos::MAXIMO_BYTES {
        return Err(Erro::Arquivo("o arquivo passa de 20 MB, o limite para anexos".into()));
    }
    let conteudo = std::fs::read(&caminho)?;
    let nome = caminho.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    estado.com_sessao(|s| anexos::anexar_arquivo(&s.conn, &item, &nome, &conteudo))
}

#[tauri::command]
pub async fn anexar_link(estado: State<'_, Estado>, item: String, nome: String, endereco: String) -> Result<anexos::Anexo, Erro> {
    estado.com_sessao(|s| anexos::anexar_link(&s.conn, &item, &nome, &endereco))
}

/// A imagem como endereço de dados, para mostrar na tela.
#[tauri::command]
pub async fn imagem_anexo(estado: State<'_, Estado>, id: String) -> Result<String, Erro> {
    use base64::Engine;
    estado.com_sessao(|s| {
        let a = anexos::obter(&s.conn, &id)?;
        if a.tipo != "imagem" {
            return Err(Erro::NaoEncontrado);
        }
        let bytes = anexos::conteudo(&s.conn, &id)?;
        Ok(format!("data:{};base64,{}", anexos::mime(&a.nome), base64::engine::general_purpose::STANDARD.encode(bytes)))
    })
}

/// Pasta das cópias temporárias para abrir anexos com outro programa.
pub fn pasta_temporaria_anexos() -> PathBuf {
    std::env::temp_dir().join("orbita-anexos")
}

/// Abre um link no navegador, ou o arquivo no programa padrão do computador.
/// Arquivos viram uma cópia temporária (sem criptografia), apagada quando o Órbita abre de novo.
#[tauri::command]
pub async fn abrir_anexo(app: tauri::AppHandle, estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    use tauri_plugin_opener::OpenerExt;
    let (a, conteudo) = estado.com_sessao(|s| {
        let a = anexos::obter(&s.conn, &id)?;
        let c = if a.tipo == "link" { Vec::new() } else { anexos::conteudo(&s.conn, &id)? };
        Ok((a, c))
    })?;
    if a.tipo == "link" {
        return app.opener().open_url(&a.endereco, None::<&str>).map_err(|e| Erro::Interno(e.to_string()));
    }
    let pasta = pasta_temporaria_anexos().join(&a.id);
    std::fs::create_dir_all(&pasta)?;
    let caminho = pasta.join(&a.nome);
    std::fs::write(&caminho, conteudo)?;
    app.opener().open_path(caminho.to_string_lossy(), None::<&str>).map_err(|e| Erro::Interno(e.to_string()))
}

/// Salva uma cópia do anexo onde a pessoa escolher.
#[tauri::command]
pub async fn salvar_anexo(estado: State<'_, Estado>, id: String, caminho: String) -> Result<(), Erro> {
    let conteudo = estado.com_sessao(|s| anexos::conteudo(&s.conn, &id))?;
    std::fs::write(caminho, conteudo)?;
    Ok(())
}

#[tauri::command]
pub async fn excluir_anexo(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| anexos::excluir(&s.conn, &id))
}

/// Conversa sobre a lista separada: a IA refaz a lista com a mudança pedida.
#[tauri::command]
pub async fn ajustar_organizacao_ia(estado: State<'_, Estado>, texto: String, itens: String, mudanca: String, sensivel: bool) -> Result<Organizacao, Erro> {
    if mudanca.trim().is_empty() {
        return Err(Erro::TextoVazio);
    }
    let (escolhido, pedido, projetos) = estado.com_sessao(|s| {
        Ok((ia::provedor_da_funcao(&s.conn, "conversa", sensivel)?, organizar::pedido_de_agora(&s.conn, &texto)?, organizar::projetos_ativos(&s.conn)?))
    })?;
    let resposta = cliente::completar(&escolhido, organizar::SISTEMA, &organizar::montar_ajuste(&pedido, &itens, &mudanca)).await?;
    let itens = organizar::ler_itens(&resposta, &projetos);
    if itens.is_empty() {
        return Err(Erro::Ia { motivo: "resposta", mensagem: "A IA não conseguiu refazer a lista. Tente explicar a mudança de outro jeito.".into() });
    }
    Ok(Organizacao { itens, provedor: escolhido.provedor.nome.clone(), local: escolhido.provedor.local() })
}

// ---------- Conta Google ou Microsoft (recuperação guardada na conta da pessoa) ----------

/// Guardado no banco criptografado, numa linha de configuração.
const CONFIG_NUVEM: &str = "nuvem";
/// Arquivo temporário do backup que veio da conta (computador novo).
const RECUPERANDO_NUVEM: &str = "nuvem-recuperando.orbita-backup";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ConfigNuvem {
    provedor: ProvedorNuvem,
    renovacao: String,
    conta: String,
    ultimo: Option<i64>,
    erro: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SituacaoNuvem {
    provedor: ProvedorNuvem,
    conta: String,
    ultimo: Option<i64>,
    erro: Option<String>,
}

impl From<&ConfigNuvem> for SituacaoNuvem {
    fn from(c: &ConfigNuvem) -> Self {
        Self { provedor: c.provedor, conta: c.conta.clone(), ultimo: c.ultimo, erro: c.erro.clone() }
    }
}

struct RecuperacaoNuvem {
    provedor: ProvedorNuvem,
    renovacao: String,
    conta: String,
    palavras: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Disponiveis {
    google: bool,
    microsoft: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EncontradoNaNuvem {
    conta: String,
    criado_em: i64,
    versao_app: String,
}

fn ler_nuvem(s: &Sessao) -> Result<Option<ConfigNuvem>, Erro> {
    Ok(banco::ler_config(&s.conn, CONFIG_NUVEM)?.and_then(|t| serde_json::from_str(&t).ok()))
}

fn gravar_nuvem(s: &Sessao, c: &ConfigNuvem) -> Result<(), Erro> {
    banco::gravar_config(&s.conn, CONFIG_NUVEM, &serde_json::to_string(c).map_err(|e| Erro::Interno(e.to_string()))?)
}

fn abrir_navegador(app: &tauri::AppHandle) -> impl Fn(&str) -> Result<(), Erro> + '_ {
    move |url: &str| {
        use tauri_plugin_opener::OpenerExt;
        app.opener().open_url(url, None::<&str>).map_err(|e| Erro::Interno(e.to_string()))
    }
}

/// A chave (texto do arquivo de recuperação) e um backup novo, prontos para enviar.
fn arquivos_para_enviar(estado: &Estado) -> Result<(Vec<u8>, Vec<u8>), Erro> {
    estado.com_sessao(|s| {
        let palavras = banco::ler_config(&s.conn, CONFIG_PALAVRAS)?.unwrap_or_default();
        let lista: Vec<String> = palavras.split_whitespace().map(String::from).collect();
        if lista.len() != palavras::QUANTIDADE {
            return Err(Erro::Interno("chave de recuperação não encontrada no banco".into()));
        }
        let temporario = estado.cofre.pasta().join("nuvem-enviando.orbita-backup");
        let feito = backup::criar(&estado.cofre, &s.conn, &s.chave, &temporario);
        let lido = feito.and_then(|_| Ok(std::fs::read(&temporario)?));
        let _ = std::fs::remove_file(&temporario);
        Ok((palavras::texto_do_arquivo(&lista).into_bytes(), lido?))
    })
}

/// Envia a chave e o backup. Guarda a renovação nova (Microsoft), a hora e o erro, se houver.
async fn enviar_para_nuvem(estado: &Estado, mut config: ConfigNuvem) -> Result<SituacaoNuvem, Erro> {
    let resultado = async {
        let (chave, copia) = arquivos_para_enviar(estado)?;
        let (acesso, nova) = nuvem::acesso(config.provedor, &config.renovacao).await?;
        if let Some(n) = nova {
            config.renovacao = n;
        }
        nuvem::enviar(config.provedor, &acesso, nuvem::ARQUIVO_CHAVE, chave).await?;
        nuvem::enviar(config.provedor, &acesso, nuvem::ARQUIVO_BACKUP, copia).await
    }
    .await;
    match &resultado {
        Ok(()) => (config.ultimo, config.erro) = (Some(banco::agora_ms()), None),
        Err(e) => config.erro = Some(e.to_string()),
    }
    estado.com_sessao(|s| gravar_nuvem(s, &config))?;
    resultado.map(|_| SituacaoNuvem::from(&config))
}

/// Quais contas esta versão do Órbita sabe usar (dependem do cadastro no Google e na Microsoft).
#[tauri::command]
pub async fn nuvem_disponivel() -> Result<Disponiveis, Erro> {
    Ok(Disponiveis { google: ProvedorNuvem::Google.credenciais().is_some(), microsoft: ProvedorNuvem::Microsoft.credenciais().is_some() })
}

#[tauri::command]
pub async fn nuvem_situacao(estado: State<'_, Estado>) -> Result<Option<SituacaoNuvem>, Erro> {
    estado.com_sessao(|s| Ok(ler_nuvem(s)?.as_ref().map(SituacaoNuvem::from)))
}

/// Liga a conta (login no navegador) e já envia a chave e o backup.
#[tauri::command]
pub async fn nuvem_conectar(app: tauri::AppHandle, estado: State<'_, Estado>, provedor: ProvedorNuvem) -> Result<SituacaoNuvem, Erro> {
    estado.com_sessao(|_| Ok(()))?;
    let conta = nuvem::entrar(abrir_navegador(&app), provedor).await?;
    let config = ConfigNuvem { provedor, renovacao: conta.renovacao, conta: conta.email, ultimo: None, erro: None };
    estado.com_sessao(|s| gravar_nuvem(s, &config))?;
    enviar_para_nuvem(&estado, config).await
}

/// Envia agora, ou só se o último envio tiver mais de 20 horas (`so_se_preciso`).
/// Sem conta ligada, não faz nada.
#[tauri::command]
pub async fn nuvem_enviar(estado: State<'_, Estado>, so_se_preciso: bool) -> Result<Option<SituacaoNuvem>, Erro> {
    let Some(config) = estado.com_sessao(ler_nuvem)? else { return Ok(None) };
    if so_se_preciso && config.ultimo.is_some_and(|u| banco::agora_ms() - u < INTERVALO_AUTOMATICO_MS) {
        return Ok(Some(SituacaoNuvem::from(&config)));
    }
    enviar_para_nuvem(&estado, config).await.map(Some)
}

/// Desliga a conta. Com `apagar`, tira antes os arquivos da pasta do app.
#[tauri::command]
pub async fn nuvem_desconectar(estado: State<'_, Estado>, apagar: bool) -> Result<(), Erro> {
    let Some(config) = estado.com_sessao(ler_nuvem)? else { return Ok(()) };
    if apagar {
        let (acesso, _) = nuvem::acesso(config.provedor, &config.renovacao).await?;
        nuvem::apagar(config.provedor, &acesso, nuvem::ARQUIVO_CHAVE).await?;
        nuvem::apagar(config.provedor, &acesso, nuvem::ARQUIVO_BACKUP).await?;
    }
    nuvem::revogar(config.provedor, &config.renovacao).await;
    estado.com_sessao(|s| banco::apagar_config(&s.conn, CONFIG_NUVEM))
}

/// Computador novo: entra na conta e baixa a chave e o backup. Ainda não restaura:
/// a pessoa escolhe antes como vai abrir o Órbita neste computador.
#[tauri::command]
pub async fn nuvem_buscar_para_recuperar(app: tauri::AppHandle, estado: State<'_, Estado>, provedor: ProvedorNuvem) -> Result<EncontradoNaNuvem, Erro> {
    let conta = nuvem::entrar(abrir_navegador(&app), provedor).await?;
    let (acesso, nova) = nuvem::acesso(provedor, &conta.renovacao).await?;
    let renovacao = nova.unwrap_or(conta.renovacao);
    let nada = || nuvem::erro("vazio", format!("Não encontrei um Órbita guardado na conta {}. Confira se é a mesma conta que você ligou no outro computador.", conta.email));
    let chave = nuvem::baixar(provedor, &acesso, nuvem::ARQUIVO_CHAVE).await?.ok_or_else(nada)?;
    let copia = nuvem::baixar(provedor, &acesso, nuvem::ARQUIVO_BACKUP).await?.ok_or_else(nada)?;
    let lidas = palavras::ler_arquivo(&String::from_utf8_lossy(&chave)).map_err(|posicoes| Erro::PalavrasErradas { posicoes })?;
    std::fs::create_dir_all(estado.cofre.pasta())?;
    let caminho = estado.cofre.pasta().join(RECUPERANDO_NUVEM);
    std::fs::write(&caminho, &copia)?;
    let info = backup::informacao(&caminho)?;
    *estado.recuperando.lock().unwrap() = Some(RecuperacaoNuvem { provedor, renovacao, conta: conta.email.clone(), palavras: lidas.join(" ") });
    Ok(EncontradoNaNuvem { conta: conta.email, criado_em: info.criado_em, versao_app: info.versao_app })
}

/// Restaura o que veio da conta, com o jeito de abrir escolhido, e deixa a conta ligada.
#[tauri::command]
pub async fn nuvem_concluir_recuperacao(estado: State<'_, Estado>, modo: ModoAbrir, pin: Option<String>) -> Result<ModoAbrir, Erro> {
    let caminho = estado.cofre.pasta().join(RECUPERANDO_NUVEM);
    let rec = estado.recuperando.lock().unwrap().take().ok_or_else(|| nuvem::erro("vazio", "Entre na conta de novo para buscar seus dados."))?;
    *estado.sessao.lock().unwrap() = None;
    let resultado = backup::restaurar(&estado.cofre, &caminho, &backup::Segredo::Palavras(rec.palavras.clone()), Some((modo, pin.as_deref())));
    let (chave, modo) = match resultado {
        Ok(r) => r,
        Err(e) => {
            // Deixa tentar de novo (por exemplo, com um PIN válido) sem entrar na conta outra vez.
            *estado.recuperando.lock().unwrap() = Some(rec);
            return Err(e);
        }
    };
    let _ = std::fs::remove_file(&caminho);
    estado.iniciar_sessao(chave)?;
    let config = ConfigNuvem { provedor: rec.provedor, renovacao: rec.renovacao, conta: rec.conta, ultimo: Some(banco::agora_ms()), erro: None };
    estado.com_sessao(|s| gravar_nuvem(s, &config))?;
    Ok(modo)
}

