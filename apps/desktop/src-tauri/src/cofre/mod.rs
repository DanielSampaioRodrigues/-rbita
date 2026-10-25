//! Cofre: guarda a chave dos dados trancada de três jeitos.
//!
//! - pela **senha** (sempre existe);
//! - pela **chave de recuperação** de 6 palavras (sempre existe);
//! - pelo **aparelho** (opcional): PIN, ou abrir direto, usando um segredo
//!   guardado pelo sistema. Só funciona neste computador.
//!
//! A chave dos dados nunca é gravada aberta. O arquivo `cofre.json` só tem envelopes.

pub mod aparelho;
pub mod cripto;
pub mod palavras;

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use unicode_normalization::UnicodeNormalization;

use aparelho::GuardaDoAparelho;
use cripto::{aleatorio, derivar, destrancar, nova_chave, trancar, Chave, Envelope, ParametrosKdf};

use crate::erro::Erro;

pub const TENTATIVAS_DE_PIN: u32 = 5;
pub const MINIMO_SENHA: usize = 12;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModoAbrir {
    Pin,
    Senha,
    Direto,
}

#[derive(Debug, Serialize, Deserialize)]
struct EnvelopeAparelho {
    envelope: Envelope,
    tentativas_erradas: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct ArquivoCofre {
    versao: u32,
    id: String,
    modo: ModoAbrir,
    senha: Envelope,
    recuperacao: Envelope,
    #[serde(default)]
    aparelho: Option<EnvelopeAparelho>,
}

/// O que a tela de entrada precisa saber antes de abrir.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Situacao {
    pub existe: bool,
    pub modo: Option<ModoAbrir>,
    pub tentativas_restantes: u32,
}

pub struct Cofre {
    pasta: PathBuf,
    guarda: Arc<dyn GuardaDoAparelho>,
}

fn rotulo(tipo: &str, id: &str) -> String {
    format!("orbita:{tipo}:v1:{id}")
}

/// Mesma senha, mesmos bytes, não importa como o teclado compôs os acentos.
fn bytes_da_senha(senha: &str) -> zeroize::Zeroizing<Vec<u8>> {
    zeroize::Zeroizing::new(senha.nfc().collect::<String>().into_bytes())
}

pub fn validar_senha(senha: &str) -> Result<(), Erro> {
    if senha.trim().chars().count() < MINIMO_SENHA {
        return Err(Erro::SenhaCurta);
    }
    Ok(())
}

pub fn validar_pin(pin: &str) -> Result<(), Erro> {
    if (4..=8).contains(&pin.len()) && pin.chars().all(|c| c.is_ascii_digit()) {
        Ok(())
    } else {
        Err(Erro::PinInvalido)
    }
}

fn envelope_por_segredo(chave: &Chave, segredo: &[u8], tipo: &str, id: &str, pimenta: Option<&[u8]>) -> Result<Envelope, Erro> {
    let sal = aleatorio::<16>().to_vec();
    let kdf = ParametrosKdf::PADRAO;
    let tranca = derivar(segredo, &sal, kdf, pimenta)?;
    trancar(chave, &tranca, &rotulo(tipo, id), Some(kdf), sal)
}

fn abrir_envelope_por_segredo(env: &Envelope, segredo: &[u8], tipo: &str, id: &str, pimenta: Option<&[u8]>) -> Result<Option<Chave>, Erro> {
    let kdf = env.kdf.ok_or_else(|| Erro::Interno("envelope sem parâmetros".into()))?;
    let tranca = derivar(segredo, &env.sal, kdf, pimenta)?;
    Ok(destrancar(env, &tranca, &rotulo(tipo, id)))
}

impl Cofre {
    pub fn new(pasta: impl Into<PathBuf>, guarda: Arc<dyn GuardaDoAparelho>) -> Self {
        Self { pasta: pasta.into(), guarda }
    }

    pub fn caminho_banco(&self) -> PathBuf {
        self.pasta.join("orbita.db")
    }

    fn caminho_cofre(&self) -> PathBuf {
        self.pasta.join("cofre.json")
    }

    pub fn existe(&self) -> bool {
        self.caminho_cofre().exists()
    }

    fn ler(&self) -> Result<ArquivoCofre, Erro> {
        if !self.existe() {
            return Err(Erro::CofreAusente);
        }
        let texto = fs::read_to_string(self.caminho_cofre())?;
        serde_json::from_str(&texto).map_err(|e| Erro::Interno(format!("cofre.json ilegível: {e}")))
    }

