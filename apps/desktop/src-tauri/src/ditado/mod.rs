//! Ditado local: o microfone grava, o whisper.cpp transcreve no próprio
//! computador. Nada sai do aparelho. O modelo de voz é baixado à parte, só
//! quando a pessoa liga o ditado, e é conferido pela soma publicada.

mod microfone;

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use sha1::{Digest, Sha1};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::erro::Erro;

pub use microfone::Gravacao;

/// Taxa que o whisper espera.
pub const TAXA_WHISPER: u32 = 16_000;
/// Gravação máxima de uma vez.
pub const MAXIMO_SEGUNDOS: u32 = 5 * 60;

pub struct InfoModelo {
    pub id: &'static str,
    arquivo: &'static str,
    pub tamanho_mb: u32,
    /// SHA-1 publicado no repositório do whisper.cpp (models/README.md).
    sha1: &'static str,
}

/// "base" é mais rápido; "small" erra menos em português.
pub const MODELOS: &[InfoModelo] = &[
    InfoModelo { id: "base", arquivo: "ggml-base.bin", tamanho_mb: 142, sha1: "465707469ff3a37a2b9b8d8f89f2f99de7299dac" },
    InfoModelo { id: "small", arquivo: "ggml-small.bin", tamanho_mb: 466, sha1: "55356645c2b361a969dfd0ef2c5a50d530afd8d5" },
];

fn erro(mensagem: &str) -> Erro {
    Erro::Ditado(mensagem.into())
}

fn info(id: &str) -> Result<&'static InfoModelo, Erro> {
    MODELOS.iter().find(|m| m.id == id).ok_or_else(|| erro("Modelo de voz desconhecido."))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EstadoDitado {
    /// Modelo baixado e conferido, se houver.
    pub instalado: Option<&'static str>,
    pub baixando: bool,
    pub gravando: bool,
}

pub struct Ditado {
    pasta: PathBuf,
    /// Sinal para cancelar o download em andamento.
    download: Mutex<Option<Arc<AtomicBool>>>,
    gravacao: Mutex<Option<Gravacao>>,
    /// Modelo carregado na memória (carregar demora alguns segundos).
    contexto: Mutex<Option<(&'static str, Arc<WhisperContext>)>>,
}

impl Ditado {
    pub fn new(pasta: PathBuf) -> Self {
        Self { pasta, download: Mutex::new(None), gravacao: Mutex::new(None), contexto: Mutex::new(None) }
    }

    fn caminho(&self, m: &InfoModelo) -> PathBuf {
        self.pasta.join(m.arquivo)
    }

    /// O mais preciso que estiver baixado.
    pub fn instalado(&self) -> Option<&'static InfoModelo> {
        MODELOS.iter().rev().find(|m| self.caminho(m).is_file())
    }

    pub fn estado(&self) -> EstadoDitado {
        EstadoDitado {
            instalado: self.instalado().map(|m| m.id),
            baixando: self.download.lock().unwrap().is_some(),
            gravando: self.gravacao.lock().unwrap().is_some(),
        }
    }

    /// Baixa o modelo, conferindo a soma enquanto grava. `progresso` recebe
    /// (baixado, total) em bytes. Só um download por vez.
    pub async fn baixar(&self, id: &str, progresso: impl Fn(u64, u64)) -> Result<(), Erro> {
        let m = info(id)?;
        let cancelar = Arc::new(AtomicBool::new(false));
        {
            let mut d = self.download.lock().unwrap();
            if d.is_some() {
                return Err(erro("Já há um download em andamento."));
            }
            *d = Some(cancelar.clone());
        }
        let resultado = self.baixar_arquivo(m, &cancelar, progresso).await;
        *self.download.lock().unwrap() = None;
        if resultado.is_ok() {
            // Fica só um modelo no disco.
            for outro in MODELOS.iter().filter(|o| o.id != m.id) {
                let _ = std::fs::remove_file(self.caminho(outro));
            }
            *self.contexto.lock().unwrap() = None;
        }
        resultado
    }

