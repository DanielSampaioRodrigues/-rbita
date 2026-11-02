//! Cofre: guarda a chave dos dados trancada de três jeitos.
//!
//! - pela **senha** (opcional desde a versão 0.21.0);
//! - pela **chave de recuperação** de 6 palavras (sempre existe; é a tranca forte);
//! - pelo **aparelho** (opcional): PIN, ou abrir direto, usando um segredo
//!   guardado pelo sistema. Só funciona neste computador.
//!
//! A chave dos dados nunca é gravada aberta. O arquivo `cofre.json` só tem envelopes.

pub mod aparelho;
pub mod cripto;
pub mod palavras;
mod portateis;

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use aparelho::GuardaDoAparelho;
use cripto::{destrancar, nova_chave, trancar, Chave, Envelope};
pub use portateis::EnvelopesPortateis;
use portateis::{abrir_envelope_por_segredo, bytes_da_senha, envelope_por_segredo, rotulo};

use crate::erro::Erro;

pub const TENTATIVAS_DE_PIN: u32 = 5;
pub const MINIMO_SENHA: usize = 12;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModoAbrir {
    Pin,
    Senha,
    Direto,
    Hello,
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
    /// Sem senha, quem vale em qualquer computador são as 6 palavras.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    senha: Option<Envelope>,
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
    /// Se há senha. Sem senha, onde antes se pedia a senha valem as 6 palavras.
    pub tem_senha: bool,
}

pub struct Cofre {
    pasta: PathBuf,
    guarda: Arc<dyn GuardaDoAparelho>,
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

impl Cofre {
    pub fn new(pasta: impl Into<PathBuf>, guarda: Arc<dyn GuardaDoAparelho>) -> Self {
        Self { pasta: pasta.into(), guarda }
    }

    pub fn pasta(&self) -> &std::path::Path {
        &self.pasta
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
            return Ok(Situacao { existe: false, modo: None, tentativas_restantes: TENTATIVAS_DE_PIN, tem_senha: false });
        }
        let c = self.ler()?;
        let erradas = c.aparelho.as_ref().map_or(0, |a| a.tentativas_erradas);
        Ok(Situacao {
            existe: true,
            modo: Some(c.modo),
            tentativas_restantes: TENTATIVAS_DE_PIN.saturating_sub(erradas),
            tem_senha: c.senha.is_some(),
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
            ModoAbrir::Direto | ModoAbrir::Hello => {
                let do_aparelho = self.guarda.obter_ou_criar(id)?;
                trancar(chave, &do_aparelho, &rotulo(Self::tipo_aparelho(modo), id), None, vec![])?
            }
        };
        Ok(Some(EnvelopeAparelho { envelope, tentativas_erradas: 0 }))
    }

    /// Cria o cofre. Devolve a chave dos dados e as 6 palavras de recuperação.
    /// A senha é opcional; sem ela, o modo "senha" não existe.
    pub fn criar(&self, senha: Option<&str>, modo: ModoAbrir, pin: Option<&str>) -> Result<(Chave, Vec<String>), Erro> {
        if self.existe() {
            return Err(Erro::CofreJaExiste);
        }
        match senha {
            Some(s) => validar_senha(s)?,
            None if modo == ModoAbrir::Senha => return Err(Erro::SemSenha),
            None => {}
        }
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
            senha: senha.map(|s| envelope_por_segredo(&chave, &bytes_da_senha(s), "senha", &id, None)).transpose()?,
            recuperacao: envelope_por_segredo(&chave, palavras::juntar(&referencias).as_bytes(), "recuperacao", &id, None)?,
            aparelho: self.envelope_do_aparelho(&chave, &id, modo, pin)?,
            modo,
            id,
        };
        self.gravar(&arquivo)?;
        Ok((chave, palavras))
    }

    pub fn abrir_com_senha(&self, senha: &str) -> Result<Chave, Erro> {
        let c = self.ler()?;
        let env = c.senha.as_ref().ok_or(Erro::SemSenha)?;
        let chave = abrir_envelope_por_segredo(env, &bytes_da_senha(senha), "senha", &c.id, None)?.ok_or(Erro::SenhaErrada)?;
        self.liberar_pin(c)?;
        Ok(chave)
    }

