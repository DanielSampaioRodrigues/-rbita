import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type PlanoDeCrise } from "../api";
import { useRecado } from "../app/Recado";
import { Aviso, Campo } from "../componentes/Campo";
import { Janela } from "../componentes/Janela";
import { textos } from "../textos/pt-BR";

const t = textos.saude.plano;
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });

const vazio: PlanoDeCrise = { sinais: "", ajuda: "", contatos: "", atualizadoEm: 0 };

export function JanelaPlanoDeCrise({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const [plano, setPlano] = useState<PlanoDeCrise>(vazio);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<PlanoDeCrise>(vazio);
  const [erro, setErro] = useState<string | null>(null);
  const recado = useRecado();

  useEffect(() => {
    if (!aberta) return;
    setEditando(false);
    setErro(null);
    api.planoDeCrise().then(
      (p) => {
        setPlano(p);
        setRascunho(p);
        // Se está tudo vazio, já abre no modo de escrever.
        if (!p.sinais && !p.ajuda && !p.contatos) setEditando(true);
      },
      (e) => setErro(e instanceof Error ? e.message : String(e)),
    );
  }, [aberta]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      const salvo = await api.salvarPlanoDeCrise(rascunho);
      setPlano(salvo);
      setRascunho(salvo);
      setEditando(false);
      recado(t.salvo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  const vazioAgora = !plano.sinais && !plano.ajuda && !plano.contatos;

  return (
    <Janela titulo={t.titulo} aberta={aberta} aoFechar={aoFechar}>
      <p className="texto-suave">{t.intro}</p>

      {editando ? (
        <Form className="formulario" onSubmit={salvar}>
          <Campo rotulo={t.sinais} valor={rascunho.sinais} aoMudar={(v) => setRascunho((p) => ({ ...p, sinais: v }))} multilinha descricao={t.sinaisAjuda} autoFocus />
          <Campo rotulo={t.ajuda} valor={rascunho.ajuda} aoMudar={(v) => setRascunho((p) => ({ ...p, ajuda: v }))} multilinha descricao={t.ajudaAjuda} />
          <Campo rotulo={t.contatos} valor={rascunho.contatos} aoMudar={(v) => setRascunho((p) => ({ ...p, contatos: v }))} multilinha descricao={t.contatosAjuda} />
          <Aviso>{erro}</Aviso>
          <div className="janela-acoes">
            {!vazioAgora && (
              <Button className="botao" onPress={() => { setRascunho(plano); setEditando(false); }}>{textos.comum.cancelar}</Button>
            )}
            <Button className="botao principal" type="submit">{t.salvar}</Button>
          </div>
        </Form>
      ) : vazioAgora ? (
        <>
          <p>{t.vazio}</p>
          <Aviso>{erro}</Aviso>
          <div className="janela-acoes">
            <Button className="botao principal" onPress={() => setEditando(true)}>{t.editar}</Button>
          </div>
        </>
      ) : (
        <>
          <Secao titulo={t.sinais} texto={plano.sinais} />
          <Secao titulo={t.ajuda} texto={plano.ajuda} />
          <Secao titulo={t.contatos} texto={plano.contatos} />
          {plano.atualizadoEm > 0 && <p className="campo-ajuda">{t.atualizadoEm(fmtData.format(plano.atualizadoEm))}</p>}
          <Aviso>{erro}</Aviso>
          <div className="janela-acoes">
            <Button className="botao" onPress={() => setEditando(true)}>{t.editar}</Button>
          </div>
        </>
      )}
    </Janela>
  );
}

function Secao({ titulo, texto }: { titulo: string; texto: string }) {
  if (!texto) return null;
  return (
    <div className="campo">
      <span className="campo-rotulo">{titulo}</span>
      <p className="quebra">{texto}</p>
    </div>
  );
}
