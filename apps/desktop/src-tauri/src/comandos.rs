//! Comandos que a interface chama. A chave dos dados só existe em memória
//! enquanto o Órbita está aberto; "Bloquear" a apaga.

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{State, WebviewWindow};

use crate::backup;
use crate::banco::{self, academico, anexos, anotacoes, caderno, cuidado, dinheiro, energia, etiquetas, eventos, hobbies, itens, leitura, organizacao, pastas_projeto, quadro, rotinas, saude, sincronia};
use crate::cofre::cripto::Chave;
use crate::cofre::{palavras, Cofre, ModoAbrir, Situacao};
use crate::erro::Erro;
use crate::ditado::{self, Ditado, EstadoDitado};
use crate::ia::{self, fluxo, planejar, EstadoIa, Provedor};
// O envio pela rede só existe no Windows (o navegador envia com fetch).
use crate::ia::cliente;
use crate::nuvem::{self, ProvedorNuvem};

use crate::portatil::CONFIG_PALAVRAS;

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

/// Grava um texto (exportação em formato aberto) num arquivo escolhido pela
/// pessoa. A serialização é feita no frontend; aqui só se escreve o arquivo.
#[tauri::command]
pub async fn exportar_texto(caminho: PathBuf, conteudo: String) -> Result<(), Erro> {
    std::fs::write(&caminho, conteudo).map_err(Erro::from)
}

/// Grava um arquivo exportado (PDF, imagem, Word) no lugar escolhido pela pessoa.
/// O conteúdo vem em base64 do frontend, que monta o arquivo.
#[tauri::command]
pub async fn exportar_arquivo(caminho: PathBuf, conteudo: String) -> Result<(), Erro> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(conteudo.as_bytes())
        .map_err(|e| Erro::Interno(format!("arquivo exportado: {e}")))?;
    std::fs::write(&caminho, bytes).map_err(Erro::from)
}

/// Nomes das fontes instaladas no computador (lista do editor de texto).
#[tauri::command]
pub async fn listar_fontes_sistema() -> Result<Vec<String>, Erro> {
    tauri::async_runtime::spawn_blocking(crate::fontes::familias_do_sistema)
        .await
        .map_err(|e| Erro::Interno(e.to_string()))
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
pub async fn definir_revisao_projeto(estado: State<'_, Estado>, id: String, meses: Option<u32>) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::definir_revisao_projeto(&s.conn, &id, meses))
}

#[tauri::command]
pub async fn marcar_projeto_revisado(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::marcar_projeto_revisado(&s.conn, &id))
}