    async fn baixar_arquivo(&self, m: &InfoModelo, cancelar: &AtomicBool, progresso: impl Fn(u64, u64)) -> Result<(), Erro> {
        std::fs::create_dir_all(&self.pasta)?;
        let parcial = self.pasta.join(format!("{}.parcial", m.arquivo));
        let url = format!("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}", m.arquivo);
        let cliente = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(20))
            .read_timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| Erro::Interno(e.to_string()))?;
        let sem_rede = |_| erro("Não consegui baixar o modelo de voz. Confira a conexão com a internet e tente de novo.");
        let mut resposta = cliente.get(&url).send().await.map_err(sem_rede)?;
        if !resposta.status().is_success() {
            return Err(erro(&format!("O site do modelo de voz respondeu com erro ({}). Tente mais tarde.", resposta.status().as_u16())));
        }
        let total = resposta.content_length().unwrap_or(m.tamanho_mb as u64 * 1024 * 1024);
        let mut arquivo = std::io::BufWriter::new(std::fs::File::create(&parcial)?);
        let mut soma = Sha1::new();
        let mut baixado = 0u64;
        let mut ultimo_aviso = 0u64;
        let resultado: Result<(), Erro> = async {
            while let Some(pedaco) = resposta.chunk().await.map_err(sem_rede)? {
                if cancelar.load(Ordering::Relaxed) {
                    return Err(erro("Download cancelado."));
                }
                arquivo.write_all(&pedaco)?;
                soma.update(&pedaco);
                baixado += pedaco.len() as u64;
                if baixado - ultimo_aviso >= total / 200 {
                    ultimo_aviso = baixado;
                    progresso(baixado, total);
                }
            }
            arquivo.flush()?;
            Ok(())
        }
        .await;
        drop(arquivo);
        let conferido = resultado.and_then(|_| {
            if hex::encode(soma.finalize()) == m.sha1 {
                Ok(())
            } else {
                Err(erro("O arquivo baixado veio diferente do esperado e foi descartado. Tente de novo."))
            }
        });
        match conferido {
            Ok(()) => {
                std::fs::rename(&parcial, self.caminho(m))?;
                progresso(total, total);
                Ok(())
            }
            Err(e) => {
                let _ = std::fs::remove_file(&parcial);
                Err(e)
            }
        }
    }

    pub fn cancelar_download(&self) {
        if let Some(c) = self.download.lock().unwrap().as_ref() {
            c.store(true, Ordering::Relaxed);
        }
    }

    pub fn remover(&self) -> Result<(), Erro> {
        *self.contexto.lock().unwrap() = None;
        for m in MODELOS {
            let _ = std::fs::remove_file(self.caminho(m));
        }
        Ok(())
    }

    pub fn comecar(&self) -> Result<(), Erro> {
        if self.instalado().is_none() {
            return Err(erro("O ditado ainda não está instalado. Dá para instalar em Ajustes."));
        }
        let mut g = self.gravacao.lock().unwrap();
        if g.is_none() {
            *g = Some(microfone::comecar(MAXIMO_SEGUNDOS)?);
        }
        Ok(())
    }

    /// Para de gravar e devolve o áudio já em 16 kHz.
    pub fn parar(&self) -> Result<Vec<f32>, Erro> {
        let gravacao = self.gravacao.lock().unwrap().take().ok_or_else(|| erro("Nada está sendo gravado."))?;
        let audio = gravacao.parar()?;
        Ok(reamostrar(&audio.amostras, audio.taxa, TAXA_WHISPER))
    }

    pub fn descartar(&self) {
        if let Some(g) = self.gravacao.lock().unwrap().take() {
            let _ = g.parar();
        }
    }

    pub fn contexto(&self) -> Result<Arc<WhisperContext>, Erro> {
        let m = self.instalado().ok_or_else(|| erro("O ditado ainda não está instalado."))?;
        let mut c = self.contexto.lock().unwrap();
        if let Some((id, ctx)) = c.as_ref() {
            if *id == m.id {
                return Ok(ctx.clone());
            }
        }
        let caminho = self.caminho(m);
        let ctx = Arc::new(carregar(&caminho)?);
        *c = Some((m.id, ctx.clone()));
        Ok(ctx)
    }
}

