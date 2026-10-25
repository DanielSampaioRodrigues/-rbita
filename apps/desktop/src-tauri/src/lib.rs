mod backup;
mod bandeja;
mod banco;
mod cofre;
mod comandos;
mod ditado;
mod erro;
mod hello;
mod ia;
mod nuvem;

use std::sync::Arc;

use tauri::{Emitter, Manager, WindowEvent};

use cofre::aparelho::GuardaDoSistema;
use cofre::Cofre;
use comandos::Estado;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Atualização dentro do app: só procura e instala quando a pessoa manda.
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            let pasta = app.path().app_data_dir()?;
            // Cópias temporárias de anexos abertos da última vez: apagadas.
            let _ = std::fs::remove_dir_all(comandos::pasta_temporaria_anexos());
            let guarda = Arc::new(GuardaDoSistema { servico: app.config().identifier.clone() });
            app.manage(ditado::Ditado::new(pasta.join("modelos-de-voz")));
            app.manage(bandeja::Bandeja::new(&pasta));
            app.manage(Estado::new(Cofre::new(pasta, guarda)));
            #[cfg(desktop)]
            {
                registrar_captura_global(app);
                bandeja::iniciar(app.handle());
            }
            Ok(())
        })
        // Ao fechar a janela: com a bandeja ligada, só esconde (avisando na primeira
        // vez); sem ela, fecha, fazendo antes o backup automático do dia, se ligado.
        .on_window_event(|janela, evento| {
            if let WindowEvent::CloseRequested { api, .. } = evento {
                let app = janela.app_handle();
                if app.state::<bandeja::Bandeja>().ligada() && app.tray_by_id("principal").is_some() {
                    api.prevent_close();
                    let _ = janela.hide();
                    if app.state::<bandeja::Bandeja>().primeiro_aviso() {
                        use tauri_plugin_notification::NotificationExt;
                        let _ = app
                            .notification()
                            .builder()
                            .title("O Órbita continua aberto")
                            .body("Ele fica no ícone perto do relógio. Para sair de vez, clique no ícone com o botão direito e escolha Sair.")
                            .show();
                    }
                } else {
                    janela.state::<Estado>().backup_automatico_se_preciso(false);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            comandos::situacao,
            comandos::criar_cofre,
            comandos::abrir_com_senha,
            comandos::abrir_com_pin,
            comandos::abrir_direto,
            comandos::hello_disponivel,
            comandos::abrir_com_hello,
            comandos::conferir_palavras,
            comandos::recuperar,
            comandos::ler_arquivo_recuperacao,
            comandos::gravar_arquivo_recuperacao,
            comandos::ver_palavras,
            comandos::definir_senha,
            comandos::abrir_com_palavras,
            comandos::nuvem_disponivel,
            comandos::nuvem_situacao,
            comandos::nuvem_conectar,
            comandos::nuvem_enviar,
            comandos::nuvem_desconectar,
            comandos::nuvem_buscar_para_recuperar,
            comandos::nuvem_concluir_recuperacao,
            comandos::mudar_modo,
            comandos::bloquear,
            comandos::fazer_backup,
            comandos::info_backup,
            comandos::restaurar_backup,
            comandos::situacao_backup,
            comandos::definir_backup_automatico,
            comandos::listar_ideias,
            comandos::criar_ideia,
            comandos::editar_ideia,
            comandos::ideia_para_projeto,
            comandos::excluir_item,
            comandos::listar_projetos,
            comandos::obter_projeto,
            comandos::criar_projeto,
            comandos::renomear,
            comandos::mudar_estado_projeto,
            comandos::salvar_onde_parei,
            comandos::limite_projetos,
            comandos::definir_limite_projetos,
            comandos::listar_tarefas,
            comandos::criar_tarefa,
            comandos::mudar_estado_tarefa,
            comandos::mover_tarefa,
            comandos::listar_eventos,
            comandos::salvar_evento,
            comandos::pular_data_evento,
            comandos::excluir_evento,
            comandos::listar_rotinas,
            comandos::criar_rotina,
            comandos::salvar_passo,
            comandos::registrar_energia,
            comandos::listar_energia,
            comandos::basicos_do_dia,
            comandos::definir_basicos,
            comandos::marcar_basico,
            comandos::tarefas_sugeridas,
            comandos::definir_peso_tarefa,
            comandos::gravar_arquivo_tema,
            comandos::definir_datas_projeto,
            comandos::definir_prazo_tarefa,
            comandos::listar_prazos,
            comandos::estado_ia,
            comandos::salvar_provedor_ia,
            comandos::remover_provedor_ia,
            comandos::definir_funcao_ia,
            comandos::bloquear_sensivel_ia,
            comandos::testar_provedor_ia,
            comandos::memoria_do_computador,
            comandos::sugerir_passos_ia,
            comandos::organizar_texto_ia,
            comandos::ajustar_organizacao_ia,
            comandos::revisar_texto_ia,
            comandos::ditado_estado,
            comandos::ditado_baixar,
            comandos::ditado_cancelar_download,
            comandos::ditado_remover,
            comandos::ditado_comecar,
            comandos::ditado_parar,
            comandos::ditado_descartar,
            comandos::bandeja_ligada,
            comandos::salvar_nota_ideia,
            comandos::listar_etiquetas,
            comandos::criar_etiqueta,
            comandos::editar_etiqueta,
            comandos::excluir_etiqueta,
            comandos::definir_etiquetas_item,
            comandos::ligar_itens,
            comandos::itens_ligados,
            comandos::listar_anexos,
            comandos::anexar_arquivo,
            comandos::anexar_link,
            comandos::imagem_anexo,
            comandos::abrir_anexo,
            comandos::salvar_anexo,
            comandos::excluir_anexo,
            comandos::gerar_tema_ia,
            comandos::modelos_imagem_ia,
            comandos::gerar_imagem_ia,
            comandos::definir_bandeja,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Órbita");
}

/// Ctrl+Alt+Espaço, de qualquer programa: traz o Órbita para a frente com a captura aberta.
/// Se outro programa já usa o atalho, o Órbita segue sem ele (a captura continua no app).
#[cfg(desktop)]
fn registrar_captura_global(app: &tauri::App) {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    let atalho = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space);
    let plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |app, recebido, evento| {
            if recebido == &atalho && evento.state() == ShortcutState::Pressed {
                bandeja::mostrar_janela(app);
                let _ = app.emit("capturar", ());
            }
        })
        .build();
    if app.handle().plugin(plugin).is_ok() {
        if let Err(e) = app.global_shortcut().register(atalho) {
            eprintln!("atalho global de captura indisponível: {e}");
        }
    }
}
