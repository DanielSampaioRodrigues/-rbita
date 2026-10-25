mod backup;
mod banco;
mod cofre;
mod comandos;
mod erro;
mod hello;

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
        .setup(|app| {
            let pasta = app.path().app_data_dir()?;
            let guarda = Arc::new(GuardaDoSistema { servico: app.config().identifier.clone() });
            app.manage(Estado::new(Cofre::new(pasta, guarda)));
            #[cfg(desktop)]
            registrar_captura_global(app);
            Ok(())
        })
        // Ao fechar a janela, faz o backup automático do dia, se estiver ligado.
        .on_window_event(|janela, evento| {
            if let WindowEvent::CloseRequested { .. } = evento {
                janela.state::<Estado>().backup_automatico_se_preciso(false);
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
            comandos::trocar_senha,
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
                if let Some(janela) = app.get_webview_window("principal") {
                    let _ = janela.show();
                    let _ = janela.unminimize();
                    let _ = janela.set_focus();
                }
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
