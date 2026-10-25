mod backup;
mod banco;
mod cofre;
mod comandos;
mod erro;
mod hello;

use std::sync::Arc;

use tauri::{Manager, WindowEvent};

use cofre::aparelho::GuardaDoSistema;
use cofre::Cofre;
use comandos::Estado;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let pasta = app.path().app_data_dir()?;
            let guarda = Arc::new(GuardaDoSistema { servico: app.config().identifier.clone() });
            app.manage(Estado::new(Cofre::new(pasta, guarda)));
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
            comandos::listar_notas,
            comandos::criar_nota,
            comandos::excluir_nota,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Órbita");
}
