import { Check, Plus, Trash2 } from "../icones";
import { useState } from "react";
import { Button, Form } from "react-aria-components";
import { chaveDia } from "../agenda/datas";
import { useRecado } from "../app/Recado";
import { ATALHOS } from "../atalhos";
import { Campo } from "../componentes/Campo";
import { Teclas } from "../componentes/Teclas";
import { textos } from "../textos/pt-BR";
import { diaDe, novoId, usarKit } from "./contas";
import { useContas } from "./Contas";

const t = textos.energia.kit;

/**
 * Kit de recuperação sensorial: lista pessoal do que ajuda a baixar a entrada
 * sensorial. "Usar agora" anota o uso, e a sugestão de reposição aprende com isso.
 * `compacto` (modo baixa energia): só a lista com "Usar agora", sem edição; some se o kit estiver vazio.
 */
export function KitSensorial({ compacto }: { compacto?: boolean }) {
  const [dados, mudar] = useContas();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const recado = useRecado();
  const hoje = chaveDia(new Date());
  const usadosHoje = new Set(dados.usosKit.filter((u) => diaDe(u.momento) === hoje).map((u) => u.itemId));
  const vazio = dados.kit.length === 0;
  if (compacto && vazio) return null;

  const adicionar = (texto: string) => {
    const limpo = texto.trim();
    if (!limpo) return;
    if (dados.kit.some((k) => k.nome.toLocaleLowerCase("pt-BR") === limpo.toLocaleLowerCase("pt-BR"))) return;
    mudar((d) => ({ ...d, kit: [...d.kit, { id: novoId(), nome: limpo }] }));
  };
  const ideias = t.ideias.filter((i) => !dados.kit.some((k) => k.nome.toLocaleLowerCase("pt-BR") === i.toLocaleLowerCase("pt-BR")));
  const titulo = compacto ? "kit-titulo-baixa" : "kit-titulo";

  return (
    <section className={compacto ? "cartao energia-kit" : "cartao largura-leitura esticado energia-kit"} aria-labelledby={titulo}>
      <div className="energia-cabeca">
        <h2 id={titulo}>{t.titulo}</h2>
        {!compacto && !vazio && (
          <Button className="botao energia-alvo" onPress={() => setEditando((e) => !e)} aria-expanded={editando}>
            {editando ? t.fecharEdicao : t.editar}
          </Button>
        )}
      </div>
      {!compacto && <p className="campo-ajuda">{t.explicacao}</p>}

      {!vazio && (
        <ul className="lista-simples sem-marcador energia-lista-sinais">
          {dados.kit.map((k) => (
            <li key={k.id} className="energia-linha">
              <span className="energia-linha-nome">
                <span className="quebra">{k.nome}</span>
                {usadosHoje.has(k.id) && (
                  <span className="campo-ajuda energia-ultima">
                    <Check aria-hidden="true" size="1em" className="energia-kit-check" /> {t.usadoHoje}
                  </span>
                )}
              </span>
              {editando ? (
                <Button
                  className="botao-icone energia-alvo"
                  aria-label={t.remover(k.nome)}
                  onPress={() => mudar((d) => ({ ...d, kit: d.kit.filter((x) => x.id !== k.id) }))}
                >
                  <Trash2 aria-hidden="true" size="1.1em" />
                </Button>
              ) : (
                <Button
                  className="botao energia-alvo"
                  aria-label={t.usarFalado(k.nome)}
                  onPress={() => {
                    mudar((d) => usarKit(d, k.id, Date.now()));
                    recado(t.usado(k.nome));
                  }}
                >
                  {t.usar}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!compacto && (editando || vazio) && (
        <div className="energia-edicao">
          {vazio && <p className="texto-suave">{t.vazio}</p>}
          {ideias.length > 0 && (
            <div className="campo">
              <span className="campo-rotulo" id="kit-ideias">{t.ideiasRotulo}</span>
              <ul className="energia-kit-ideias" aria-labelledby="kit-ideias">
                {ideias.map((i) => (
                  <li key={i}>
                    <Button className="botao energia-alvo" aria-label={t.adicionarIdeia(i)} onPress={() => adicionar(i)}>
                      <Plus aria-hidden="true" size="1em" /> {i}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Form
            className="energia-novo-sinal"
            aria-label={t.novo}
            onSubmit={(e) => {
              e.preventDefault();
              adicionar(nome);
              setNome("");
            }}
          >
            <Campo rotulo={t.novo} valor={nome} aoMudar={setNome} maximo={60} />
            <div className="botoes">
              <Button className="botao energia-alvo" type="submit" isDisabled={!nome.trim()}>
                <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
              </Button>
            </div>
          </Form>
        </div>
      )}

      {!compacto && (
        <p className="campo-ajuda energia-kit-estrategias">
          {t.estrategias} <Teclas combinacoes={ATALHOS.find((a) => a.acao === "planoDeCrise")?.teclas ?? []} />
        </p>
      )}
    </section>
  );
}
