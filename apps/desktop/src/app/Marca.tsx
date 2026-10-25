/** Símbolo do Órbita: um centro, uma órbita e um ponto em destaque. */
export function Marca({ tamanho = "1.6em" }: { tamanho?: string }) {
  return (
    <svg className="marca" viewBox="0 0 64 64" width={tamanho} height={tamanho} aria-hidden="true">
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.45" />
      <circle cx="32" cy="32" r="9" fill="currentColor" />
      <circle cx="51" cy="21" r="5" fill="var(--cor-destaque)" />
    </svg>
  );
}
