//! Gravação do microfone padrão. O fluxo de áudio vive numa linha de execução
//! própria (no Windows ele não pode trocar de linha) e devolve o áudio mono
//! quando recebe o sinal de parar ou chega ao tempo máximo.

pub struct Audio {
    pub amostras: Vec<f32>,
    pub taxa: u32,
}

#[cfg(windows)]
mod sistema {
    use std::sync::mpsc;
    use std::sync::{Arc, Mutex};
    use std::thread::JoinHandle;
    use std::time::Duration;

    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use cpal::{FromSample, Sample, SampleFormat};

    use super::Audio;
    use crate::erro::Erro;

    pub struct Gravacao {
        parar: mpsc::Sender<()>,
        fio: JoinHandle<Result<Audio, Erro>>,
    }

    fn erro(m: &str) -> Erro {
        Erro::Ditado(m.into())
    }

    /// Mistura os canais em um só e guarda, até o limite.
    fn empurrar<T>(dados: &[T], canais: usize, destino: &Mutex<Vec<f32>>, limite: usize)
    where
        T: Sample,
        f32: FromSample<T>,
    {
        let mut d = destino.lock().unwrap();
        for quadro in dados.chunks(canais) {
            if d.len() >= limite {
                return;
            }
            d.push(quadro.iter().map(|s| f32::from_sample(*s)).sum::<f32>() / canais as f32);
        }
    }

    pub fn comecar(maximo_segundos: u32) -> Result<Gravacao, Erro> {
        let (pronto_tx, pronto_rx) = mpsc::channel::<Result<(), Erro>>();
        let (parar_tx, parar_rx) = mpsc::channel::<()>();
        let fio = std::thread::spawn(move || -> Result<Audio, Erro> {
            let falhar = |m: &str| {
                let _ = pronto_tx.send(Err(erro(m)));
                Err(erro(m))
            };
            let host = cpal::default_host();
            let Some(aparelho) = host.default_input_device() else {
                return falhar("Não encontrei um microfone. Confira se ele está conectado.");
            };
            let Ok(config) = aparelho.default_input_config() else {
                return falhar("Não consegui usar o microfone. Confira se o Windows deixa programas usarem o microfone.");
            };
            let canais = config.channels().max(1) as usize;
            let taxa = config.sample_rate();
            let limite = (taxa * maximo_segundos) as usize;
            let amostras = Arc::new(Mutex::new(Vec::<f32>::with_capacity(taxa as usize * 30)));
            let a = amostras.clone();
            let ao_errar = |_| {};
            let formato = config.sample_format();
            let fluxo = match formato {
                SampleFormat::F32 => aparelho.build_input_stream(config.into(), move |d: &[f32], _: &_| empurrar(d, canais, &a, limite), ao_errar, None),
                SampleFormat::I16 => aparelho.build_input_stream(config.into(), move |d: &[i16], _: &_| empurrar(d, canais, &a, limite), ao_errar, None),
                SampleFormat::I32 => aparelho.build_input_stream(config.into(), move |d: &[i32], _: &_| empurrar(d, canais, &a, limite), ao_errar, None),
                SampleFormat::U16 => aparelho.build_input_stream(config.into(), move |d: &[u16], _: &_| empurrar(d, canais, &a, limite), ao_errar, None),
                _ => return falhar("O formato de áudio deste microfone não é suportado."),
            };
            let Ok(fluxo) = fluxo else {
                return falhar("Não consegui abrir o microfone. Ele pode estar em uso por outro programa, ou bloqueado nas configurações de privacidade do Windows.");
            };
            if fluxo.play().is_err() {
                return falhar("Não consegui começar a gravar.");
            }
            let _ = pronto_tx.send(Ok(()));
            let _ = parar_rx.recv_timeout(Duration::from_secs(maximo_segundos as u64));
            drop(fluxo);
            let amostras = std::mem::take(&mut *amostras.lock().unwrap());
            Ok(Audio { amostras, taxa })
        });
        match pronto_rx.recv() {
            Ok(Ok(())) => Ok(Gravacao { parar: parar_tx, fio }),
            Ok(Err(e)) => Err(e),
            Err(_) => Err(erro("Não consegui começar a gravar.")),
        }
    }

    impl Gravacao {
        pub fn parar(self) -> Result<Audio, Erro> {
            let _ = self.parar.send(());
            self.fio.join().map_err(|_| erro("A gravação parou de um jeito inesperado."))?
        }
    }
}

#[cfg(not(windows))]
mod sistema {
    use super::Audio;
    use crate::erro::Erro;

    /// Por enquanto o ditado só grava no Windows (Mac e celular vêm na Onda 3).
    pub struct Gravacao;

    pub fn comecar(_maximo_segundos: u32) -> Result<Gravacao, Erro> {
        Err(Erro::Ditado("O ditado ainda não funciona neste sistema.".into()))
    }

    impl Gravacao {
        pub fn parar(self) -> Result<Audio, Erro> {
            Ok(Audio { amostras: Vec::new(), taxa: 16_000 })
        }
    }
}

pub use sistema::{comecar, Gravacao};