fn carregar(caminho: &Path) -> Result<WhisperContext, Erro> {
    let texto = caminho.to_str().ok_or_else(|| erro("Caminho do modelo inválido."))?;
    // "Flash attention" acelera a transcrição no processador.
    let mut parametros = WhisperContextParameters::default();
    parametros.flash_attn(true);
    WhisperContext::new_with_params(texto, parametros)
        .map_err(|_| erro("Não consegui abrir o modelo de voz. Tente remover e baixar de novo em Ajustes."))
}

/// Volume médio (RMS). Abaixo de um mínimo, não houve fala: o whisper
/// costuma "inventar" frases quando recebe silêncio.
pub fn volume(audio: &[f32]) -> f32 {
    if audio.is_empty() {
        return 0.0;
    }
    (audio.iter().map(|a| a * a).sum::<f32>() / audio.len() as f32).sqrt()
}

pub const VOLUME_MINIMO: f32 = 0.002;

/// Tamanho da janela de áudio do whisper para uma fala curta. A janela cheia
/// (1500) vale 30 s: 50 por segundo. Folga de 2 s e mínimo de 512, porque
/// janelas muito pequenas pioram o reconhecimento. None = fala de 25 s ou mais.
pub fn janela_de_audio(amostras: usize) -> Option<i32> {
    let segundos = amostras as f32 / TAXA_WHISPER as f32;
    if segundos >= 25.0 {
        return None;
    }
    Some((((segundos + 2.0) * 50.0).ceil() as i32).clamp(512, 1500))
}

/// Transcreve áudio mono de 16 kHz em português. Demora: rodar fora da tela.
pub fn transcrever(ctx: &WhisperContext, audio: &[f32]) -> Result<String, Erro> {
    if (audio.len() as u32) < TAXA_WHISPER / 2 {
        return Err(erro("A gravação ficou curta demais. Aperte o microfone, fale e aperte de novo para parar."));
    }
    if volume(audio) < VOLUME_MINIMO {
        return Err(erro(
            "Não ouvi nada. Confira se o microfone está ligado e se o Windows deixa programas usarem o microfone (Configurações > Privacidade > Microfone).",
        ));
    }
    let mut estado = ctx.create_state().map_err(|_| erro("Não consegui preparar a transcrição."))?;
    let mut p = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    p.set_language(Some("pt"));
    let fios = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).clamp(1, 8);
    p.set_n_threads(fios as i32);
    p.set_print_special(false);
    p.set_print_progress(false);
    p.set_print_realtime(false);
    p.set_print_timestamps(false);
    p.set_no_context(true);
    // Mais rápido: sem marcar tempos (o Órbita não usa) e sem refazer a
    // decodificação com outras "temperaturas" quando o modelo hesita.
    p.set_no_timestamps(true);
    p.set_temperature_inc(0.0);
    // O whisper sempre trabalha numa janela de 30 s. Para falas curtas, uma
    // janela do tamanho da fala (com folga) corta boa parte do tempo.
    if let Some(ctx_audio) = janela_de_audio(audio.len()) {
        p.set_audio_ctx(ctx_audio);
        p.set_single_segment(true);
    }
    estado.full(p, audio).map_err(|_| erro("A transcrição falhou. Tente de novo."))?;
    let texto: String = estado.as_iter().map(|s| s.to_string()).collect::<Vec<_>>().join(" ");
    let texto = limpar_transcricao(&texto);
    if texto.is_empty() {
        return Err(erro("Não entendi o que foi dito. Tente falar um pouco mais perto do microfone."));
    }
    Ok(texto)
}