    /// Abrir com a senha ou com as palavras libera o PIN de novo.
    fn liberar_pin(&self, mut c: ArquivoCofre) -> Result<(), Erro> {
        if let Some(a) = c.aparelho.as_mut() {
            if a.tentativas_erradas > 0 {
                a.tentativas_erradas = 0;
                self.gravar(&c)?;
            }
        }
        Ok(())
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

    fn tipo_aparelho(modo: ModoAbrir) -> &'static str {
        if modo == ModoAbrir::Hello { "hello" } else { "direto" }
    }

    /// Abre com o segredo do aparelho. No modo Windows Hello, quem chama já
    /// confirmou a pessoa com o Windows antes.
    fn abrir_pelo_aparelho(&self, esperado: ModoAbrir) -> Result<Chave, Erro> {
        let c = self.ler()?;
        if c.modo != esperado {
            return Err(Erro::AparelhoSemChave);
        }
        let aparelho = c.aparelho.as_ref().ok_or(Erro::AparelhoSemChave)?;
        let do_aparelho = self.guarda.ler(&c.id)?.ok_or(Erro::AparelhoSemChave)?;
        destrancar(&aparelho.envelope, &do_aparelho, &rotulo(Self::tipo_aparelho(esperado), &c.id)).ok_or(Erro::AparelhoSemChave)
    }

    pub fn abrir_direto(&self) -> Result<Chave, Erro> {
        self.abrir_pelo_aparelho(ModoAbrir::Direto)
    }

    pub fn abrir_depois_do_hello(&self) -> Result<Chave, Erro> {
        self.abrir_pelo_aparelho(ModoAbrir::Hello)
    }

    pub fn abrir_com_palavras(&self, texto: &str) -> Result<Chave, Erro> {
        let lidas = palavras::ler(texto).map_err(|posicoes| Erro::PalavrasErradas { posicoes })?;
        let c = self.ler()?;
        let chave = abrir_envelope_por_segredo(&c.recuperacao, palavras::juntar(&lidas).as_bytes(), "recuperacao", &c.id, None)?
            .ok_or(Erro::ChaveDeRecuperacaoErrada)?;
        self.liberar_pin(c)?;
        Ok(chave)
    }

    /// Cria ou troca a senha. Quem chama já abriu o cofre (com a senha atual ou com a chave de recuperação).
    pub fn trocar_senha(&self, chave: &Chave, nova: &str) -> Result<(), Erro> {
        validar_senha(nova)?;
        let mut c = self.ler()?;
        c.senha = Some(envelope_por_segredo(chave, &bytes_da_senha(nova), "senha", &c.id, None)?);
        if let Some(a) = c.aparelho.as_mut() {
            a.tentativas_erradas = 0;
        }
        self.gravar(&c)
    }

    /// Envelopes que valem em qualquer computador (senha e recuperação), para o backup.
    pub fn envelopes_portateis(&self) -> Result<EnvelopesPortateis, Erro> {
        let c = self.ler()?;
        Ok(EnvelopesPortateis { id: c.id, senha: c.senha, recuperacao: c.recuperacao })
    }

    /// Instala o cofre de um backup restaurado. Se a pessoa escolheu como abrir, vale a escolha.
    /// Senão, Windows Hello e abrir direto continuam como estavam; o PIN precisa ser
    /// criado de novo (volta para senha). Backup sem senha exige a escolha.
    pub fn instalar_restauracao(
        &self,
        portateis: EnvelopesPortateis,
        chave: &Chave,
        modo_anterior: Option<ModoAbrir>,
        escolha: Option<(ModoAbrir, Option<&str>)>,
    ) -> Result<ModoAbrir, Erro> {
        let (modo, pin) = match (escolha, modo_anterior) {
            (Some(e), _) => e,
            (None, Some(m @ (ModoAbrir::Hello | ModoAbrir::Direto))) => (m, None),
            (None, _) if portateis.senha.is_some() => (ModoAbrir::Senha, None),
            (None, _) => return Err(Erro::SemSenha),
        };
        if modo == ModoAbrir::Senha && portateis.senha.is_none() {
            return Err(Erro::SemSenha);
        }
        let arquivo = ArquivoCofre {
            versao: 1,
            aparelho: self.envelope_do_aparelho(chave, &portateis.id, modo, pin)?,
            modo,
            senha: portateis.senha,
            recuperacao: portateis.recuperacao,
            id: portateis.id,
        };
        self.gravar(&arquivo)?;
        Ok(modo)
    }

