// "Abrir isto quando chegar lá": uma tela pede para abrir um caderno ou um livro de
// outra seção (por exemplo, a matéria nos Estudos), e a estante abre ao carregar.
type Tipo = "caderno" | "livro";
let pendente: { tipo: Tipo; id: string } | null = null;

export function pedirAbrir(tipo: Tipo, id: string): void {
  pendente = { tipo, id };
}

/** O id pedido para este tipo (uma vez só), ou null. */
export function pegarPedido(tipo: Tipo): string | null {
  if (pendente?.tipo !== tipo) return null;
  const id = pendente.id;
  pendente = null;
  return id;
}
