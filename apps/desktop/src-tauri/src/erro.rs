use serde::Serialize;

/// Erros que chegam à interface, com um código para a tela decidir o que mostrar.
#[derive(Debug, thiserror::Error)]
pub enum Erro {
    #[error("A senha não confere.")]
    SenhaErrada,
    #[error("O PIN não confere.")]
    PinErrado { tentativas_restantes: u32 },
    #[error("Muitas tentativas com o PIN. Use a senha para abrir.")]
    PinBloqueado,
    #[error("Algumas palavras da chave de recuperação não foram reconhecidas.")]
    PalavrasErradas { posicoes: Vec<usize> },
    #[error("A chave de recuperação não abre estes dados.")]
    ChaveDeRecuperacaoErrada,
    #[error("A senha precisa ter pelo menos 12 caracteres.")]
    SenhaCurta,
    #[error("O PIN precisa ter de 4 a 8 números.")]
    PinInvalido,
    #[error("Já existem dados protegidos neste computador.")]
    CofreJaExiste,
    #[error("Ainda não há dados protegidos neste computador.")]
    CofreAusente,
    #[error("O Órbita está bloqueado.")]
    Bloqueado,
    #[error("Este computador não guardou a chave para abrir sem senha. Use a senha.")]
    AparelhoSemChave,
    #[error("O Windows Hello foi cancelado.")]
    HelloCancelado,
    #[error("O Windows Hello não está disponível neste computador. Use a senha.")]
    HelloIndisponivel,
    #[error("Não foi possível ler ou gravar um arquivo: {0}")]
    Arquivo(String),
    #[error("Erro interno: {0}")]
    Interno(String),
}

impl Erro {
    fn codigo(&self) -> &'static str {
        match self {
            Erro::SenhaErrada => "senha_errada",
            Erro::PinErrado { .. } => "pin_errado",
            Erro::PinBloqueado => "pin_bloqueado",
            Erro::PalavrasErradas { .. } => "palavras_erradas",
            Erro::ChaveDeRecuperacaoErrada => "chave_errada",
            Erro::SenhaCurta => "senha_curta",
            Erro::PinInvalido => "pin_invalido",
            Erro::CofreJaExiste => "cofre_existe",
            Erro::CofreAusente => "cofre_ausente",
            Erro::Bloqueado => "bloqueado",
            Erro::AparelhoSemChave => "aparelho_sem_chave",
            Erro::HelloCancelado => "hello_cancelado",
            Erro::HelloIndisponivel => "hello_indisponivel",
            Erro::Arquivo(_) => "arquivo",
            Erro::Interno(_) => "interno",
        }
    }
}

impl Serialize for Erro {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut st = s.serialize_struct("Erro", 3)?;
        st.serialize_field("codigo", self.codigo())?;
        st.serialize_field("mensagem", &self.to_string())?;
        match self {
            Erro::PinErrado { tentativas_restantes } => st.serialize_field("tentativasRestantes", tentativas_restantes)?,
            Erro::PalavrasErradas { posicoes } => st.serialize_field("posicoes", posicoes)?,
            _ => st.skip_field("extra")?,
        }
        st.end()
    }
}

impl From<rusqlite::Error> for Erro {
    fn from(e: rusqlite::Error) -> Self {
        Erro::Interno(format!("banco de dados: {e}"))
    }
}

impl From<std::io::Error> for Erro {
    fn from(e: std::io::Error) -> Self {
        Erro::Arquivo(e.to_string())
    }
}