#[tauri::command]
pub async fn salvar_anotacoes_projeto(estado: State<'_, Estado>, id: String, texto: String) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::salvar_anotacoes_projeto(&s.conn, &id, &texto))
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

// ── Cofre de valores (dados pequenos de módulo, em JSON) ────────────────────

#[tauri::command]
pub async fn valor_ler(estado: State<'_, Estado>, chave: String) -> Result<Option<String>, Erro> {
    estado.com_sessao(|s| banco::valores::ler(&s.conn, &chave))
}

#[tauri::command]
pub async fn valor_gravar(estado: State<'_, Estado>, chave: String, json: String) -> Result<(), Erro> {
    estado.com_sessao(|s| banco::valores::gravar(&s.conn, &chave, &json))
}

#[tauri::command]
pub async fn valor_apagar(estado: State<'_, Estado>, chave: String) -> Result<(), Erro> {
    estado.com_sessao(|s| banco::valores::apagar(&s.conn, &chave))
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
pub async fn testar_provedor_ia(estado: State<'_, Estado>, provedor: Provedor, chave: Option<String>) -> Result<Value, Erro> {
    rodar_ia(&estado, "testar_provedor_ia", json!({ "provedor": provedor, "chave": chave })).await
}

#[tauri::command]
pub async fn memoria_do_computador() -> Result<Option<f64>, Erro> {
    Ok(ia::memoria_gb())
}

/// Roda uma ordem de IA (`ia/fluxo.rs`, a mesma do navegador): lê o banco,
/// envia o pedido sem segurar o banco e volta com a resposta, até terminar.
async fn rodar_ia(estado: &Estado, comando: &str, args: Value) -> Result<Value, Erro> {
    // Os argumentos podem levar uma chave nova (conferir provedor): apagados da memória no fim.
    let args = zeroize::Zeroizing::new(args.to_string());
    let mut passo = estado.com_sessao(|s| fluxo::avancar(&s.conn, comando, &args, None))?;
    loop {
        match passo {
            fluxo::Passo::Pronto { valor } => return Ok(valor),
            fluxo::Passo::Pedir { pedido, etapa } => {
                let (situacao, corpo) = cliente::enviar(&pedido).await?;
                let r = fluxo::Resposta { etapa, situacao, corpo };
                passo = estado.com_sessao(|s| fluxo::avancar(&s.conn, comando, &args, Some(&r)))?;
            }
        }
    }
}

/// "Planejar com a IA": manda o contexto do projeto (ou da etapa), a proposta
/// atual com as mudanças feitas à mão e a conversa; devolve a proposta revisada.
/// Não grava nada. `sensivel`: a interface achou sinais de saúde ou terapia.
#[tauri::command]
pub async fn planejar_com_ia(
    estado: State<'_, Estado>,
    alvo: String,
    conversa: Vec<planejar::Fala>,
    proposta_atual: Option<Vec<planejar::EtapaProposta>>,
    sensivel: bool,
) -> Result<Value, Erro> {
    rodar_ia(&estado, "planejar_com_ia", json!({ "alvo": alvo, "conversa": conversa, "propostaAtual": proposta_atual, "sensivel": sensivel })).await
}

/// Separa um texto solto em ideias, tarefas e compromissos. Não grava nada.
/// `sensivel`: a interface achou sinais de saúde ou terapia no texto.
#[tauri::command]
pub async fn organizar_texto_ia(estado: State<'_, Estado>, texto: String, sensivel: bool) -> Result<Value, Erro> {
    rodar_ia(&estado, "organizar_texto_ia", json!({ "texto": texto, "sensivel": sensivel })).await
}

/// Revisa ortografia e pontuação. Não grava nada: a tela mostra antes e depois.
#[tauri::command]
pub async fn revisar_texto_ia(estado: State<'_, Estado>, texto: String, sensivel: bool, modo: Option<String>, instrucao: Option<String>) -> Result<Value, Erro> {
    rodar_ia(&estado, "revisar_texto_ia", json!({ "texto": texto, "sensivel": sensivel, "modo": modo, "instrucao": instrucao })).await
}

/// IA do caderno: um pedido livre sobre a página, com o texto digitado e, se houver,
/// imagens (escrita à mão, foto do quadro). Devolve HTML simples para a tela mostrar
/// como proposta. Não grava nada.
#[tauri::command]
pub async fn ia_caderno(estado: State<'_, Estado>, pedido: String, contexto: String, imagens: Vec<String>, sensivel: bool) -> Result<Value, Erro> {
    rodar_ia(&estado, "ia_caderno", json!({ "pedido": pedido, "contexto": contexto, "imagens": imagens, "sensivel": sensivel })).await
}

/// Corretor da escrita à mão: a imagem da página com as palavras numeradas; devolve
/// as erradas com sugestões. Não grava nada.
#[tauri::command]
pub async fn conferir_escrita_ia(estado: State<'_, Estado>, imagem: String, quantas: usize, sensivel: bool) -> Result<Value, Erro> {
    rodar_ia(&estado, "conferir_escrita_ia", json!({ "imagem": imagem, "quantas": quantas, "sensivel": sensivel })).await
}

/// IA com liberdade total no caderno: devolve um plano de mudanças; quem aplica é a tela.
#[tauri::command]
pub async fn ia_caderno_agir(estado: State<'_, Estado>, pedido: String, descricao: String, imagens: Vec<String>, sensivel: bool) -> Result<Value, Erro> {
    rodar_ia(&estado, "ia_caderno_agir", json!({ "pedido": pedido, "descricao": descricao, "imagens": imagens, "sensivel": sensivel })).await
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
pub async fn definir_cor_ideia(estado: State<'_, Estado>, id: String, cor: Option<String>) -> Result<(), Erro> {
    estado.com_sessao(|s| itens::definir_cor_ideia(&s.conn, &id, cor.as_deref()))
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
pub async fn gerar_tema_ia(estado: State<'_, Estado>, provedor_id: String, pedido: String, anterior: Option<String>, com_desenho: bool) -> Result<Value, Erro> {
    rodar_ia(&estado, "gerar_tema_ia", json!({ "provedorId": provedor_id, "pedido": pedido, "anterior": anterior, "comDesenho": com_desenho })).await
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
) -> Result<Value, Erro> {
    rodar_ia(&estado, "desenhar_icones_ia", json!({ "provedorId": provedor_id, "estilo": estilo, "icones": icones, "referencia": referencia })).await
}

/// Modelos de imagem que a conta da pessoa tem nesse provedor (pode ser nenhum).
#[tauri::command]
pub async fn modelos_imagem_ia(estado: State<'_, Estado>, provedor_id: String) -> Result<Value, Erro> {
    rodar_ia(&estado, "modelos_imagem_ia", json!({ "provedorId": provedor_id })).await
}

/// Gera a imagem de fundo do tema. Devolve um endereço de dados (PNG).
#[tauri::command]
pub async fn gerar_imagem_ia(estado: State<'_, Estado>, provedor_id: String, modelo: String, pedido: String, alta: bool, vivas: bool) -> Result<Value, Erro> {
    rodar_ia(&estado, "gerar_imagem_ia", json!({ "provedorId": provedor_id, "modelo": modelo, "pedido": pedido, "alta": alta, "vivas": vivas })).await
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
        return Err(Erro::Arquivo(format!("o arquivo passa de {} MB, o limite para anexos", anexos::MAXIMO_MB)));
    }
    let conteudo = std::fs::read(&caminho)?;
    let nome = caminho.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    estado.com_sessao(|s| anexos::anexar_arquivo(&s.conn, &item, &nome, &conteudo))
}

#[tauri::command]
pub async fn anexar_link(estado: State<'_, Estado>, item: String, nome: String, endereco: String) -> Result<anexos::Anexo, Erro> {
    estado.com_sessao(|s| anexos::anexar_link(&s.conn, &item, &nome, &endereco))
}

/// Anexa conteúdo vindo da memória (por exemplo, um áudio gravado no app), em base64.
#[tauri::command]
pub async fn anexar_bytes(estado: State<'_, Estado>, item: String, nome: String, base64: String) -> Result<anexos::Anexo, Erro> {
    use base64::Engine;
    let conteudo = base64::engine::general_purpose::STANDARD.decode(base64.as_bytes()).map_err(|e| Erro::Arquivo(e.to_string()))?;
    estado.com_sessao(|s| anexos::anexar_arquivo(&s.conn, &item, &nome, &conteudo))
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
pub async fn ajustar_organizacao_ia(estado: State<'_, Estado>, texto: String, itens: String, mudanca: String, sensivel: bool) -> Result<Value, Erro> {
    rodar_ia(&estado, "ajustar_organizacao_ia", json!({ "texto": texto, "itens": itens, "mudanca": mudanca, "sensivel": sensivel })).await
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

/// Acesso de curta duração ao Drive, para a sincronização no Windows: a interface fala
/// com o Drive direto (o mesmo `driveRest.ts` do navegador). Só a pasta escondida do app;
/// a renovação continua guardada no banco criptografado e nunca vai para a interface.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenGoogle {
    token: String,
    /// Milissegundos desde 1970.
    expira_em: i64,
}

#[tauri::command]
pub async fn nuvem_token_google(estado: State<'_, Estado>) -> Result<TokenGoogle, Erro> {
    let config = estado.com_sessao(ler_nuvem)?.ok_or_else(|| nuvem::erro("desligada", "Nenhuma conta Google ligada. Ligue a conta em Ajustes."))?;
    if config.provedor != ProvedorNuvem::Google {
        return Err(nuvem::erro("indisponivel", "A sincronização usa uma conta Google; a conta ligada é de outro tipo."));
    }
    let (token, validade) = nuvem::acesso_google(&config.renovacao).await?;
    Ok(TokenGoogle { token, expira_em: banco::agora_ms() + (validade as i64) * 1000 })
}

// ---------- Saúde: medicação ----------

#[tauri::command]
pub async fn listar_remedios(estado: State<'_, Estado>) -> Result<Vec<saude::Remedio>, Erro> {
    estado.com_sessao(|s| saude::listar(&s.conn))
}

#[tauri::command]
pub async fn salvar_remedio(estado: State<'_, Estado>, remedio: saude::Remedio) -> Result<saude::Remedio, Erro> {
    estado.com_sessao(|s| saude::salvar(&s.conn, remedio))
}

#[tauri::command]
pub async fn excluir_remedio(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| saude::excluir(&s.conn, &id))
}

#[tauri::command]
pub async fn pausar_remedio(estado: State<'_, Estado>, id: String, pausado: bool) -> Result<(), Erro> {
    estado.com_sessao(|s| saude::mudar_estado(&s.conn, &id, pausado))
}

#[tauri::command]
pub async fn doses_do_dia(estado: State<'_, Estado>, data: String) -> Result<Vec<saude::DoseDoDia>, Erro> {
    estado.com_sessao(|s| saude::doses_do_dia(&s.conn, &data))
}

#[tauri::command]
pub async fn marcar_dose(estado: State<'_, Estado>, remedio_id: String, horario: String, data: String, tomada: bool) -> Result<(), Erro> {
    estado.com_sessao(|s| saude::marcar_dose(&s.conn, &remedio_id, &horario, &data, tomada))
}

#[tauri::command]
pub async fn alertas_saude(estado: State<'_, Estado>, hoje: String) -> Result<Vec<saude::AvisoSaude>, Erro> {
    // Avisa com estoque de até 5 doses ou receita a vencer em até 7 dias.
    estado.com_sessao(|s| saude::alertas(&s.conn, &hoje, 5, 7))
}

// ---------- Saúde: registros e plano de crise ----------

#[tauri::command]
pub async fn registrar_saude(estado: State<'_, Estado>, tipo: String, intensidade: Option<u8>, nota: String) -> Result<saude::RegistroSaude, Erro> {
    estado.com_sessao(|s| saude::registrar(&s.conn, &tipo, intensidade, &nota))
}

#[tauri::command]
pub async fn listar_registros_saude(estado: State<'_, Estado>, de: i64, ate: i64) -> Result<Vec<saude::RegistroSaude>, Erro> {
    estado.com_sessao(|s| saude::listar_registros(&s.conn, de, ate))
}

#[tauri::command]
pub async fn excluir_registro_saude(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| saude::excluir_registro(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_planos(estado: State<'_, Estado>) -> Result<Vec<saude::PlanoSaude>, Erro> {
    estado.com_sessao(|s| saude::listar_planos(&s.conn))
}

#[tauri::command]
pub async fn salvar_plano(estado: State<'_, Estado>, plano: saude::PlanoSaude) -> Result<saude::PlanoSaude, Erro> {
    estado.com_sessao(|s| saude::salvar_plano(&s.conn, plano))
}

#[tauri::command]
pub async fn excluir_plano(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| saude::excluir_plano(&s.conn, &id))
}

// ---------- Cuidado — meus profissionais de saúde ----------

#[tauri::command]
pub async fn listar_profissionais(estado: State<'_, Estado>) -> Result<Vec<cuidado::Profissional>, Erro> {
    estado.com_sessao(|s| cuidado::listar_profissionais(&s.conn))
}

#[tauri::command]
pub async fn salvar_profissional(estado: State<'_, Estado>, profissional: cuidado::Profissional) -> Result<cuidado::Profissional, Erro> {
    estado.com_sessao(|s| cuidado::salvar_profissional(&s.conn, profissional))
}

#[tauri::command]
pub async fn excluir_profissional(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| cuidado::excluir_profissional(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_notas_cuidado(estado: State<'_, Estado>, profissional_id: String, tipo: String) -> Result<Vec<cuidado::Nota>, Erro> {
    estado.com_sessao(|s| cuidado::listar_notas(&s.conn, &profissional_id, &tipo))
}

#[tauri::command]
pub async fn criar_nota_cuidado(estado: State<'_, Estado>, profissional_id: String, tipo: String, texto: String) -> Result<cuidado::Nota, Erro> {
    estado.com_sessao(|s| cuidado::criar_nota(&s.conn, &profissional_id, &tipo, &texto))
}

#[tauri::command]
pub async fn marcar_nota_cuidado(estado: State<'_, Estado>, id: String, feita: bool) -> Result<(), Erro> {
    estado.com_sessao(|s| cuidado::marcar_nota(&s.conn, &id, feita))
}

#[tauri::command]
pub async fn excluir_nota_cuidado(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| cuidado::excluir_nota(&s.conn, &id))
}

#[tauri::command]
pub async fn registrar_sessao(estado: State<'_, Estado>, profissional_id: String, data: String, nota: String) -> Result<cuidado::RegistroSessao, Erro> {
    estado.com_sessao(|s| cuidado::registrar_sessao(&s.conn, &profissional_id, &data, &nota))
}

#[tauri::command]
pub async fn listar_sessoes(estado: State<'_, Estado>, profissional_id: String) -> Result<Vec<cuidado::RegistroSessao>, Erro> {
    estado.com_sessao(|s| cuidado::listar_sessoes(&s.conn, &profissional_id))
}

#[tauri::command]
pub async fn excluir_sessao(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| cuidado::excluir_sessao(&s.conn, &id))
}

// ---------- Vida acadêmica ----------

#[tauri::command]
pub async fn listar_materias(estado: State<'_, Estado>) -> Result<Vec<academico::Materia>, Erro> {
    estado.com_sessao(|s| academico::listar_materias(&s.conn))
}

#[tauri::command]
pub async fn salvar_materia(estado: State<'_, Estado>, materia: academico::Materia) -> Result<academico::Materia, Erro> {
    estado.com_sessao(|s| academico::salvar_materia(&s.conn, materia))
}

#[tauri::command]
pub async fn excluir_materia(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| academico::excluir_materia(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_atividades(estado: State<'_, Estado>) -> Result<Vec<academico::Atividade>, Erro> {
    estado.com_sessao(|s| academico::listar_atividades(&s.conn))
}

#[tauri::command]
pub async fn salvar_atividade(estado: State<'_, Estado>, atividade: academico::Atividade) -> Result<academico::Atividade, Erro> {
    estado.com_sessao(|s| academico::salvar_atividade(&s.conn, atividade))
}

#[tauri::command]
pub async fn marcar_atividade(estado: State<'_, Estado>, id: String, feita: bool) -> Result<(), Erro> {
    estado.com_sessao(|s| academico::marcar_atividade(&s.conn, &id, feita))
}

#[tauri::command]
pub async fn excluir_atividade(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| academico::excluir_atividade(&s.conn, &id))
}

#[tauri::command]
pub async fn media_aprovacao(estado: State<'_, Estado>) -> Result<f64, Erro> {
    estado.com_sessao(|s| academico::media_aprovacao(&s.conn))
}

#[tauri::command]
pub async fn definir_media_aprovacao(estado: State<'_, Estado>, media: f64) -> Result<(), Erro> {
    estado.com_sessao(|s| academico::definir_media_aprovacao(&s.conn, media))
}

#[tauri::command]
pub async fn listar_aulas(estado: State<'_, Estado>) -> Result<Vec<academico::Aula>, Erro> {
    estado.com_sessao(|s| academico::listar_aulas(&s.conn))
}

#[tauri::command]
pub async fn salvar_aula(estado: State<'_, Estado>, aula: academico::Aula) -> Result<academico::Aula, Erro> {
    estado.com_sessao(|s| academico::salvar_aula(&s.conn, aula))
}

#[tauri::command]
pub async fn excluir_aula(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| academico::excluir_aula(&s.conn, &id))
}

// ---------- Dinheiro ----------

#[tauri::command]
pub async fn registrar_gasto(
    estado: State<'_, Estado>,
    centavos: i64,
    grupo_id: String,
    descricao: String,
    interesse: bool,
    momento: Option<i64>,
    nota: Option<String>,
    conta_id: Option<String>,
) -> Result<dinheiro::Gasto, Erro> {
    estado.com_sessao(|s| dinheiro::registrar_gasto(&s.conn, centavos, &grupo_id, &descricao, interesse, momento, nota.as_deref(), conta_id.as_deref()))
}

#[tauri::command]
pub async fn registrar_entrada(estado: State<'_, Estado>, centavos: i64, descricao: String, momento: Option<i64>) -> Result<dinheiro::Entrada, Erro> {
    estado.com_sessao(|s| dinheiro::registrar_entrada(&s.conn, centavos, &descricao, momento))
}

#[tauri::command]
pub async fn listar_entradas(estado: State<'_, Estado>, de: i64, ate: i64) -> Result<Vec<dinheiro::Entrada>, Erro> {
    estado.com_sessao(|s| dinheiro::listar_entradas(&s.conn, de, ate))
}

#[tauri::command]
pub async fn excluir_entrada(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| dinheiro::excluir_entrada(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_grupos_gasto(estado: State<'_, Estado>) -> Result<Vec<dinheiro::Grupo>, Erro> {
    estado.com_sessao(|s| dinheiro::listar_grupos(&s.conn))
}

#[tauri::command]
pub async fn salvar_grupo_gasto(estado: State<'_, Estado>, grupo: dinheiro::Grupo) -> Result<dinheiro::Grupo, Erro> {
    estado.com_sessao(|s| dinheiro::salvar_grupo(&s.conn, grupo))
}

#[tauri::command]
pub async fn excluir_grupo_gasto(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| dinheiro::excluir_grupo(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_gastos(estado: State<'_, Estado>, de: i64, ate: i64) -> Result<Vec<dinheiro::Gasto>, Erro> {
    estado.com_sessao(|s| dinheiro::listar_gastos(&s.conn, de, ate))
}

#[tauri::command]
pub async fn excluir_gasto(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| dinheiro::excluir_gasto(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_contas(estado: State<'_, Estado>) -> Result<Vec<dinheiro::Conta>, Erro> {
    estado.com_sessao(|s| dinheiro::listar_contas(&s.conn))
}

#[tauri::command]
pub async fn salvar_conta(estado: State<'_, Estado>, conta: dinheiro::Conta) -> Result<dinheiro::Conta, Erro> {
    estado.com_sessao(|s| dinheiro::salvar_conta(&s.conn, conta))
}

#[tauri::command]
pub async fn excluir_conta(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| dinheiro::excluir_conta(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_desejos(estado: State<'_, Estado>) -> Result<Vec<dinheiro::Desejo>, Erro> {
    estado.com_sessao(|s| dinheiro::listar_desejos(&s.conn))
}

#[tauri::command]
pub async fn criar_desejo(estado: State<'_, Estado>, nome: String, centavos: i64, espera_horas: i64) -> Result<dinheiro::Desejo, Erro> {
    estado.com_sessao(|s| dinheiro::criar_desejo(&s.conn, &nome, centavos, espera_horas))
}

#[tauri::command]
pub async fn resolver_desejo(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| dinheiro::resolver_desejo(&s.conn, &id))
}

#[tauri::command]
pub async fn excluir_desejo(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| dinheiro::excluir_desejo(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_metas(estado: State<'_, Estado>) -> Result<Vec<dinheiro::Meta>, Erro> {
    estado.com_sessao(|s| dinheiro::listar_metas(&s.conn))
}

#[tauri::command]
pub async fn salvar_meta(estado: State<'_, Estado>, meta: dinheiro::Meta) -> Result<dinheiro::Meta, Erro> {
    estado.com_sessao(|s| dinheiro::salvar_meta(&s.conn, meta))
}

#[tauri::command]
pub async fn excluir_meta(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| dinheiro::excluir_meta(&s.conn, &id))
}

// ---------- Hobbies e interesses ----------

#[tauri::command]
pub async fn listar_hobbies(estado: State<'_, Estado>) -> Result<Vec<hobbies::Hobby>, Erro> {
    estado.com_sessao(|s| hobbies::listar(&s.conn))
}

#[tauri::command]
pub async fn salvar_hobby(estado: State<'_, Estado>, hobby: hobbies::Hobby) -> Result<hobbies::Hobby, Erro> {
    estado.com_sessao(|s| hobbies::salvar(&s.conn, hobby))
}

#[tauri::command]
pub async fn excluir_hobby(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| hobbies::excluir(&s.conn, &id))
}

// ---------- Leitura: estante e diário ----------

#[tauri::command]
pub async fn listar_livros(estado: State<'_, Estado>) -> Result<Vec<leitura::Livro>, Erro> {
    estado.com_sessao(|s| leitura::listar(&s.conn))
}

#[tauri::command]
pub async fn salvar_livro(estado: State<'_, Estado>, livro: leitura::Livro) -> Result<leitura::Livro, Erro> {
    estado.com_sessao(|s| leitura::salvar(&s.conn, livro))
}

#[tauri::command]
pub async fn mudar_status_livro(estado: State<'_, Estado>, id: String, status: String) -> Result<(), Erro> {
    estado.com_sessao(|s| leitura::mudar_status(&s.conn, &id, &status))
}

#[tauri::command]
pub async fn excluir_livro(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| leitura::excluir(&s.conn, &id))
}

/// Bytes de um anexo em base64, para abrir um livro (EPUB/PDF) no leitor.
#[tauri::command]
pub async fn bytes_anexo(estado: State<'_, Estado>, id: String) -> Result<String, Erro> {
    use base64::Engine;
    estado.com_sessao(|s| {
        let bytes = anexos::conteudo(&s.conn, &id)?;
        Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
    })
}

/// Lê um arquivo do disco (escolhido pela pessoa) e devolve em base64. Serve
/// para o leitor puxar os metadados de um livro antes de anexá-lo.
#[tauri::command]
pub async fn bytes_arquivo(_estado: State<'_, Estado>, caminho: String) -> Result<String, Erro> {
    use base64::Engine;
    let bytes = std::fs::read(&caminho).map_err(|e| Erro::Interno(format!("não consegui ler o arquivo: {e}")))?;
    if bytes.len() > anexos::MAXIMO_BYTES {
        return Err(Erro::Interno(format!("o arquivo passa de {} MB, o limite para anexos", anexos::MAXIMO_MB)));
    }
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

// ---------- Leitura: grupos (prateleiras) ----------

#[tauri::command]
pub async fn listar_grupos_livro(estado: State<'_, Estado>) -> Result<Vec<leitura::GrupoLivro>, Erro> {
    estado.com_sessao(|s| leitura::listar_grupos(&s.conn))
}

#[tauri::command]
pub async fn salvar_grupo_livro(estado: State<'_, Estado>, grupo: leitura::GrupoLivro) -> Result<leitura::GrupoLivro, Erro> {
    estado.com_sessao(|s| leitura::salvar_grupo(&s.conn, grupo))
}

#[tauri::command]
pub async fn excluir_grupo_livro(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| leitura::excluir_grupo(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_anotacoes(estado: State<'_, Estado>, livro_id: String) -> Result<Vec<anotacoes::Anotacao>, Erro> {
    estado.com_sessao(|s| anotacoes::listar(&s.conn, &livro_id))
}

#[tauri::command]
pub async fn salvar_anotacao(estado: State<'_, Estado>, anotacao: anotacoes::Anotacao) -> Result<anotacoes::Anotacao, Erro> {
    estado.com_sessao(|s| anotacoes::salvar(&s.conn, anotacao))
}

#[tauri::command]
pub async fn excluir_anotacao(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| anotacoes::excluir(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_cartoes(estado: State<'_, Estado>, hobby_id: String) -> Result<Vec<quadro::CartaoQuadro>, Erro> {
    estado.com_sessao(|s| quadro::listar(&s.conn, &hobby_id))
}

#[tauri::command]
pub async fn salvar_cartao(estado: State<'_, Estado>, cartao: quadro::CartaoQuadro) -> Result<quadro::CartaoQuadro, Erro> {
    estado.com_sessao(|s| quadro::salvar(&s.conn, cartao))
}

#[tauri::command]
pub async fn mover_cartao(estado: State<'_, Estado>, id: String, x: f64, y: f64) -> Result<(), Erro> {
    estado.com_sessao(|s| quadro::mover(&s.conn, &id, x, y))
}

#[tauri::command]
pub async fn excluir_cartao(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| quadro::excluir(&s.conn, &id))
}

// ---------- Minha organização (quadros e listas) ----------

#[tauri::command]
pub async fn listar_quadros(estado: State<'_, Estado>) -> Result<Vec<organizacao::Quadro>, Erro> {
    estado.com_sessao(|s| organizacao::listar_quadros(&s.conn))
}

#[tauri::command]
pub async fn salvar_quadro(estado: State<'_, Estado>, quadro: organizacao::Quadro) -> Result<organizacao::Quadro, Erro> {
    estado.com_sessao(|s| organizacao::salvar_quadro(&s.conn, quadro))
}

#[tauri::command]
pub async fn excluir_quadro(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| organizacao::excluir_quadro(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_colunas(estado: State<'_, Estado>, quadro_id: String) -> Result<Vec<organizacao::Coluna>, Erro> {
    estado.com_sessao(|s| organizacao::listar_colunas(&s.conn, &quadro_id))
}

#[tauri::command]
pub async fn salvar_coluna(estado: State<'_, Estado>, coluna: organizacao::Coluna) -> Result<organizacao::Coluna, Erro> {
    estado.com_sessao(|s| organizacao::salvar_coluna(&s.conn, coluna))
}

#[tauri::command]
pub async fn excluir_coluna(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| organizacao::excluir_coluna(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_cartoes_org(estado: State<'_, Estado>, quadro_id: String) -> Result<Vec<organizacao::Cartao>, Erro> {
    estado.com_sessao(|s| organizacao::listar_cartoes(&s.conn, &quadro_id))
}

#[tauri::command]
pub async fn salvar_cartao_org(estado: State<'_, Estado>, cartao: organizacao::Cartao) -> Result<organizacao::Cartao, Erro> {
    estado.com_sessao(|s| organizacao::salvar_cartao(&s.conn, cartao))
}

#[tauri::command]
pub async fn marcar_cartao_org(estado: State<'_, Estado>, id: String, feito: bool) -> Result<(), Erro> {
    estado.com_sessao(|s| organizacao::marcar_cartao(&s.conn, &id, feito))
}

#[tauri::command]
pub async fn mover_cartao_org(estado: State<'_, Estado>, id: String, coluna_id: String, ordem: f64) -> Result<(), Erro> {
    estado.com_sessao(|s| organizacao::mover_cartao(&s.conn, &id, &coluna_id, ordem))
}

#[tauri::command]
pub async fn reordenar_cartoes_org(estado: State<'_, Estado>, ids: Vec<String>) -> Result<(), Erro> {
    estado.com_sessao(|s| organizacao::reordenar_cartoes(&s.conn, ids))
}

#[tauri::command]
pub async fn excluir_cartao_org(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| organizacao::excluir_cartao(&s.conn, &id))
}

// ----- Pastas de projetos -----

#[tauri::command]
pub async fn listar_pastas_projeto(estado: State<'_, Estado>) -> Result<Vec<pastas_projeto::PastaProjeto>, Erro> {
    estado.com_sessao(|s| pastas_projeto::listar(&s.conn))
}

#[tauri::command]
pub async fn salvar_pasta_projeto(estado: State<'_, Estado>, pasta: pastas_projeto::PastaProjeto) -> Result<pastas_projeto::PastaProjeto, Erro> {
    estado.com_sessao(|s| pastas_projeto::salvar(&s.conn, pasta))
}

#[tauri::command]
pub async fn excluir_pasta_projeto(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| pastas_projeto::excluir(&s.conn, &id))
}

#[tauri::command]
pub async fn reordenar_pastas_projeto(estado: State<'_, Estado>, ids: Vec<String>) -> Result<(), Erro> {
    estado.com_sessao(|s| pastas_projeto::reordenar(&s.conn, &ids))
}

#[tauri::command]
pub async fn definir_pasta_do_projeto(estado: State<'_, Estado>, projeto: String, pasta: String, dentro: bool) -> Result<(), Erro> {
    estado.com_sessao(|s| pastas_projeto::definir(&s.conn, &projeto, &pasta, dentro))
}

// ----- Caderno -----

#[tauri::command]
pub async fn listar_pastas_caderno(estado: State<'_, Estado>) -> Result<Vec<caderno::PastaCaderno>, Erro> {
    estado.com_sessao(|s| caderno::listar_pastas(&s.conn))
}

#[tauri::command]
pub async fn salvar_pasta_caderno(estado: State<'_, Estado>, pasta: caderno::PastaCaderno) -> Result<caderno::PastaCaderno, Erro> {
    estado.com_sessao(|s| caderno::salvar_pasta(&s.conn, pasta))
}

#[tauri::command]
pub async fn excluir_pasta_caderno(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| caderno::excluir_pasta(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_cadernos(estado: State<'_, Estado>) -> Result<Vec<caderno::Caderno>, Erro> {
    estado.com_sessao(|s| caderno::listar_cadernos(&s.conn))
}

#[tauri::command]
pub async fn salvar_caderno(estado: State<'_, Estado>, cad: caderno::Caderno) -> Result<caderno::Caderno, Erro> {
    estado.com_sessao(|s| caderno::salvar_caderno(&s.conn, cad))
}

#[tauri::command]
pub async fn excluir_caderno(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| caderno::excluir_caderno(&s.conn, &id))
}

#[tauri::command]
pub async fn listar_paginas_caderno(estado: State<'_, Estado>, caderno_id: String) -> Result<Vec<caderno::Pagina>, Erro> {
    estado.com_sessao(|s| caderno::listar_paginas(&s.conn, &caderno_id))
}

#[tauri::command]
pub async fn salvar_pagina_caderno(estado: State<'_, Estado>, pagina: caderno::Pagina) -> Result<caderno::Pagina, Erro> {
    estado.com_sessao(|s| caderno::salvar_pagina(&s.conn, pagina))
}

#[tauri::command]
pub async fn excluir_pagina_caderno(estado: State<'_, Estado>, id: String) -> Result<(), Erro> {
    estado.com_sessao(|s| caderno::excluir_pagina(&s.conn, &id))
}

#[tauri::command]
pub async fn carregar_cena_caderno(estado: State<'_, Estado>, pagina_id: String) -> Result<String, Erro> {
    estado.com_sessao(|s| caderno::carregar_cena(&s.conn, &pagina_id))
}

#[tauri::command]
pub async fn salvar_cena_caderno(estado: State<'_, Estado>, pagina_id: String, cena: String) -> Result<(), Erro> {
    estado.com_sessao(|s| caderno::salvar_cena(&s.conn, &pagina_id, &cena))
}

// ---------- Sincronização entre aparelhos (motor; ver docs/decisoes/0012-sincronizacao.md) ----------
// Só banco e bytes: os mesmos comandos rodam no navegador (ponte gerada).

/// Se este aparelho tem a chave de sincronização e o id dele.
#[tauri::command]
pub async fn sincronia_situacao(estado: State<'_, Estado>) -> Result<sincronia::Situacao, Erro> {
    estado.com_sessao(|s| sincronia::situacao(&s.conn))
}

/// Primeiro aparelho: cria a chave e devolve o envelope (base64) para guardar no Drive.
#[tauri::command]
pub async fn sincronia_criar_chave(estado: State<'_, Estado>, senha: String) -> Result<String, Erro> {
    estado.com_sessao(|s| sincronia::criar_chave(&s.conn, &senha))
}

/// Aparelho novo: abre o envelope (base64) com a senha de sincronização.
#[tauri::command]
pub async fn sincronia_entrar(estado: State<'_, Estado>, envelope: String, senha: String) -> Result<(), Erro> {
    estado.com_sessao(|s| sincronia::entrar(&s.conn, &envelope, &senha))
}

/// Primeiro aparelho, modo conta (padrão, "só o Google"): cria a chave e devolve o arquivo aberto (base64).
#[tauri::command]
pub async fn sincronia_criar_chave_conta(estado: State<'_, Estado>) -> Result<String, Erro> {
    estado.com_sessao(|s| sincronia::criar_chave_conta(&s.conn))
}

/// Aparelho novo, modo conta: entra a partir do arquivo aberto (base64), sem senha.
#[tauri::command]
pub async fn sincronia_entrar_por_conta(estado: State<'_, Estado>, arquivo: String) -> Result<(), Erro> {
    estado.com_sessao(|s| sincronia::entrar_por_conta(&s.conn, &arquivo))
}

/// Liga a proteção extra: envelope com senha (base64) da chave que este aparelho já tem.
#[tauri::command]
pub async fn sincronia_ligar_protecao(estado: State<'_, Estado>, senha: String) -> Result<String, Erro> {
    estado.com_sessao(|s| sincronia::ligar_protecao(&s.conn, &senha))
}

/// Desliga a proteção extra: arquivo aberto (base64) da mesma chave.
#[tauri::command]
pub async fn sincronia_desligar_protecao(estado: State<'_, Estado>) -> Result<String, Erro> {
    estado.com_sessao(|s| sincronia::desligar_protecao(&s.conn))
}

/// O modo do arquivo da chave (base64): "conta" ou "senha".
#[tauri::command]
pub async fn sincronia_modo_da_chave(estado: State<'_, Estado>, arquivo: String) -> Result<sincronia::ModoChave, Erro> {
    estado.com_sessao(|_s| sincronia::modo_da_chave(&arquivo))
}

/// O retrato deste aparelho, trancado (base64), para gravar no Drive.
#[tauri::command]
pub async fn sincronia_meu_pacote(estado: State<'_, Estado>) -> Result<String, Erro> {
    estado.com_sessao(|s| sincronia::meu_pacote(&s.conn))
}

/// Junta aqui o pacote (base64) de outro aparelho.
#[tauri::command]
pub async fn sincronia_juntar(estado: State<'_, Estado>, pacote: String) -> Result<sincronia::Resumo, Erro> {
    estado.com_sessao(|s| sincronia::juntar_pacote(&s.conn, &pacote))
}

/// O conteúdo de um anexo pelo SHA-256, trancado (base64), ou nada se não existe aqui.
#[tauri::command]
pub async fn sincronia_conteudo(estado: State<'_, Estado>, sha: String) -> Result<Option<String>, Erro> {
    estado.com_sessao(|s| sincronia::conteudo_trancado(&s.conn, &sha))
}

/// Guarda o conteúdo trancado (base64) de um anexo que veio de outro aparelho.
#[tauri::command]
pub async fn sincronia_guardar_conteudo(estado: State<'_, Estado>, sha: String, conteudo: String) -> Result<u32, Erro> {
    estado.com_sessao(|s| sincronia::guardar_conteudo_trancado(&s.conn, &sha, &conteudo))
}

/// A marca do estado daqui (muda só quando algo que viaja muda) e os anexos que tem e que faltam.
#[tauri::command]
pub async fn sincronia_marca(estado: State<'_, Estado>) -> Result<sincronia::Marca, Erro> {
    estado.com_sessao(|s| sincronia::marca(&s.conn))
}

/// Desliga a sincronização neste aparelho (apaga a chave daqui; os dados ficam).
#[tauri::command]
pub async fn sincronia_sair(estado: State<'_, Estado>) -> Result<(), Erro> {
    estado.com_sessao(|s| sincronia::sair(&s.conn))
}

/// Recuperação (PIN + 6 perguntas): cria o arquivo (base64) para guardar no Drive.
#[tauri::command]
pub async fn sincronia_criar_recuperacao(estado: State<'_, Estado>, pin: String, perguntas: Vec<String>, respostas: Vec<String>) -> Result<String, Erro> {
    estado.com_sessao(|s| sincronia::criar_recuperacao(&s.conn, &pin, &perguntas, &respostas))
}

/// Só as perguntas do arquivo de recuperação (aparecem antes de abrir).
#[tauri::command]
pub async fn sincronia_perguntas(estado: State<'_, Estado>, recuperacao: String) -> Result<Vec<String>, Erro> {
    estado.com_sessao(|_s| sincronia::perguntas_da_recuperacao(&recuperacao))
}

/// "Esqueci a senha": entra com o PIN e as 6 respostas.
#[tauri::command]
pub async fn sincronia_entrar_por_recuperacao(estado: State<'_, Estado>, recuperacao: String, pin: String, respostas: Vec<String>) -> Result<(), Erro> {
    estado.com_sessao(|s| sincronia::entrar_por_recuperacao(&s.conn, &recuperacao, &pin, &respostas))
}

/// Resumo do PIN, trancado (base64), para os aparelhos novos conferirem que o PIN é o mesmo.
#[tauri::command]
pub async fn sincronia_marca_do_pin(estado: State<'_, Estado>, pin: String) -> Result<String, Erro> {
    estado.com_sessao(|s| sincronia::marca_do_pin(&s.conn, &pin))
}

/// Confere o PIN contra o resumo guardado no Drive.
#[tauri::command]
pub async fn sincronia_conferir_pin(estado: State<'_, Estado>, marca: String, pin: String) -> Result<bool, Erro> {
    estado.com_sessao(|s| sincronia::conferir_pin(&s.conn, &marca, &pin))
}

/// Quantas linhas de dados este aparelho tem (para perguntar se junta com o Drive).
#[tauri::command]
pub async fn sincronia_dados_locais(estado: State<'_, Estado>) -> Result<u32, Erro> {
    estado.com_sessao(|s| sincronia::dados_locais(&s.conn))
}

/// "Usar só os do Drive": apaga daqui os dados que viajam, antes de entrar (a tela faz a cópia de segurança antes).
#[tauri::command]
pub async fn sincronia_esvaziar(estado: State<'_, Estado>) -> Result<(), Erro> {
    estado.com_sessao(|s| sincronia::esvaziar_antes_de_entrar(&s.conn))
}
