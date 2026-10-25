//! Windows Hello: digital, rosto ou PIN do Windows.
//!
//! O Windows só confirma que é a pessoa dona do usuário; a chave dos dados
//! continua presa a este computador, como no PIN e no abrir direto.

#[derive(Debug, PartialEq)]
#[cfg_attr(not(windows), allow(dead_code))]
pub enum Resultado {
    Confirmado,
    Cancelado,
    Indisponivel,
}

#[cfg(windows)]
pub fn disponivel() -> bool {
    use windows::Security::Credentials::UI::{UserConsentVerifier, UserConsentVerifierAvailability};
    UserConsentVerifier::CheckAvailabilityAsync()
        .and_then(|op| op.join())
        .map(|d| d == UserConsentVerifierAvailability::Available)
        .unwrap_or(false)
}

/// Pede a confirmação presa à janela do Órbita, para o pedido não abrir atrás dela.
/// Bloqueia até a pessoa responder; chame fora da linha principal.
#[cfg(windows)]
pub fn confirmar(janela: *mut core::ffi::c_void, mensagem: &str) -> Resultado {
    use windows::core::{factory, HSTRING};
    use windows::Security::Credentials::UI::{UserConsentVerificationResult as R, UserConsentVerifier};
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::WinRT::IUserConsentVerifierInterop;
    use windows_future::IAsyncOperation;

    let resposta = (|| {
        let interop = factory::<UserConsentVerifier, IUserConsentVerifierInterop>()?;
        let op: IAsyncOperation<R> = unsafe { interop.RequestVerificationForWindowAsync(HWND(janela), &HSTRING::from(mensagem))? };
        op.join()
    })();
    match resposta {
        Ok(R::Verified) => Resultado::Confirmado,
        Ok(R::Canceled) | Ok(R::RetriesExhausted) => Resultado::Cancelado,
        Ok(_) | Err(_) => Resultado::Indisponivel,
    }
}

#[cfg(not(windows))]
pub fn disponivel() -> bool {
    false
}

#[cfg(not(windows))]
pub fn confirmar(_janela: *mut core::ffi::c_void, _mensagem: &str) -> Resultado {
    Resultado::Indisponivel
}