    /// Grava num arquivo temporário e depois troca, para nunca deixar o cofre pela metade.
    fn gravar(&self, arquivo: &ArquivoCofre) -> Result<(), Erro> {
        fs::create_dir_all(&self.pasta)?;
        let texto = serde_json::to_string_pretty(arquivo).map_err(|e| Erro::Interno(e.to_string()))?;
        let temporario = self.pasta.join("cofre.json.novo");
        {
            use std::io::Write;
            let mut f = fs::File::create(&temporario)?;
            f.write_all(texto.as_bytes())?;
            f.sync_all()?;
        }
        fs::rename(&temporario, self.caminho_cofre())?;
        Ok(())
    }

    pub fn situacao(&self) -> Result<Situacao, Erro> {
        if !self.existe() {
            return Ok(Situacao { existe: false, modo: None, tentativas_restantes: TENTATIVAS_DE_PIN });
        }
        let c = self.ler()?;
        let erradas = c.aparelho.as_ref().map_or(0, |a| a.tentativas_erradas);
        Ok(Situacao {
            existe: true,
            modo: Some(c.modo),
            tentativas_restantes: TENTATIVAS_DE_PIN.saturating_sub(erradas),
        })
    }

    fn envelope_do_aparelho(&self, chave: &Chave, id: &str, modo: ModoAbrir, pin: Option<&str>) -> Result<Option<EnvelopeAparelho>, Erro> {
        let envelope = match modo {
            ModoAbrir::Senha => {
                self.guarda.apagar(id)?;
                return Ok(None);
            }
            ModoAbrir::Pin => {
                let pin = pin.ok_or(Erro::PinInvalido)?;
                validar_pin(pin)?;
                let do_aparelho = self.guarda.obter_ou_criar(id)?;
                envelope_por_segredo(chave, pin.as_bytes(), "pin", id, Some(do_aparelho.as_ref()))?
            }
            ModoAbrir::Direto => {
                let do_aparelho = self.guarda.obter_ou_criar(id)?;
                trancar(chave, &do_aparelho, &rotulo("direto", id), None, vec![])?
            }
        };
        Ok(Some(EnvelopeAparelho { envelope, tentativas_erradas: 0 }))
    }

    /// Cria o cofre. Devolve a chave dos dados e as 6 palavras de recuperação.
    pub fn criar(&self, senha: &str, modo: ModoAbrir, pin: Option<&str>) -> Result<(Chave, Vec<String>), Erro> {
        if self.existe() {
            return Err(Erro::CofreJaExiste);
        }
        validar_senha(senha)?;
        if modo == ModoAbrir::Pin {
            validar_pin(pin.unwrap_or(""))?;
        }
        // Um banco sem cofre (criação interrompida) é guardado de lado, nunca apagado.
        let banco = self.caminho_banco();
        if banco.exists() {
            let marca = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_secs());
            fs::rename(&banco, self.pasta.join(format!("orbita.db.sem-cofre-{marca}")))?;
        }

