// Fila por nome: tarefas com o mesmo nome rodam uma de cada vez, na ordem em que chegaram.
// Serve para "ler, mudar e gravar" um valor do cofre sem duas mudanças se atropelarem.
const filas = new Map<string, Promise<unknown>>();

export function emFila<T>(nome: string, tarefa: () => Promise<T>): Promise<T> {
  const antes = filas.get(nome) ?? Promise.resolve();
  const agora = antes.catch(() => undefined).then(tarefa);
  filas.set(nome, agora.catch(() => undefined));
  return agora;
}
