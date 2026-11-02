// Monta o motor do navegador: o banco do Windows (crates/motor-web) em WebAssembly,
// e a ponte em JavaScript, dentro de src/web/motor/ (pasta fora do git).
// Precisa de: rustup target add wasm32-unknown-unknown; cargo install wasm-bindgen-cli
// na mesma versão do Cargo.lock de crates/motor-web.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));
const crate = join(aqui, "..", "..", "..", "crates", "motor-web");
const destino = join(aqui, "..", "src", "web", "motor");
const rodar = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit" });

rodar("cargo", ["build", "--release", "--target", "wasm32-unknown-unknown"], crate);
rodar("wasm-bindgen", ["--target", "web", "--out-dir", destino, join(crate, "target", "wasm32-unknown-unknown", "release", "orbita_motor_web.wasm")], crate);
console.log(`Motor pronto em ${destino}`);
