import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { noApp } from "./api";

/** Notificação do sistema, sempre sem som. Falhas são ignoradas: o aviso dentro do app continua. */
export async function notificar(titulo: string, corpo: string): Promise<void> {
  if (!noApp) return;
  try {
    let permitido = await isPermissionGranted();
    if (!permitido) permitido = (await requestPermission()) === "granted";
    if (permitido) sendNotification({ title: titulo, body: corpo });
  } catch {
    // Sem notificação do sistema: tudo bem.
  }
}
