fn main() {
    // Identificadores do Órbita no Google e na Microsoft (login com conta). Vêm dos
    // segredos do GitHub na hora de montar; sem eles, a opção some da tela.
    for nome in ["ORBITA_GOOGLE_CLIENT_ID", "ORBITA_GOOGLE_CLIENT_SECRET", "ORBITA_MICROSOFT_CLIENT_ID"] {
        println!("cargo:rerun-if-env-changed={nome}");
    }
    tauri_build::build()
}
