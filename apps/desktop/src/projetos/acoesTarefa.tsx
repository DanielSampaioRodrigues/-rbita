import { MoreHorizontal } from "lucide-react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { api, type EstadoTarefa, type Peso, type Tarefa } from "../api";
import { textos } from "../textos/pt-BR";

const t = textos.projeto;
export const ESTADOS: EstadoTarefa[] = ["a_fazer", "fazendo", "feita"];

/** Menu de cada tarefa: mudar de coluna, subir, descer e excluir. Tudo pelo teclado. */
export function MenuTarefa({
  tarefa,
  irmas,
  executar,
  aoMover,
  aoDefinirPrazo,
}: {
  tarefa: Tarefa;
  irmas: Tarefa[];
  executar: (acao: () => Promise<unknown>) => void;
  aoMover?: (texto: string) => void;
  /** Abre a janela de prazo (fica fora do menu, para o menu poder fechar). */
  aoDefinirPrazo?: (tarefa: Tarefa) => void;
}) {
  const pos = irmas.findIndex((i) => i.id === tarefa.id);
  const acoes: { id: string; nome: string; fazer: () => Promise<unknown> }[] = [
    ...ESTADOS.filter((e) => e !== tarefa.estado).map((e) => ({
      id: `estado-${e}`,
      nome: t.moverPara(t.colunas[e]),
      fazer: async () => (await api.mudarEstadoTarefa(tarefa.id, e), aoMover?.(t.movida(tarefa.titulo, t.colunas[e]))),
    })),
    ...(pos > 0 ? [{ id: "subir", nome: t.subir, fazer: () => api.moverTarefa(tarefa.id, irmas[pos - 1].id) }] : []),
    ...(pos >= 0 && pos < irmas.length - 1
      ? [{ id: "descer", nome: t.descer, fazer: () => api.moverTarefa(tarefa.id, irmas[pos + 2]?.id ?? null) }]
      : []),
    ...(["leve", "media", "pesada"] as Peso[])
      .filter((p) => p !== tarefa.peso)
      .map((p) => ({ id: `peso-${p}`, nome: textos.energia.marcarPeso(textos.energia.pesos[p]), fazer: () => api.definirPesoTarefa(tarefa.id, p) })),
    ...(tarefa.peso ? [{ id: "sem-peso", nome: textos.energia.tirarPeso, fazer: () => api.definirPesoTarefa(tarefa.id, null) }] : []),
    ...(aoDefinirPrazo ? [{ id: "prazo", nome: t.definirPrazo, fazer: async () => aoDefinirPrazo(tarefa) }] : []),
    { id: "excluir", nome: t.excluirTarefa, fazer: () => api.excluirItem(tarefa.id) },
  ];
  return (
    <MenuTrigger>
      <Button className="botao-icone" aria-label={t.acoes(tarefa.titulo)}>
        <MoreHorizontal aria-hidden="true" size="1.1em" />
      </Button>
      <Popover className="menu-popover" placement="bottom end">
        <Menu className="menu" onAction={(id) => executar(acoes.find((a) => a.id === id)!.fazer)}>
          {acoes.map((a) => (
            <MenuItem key={a.id} id={a.id} className="menu-item">{a.nome}</MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/** Etiqueta com o peso da tarefa (só aparece quando há peso). */
export function EtiquetaPeso({ peso }: { peso: Peso | null }) {
  if (!peso) return null;
  return <span className={`etiqueta-estado peso peso-${peso}`}>{textos.energia.pesos[peso]}</span>;
}
