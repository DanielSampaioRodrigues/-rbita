import { Button } from "react-aria-components";
import { api, type RegistroSaude } from "../api";
import { useRecado } from "../app/Recado";
import { avisarMudanca } from "../dados";
import { Trash2 } from "../icones";
import { textos } from "../textos/pt-BR";
import { separarNota } from "./gatilhos";
import { iconeDoTipo } from "./RegistroRapido";
import { COR_TIPO } from "./visao";

const t = textos.saude.registros;
const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Uma linha de registro: hora, tipo com ícone, intensidade, gatilhos e nota, com apagar. */
export function ItemRegistro({ registro: r }: { registro: RegistroSaude }) {
  const recado = useRecado();
  const { gatilhos, texto } = separarNota(r.nota);
  const Icone = iconeDoTipo(r.tipo);
  const nome = t.tipos[r.tipo as keyof typeof t.tipos] ?? r.tipo;

  const apagar = async () => {
    await api.excluirRegistroSaude(r.id);
    avisarMudanca();
    recado(t.excluido);
  };

  return (
    <li className="saude-registro">
      <span className={`saude-registro-icone cor-${COR_TIPO[r.tipo] ?? "cinza"}`} aria-hidden="true">
        <Icone size="1.2em" />
      </span>
      <span className="saude-registro-corpo quebra">
        <span>
          <strong>{nome}</strong>
          {r.intensidade != null && <span className="texto-suave"> · {t.nivel(r.intensidade)}</span>}
          <span className="texto-suave"> · {fmtHora.format(r.momento)}</span>
        </span>
        {gatilhos.length > 0 && (
          <span className="saude-registro-gatilhos">
            {gatilhos.map((g) => <span key={g} className="livro-selo">{g}</span>)}
          </span>
        )}
        {texto && <span>{texto}</span>}
      </span>
      <Button className="botao-icone" onPress={() => void apagar()} aria-label={`${t.excluir}: ${nome}, ${fmtHora.format(r.momento)}`}>
        <Trash2 aria-hidden="true" size="1.1em" />
      </Button>
    </li>
  );
}