    /// Muda o jeito de abrir neste computador.
    pub fn mudar_modo(&self, chave: &Chave, modo: ModoAbrir, pin: Option<&str>) -> Result<(), Erro> {
        let mut c = self.ler()?;
        if modo == ModoAbrir::Senha && c.senha.is_none() {
            return Err(Erro::SemSenha);
        }
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
        let (chave, palavras) = cofre.criar(Some(SENHA), ModoAbrir::Pin, Some("2468")).unwrap();
        assert_eq!(palavras.len(), 6);
        assert_eq!(*cofre.abrir_com_senha(SENHA).unwrap(), *chave);
        assert_eq!(*cofre.abrir_com_pin("2468").unwrap(), *chave);
        assert_eq!(*cofre.abrir_com_palavras(&palavras.join(" ").to_uppercase()).unwrap(), *chave);
    }

    #[test]
    fn senha_com_acento_composto_de_outro_jeito_abre_igual() {
        let (_p, cofre, _) = novo();
        let (chave, _) = cofre.criar(Some("caf\u{e9} com p\u{e3}o quente"), ModoAbrir::Senha, None).unwrap();
        // "é" e "ã" escritos como letra + acento separado.
        assert_eq!(*cofre.abrir_com_senha("cafe\u{301} com pa\u{303}o quente").unwrap(), *chave);
    }

    #[test]
    fn recusa_senha_curta_pin_invalido_e_segundo_cofre() {
        let (_p, cofre, _) = novo();
        assert!(matches!(cofre.criar(Some("curta"), ModoAbrir::Senha, None), Err(Erro::SenhaCurta)));
        assert!(matches!(cofre.criar(Some(SENHA), ModoAbrir::Pin, Some("12a4")), Err(Erro::PinInvalido)));
        assert!(matches!(cofre.criar(Some(SENHA), ModoAbrir::Pin, Some("123")), Err(Erro::PinInvalido)));
        cofre.criar(Some(SENHA), ModoAbrir::Senha, None).unwrap();
        assert!(matches!(cofre.criar(Some(SENHA), ModoAbrir::Senha, None), Err(Erro::CofreJaExiste)));
    }

    #[test]
    fn senha_errada_nao_abre() {
        let (_p, cofre, _) = novo();
        cofre.criar(Some(SENHA), ModoAbrir::Senha, None).unwrap();
        assert!(matches!(cofre.abrir_com_senha("gato azul na janelA"), Err(Erro::SenhaErrada)));
    }

    #[test]
    fn pin_bloqueia_depois_de_5_erros_e_a_senha_libera() {
        let (_p, cofre, _) = novo();
        cofre.criar(Some(SENHA), ModoAbrir::Pin, Some("2468")).unwrap();
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
        cofre.criar(Some(SENHA), ModoAbrir::Pin, Some("2468")).unwrap();
        // Mesmo arquivo, outro computador (guarda vazia).
        let outro = Cofre::new(pasta.path(), Arc::new(GuardaEmMemoria::default()));
        assert!(matches!(outro.abrir_com_pin("2468"), Err(Erro::AparelhoSemChave)));
        assert!(outro.abrir_com_senha(SENHA).is_ok());
    }

