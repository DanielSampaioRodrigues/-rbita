use serde::Serialize;

/// Erros que chegam à interface, com um código para a tela decidir o que mostrar.
#[derive(Debug, thiserror::Error)]
pub enum Erro {
    #[error("A senha não confere.")]
    SenhaErrada,
    #[error("O PIN não confere.")]
    PinErrado { tentativas_restantes: u32 },
    #[error("Muitas tentativas com o PIN. Use a chave de recuperação (ou a senha, se você criou uma) para abrir.")]
    PinBloqueado,
    #[error("Algumas palavras da chave de recuperação não foram reconhecidas.")]
    PalavrasErradas { posicoes: Vec<usize> },
    #[error("A chave de recuperação não abre estes dados.")]
    ChaveDeRecuperacaoErrada,
    #[error("A senha precisa ter pelo menos 12 caracteres.")]
    SenhaCurta,
    #[error("Estes dados não têm senha. Use as 6 palavras da chave de recuperação.")]
    SemSenha,
    #[error("O PIN precisa ter de 4 a 8 números.")]
    PinInvalido,
    #[error("Já existem dados protegidos neste computador.")]
    CofreJaExiste,
    #[error("Ainda não há dados protegidos neste computador.")]
    CofreAusente,
    #[error("O Órbita está bloqueado.")]
    Bloqueado,
    #[error("Este computador não guardou a chave para abrir sem senha. Use a chave de recuperação (ou a senha, se você criou uma).")]
    AparelhoSemChave,
    #[error("O Windows Hello foi cancelado.")]
    HelloCancelado,
    #[error("O Windows Hello não está disponível neste computador. Use a chave de recuperação (ou a senha, se você criou uma).")]
    HelloIndisponivel,
    #[error("Já existem {limite} projetos ativos, o limite que você definiu.")]
    LimiteDeProjetos { limite: u32 },
    #[error("Escreva alguma coisa antes de salvar.")]
    TextoVazio,
    #[error("Não encontrei esse item. Talvez tenha sido excluído.")]
    NaoEncontrado,
    #[error("Não deu para usar este backup: {0}.")]
    BackupInvalido(String),
    #[error("Não foi possível ler ou gravar um arquivo: {0}")]
    Arquivo(String),
    /// Falha do ditado (microfone, modelo de voz), já explicada.
    #[error("{0}")]
    Ditado(String),
    /// Falha da IA, já explicada em linguagem simples.
    #[error("{mensagem}")]
    Ia { motivo: &'static str, mensagem: String },
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
            Erro::SemSenha => "sem_senha",
            Erro::PinInvalido => "pin_invalido",
            Erro::CofreJaExiste => "cofre_existe",
            Erro::CofreAusente => "cofre_ausente",
            Erro::Bloqueado => "bloqueado",
            Erro::AparelhoSemChave => "aparelho_sem_chave",
            Erro::HelloCancelado => "hello_cancelado",
            Erro::HelloIndisponivel => "hello_indisponivel",
            Erro::BackupInvalido(_) => "backup_invalido",
            Erro::LimiteDeProjetos { .. } => "limite_projetos",
            Erro::TextoVazio => "texto_vazio",
            Erro::NaoEncontrado => "nao_encontrado",
            Erro::Arquivo(_) => "arquivo",
            Erro::Ia { .. } => "ia",
            Erro::Ditado(_) => "ditado",
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
            Erro::LimiteDeProjetos { limite } => st.serialize_field("limite", limite)?,
            Erro::Ia { motivo, .. } => st.serialize_field("motivo", motivo)?,
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