/// Junta espaços e tira marcas que o whisper põe em trechos sem fala.
pub fn limpar_transcricao(texto: &str) -> String {
    let sem_marcas: String = texto
        .split_whitespace()
        .filter(|p| !(p.starts_with('[') && p.ends_with(']')) && !(p.starts_with('(') && p.ends_with(')')))
        .collect::<Vec<_>>()
        .join(" ");
    sem_marcas.trim().to_string()
}

/// Muda a taxa de amostragem por interpolação linear (suficiente para voz).
pub fn reamostrar(audio: &[f32], de: u32, para: u32) -> Vec<f32> {
    if de == para || audio.is_empty() {
        return audio.to_vec();
    }
    let razao = de as f64 / para as f64;
    let n = ((audio.len() as f64) / razao).floor() as usize;
    (0..n)
        .map(|i| {
            let pos = i as f64 * razao;
            let j = pos.floor() as usize;
            let f = (pos - j as f64) as f32;
            let a = audio[j];
            let b = *audio.get(j + 1).unwrap_or(&a);
            a + (b - a) * f
        })
        .collect()
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn reamostra_para_16_khz() {
        let um_segundo: Vec<f32> = (0..48_000).map(|i| (i as f32 / 48_000.0 * 440.0 * std::f32::consts::TAU).sin()).collect();
        let r = reamostrar(&um_segundo, 48_000, 16_000);
        assert_eq!(r.len(), 16_000);
        assert!((r[3] - um_segundo[9]).abs() < 1e-6);
        assert_eq!(reamostrar(&[1.0, 2.0], 16_000, 16_000), vec![1.0, 2.0]);
        let dobro = reamostrar(&[0.0, 1.0], 8_000, 16_000);
        assert_eq!(dobro, vec![0.0, 0.5, 1.0, 1.0]);
    }

    #[test]
    fn janela_acompanha_o_tamanho_da_fala() {
        assert_eq!(janela_de_audio(16_000 * 3), Some(512));
        assert_eq!(janela_de_audio(16_000 * 10), Some(600));
        assert_eq!(janela_de_audio(16_000 * 24), Some(1300));
        assert_eq!(janela_de_audio(16_000 * 40), None);
    }

    #[test]
    fn silencio_nao_vira_texto() {
        assert!(volume(&vec![0.0; 16_000]) < VOLUME_MINIMO);
        assert!(volume(&vec![0.1; 16_000]) > VOLUME_MINIMO);
        assert_eq!(limpar_transcricao(" [Música]  Comprar   pão (risos) "), "Comprar pão");
    }

    #[test]
    fn so_um_modelo_fica_instalado_e_o_mais_preciso_vale() {
        let pasta = tempfile::tempdir().unwrap();
        let d = Ditado::new(pasta.path().to_path_buf());
        assert!(d.estado().instalado.is_none());
        std::fs::write(pasta.path().join("ggml-base.bin"), b"x").unwrap();
        assert_eq!(d.estado().instalado, Some("base"));
        std::fs::write(pasta.path().join("ggml-small.bin"), b"x").unwrap();
        assert_eq!(d.estado().instalado, Some("small"));
        d.remover().unwrap();
        assert!(d.estado().instalado.is_none());
    }

    /// Precisa do modelo base e de um áudio de exemplo (não roda no CI):
    /// ORBITA_MODELO=ggml-base.bin ORBITA_WAV=jfk.wav cargo test transcreve_de_verdade -- --ignored
    #[test]
    #[ignore]
    fn transcreve_de_verdade() {
        let modelo = std::env::var("ORBITA_MODELO").unwrap();
        let wav = std::fs::read(std::env::var("ORBITA_WAV").unwrap()).unwrap();
        // WAV PCM 16 bits mono 16 kHz: pula o cabeçalho de 44 bytes.
        let audio: Vec<f32> = wav[44..].chunks_exact(2).map(|b| i16::from_le_bytes([b[0], b[1]]) as f32 / 32768.0).collect();
        let ctx = carregar(Path::new(&modelo)).unwrap();
        let texto = transcrever(&ctx, &audio).unwrap();
        println!("{texto}");
        assert!(!texto.is_empty());
    }
}
