import { textos } from "./textos/pt-BR";

const t = textos.boasVindas;

export function App() {
  return (
    <main className="boas-vindas">
      <svg className="marca" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.45" />
        <circle cx="32" cy="32" r="9" fill="currentColor" />
        <circle cx="51" cy="21" r="4.5" fill="var(--cor-destaque)" />
      </svg>
      <h1>{t.titulo}</h1>
      <p className="subtitulo">{t.subtitulo}</p>
      <p>{t.mensagem}</p>
      <p className="proximo">{t.proximo}</p>
      <p className="versao">{t.versao(__VERSAO__)}</p>
    </main>
  );
}
