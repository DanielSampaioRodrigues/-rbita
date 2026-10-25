import { Check } from "../icones";
import { Input, Label, TextField } from "react-aria-components";
import { QUANTIDADE, reconhecer, separar } from "../palavras";
import { textos } from "../textos/pt-BR";

const t = textos.recuperar;

/** Seis campos numerados. Colar a frase inteira no primeiro preenche todos. */
export function CampoPalavras({ valores, aoMudar }: { valores: string[]; aoMudar: (v: string[]) => void }) {
  const mudar = (i: number, texto: string) => {
    const partes = separar(texto);
    if (partes.length > 1) {
      const novos = [...valores];
      partes.slice(0, QUANTIDADE - i).forEach((p, j) => (novos[i + j] = p));
      aoMudar(novos);
      return;
    }
    const novos = [...valores];
    novos[i] = texto.trim();
    aoMudar(novos);
  };

  return (
    <div className="palavras-grade">
      {valores.map((v, i) => {
        const reconhecida = reconhecer(v);
        return (
          <TextField key={i} className="campo" value={v} onChange={(texto) => mudar(i, texto)} autoFocus={i === 0}>
            <Label className="campo-rotulo">{t.palavra(i + 1)}</Label>
            <Input className="entrada-texto sozinha" spellCheck={false} autoComplete="off" />
            <span className={reconhecida ? "palavra-estado ok" : "palavra-estado"} aria-live="polite">
              {v.length >= 4 &&
                (reconhecida ? (
                  <>
                    <Check aria-hidden="true" size="1em" /> {t.reconhecida(reconhecida)}
                  </>
                ) : (
                  t.naoReconhecida
                ))}
            </span>
          </TextField>
        );
      })}
    </div>
  );
}