    #[test]
    fn abrir_direto_e_voltar_para_senha_apaga_a_chave_do_aparelho() {
        let (_p, cofre, guarda) = novo();
        let (chave, _) = cofre.criar(Some(SENHA), ModoAbrir::Direto, None).unwrap();
        assert_eq!(*cofre.abrir_direto().unwrap(), *chave);
        cofre.mudar_modo(&chave, ModoAbrir::Senha, None).unwrap();
        assert!(cofre.abrir_direto().is_err());
        assert!(guarda.0.lock().unwrap().is_empty());
    }

    #[test]
    fn hello_usa_a_chave_do_aparelho_e_nao_abre_como_direto() {
        let (pasta, cofre, _) = novo();
        let (chave, _) = cofre.criar(Some(SENHA), ModoAbrir::Hello, None).unwrap();
        assert_eq!(*cofre.abrir_depois_do_hello().unwrap(), *chave);
        assert!(cofre.abrir_direto().is_err());
        let outro = Cofre::new(pasta.path(), Arc::new(GuardaEmMemoria::default()));
        assert!(matches!(outro.abrir_depois_do_hello(), Err(Erro::AparelhoSemChave)));
    }

    #[test]
    fn recuperar_e_trocar_senha() {
        let (_p, cofre, _) = novo();
        let (chave, palavras) = cofre.criar(Some(SENHA), ModoAbrir::Pin, Some("2468")).unwrap();
        let aberta = cofre.abrir_com_palavras(&palavras.join(" ")).unwrap();
        cofre.trocar_senha(&aberta, "nova frase bem comprida").unwrap();
        assert!(cofre.abrir_com_senha(SENHA).is_err());
        assert_eq!(*cofre.abrir_com_senha("nova frase bem comprida").unwrap(), *chave);
    }

    #[test]
    fn palavras_erradas_apontam_a_posicao() {
        let (_p, cofre, _) = novo();
        let (_, palavras) = cofre.criar(Some(SENHA), ModoAbrir::Senha, None).unwrap();
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
        let (chave, palavras) = cofre.criar(Some(SENHA), ModoAbrir::Pin, Some("2468")).unwrap();
        let texto = fs::read_to_string(pasta.path().join("cofre.json")).unwrap();
        assert!(!texto.contains(&hex::encode(chave.as_ref())));
        assert!(!texto.contains(SENHA));
        assert!(!texto.contains(&palavras.join(" ")));
    }

    #[test]
    fn sem_senha_as_palavras_fazem_o_papel_da_senha() {
        let (_p, cofre, _) = novo();
        assert!(matches!(cofre.criar(None, ModoAbrir::Senha, None), Err(Erro::SemSenha)));
        let (chave, palavras) = cofre.criar(None, ModoAbrir::Pin, Some("2468")).unwrap();
        assert!(!cofre.situacao().unwrap().tem_senha);
        assert!(matches!(cofre.abrir_com_senha(SENHA), Err(Erro::SemSenha)));
        for _ in 0..5 {
            let _ = cofre.abrir_com_pin("0000");
        }
        assert!(matches!(cofre.abrir_com_pin("2468"), Err(Erro::PinBloqueado)));
        // As palavras abrem e liberam o PIN.
        assert_eq!(*cofre.abrir_com_palavras(&palavras.join(" ")).unwrap(), *chave);
        assert!(cofre.abrir_com_pin("2468").is_ok());
        assert!(matches!(cofre.mudar_modo(&chave, ModoAbrir::Senha, None), Err(Erro::SemSenha)));
        // Criar uma senha depois, se a pessoa quiser.
        cofre.trocar_senha(&chave, SENHA).unwrap();
        assert!(cofre.situacao().unwrap().tem_senha);
        assert_eq!(*cofre.abrir_com_senha(SENHA).unwrap(), *chave);
    }

    #[test]
    fn cofre_antigo_com_senha_continua_lendo() {
        let (pasta, cofre, _) = novo();
        let (chave, _) = cofre.criar(Some(SENHA), ModoAbrir::Senha, None).unwrap();
        let texto = fs::read_to_string(pasta.path().join("cofre.json")).unwrap();
        assert!(texto.contains("\"senha\""));
        assert_eq!(*cofre.abrir_com_senha(SENHA).unwrap(), *chave);
    }
}
