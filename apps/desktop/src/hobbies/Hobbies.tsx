import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { api, type Hobby } from "../api";
import { Aviso, Campo } from "../componentes/Campo";
import { Confirmar, Janela } from "../componentes/Janela";
import { AnexosDoItem } from "../relacoes/Relacoes";
import { Pencil, Plus, Sparkles, Trash2 } from "../icones";
import { avisarMudanca, useMudancas } from "../dados";
import { textos } from "../textos/pt-BR";

const t = textos.hobbies;

export function PaginaHobbies() {
  const [hobbies, setHobbies] = useState<Hobby[]>([]);
  const [editando, setEditando] = useState<Hobby | null>(null);
  const [excluindo, setExcluindo] = useState<Hobby | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mudancas = useMudancas();

  useEffect(() => {
    api.listarHobbies().then(setHobbies, (e) => setErro(e instanceof Error ? e.message : String(e)));
  }, [mudancas]);

  const excluir = async () => {
    if (!excluindo) return;
    await api.excluirHobby(excluindo.id);
    setExcluindo(null);
    avisarMudanca();
  };

  return (
    <div className="pagina">
      <h1>{t.titulo}</h1>
      <p className="pagina-intro">{t.intro}</p>

      <div className="botoes">
        <Button className="botao principal" onPress={() => setEditando({ id: "", nome: "", notas: "", criadoEm: 0 })}>
          <Plus aria-hidden="true" size="1.1em" /> {t.adicionar}
        </Button>
      </div>

      {hobbies.length === 0 ? (
        <section className="cartao largura-leitura esticado"><p className="texto-suave">{t.semHobbies}</p></section>
      ) : (
        hobbies.map((h) => (
          <section key={h.id} className="cartao largura-leitura esticado" aria-labelledby={`hobby-${h.id}`}>
            <div className="linha-ajuste">
              <h2 id={`hobby-${h.id}`}>
                <Sparkles aria-hidden="true" size="1em" /> {h.nome}
              </h2>
              <span className="linha-ajuste">
                <Button className="botao-icone" onPress={() => setEditando(h)} aria-label={`${t.editar}: ${h.nome}`}><Pencil aria-hidden="true" size="1.1em" /></Button>
                <Button className="botao-icone" onPress={() => setExcluindo(h)} aria-label={`${t.excluir}: ${h.nome}`}><Trash2 aria-hidden="true" size="1.1em" /></Button>
              </span>
            </div>
            {h.notas && <p className="quebra">{h.notas}</p>}
            <AnexosDoItem id={h.id} />
          </section>
        ))
      )}

      <Aviso>{erro}</Aviso>

      <Janela titulo={editando && editando.id ? t.form.editarTitulo : t.form.novo} aberta={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && <FormHobby key={editando.id || "novo"} inicial={editando} aoFechar={() => setEditando(null)} />}
      </Janela>

      <Confirmar titulo={t.excluir} texto={excluindo ? t.confirmarExcluir(excluindo.nome) : ""} confirmar={t.excluir} aberta={excluindo !== null} aoCancelar={() => setExcluindo(null)} aoConfirmar={() => void excluir()} />
    </div>
  );
}

function FormHobby({ inicial, aoFechar }: { inicial: Hobby; aoFechar: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [notas, setNotas] = useState(inicial.notas);
  const [erro, setErro] = useState<string | null>(null);
  const editando = inicial.id !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      await api.salvarHobby({ ...inicial, nome, notas });
      avisarMudanca();
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Form className="formulario" onSubmit={enviar}>
      <Campo rotulo={t.form.nome} valor={nome} aoMudar={setNome} autoFocus maximo={120} semDitado />
      <Campo rotulo={t.form.notas} valor={notas} aoMudar={setNotas} multilinha descricao={t.form.notasAjuda} />
      <Aviso>{erro}</Aviso>
      <div className="janela-acoes">
        <Button className="botao" onPress={aoFechar}>{textos.comum.cancelar}</Button>
        <Button className="botao principal" type="submit">{editando ? t.form.salvarMudancas : t.form.salvar}</Button>
      </div>
    </Form>
  );
}
