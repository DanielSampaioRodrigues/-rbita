// Sem janela de terminal extra no Windows ao abrir o app instalado.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    orbita_lib::run()
}