        let id = uuid::Uuid::now_v7().to_string();
        let chave = nova_chave();
        let palavras = palavras::sortear();
        let referencias: Vec<&str> = palavras.iter().map(String::as_str).collect();
        let arquivo = ArquivoCofre {
            versao: 1,
            senha: envelope_por_segredo(&chave, &bytes_da_senha(senha), "senha", &id, None)?,
            recuperacao: envelope_por_segredo(&chave, palavras::juntar(&referencias).as_bytes(), "recuperacao", &id, None)?,
            aparelho: self.envelope_do_aparelho(&chave, &id, modo, pin)?,
            modo,
            id,
        };
        self.gravar(&arquivo)?;
        Ok((chave, palavras))
    }

    pub fn abrir_com_senha(&self, senha: &str) -> Result<Chave, Erro> {
        let mut c = self.ler()?;
        let chave = abrir_envelope_por_segredo(&c.senha, &bytes_da_senha(senha), "senha", &c.id, None)?.ok_or(Erro::SenhaErrada)?;
        // Abrir com a senha libera o PIN de novo.
        if let Some(a) = c.aparelho.as_mut() {
            if a.tentativas_erradas > 0 {
                a.tentativas_erradas = 0;
                self.gravar(&c)?;
            }
        }
        Ok(chave)
    }

    pub fn abrir_com_pin(&self, pin: &str) -> Result<Chave, Erro> {
        let mut c = self.ler()?;
        if c.modo != ModoAbrir::Pin {
            return Err(Erro::AparelhoSemChave);
        }
        let id = c.id.clone();
        let aparelho = c.aparelho.as_mut().ok_or(Erro::AparelhoSemChave)?;
        if aparelho.tentativas_erradas >= TENTATIVAS_DE_PIN {
            return Err(Erro::PinBloqueado);
        }
        let do_aparelho = self.guarda.ler(&id)?.ok_or(Erro::AparelhoSemChave)?;
        match abrir_envelope_por_segredo(&aparelho.envelope, pin.as_bytes(), "pin", &id, Some(do_aparelho.as_ref()))? {
            Some(chave) => {
                if aparelho.tentativas_erradas > 0 {
                    aparelho.tentativas_erradas = 0;
                    self.gravar(&c)?;
                }
                Ok(chave)
            }
            None => {
                aparelho.tentativas_erradas += 1;
                let restantes = TENTATIVAS_DE_PIN.saturating_sub(aparelho.tentativas_erradas);
                self.gravar(&c)?;
                Err(if restantes == 0 { Erro::PinBloqueado } else { Erro::PinErrado { tentativas_restantes: restantes } })
            }
        }
    }

    pub fn abrir_direto(&self) -> Result<Chave, Erro> {
        let c = self.ler()?;
        if c.modo != ModoAbrir::Direto {
            return Err(Erro::AparelhoSemChave);
        }
        let aparelho = c.aparelho.as_ref().ok_or(Erro::AparelhoSemChave)?;
        let do_aparelho = self.guarda.ler(&c.id)?.ok_or(Erro::AparelhoSemChave)?;
        destrancar(&aparelho.envelope, &do_aparelho, &rotulo("direto", &c.id)).ok_or(Erro::AparelhoSemChave)
    }

    pub fn abrir_com_palavras(&self, texto: &str) -> Result<Chave, Erro> {
        let lidas = palavras::ler(texto).map_err(|posicoes| Erro::PalavrasErradas { posicoes })?;
        let c = self.ler()?;
        abrir_envelope_por_segredo(&c.recuperacao, palavras::juntar(&lidas).as_bytes(), "recuperacao", &c.id, None)?
            .ok_or(Erro::ChaveDeRecuperacaoErrada)
    }

    /// Troca a senha. Quem chama já abriu o cofre (com a senha atual ou com a chave de recuperação).
    pub fn trocar_senha(&self, chave: &Chave, nova: &str) -> Result<(), Erro> {
        validar_senha(nova)?;
        let mut c = self.ler()?;
        c.senha = envelope_por_segredo(chave, &bytes_da_senha(nova), "senha", &c.id, None)?;
        if let Some(a) = c.aparelho.as_mut() {
            a.tentativas_erradas = 0;
        }
        self.gravar(&c)
    }

    /// Muda o jeito de abrir neste computador.
    pub fn mudar_modo(&self, chave: &Chave, modo: ModoAbrir, pin: Option<&str>) -> Result<(), Erro> {
        let mut c = self.ler()?;
        c.aparelho = self.envelope_do_aparelho(chave, &c.id, modo, pin)?;
        c.modo = modo;
        self.gravar(&c)
    }
}

#[cfg(test)]
mod testes {
    use super::aparelho::GuardaEmMemoria;
    use super::*;

    const SENHA: &str = "gato azul na janela";

    fn novo() -> (tempfile::TempDir, Cofre, Arc<GuardaEmMemoria>) {
        let pasta = tempfile::tempdir().unwrap();
        let guarda = Arc::new(GuardaEmMemoria::default());
        let cofre = Cofre::new(pasta.path(), guarda.clone());
        (pasta, cofre, guarda)
    }

    #[test]
    fn cria_e_abre_pela_senha_pin_e_palavras() {
        let (_p, cofre, _) = novo();
        let (chave, palavras) = cofre.criar(SENHA, ModoAbrir::Pin, Some("2468")).unwrap();
        assert_eq!(palavras.len(), 6);
        assert_eq!(*cofre.abrir_com_senha(SENHA).unwrap(), *chave);
        assert_eq!(*cofre.abrir_com_pin("2468").unwrap(), *chave);
        assert_eq!(*cofre.abrir_com_palavras(&palavras.join(" ").to_uppercase()).unwrap(), *chave);
    }

    #[test]
    fn senha_com_acento_composto_de_outro_jeito_abre_igual() {
        let (_p, cofre, _) = novo();
        let (chave, _) = cofre.criar("caf\u{e9} com p\u{e3}o quente", ModoAbrir::Senha, None).unwrap();
        // "é" e "ã" escritos como letra + acento separado.
        assert_eq!(*cofre.abrir_com_senha("cafe\u{301} com pa\u{303}o quente").unwrap(), *chave);
    }

    #[test]
    fn recusa_senha_curta_pin_invalido_e_segundo_cofre() {
        let (_p, cofre, _) = novo();
        assert!(matches!(cofre.criar("curta", ModoAbrir::Senha, None), Err(Erro::SenhaCurta)));
        assert!(matches!(cofre.criar(SENHA, ModoAbrir::Pin, Some("12a4")), Err(Erro::PinInvalido)));
        assert!(matches!(cofre.criar(SENHA, ModoAbrir::Pin, Some("123")), Err(Erro::PinInvalido)));
        cofre.criar(SENHA, ModoAbrir::Senha, None).unwrap();
        assert!(matches!(cofre.criar(SENHA, ModoAbrir::Senha, None), Err(Erro::CofreJaExiste)));
    }

    #[test]
    fn senha_errada_nao_abre() {
        let (_p, cofre, _) = novo();
        cofre.criar(SENHA, ModoAbrir::Senha, None).unwrap();
        assert!(matches!(cofre.abrir_com_senha("gato azul na janelA"), Err(Erro::SenhaErrada)));
    }

    #[test]
    fn pin_bloqueia_depois_de_5_erros_e_a_senha_libera() {
        let (_p, cofre, _) = novo();
        cofre.criar(SENHA, ModoAbrir::Pin, Some("2468")).unwrap();
        for restantes in (1..5).rev() {
            match cofre.abrir_com_pin("0000") {
                Err(Erro::PinErrado { tentativas_restantes }) => assert_eq!(tentativas_restantes, restantes),
                outro => panic!("esperava PIN errado, veio {outro:?}"),
            }
        }
        assert!(matches!(cofre.abrir_com_pin("0000"), Err(Erro::PinBloqueado)));
        // Nem o PIN certo abre enquanto estiver bloqueado.
        assert!(matches!(cofre.abrir_com_pin("2468"), Err(Erro::PinBloqueado)));
        assert_eq!(cofre.situacao().unwrap().tentativas_restantes, 0);
        cofre.abrir_com_senha(SENHA).unwrap();
        assert!(cofre.abrir_com_pin("2468").is_ok());
    }

    #[test]
    fn pin_nao_serve_sem_a_chave_do_aparelho() {
        let (pasta, cofre, _) = novo();
        cofre.criar(SENHA, ModoAbrir::Pin, Some("2468")).unwrap();
        // Mesmo arquivo, outro computador (guarda vazia).
        let outro = Cofre::new(pasta.path(), Arc::new(GuardaEmMemoria::default()));
        assert!(matches!(outro.abrir_com_pin("2468"), Err(Erro::AparelhoSemChave)));
        assert!(outro.abrir_com_senha(SENHA).is_ok());
    }

    #[test]
    fn abrir_direto_e_voltar_para_senha_apaga_a_chave_do_aparelho() {
        let (_p, cofre, guarda) = novo();
        let (chave, _) = cofre.criar(SENHA, ModoAbrir::Direto, None).unwrap();
        assert_eq!(*cofre.abrir_direto().unwrap(), *chave);
        cofre.mudar_modo(&chave, ModoAbrir::Senha, None).unwrap();
        assert!(cofre.abrir_direto().is_err());
        assert!(guarda.0.lock().unwrap().is_empty());
    }

    #[test]
    fn recuperar_e_trocar_senha() {
        let (_p, cofre, _) = novo();
        let (chave, palavras) = cofre.criar(SENHA, ModoAbrir::Pin, Some("2468")).unwrap();
        let aberta = cofre.abrir_com_palavras(&palavras.join(" ")).unwrap();
        cofre.trocar_senha(&aberta, "nova frase bem comprida").unwrap();
        assert!(cofre.abrir_com_senha(SENHA).is_err());
        assert_eq!(*cofre.abrir_com_senha("nova frase bem comprida").unwrap(), *chave);
    }

    #[test]
    fn palavras_erradas_apontam_a_posicao() {
        let (_p, cofre, _) = novo();
        let (_, palavras) = cofre.criar(SENHA, ModoAbrir::Senha, None).unwrap();
        let mut trocadas = palavras.clone();
        trocadas[2] = "xyzw".into();
        match cofre.abrir_com_palavras(&trocadas.join(" ")) {
            Err(Erro::PalavrasErradas { posicoes }) => assert_eq!(posicoes, vec![3]),
            outro => panic!("{outro:?}"),
        }
    }

    #[test]
    fn o_cofre_nao_guarda_nada_aberto() {
        let (pasta, cofre, _) = novo();
        let (chave, palavras) = cofre.criar(SENHA, ModoAbrir::Pin, Some("2468")).unwrap();
        let texto = fs::read_to_string(pasta.path().join("cofre.json")).unwrap();
        assert!(!texto.contains(&hex::encode(chave.as_ref())));
        assert!(!texto.contains(SENHA));
        assert!(!texto.contains(&palavras.join(" ")));
    }
}
